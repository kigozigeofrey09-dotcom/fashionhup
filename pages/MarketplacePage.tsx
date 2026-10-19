import { useDeferredValue, useEffect, useState } from 'react';
import { ArrowDown, Search, ShieldCheck } from 'lucide-react';
import { Link } from 'react-router-dom';
import { EmptyState, ListingCard, Loading, Notice, SeedNotice } from '../components/ui';
import { seedListings, seedShops } from '../data/seed';
import { errorMessage } from '../services/http';
import { accountService } from '../services/accountService';
import { marketplaceService } from '../services/marketplaceService';
import { useAppContext } from '../context/AppContext';
import { demoDataEnabled } from '../config/features';
import type { Listing, Shop } from '../types';
import './marketplace-3d.css';

const categoryOptions = ['All finds', 'Clothing', 'Shoes', 'Bags', 'Jewellery', 'Beauty', 'Tailoring', 'Accessories', 'Other'];

export function MarketplacePage() {
  const { countries } = useAppContext();
  const [query, setQuery] = useState('');
  const deferredQuery = useDeferredValue(query);
  const [category, setCategory] = useState('All finds');
  const [countryCode, setCountryCode] = useState('');
  const [city, setCity] = useState('');
  const [kind, setKind] = useState('all');
  const [sort, setSort] = useState('curated');
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [listings, setListings] = useState<Listing[]>(demoDataEnabled ? seedListings : []);
  const [shops, setShops] = useState<Shop[]>(demoDataEnabled ? seedShops : []);
  const [loading, setLoading] = useState(true);
  const [seedFallback, setSeedFallback] = useState(demoDataEnabled);
  const [apiNotice, setApiNotice] = useState('');
  const [feedback, setFeedback] = useState('');
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    let active = true;
    const params = new URLSearchParams();
    if (countryCode) params.set('country', countryCode);
    if (city.trim()) params.set('city', city.trim());
    if (category !== 'All finds') params.set('category', category);
    if (kind !== 'all') params.set('type', kind);
    if (deferredQuery.trim()) params.set('q', deferredQuery.trim());
    if (sort === 'price-asc') params.set('sort', sort);
    setLoading(true);
    Promise.allSettled([marketplaceService.searchListings(params), marketplaceService.searchShops(params)]).then(([listingResult, shopResult]) => {
      if (!active) return;
      const listingFailed = listingResult.status === 'rejected';
      const shopsFailed = shopResult.status === 'rejected';
      setListings(listingFailed ? (demoDataEnabled ? seedListings : []) : listingResult.value);
      setShops(shopsFailed ? (demoDataEnabled ? seedShops : []) : shopResult.value);
      setSeedFallback(demoDataEnabled && (listingFailed || shopsFailed));
      setApiNotice(listingFailed || shopsFailed ? (demoDataEnabled ? 'Marketplace APIs are not connected. Showing clearly marked development seed data.' : 'Could not reach the live marketplace. Start the backend and try again.') : '');
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [category, countryCode, city, kind, deferredQuery, sort, retryCount]);

  let visible = listings.filter((listing) => {
    const matchCategory = category === 'All finds' || listing.category === category || (category === 'Tailoring' && listing.type === 'service');
    const matchCountry = !countryCode || listing.countryCode === countryCode;
    const matchCity = !city.trim() || listing.city.toLowerCase().includes(city.trim().toLowerCase());
    const matchKind = kind === 'all' || listing.type === kind;
    const term = deferredQuery.trim().toLowerCase();
    const matchQuery = !term || [listing.name, listing.shopName, listing.description, listing.city, listing.countryName, listing.category].join(' ').toLowerCase().includes(term);
    return matchCategory && matchCountry && matchCity && matchKind && matchQuery;
  });
  if (sort === 'price-asc') visible = [...visible].sort((a, b) => a.price - b.price);
  if (sort === 'price-desc') visible = [...visible].sort((a, b) => b.price - a.price);

  const visibleShops = shops.filter((shop) => {
    const term = deferredQuery.trim().toLowerCase();
    const matchCountry = !countryCode || shop.countryCode === countryCode;
    const matchCity = !city.trim() || shop.city.toLowerCase().includes(city.trim().toLowerCase());
    const matchCategory = category === 'All finds' || shop.categories.includes(category as (typeof shop.categories)[number]) || (category === 'Tailoring' && shop.sellType !== 'products');
    const matchKind = kind === 'all' || shop.sellType === 'both' || shop.sellType === `${kind}s`;
    const matchVerified = !verifiedOnly || shop.isVerified;
    const matchQuery = !term || [shop.name, shop.story, shop.tagline, shop.city, shop.countryName, ...shop.categories].join(' ').toLowerCase().includes(term);
    return matchCountry && matchCity && matchCategory && matchKind && matchVerified && matchQuery;
  });

  async function saveListing(listing: Listing) {
    setFeedback('');
    try {
      await accountService.saveListing(listing.id);
      setFeedback('Saved item updated by the account service.');
    } catch (error) {
      setFeedback(errorMessage(error));
    }
  }

  const selectedCountry = countries.find((country) => country.code === countryCode);
  const cities = selectedCountry?.cities ?? [];

  return <>
    <section className="market-hero">
      <div className="market-hero-copy"><p className="eyebrow"><span className="eyebrow-line" />LOCAL FINDS, GOOD FINDS</p><h1>Wear your<br /><em>kind of story.</em></h1><p>Meet independent designers, makers and beauty professionals. Find work made with care, close to home.</p><a href="#discover" className="button button-dark">Explore the edit <ArrowDown size={15} /></a><div className="hero-foot"><span className="hero-dot" />Across Uganda and beyond</div></div>
      <div className="market-hero-art"><img src="https://images.unsplash.com/photo-1539109136881-3be0616acf4b?auto=format&fit=crop&w=1200&q=88" alt="Model wearing a contemporary printed outfit" /><div className="hero-stamp"><span>THE</span><strong>LOCAL<br />EDIT</strong><span>FASHIONHUB</span></div><p>Kampala, with love <span>01 / 04</span></p></div>
    </section>
    <section className="fx-showcase" aria-labelledby="fx-showcase-title">
      <div className="fx-showcase-copy"><p className="eyebrow"><span className="eyebrow-line" />MADE TO BE DISCOVERED</p><h2 id="fx-showcase-title">A world of <em>local finds.</em></h2><p>Explore the colour, craft and character of independent fashion.</p></div>
      <div className="fx-scene" aria-hidden="true"><div className="fx-stage">
        <div className="fx-ring fx-ring-outer">{Array.from({ length: 12 }, (_, index) => <span className="fx-panel fx-panel-outer" style={{ '--fx-angle': `${index * 30}deg` } as React.CSSProperties} key={`outer-${index}`}><i /></span>)}</div>
        <div className="fx-ring fx-ring-inner">{Array.from({ length: 8 }, (_, index) => <span className="fx-panel fx-panel-inner" style={{ '--fx-angle': `${index * 45}deg` } as React.CSSProperties} key={`inner-${index}`}><i /></span>)}</div>
        <div className="fx-sphere"><i className="fx-sphere-circle fx-sphere-circle-one" /><i className="fx-sphere-circle fx-sphere-circle-two" /><i className="fx-sphere-circle fx-sphere-circle-three" /><b /></div>
      </div></div>
      <div className="fx-category-window" aria-hidden="true"><div className="fx-category-track">{['Clothing', 'Shoes', 'Bags', 'Jewellery', 'Beauty', 'Tailoring', 'Accessories', 'Clothing', 'Shoes', 'Bags', 'Jewellery', 'Beauty', 'Tailoring', 'Accessories'].map((name, index) => <span key={`${name}-${index}`}>{name}<i>✳</i></span>)}</div></div>
    </section>
    <section id="discover" className="discover-section">
      <div className="section-heading"><div><p className="eyebrow">THE MARKETPLACE</p><h2>A little something <em>for you.</em></h2></div><label className="search-box"><Search size={18} /><input value={query} onChange={(event) => setQuery(event.target.value)} type="search" placeholder="Search pieces, makers, places" aria-label="Search listings" /><kbd>↵</kbd></label></div>
      <div className="filter-row" aria-label="Filter by category">{categoryOptions.map((item) => <button key={item} className={`filter-chip ${category === item ? 'is-selected' : ''}`} onClick={() => setCategory(item)}>{item}</button>)}</div>
      <div className="discovery-filters">
        <label>Country<select value={countryCode} onChange={(event) => setCountryCode(event.target.value)}><option value="">All countries</option>{countries.map((country) => <option value={country.code} key={country.code}>{country.name} · {country.currency}</option>)}</select></label>
        <label>City{cities.length ? <select value={city} onChange={(event) => setCity(event.target.value)}><option value="">Any city</option>{cities.map((item) => <option key={item}>{item}</option>)}</select> : <input value={city} onChange={(event) => setCity(event.target.value)} placeholder="Any city" />}</label>
        <label>Listing type<select value={kind} onChange={(event) => setKind(event.target.value)}><option value="all">Products & services</option><option value="product">Products</option><option value="service">Services</option></select></label>
        <label>Sort order<select value={sort} onChange={(event) => setSort(event.target.value)}><option value="curated">Curated for you</option><option value="price-asc">Price: Low to High</option><option value="price-desc">Price: High to Low</option></select></label>
        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', paddingTop: '1.25rem' }}>
          <input type="checkbox" checked={verifiedOnly} onChange={(e) => setVerifiedOnly(e.target.checked)} />
          <span>Verified Blue Tick ✓</span>
        </label>
      </div>
      {seedFallback && <SeedNotice />}{apiNotice && <Notice tone={demoDataEnabled ? 'warning' : 'error'}>{apiNotice}{!demoDataEnabled && <button className="text-button" onClick={() => setRetryCount((count) => count + 1)}>Retry live marketplace</button>}</Notice>}{feedback && <Notice tone="info">{feedback}</Notice>}
      <div className="results-meta"><span>{loading ? 'Refreshing catalog…' : `${visible.length} ${visible.length === 1 ? 'find' : 'finds'} to explore`}</span><Link to="/seller/setup">Have something good? Open your shop <span aria-hidden="true">↗</span></Link></div>
      {loading && <Loading label="Checking the marketplace service…" />}
      {visible.length > 0 ? <div className="product-grid">{visible.map((listing) => <ListingCard key={listing.id} listing={listing} onSave={saveListing} />)}</div> : !loading && <div className="empty-state"><span className="empty-mark">✳</span><h2>No finds just yet</h2><p>Try a different search, country, city or category.</p><button className="button button-outline" onClick={() => { setQuery(''); setCategory('All finds'); setCountryCode(''); setCity(''); setKind('all'); setVerifiedOnly(false); }}>Clear all filters</button></div>}
      <div className="section-heading compact"><div><p className="eyebrow">MAKERS & STUDIOS</p><h2>Find a <em>shop.</em></h2></div></div>
      {visibleShops.length ? <div className="shop-grid">{visibleShops.map((shop) => <article className="shop-card" key={shop.id}><span className="shop-initial" style={{ '--shop-accent': shop.accent } as React.CSSProperties}>{shop.name.slice(0, 1)}</span><p className="eyebrow">{shop.countryCode} · {shop.city}</p><h3>{shop.name} {shop.isVerified && <span style={{ color: '#1d9bf0' }} title="Verified Storefront">✓</span>}</h3><p>{shop.tagline}</p><div className="preview-collections">{shop.categories.map((item) => <span key={item}>{item}</span>)}</div><Link to={`/shops/${shop.id}`}>Visit storefront <span>↗</span></Link>{shop.isSeed && <small>Sample shop</small>}</article>)}</div> : !loading && <EmptyState title="No shops match these filters">Try widening the country, city, category or listing type filters.</EmptyState>}
    </section>
    <section className="maker-band"><span className="maker-icon">✳</span><div><p className="eyebrow">YOUR CRAFT, YOUR CORNER</p><h2>Have something <em>good?</em></h2></div><p>Build a storefront that feels like you, then connect it to the FashionHub marketplace.</p><Link className="button button-outline" to="/seller/setup">Start your shop <span>↗</span></Link></section>
  </>;
}
