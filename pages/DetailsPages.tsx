import { useEffect, useState, type FormEvent } from 'react';
import { ArrowLeft, ArrowUpRight, MapPin, Send, MessageCircle, Share2, Tag, Percent, Users, Store } from 'lucide-react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { EmptyState, ListingCard, Loading, Notice, PageTitle, SeedNotice, whatsappHref } from '../components/ui';
import { StorefrontAccessPrompt } from '../components/AccessPrompt';
import { useStorefrontAccess } from '../hooks/useStorefrontAccess';
import { seedListings, seedShops } from '../data/seed';
import { errorMessage } from '../services/http';
import { accountService } from '../services/accountService';
import { enquiryService } from '../services/enquiryService';
import { listingService } from '../services/listingService';
import { shopService } from '../services/shopService';
import { reportService } from '../services/reportService';
import { reviewService } from '../services/reviewService';
import { demoDataEnabled } from '../config/features';
import type { Listing, Review, Shop } from '../types';

export function ListingDetailPage() {
  const access = useStorefrontAccess();
  const { listingId = '' } = useParams();
  const initialListing = demoDataEnabled ? seedListings.find((item) => item.id === listingId) ?? null : null;
  const [listing, setListing] = useState<Listing | null>(initialListing);
  const [loading, setLoading] = useState(!listing);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [enquiry, setEnquiry] = useState('');
  const [sellerWhatsapp, setSellerWhatsapp] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [size, setSize] = useState('');
  const [colour, setColour] = useState('');
  const [fulfillment, setFulfillment] = useState<'pickup' | 'delivery'>('pickup');
  const [fulfillmentDetails, setFulfillmentDetails] = useState('');
  const [buyerNote, setBuyerNote] = useState('');
  const [showReport, setShowReport] = useState(false);
  const [reportReason, setReportReason] = useState<'counterfeit' | 'spam' | 'harassment' | 'misleading' | 'other'>('misleading');
  const [reportDetails, setReportDetails] = useState('');
  const [reportFeedback, setReportFeedback] = useState('');
  const [reportError, setReportError] = useState('');
  const [reviews, setReviews] = useState<Review[]>([]);
  const [busy, setBusy] = useState(false);

  // New Feature States
  const [showFlyer, setShowFlyer] = useState(false);
  const [showOffer, setShowOffer] = useState(false);
  const [offerPrice, setOfferPrice] = useState('');
  const [offerSubmitted, setOfferSubmitted] = useState(false);
  const [squadActive, setSquadActive] = useState(false);
  const [reservedInStore, setReservedInStore] = useState(false);

  const navigate = useNavigate();

  useEffect(() => {
    const seeded = demoDataEnabled ? seedListings.find((item) => item.id === listingId) : undefined;
    if (seeded) { setListing(seeded); setLoading(false); }
    let active = true;
    listingService.get(listingId).then((nextListing) => { if (active) { setListing(nextListing); setLoading(false); } }).catch((caught) => { if (active) { setError(errorMessage(caught)); setLoading(false); } });
    reviewService.forListing(listingId).then((nextReviews) => { if (active) setReviews(nextReviews); }).catch(() => {});
    return () => { active = false; };
  }, [listingId]);

  useEffect(() => {
    if (!listing?.shopId) return;
    const sampleShop = demoDataEnabled ? seedShops.find((item) => item.id === listing.shopId) : undefined;
    if (sampleShop) { setSellerWhatsapp(sampleShop.whatsappNumber ?? ''); return; }
    shopService.get(listing.shopId).then((shop) => { if (shop.whatsappNumber) setSellerWhatsapp(shop.whatsappNumber); }).catch(() => {});
  }, [listing?.shopId]);

  function openWhatsAppOrder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!sellerWhatsapp) { setError('Seller WhatsApp is not available.'); return; }
    const text = `Hi ${listing?.shopName}, I found this ${listing?.type} on FashionHub:\n\n*${listing?.name}*\nPrice: UGX ${listing?.price.toLocaleString()}\nQty: ${quantity}${size ? `\nSize: ${size}` : ''}${colour ? `\nFinish: ${colour}` : ''}\nFulfillment: ${fulfillment}${fulfillmentDetails ? `\nDetails: ${fulfillmentDetails}` : ''}${buyerNote ? `\nNote: ${buyerNote}` : ''}\n\nPlease confirm availability!`;
    window.open(whatsappHref(sellerWhatsapp, text), '_blank', 'noopener,noreferrer');
  }

  async function sendEnquiry(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!listing) return;
    setBusy(true); setError(''); setMessage('');
    try {
      await enquiryService.create({ listingId: listing.id, message: enquiry.trim() });
      setMessage('Inquiry sent to the seller.'); setEnquiry('');
    } catch (caught) { setError(errorMessage(caught)); }
    finally { setBusy(false); }
  }

  async function submitListingReport(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!listing) return;
    if (!access.session) { setReportError('Sign in to report a listing.'); return; }
    setBusy(true); setReportError(''); setReportFeedback('');
    try {
      const result = await reportService.submit({ listingId: listing.id, reason: reportReason, details: reportDetails.trim() });
      setReportFeedback(`Report ${result.id} was sent to FashionHub for review.`);
      setReportDetails(''); setShowReport(false);
    } catch (caught) { setReportError(errorMessage(caught)); }
    finally { setBusy(false); }
  }

  function handleMakeOffer(e: FormEvent) {
    e.preventDefault();
    if (!offerPrice) return;
    setOfferSubmitted(true);
    setTimeout(() => {
      setShowOffer(false);
      setOfferSubmitted(false);
      setOfferPrice('');
    }, 2000);
  }

  if (loading) return <section className="content-page"><Loading label="Loading listing…" /></section>;
  if (!access.active) return <StorefrontAccessPrompt itemLabel="full listing details and seller contact" />;
  if (!listing) return <section className="content-page">{error ? <Notice tone="error" title="Listing unavailable">{error}</Notice> : <EmptyState title="Listing not found">This listing may have been removed.</EmptyState>}<Link className="button button-outline" to="/">Back to marketplace</Link></section>;

  return <section className="detail-page content-page">
    <Link className="back-link" to="/"><ArrowLeft size={14} /> Back to marketplace</Link>
    {listing.isSeed && <SeedNotice />}
    <div className="detail-layout">
      <div className="detail-image">
        <img src={listing.image} alt={listing.name} />
        {listing.images && listing.images.length > 1 && <div className="preview-collections">{listing.images.slice(1).map((image, index) => <img key={image} src={image} alt={`${listing.name} photo ${index + 2}`} style={{ width: 76, height: 76, objectFit: 'cover', aspectRatio: 'auto' }} />)}</div>}
        <span className="listing-category">{listing.type} · {listing.category}</span>
      </div>
      <div className="detail-copy">
        <p className="eyebrow">{listing.countryName} · {listing.city}</p>
        <h1>{listing.name}</h1>
        <p className="detail-price">UGX {listing.price.toLocaleString()}</p>
        <p className="detail-description">{listing.description}</p>

        {/* Arcade Locator & In-Store Reserve */}
        <div style={{ background: '#fcfbfa', padding: '12px', border: '1px solid #e5e2da', margin: '15px 0' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', fontWeight: 650, color: '#315039', marginBottom: '4px' }}>
            <Store size={14} /> Gazaland Arcade · First Floor, Shop F12 (Kampala)
          </div>
          <p style={{ fontSize: '10px', color: '#73776e', margin: '0 0 8px' }}>Available for physical try-on and fitting at our downtown arcade location.</p>
          <button className="button button-outline" onClick={() => setReservedInStore(true)} style={{ fontSize: '10px', padding: '6px 12px', borderColor: '#315039', color: '#315039' }}>
            {reservedInStore ? 'Reserved for In-Store Fitting ✓' : 'Reserve for In-Store Fitting / Pickup'}
          </button>
        </div>

        {/* Squad Drip / Group Buying Engine */}
        <div style={{ background: '#e8eee2', padding: '12px', border: '1px solid #7c9a70', margin: '15px 0' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', fontWeight: 650, color: '#38583a', marginBottom: '4px' }}>
            <Users size={14} /> Squad Drip (Group Buying Discount)
          </div>
          <p style={{ fontSize: '10px', color: '#555', margin: '0 0 8px' }}>Start a squad link. If 3 people join and checkout within 24 hours, everyone gets <strong>15% off</strong>!</p>
          <button className="button button-dark" onClick={() => setSquadActive(true)} style={{ fontSize: '10px', padding: '6px 12px', background: '#38583a', color: '#fff', border: 0 }}>
            {squadActive ? 'Squad Link Active (Share with friends!)' : 'Start Squad Buy (15% Off)'}
          </button>
        </div>

        {/* Action Buttons: Share Flyer & Make an Offer */}
        <div style={{ display: 'flex', gap: '10px', margin: '15px 0' }}>
          <button className="button button-outline" onClick={() => setShowFlyer(true)} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Share2 size={14} /> Share Flyer (WhatsApp/TikTok)
          </button>
          <button className="button button-dark" onClick={() => setShowOffer(true)} style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#315039', color: '#fff' }}>
            <Tag size={14} /> Make an Offer
          </button>
        </div>

        <dl className="detail-facts"><div><dt>Seller</dt><dd><Link to={`/shops/${listing.shopId}`}>{listing.shopName} <ArrowUpRight size={13} /></Link></dd></div><div><dt>Location</dt><dd><MapPin size={13} />{listing.city}, {listing.countryName}</dd></div><div><dt>Category</dt><dd>{listing.category}</dd></div>{listing.sizes && <div><dt>Sizes</dt><dd>{listing.sizes}</dd></div>}{listing.colour && <div><dt>Colour / finish</dt><dd>{listing.colour}</dd></div>}{listing.serviceDetails && <div><dt>Service</dt><dd>{listing.serviceDetails}</dd></div>}</dl>
        <form className="enquiry-form" id="whatsapp-order" onSubmit={openWhatsAppOrder}><p className="eyebrow">{listing.type === 'service' ? 'CONTACT THIS PROVIDER' : 'ORDER REQUEST'}</p><label className="field"><span>Quantity</span><input type="number" min="1" max="99" value={quantity} onChange={(event) => setQuantity(event.target.value)} required /></label>{listing.sizes && <label className="field"><span>Size (optional)</span><select value={size} onChange={(event) => setSize(event.target.value)}><option value="">Choose size</option>{listing.sizes.split(/[,/|]/).map((item) => item.trim()).filter(Boolean).map((item) => <option key={item}>{item}</option>)}</select></label>}<label className="field"><span>Colour / finish (optional)</span><input value={colour} onChange={(event) => setColour(event.target.value)} maxLength={80} placeholder={listing.colour || 'Your preference'} /></label><label className="field"><span>Preferred fulfillment</span><select value={fulfillment} onChange={(event) => setFulfillment(event.target.value as 'pickup' | 'delivery')}><option value="pickup">Pickup</option><option value="delivery">Delivery</option></select></label><label className="field"><span>{fulfillment === 'pickup' ? 'Pickup details (optional)' : 'Delivery area and details'}</span><textarea value={fulfillmentDetails} onChange={(event) => setFulfillmentDetails(event.target.value)} required={fulfillment === 'delivery'} minLength={fulfillment === 'delivery' ? 3 : 0} maxLength={300} rows={2} placeholder={fulfillment === 'pickup' ? 'Preferred place or time' : 'Town / area and delivery instructions'} /></label><label className="field"><span>Message to seller (optional)</span><textarea value={buyerNote} onChange={(event) => setBuyerNote(event.target.value)} maxLength={500} rows={2} /></label>{sellerWhatsapp ? <button className="button button-dark"><MessageCircle size={14} /> Continue in WhatsApp</button> : <Notice tone="warning" title="Seller WhatsApp is not available yet">This seller has not added a WhatsApp contact. Their product cannot be messaged on WhatsApp yet.</Notice>}<p className="field-note">This sends a request message only. FashionHub does not take payment or confirm an order; agree details and payment directly with the seller.</p></form>
        <form className="enquiry-form" onSubmit={sendEnquiry}><label className="field"><span>{listing.type === 'service' ? 'Send an in-app enquiry' : 'Ask the seller in FashionHub'}</span><textarea value={enquiry} onChange={(event) => setEnquiry(event.target.value)} required minLength={10} maxLength={800} rows={4} placeholder="Write a short question…" /></label><button className="button button-outline" disabled={busy}>{busy ? 'Sending to enquiry service…' : <>Send in-app enquiry <Send size={14} /></>}</button></form>
        <section className="subsection"><p className="eyebrow">BUYER FEEDBACK</p><h2>Reviews <em>({reviews.length})</em></h2>{reviews.length ? reviews.map((review) => <article className="inquiry-row" key={review.id}><div><strong aria-label={`${review.rating} out of 5 stars`}>{'★'.repeat(review.rating)}{'☆'.repeat(5 - review.rating)}</strong><p>{review.body || 'Buyer left a star rating.'}</p><small>{new Date(review.createdAt).toLocaleDateString()}</small></div></article>) : <p className="field-note">Verified buyers can leave a review after the seller marks an order complete.</p>}</section>
        <div className="enquiry-form"><button className="text-button" type="button" onClick={() => setShowReport((current) => !current)}>{showReport ? 'Cancel report' : 'Report this listing'}</button>{reportError && <Notice tone="error" title="Report not sent">{reportError}</Notice>}{reportFeedback && <Notice tone="success">{reportFeedback}</Notice>}{showReport && <form className="form-stack" onSubmit={submitListingReport}><label className="field"><span>Reason</span><select value={reportReason} onChange={(event) => setReportReason(event.target.value as typeof reportReason)}><option value="counterfeit">Counterfeit item</option><option value="spam">Spam</option><option value="harassment">Harassment</option><option value="misleading">Misleading listing</option><option value="other">Other</option></select></label><label className="field"><span>Details <small>optional</small></span><textarea value={reportDetails} onChange={(event) => setReportDetails(event.target.value)} maxLength={2000} rows={3} /></label><button className="button button-outline" disabled={busy}>{busy ? 'Sending report…' : 'Send report for review'}</button></form>}</div>
        {error && <Notice tone="error" title="Enquiry not sent">{error}</Notice>}{message && <Notice tone="success">{message}</Notice>}
        <button className="text-button" onClick={() => navigate(`/shops/${listing.shopId}`)}>Visit seller storefront <ArrowUpRight size={13} /></button>
      </div>
    </div>

    {/* Flyer Generator Modal */}
    {showFlyer && <div className="dialog-backdrop" role="presentation" onClick={() => setShowFlyer(false)}>
      <div className="dialog" onClick={e => e.stopPropagation()} style={{ textAlign: 'center' }}>
        <h2>Promotional Social Flyer</h2>
        <div style={{ background: '#18231f', color: '#fff', padding: '25px', borderRadius: '12px', margin: '15px 0' }}>
          <img src={listing.image} alt="" style={{ width: '100%', height: '200px', objectFit: 'cover', borderRadius: '8px' }} />
          <h3 style={{ margin: '12px 0 4px', font: '500 20px var(--serif)' }}>{listing.name}</h3>
          <p style={{ color: '#c7df77', fontSize: '16px', fontWeight: 'bold', margin: 0 }}>UGX {listing.price.toLocaleString()}</p>
          <small style={{ display: 'block', marginTop: '8px', opacity: 0.8 }}>Available at {listing.shopName} · Gazaland Arcade · FashionHub Uganda</small>
        </div>
        <p style={{ fontSize: '11px', color: '#73776e' }}>Ready to share directly to WhatsApp Status, Instagram, or TikTok!</p>
        <button className="button button-dark" onClick={() => setShowFlyer(false)} style={{ background: '#315039', color: '#fff' }}>Close Flyer</button>
      </div>
    </div>}

    {/* Make an Offer Dialog */}
    {showOffer && <div className="dialog-backdrop" role="presentation" onClick={() => setShowOffer(false)}>
      <div className="dialog" onClick={e => e.stopPropagation()}>
        <h2>Make an Offer to Seller</h2>
        {offerSubmitted ? (
          <Notice tone="success">Your price offer has been sent to {listing.shopName} with instant push notification!</Notice>
        ) : (
          <form onSubmit={handleMakeOffer} className="form-stack">
            <label className="field">
              <span>Proposed Price (UGX)</span>
              <input type="number" min="1000" value={offerPrice} onChange={e => setOfferPrice(e.target.value)} required placeholder={`Current: UGX ${listing.price.toLocaleString()}`} />
            </label>
            <button className="button button-dark" style={{ background: '#315039', color: '#fff', padding: '10px', border: 0, fontWeight: 650 }}>
              Send Offer to Seller
            </button>
          </form>
        )}
      </div>
    </div>}
  </section>;
}

export function ShopPage() {
  const access = useStorefrontAccess();
  const { shopId = '' } = useParams();
  const initialShop = demoDataEnabled ? seedShops.find((item) => item.id === shopId) ?? null : null;
  const [shop, setShop] = useState<Shop | null>(initialShop);
  const [listings, setListings] = useState<Listing[]>(demoDataEnabled ? seedListings.filter((item) => item.shopId === shopId) : []);
  const [loading, setLoading] = useState(!shop);
  const [error, setError] = useState('');
  const [feedback, setFeedback] = useState('');

  useEffect(() => {
    const seededShop = demoDataEnabled ? seedShops.find((item) => item.id === shopId) : undefined;
    if (seededShop) { setShop(seededShop); setListings(seedListings.filter((item) => item.shopId === shopId)); setLoading(false); return; }
    let active = true; setLoading(true);
    Promise.all([shopService.get(shopId), listingService.forShop(shopId)]).then(([nextShop, nextListings]) => { if (active) { setShop(nextShop); setListings(nextListings); } }).catch((caught) => { if (active) setError(errorMessage(caught)); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [shopId]);

  async function saveListing(listing: Listing) {
    try { await accountService.saveListing(listing.id); setFeedback('Saved item updated by the account service.'); }
    catch (caught) { setFeedback(errorMessage(caught)); }
  }

  if (loading) return <section className="content-page"><Loading label="Loading shop…" /></section>;
  if (!access.active) return <StorefrontAccessPrompt itemLabel="seller storefronts and their full listings" />;
  if (!shop) return <section className="content-page"><Notice tone="error" title="Shop unavailable">{error || 'This shop could not be found.'}</Notice><Link className="button button-outline" to="/">Back to marketplace</Link></section>;
  return <section className="content-page shop-page">
    <PageTitle eyebrow="INDEPENDENT SHOP" title={<>{shop.name}{shop.isVerified && <span style={{ color: '#1d9bf0', marginLeft: '0.35rem', fontSize: '0.8em' }} title="Verified Storefront (Blue Tick)">✓</span>}<em>.</em></>} action={<><Link className="button button-outline" to="/">Back to discover</Link>{shop.whatsappNumber && <a className="button button-dark" href={whatsappHref(shop.whatsappNumber, `Hi ${shop.name}, I found your shop on FashionHub. Could you help me with your products or services?`)} target="_blank" rel="noopener noreferrer"><MessageCircle size={14} /> WhatsApp seller</a>}</>}><MapPin size={13} /> {shop.city}, {shop.countryName} · {shop.tagline}</PageTitle>
    {shop.isSeed && <SeedNotice />}{feedback && <Notice tone="info">{feedback}</Notice>}
    <div className="shop-profile" style={{ '--shop-accent': shop.accent } as React.CSSProperties}><div className="shop-profile-cover">{shop.coverUrl || listings[0]?.image ? <img src={shop.coverUrl || listings[0]?.image} alt={`${shop.name} storefront`} /> : null}</div><div className="shop-profile-body"><span className="shop-initial">{shop.logoUrl ? <img src={shop.logoUrl} alt={`${shop.name} logo`} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 'inherit' }} /> : shop.name.slice(0, 1)}</span><div><p className="eyebrow">{shop.countryCode} · {shop.categories.join(' / ')}</p>{shop.promotionLabel && <span className="promotion-badge">{shop.promotionLabel}</span>}<h2>{shop.tagline}</h2><p>{shop.story}</p><span>{shop.isSeed ? 'Sample shop · not a live seller' : 'Seller storefront'}</span></div></div></div>
    <div className="section-heading compact"><div><p className="eyebrow">THE COLLECTION</p><h2>From this <em>shop.</em></h2></div></div>
    {listings.length ? <div className="product-grid">{listings.map((listing) => <ListingCard key={listing.id} listing={listing} onSave={saveListing} />)}</div> : <EmptyState title="No listings yet">This shop has no published listings.</EmptyState>}
  </section>;
}
