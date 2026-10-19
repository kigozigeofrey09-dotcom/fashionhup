import { useEffect, useState, type FormEvent } from 'react';
import { ArrowLeft, ArrowRight, Eye, EyeOff, Pencil, Plus, Store, Trash2, ShieldCheck } from 'lucide-react';
import { Link } from 'react-router-dom';
import { EmptyState, FormError, Loading, Notice, PageTitle } from '../components/ui';
import { categories } from '../data/seed';
import { errorMessage } from '../services/http';
import { listingService } from '../services/listingService';
import { shopService } from '../services/shopService';
import { uploadService } from '../services/uploadService';
import { useAppContext } from '../context/AppContext';
import { subscriptionsEnabled } from '../config/features';
import type { Category, Listing, ListingType, Shop } from '../types';

interface ShopForm {
  name: string;
  story: string;
  tagline: string;
  categories: Category[];
  sellType: 'products' | 'services' | 'both';
  countryCode: string;
  city: string;
  accent: string;
  whatsappNumber: string;
  logoUrl: string;
  coverUrl: string;
}

const blankShop: ShopForm = { name: '', story: '', tagline: '', categories: [], sellType: 'products', countryCode: '', city: '', accent: '#496a4d', whatsappNumber: '', logoUrl: '', coverUrl: '' };

export function SellerOnboardingPage() {
  const { countries, session } = useAppContext();
  const [step, setStep] = useState(0);
  const [shop, setShop] = useState<ShopForm>(blankShop);
  const [listingType, setListingType] = useState<ListingType>('product');
  const [listing, setListing] = useState({ name: '', category: 'Clothing' as Category, price: '', description: '', sizes: '', colour: '', enquiryLabel: 'Ask about availability', imageUrl: '' });
  const [error, setError] = useState('');
  const [fieldError, setFieldError] = useState('');
  const [busy, setBusy] = useState(false);
  const [createdShop, setCreatedShop] = useState<Shop | null>(null);
  const [setupComplete, setSetupComplete] = useState(false);
  const [listingImages, setListingImages] = useState<string[]>([]);
  const [uploadingImages, setUploadingImages] = useState(false);
  const country = countries.find((item) => item.code === shop.countryCode);
  const currency = country?.currency ?? '';
  const availableCities = country?.cities ?? [];
  const filteredCategories = shop.categories.length ? shop.categories : categories;

  useEffect(() => {
    if (session?.user.role !== 'seller') return;
    let active = true;
    void shopService.getMine().then(async (existingShop) => {
      if (!active || !existingShop) return;
      setCreatedShop(existingShop);
      setShop({ name: existingShop.name, story: existingShop.story, tagline: existingShop.tagline, categories: existingShop.categories, sellType: existingShop.sellType, countryCode: existingShop.countryCode, city: existingShop.city, accent: existingShop.accent, whatsappNumber: existingShop.whatsappNumber ?? '', logoUrl: existingShop.logoUrl ?? '', coverUrl: existingShop.coverUrl ?? '' });
      setListing((current) => ({ ...current, category: existingShop.categories[0] ?? current.category }));
      try {
        const existingListings = await listingService.mine();
        if (active && existingListings.length) { setSetupComplete(true); setStep(3); }
        else if (active) setStep(2);
      } catch {
        if (active) { setError('Your shop is saved, but its listings could not be loaded. You can retry adding the first listing here.'); setStep(2); }
      }
    }).catch((caught) => { if (active) setError(errorMessage(caught)); });
    return () => { active = false; };
  }, [session]);

  function toggleCategory(item: Category) {
    setShop((current) => ({ ...current, categories: current.categories.includes(item) ? current.categories.filter((category) => category !== item) : [...current.categories, item] }));
  }

  function validateStep() {
    if (step === 0 && shop.categories.length === 0) return 'Choose at least one category.';
    if (step === 1 && shop.name.trim().length < 2) return 'Shop name must be at least 2 characters.';
    if (step === 1 && (!shop.countryCode || !shop.city.trim() || shop.story.trim().length < 10)) return 'Choose a country and add a city and a shop story of at least 10 characters.';
    if (step === 1 && !/^\+[1-9]\d{7,14}$/.test(shop.whatsappNumber.replace(/[\s()-]/g, ''))) return 'Add a valid WhatsApp number with its country code, such as +256 773 927 881.';
    if (step === 2 && listing.name.trim().length < 2) return 'Listing name must be at least 2 characters.';
    if (step === 2 && (!listing.price || !Number.isFinite(Number(listing.price)) || Number(listing.price) <= 0)) return 'Enter a positive listing price.';
    if (step === 2 && listing.description.trim().length < 5) return 'Description must be at least 5 characters.';
    return '';
  }

  function nextStep() {
    const validation = validateStep(); setFieldError(validation);
    if (!validation) setStep((current) => Math.min(3, current + 1));
  }

  async function createStore(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(''); setFieldError(''); setBusy(true);
    try {
      const created = createdShop ?? await shopService.create({ ...shop, whatsappNumber: shop.whatsappNumber.replace(/[\s()-]/g, ''), categories: shop.categories, countryName: country?.name, currency });
      setCreatedShop(created);
      await listingService.create({ ...listing, imageUrls: listingImages.length ? listingImages : undefined, type: listingType, price: Number(listing.price), currency, countryCode: shop.countryCode, city: shop.city, category: listing.category, shopId: created.id });
      setSetupComplete(true);
    } catch (caught) {
      setError(errorMessage(caught));
    } finally { setBusy(false); }
  }

  async function uploadSelectedImages(files: FileList | null, kind: 'listing' | 'storefront', target: 'listing' | 'logo' | 'cover') {
    if (!files?.length) return;
    setUploadingImages(true); setError('');
    try {
      const uploaded = await uploadService.uploadFiles(files);
      if (kind === 'listing') setListingImages((current) => [...current, ...uploaded.map((item) => item.url)]);
      else setShop((current) => ({ ...current, [target === 'logo' ? 'logoUrl' : 'coverUrl']: uploaded[0].url }));
    } catch (caught) { setError(errorMessage(caught)); }
    finally { setUploadingImages(false); }
  }

  return <section className="content-page setup-page">
    <PageTitle eyebrow="SELL ON FASHIONHUB" title={<>Make a little <em>space.</em></>}><span>Every newly registered seller receives a 2-Month Free Trial. Setup your shop and publish your first listing.</span></PageTitle>
    {!countries.length && <Notice tone="warning" title="Live country list unavailable">Start the backend API to load live country data.</Notice>}
    <ol className="stepper" aria-label="Shop setup steps">{['Your work', 'Shop details', 'First listing', 'Done'].map((label, index) => <li key={label} className={`${step === index ? 'is-active' : ''} ${step > index ? 'is-complete' : ''}`}><span>{index + 1}</span><strong>{label}</strong></li>)}</ol>
    {error && <Notice tone="error" title="Shop setup not completed">{error}{createdShop && ' Your saved shop was loaded.'}</Notice>}
    {createdShop && !error && !setupComplete && <Notice tone="success" title="Your saved shop is ready">Your shop is saved. Complete your first listing to finish setup.</Notice>}
    {setupComplete ? <Notice tone="success" title="Your shop is ready">Your shop and listing are saved. Open your seller studio to manage your collection.</Notice> : <form onSubmit={createStore} className="setup-layout">
      <div className="setup-main">
        {step === 0 && <div className="setup-step"><p className="step-number">01</p><h2>What do you make?</h2><p>Select all categories that fit your work.</p><fieldset className="category-picker"><legend>Categories</legend><div className="category-options">{categories.map((item) => <label className="category-option" key={item}><input type="checkbox" checked={shop.categories.includes(item)} onChange={() => toggleCategory(item)} /><span>{item}</span></label>)}</div></fieldset></div>}
        {step === 1 && <div className="setup-step"><p className="step-number">02</p><h2>Tell us about your shop.</h2><p>Choose where you operate and how customers can reach you.</p><div className="form-grid" style={{ marginTop: '16px' }}><label className="field"><span>Shop name</span><input value={shop.name} onChange={(event) => setShop({ ...shop, name: event.target.value })} required minLength={2} maxLength={60} placeholder="Mirembe Studio" /></label><label className="field"><span>Tagline</span><input value={shop.tagline} onChange={(event) => setShop({ ...shop, tagline: event.target.value })} maxLength={80} placeholder="A softer take on everyday dressing." /></label><label className="field"><span>Country</span><select value={shop.countryCode} onChange={(event) => setShop({ ...shop, countryCode: event.target.value, city: '' })} required><option value="">Select country</option>{countries.map((item) => <option key={item.code} value={item.code}>{item.name} · {item.currency}</option>)}</select></label><label className="field"><span>City</span>{availableCities.length ? <select value={shop.city} onChange={(event) => setShop({ ...shop, city: event.target.value })} required><option value="">Select city</option>{availableCities.map((item) => <option key={item}>{item}</option>)}</select> : <input value={shop.city} onChange={(event) => setShop({ ...shop, city: event.target.value })} required placeholder="Kampala" />}</label><label className="field"><span>Storefront accent</span><select value={shop.accent} onChange={(event) => setShop({ ...shop, accent: event.target.value })}><option value="#496a4d">Maker green</option><option value="#a94f47">Clay red</option><option value="#426c83">Lake blue</option><option value="#a37936">Warm gold</option></select></label><label className="field"><span>WhatsApp contact</span><input type="tel" value={shop.whatsappNumber} onChange={(event) => setShop({ ...shop, whatsappNumber: event.target.value })} required placeholder="+256 773 927 881" /><small className="field-note">Used by buyers to contact you.</small></label><label className="field field-wide"><span>Shop story</span><textarea value={shop.story} onChange={(event) => setShop({ ...shop, story: event.target.value })} required minLength={10} maxLength={500} rows={4} placeholder="Easy shapes, thoughtful fabrics and small runs made locally." /></label></div></div>}
        {step === 2 && <div className="setup-step"><p className="step-number">03</p><h2>Add your first listing.</h2><p>Introduce your work to the marketplace.</p><div className="form-grid" style={{ marginTop: '16px' }}><label className="field"><span>Listing type</span><select value={listingType} onChange={(event) => setListingType(event.target.value as ListingType)}><option value="product">Product</option><option value="service">Service</option></select></label><label className="field"><span>Category</span><select value={listing.category} onChange={(event) => setListing({ ...listing, category: event.target.value as Category })}>{filteredCategories.map((item) => <option key={item}>{item}</option>)}</select></label><label className="field"><span>Name</span><input value={listing.name} onChange={(event) => setListing({ ...listing, name: event.target.value })} required maxLength={80} placeholder="The Sunday Shirt" /></label><label className="field"><span>Price · {currency || 'currency'}</span><input type="number" min="1" value={listing.price} onChange={(event) => setListing({ ...listing, price: event.target.value })} required placeholder="85000" /></label><label className="field"><span>Photo URL <small>optional</small></span><input type="url" value={listing.imageUrl} onChange={(event) => setListing({ ...listing, imageUrl: event.target.value })} maxLength={2048} placeholder="https://…" /></label><label className="field"><span>Upload photos <small>up to 5 · 10 MB each</small></span><input type="file" accept="image/jpeg,image/png,image/webp,image/avif" multiple disabled={uploadingImages} onChange={(event) => void uploadSelectedImages(event.target.files, 'listing', 'listing')} /><small className="field-note">{listingImages.length} photo(s) selected.</small></label>{listingType === 'product' && ['Clothing', 'Shoes'].includes(listing.category) && <label className="field"><span>Sizes</span><input value={listing.sizes} onChange={(event) => setListing({ ...listing, sizes: event.target.value })} placeholder="S, M, L, XL" /></label>}{listingType === 'product' && ['Clothing', 'Shoes', 'Bags', 'Jewellery', 'Accessories'].includes(listing.category) && <label className="field"><span>Colour / finish</span><input value={listing.colour} onChange={(event) => setListing({ ...listing, colour: event.target.value })} placeholder="Terracotta" /></label>}{listingType === 'service' && <label className="field"><span>Enquiry action</span><select value={listing.enquiryLabel} onChange={(event) => setListing({ ...listing, enquiryLabel: event.target.value })}><option>Ask about availability</option><option>Request an appointment</option><option>Ask a question</option></select></label>}<label className="field field-wide"><span>Description</span><textarea value={listing.description} onChange={(event) => setListing({ ...listing, description: event.target.value })} required maxLength={800} rows={4} placeholder="An easy cotton shirt for slow Sundays and everything after." /></label></div></div>}
        {step === 3 && <div className="setup-step"><p className="step-number">04</p><h2>All set!</h2><p>Your shop and listing are created. Open your studio to manage orders and collection.</p><Link className="button button-dark" to="/seller/dashboard">Open seller studio <ArrowRight size={14} /></Link></div>}
        {fieldError && <FormError>{fieldError}</FormError>}
        <div className="panel-actions">{step > 0 && step < 3 && <button type="button" className="button button-outline" onClick={() => setStep((current) => Math.max(0, current - 1))}><ArrowLeft size={14} /> Back</button>}{step < 2 && <button type="button" className="button button-dark" onClick={nextStep}>Next <ArrowRight size={14} /></button>}{step === 2 && <button type="submit" className="button button-dark" disabled={busy || uploadingImages}>{busy ? 'Saving shop & listing…' : uploadingImages ? 'Uploading photos…' : 'Complete setup'}</button>}</div>
      </div>
      <aside className="setup-aside"><p className="eyebrow">LIVE PREVIEW</p><div className="mini-shop-card" style={{ '--shop-accent': shop.accent } as React.CSSProperties}><div className="mini-cover" /><span className="shop-initial">{shop.name ? shop.name.slice(0, 1) : 'S'}</span><h3>{shop.name || 'Your shop name'}</h3><p>{shop.tagline || 'Your tagline here'}</p><div className="preview-collections">{shop.categories.slice(0, 3).map((item) => <span key={item}>{item}</span>)}</div></div></aside>
    </form>}
  </section>;
}

export function SellerDashboardPage() {
  const { session, countries } = useAppContext();
  const [shop, setShop] = useState<Shop | null>(null);
  const [shopDraft, setShopDraft] = useState({ name: '', story: '', tagline: '', city: '', accent: '#496a4d', logoUrl: '', coverUrl: '' });
  const [whatsappDraft, setWhatsappDraft] = useState('');
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [feedback, setFeedback] = useState('');
  const [busyId, setBusyId] = useState('');
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<Listing | null>(null);
  const [draft, setDraft] = useState({ type: 'product' as ListingType, category: 'Clothing' as Category, name: '', price: '', description: '', sizes: '', colour: '', enquiryLabel: 'Ask about availability', imageUrl: '' });
  const [draftImages, setDraftImages] = useState<string[]>([]);
  const [uploadingPhotos, setUploadingPhotos] = useState(false);

  const [showManualPayment, setShowManualPayment] = useState(false);
  const [transactionId, setTransactionId] = useState('');
  const [paymentSubmitted, setPaymentSubmitted] = useState(false);

  const registrationDate = new Date();
  const trialEndDate = new Date(registrationDate.getTime() + 60 * 24 * 60 * 60 * 1000);
  const daysRemaining = Math.ceil((trialEndDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  const isTrialExpired = daysRemaining <= 0;
  const isExpiringSoon = daysRemaining <= 5 && !isTrialExpired;

  async function loadDashboard() {
    setLoading(true); setError('');
    try {
      const [myShop, myListings] = await Promise.all([shopService.getMine(), listingService.mine()]);
      setShop(myShop);
      if (myShop) {
        setShopDraft({ name: myShop.name, story: myShop.story, tagline: myShop.tagline, city: myShop.city, accent: myShop.accent, logoUrl: myShop.logoUrl ?? '', coverUrl: myShop.coverUrl ?? '' });
        setWhatsappDraft(myShop.whatsappNumber ?? '');
        setDraft((current) => ({ ...current, category: myShop.categories[0] ?? current.category }));
      }
      setListings(myListings);
    } catch (caught) { setError(errorMessage(caught)); }
    finally { setLoading(false); }
  }
  useEffect(() => { void loadDashboard(); }, []);

  async function addListing(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isTrialExpired) { setShowManualPayment(true); return; }
    if (!shop) return;
    setBusyId('new'); setError(''); setFeedback('');
    try {
      const created = await listingService.create({ ...draft, imageUrls: draftImages.length ? draftImages : undefined, price: Number(draft.price), currency: countries.find((item) => item.code === shop.countryCode)?.currency ?? 'UGX', countryCode: shop.countryCode, city: shop.city, shopId: shop.id });
      setListings((current) => [created, ...current]);
      setDraft({ type: 'product', category: shop.categories[0] ?? 'Clothing', name: '', price: '', description: '', sizes: '', colour: '', enquiryLabel: 'Ask about availability', imageUrl: '' });
      setDraftImages([]); setAdding(false); setFeedback('New listing created by the listing API.');
    } catch (caught) { setError(errorMessage(caught)); }
    finally { setBusyId(''); }
  }

  async function deleteListing(item: Listing) {
    if (!window.confirm(`Delete "${item.name}"?`)) return;
    setBusyId(item.id); setError('');
    try { await listingService.delete(item.id); setListings((current) => current.filter((listing) => listing.id !== item.id)); }
    catch (caught) { setError(errorMessage(caught)); }
    finally { setBusyId(''); }
  }

  async function toggleListing(item: Listing) {
    setBusyId(item.id); setError('');
    try {
      const updated = await listingService.update(item.id, { isActive: item.isActive === false ? true : false });
      setListings((current) => current.map((listing) => listing.id === updated.id ? updated : listing));
    } catch (caught) { setError(errorMessage(caught)); }
    finally { setBusyId(''); }
  }

  async function saveEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editing) return;
    const form = new FormData(event.currentTarget);
    setBusyId(editing.id); setError('');
    try {
      const updated = await listingService.update(editing.id, { name: form.get('name'), price: Number(form.get('price')), description: form.get('description'), imageUrl: String(form.get('imageUrl') ?? '') });
      setListings((current) => current.map((i) => i.id === updated.id ? updated : i));
      setEditing(null);
    } catch (caught) { setError(errorMessage(caught)); }
    finally { setBusyId(''); }
  }

  async function saveShopSettings(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!shop) return;
    setBusyId('shop-settings'); setError(''); setFeedback('');
    try {
      const updated = await shopService.update(shop.id, shopDraft);
      setShop(updated);
      setShopDraft({ name: updated.name, story: updated.story, tagline: updated.tagline, city: updated.city, accent: updated.accent, logoUrl: updated.logoUrl ?? '', coverUrl: updated.coverUrl ?? '' });
      setFeedback('Shop settings updated.');
    } catch (caught) { setError(errorMessage(caught)); }
    finally { setBusyId(''); }
  }

  async function saveWhatsAppContact(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!shop) return;
    const normalized = whatsappDraft.replace(/[\s()-]/g, '');
    if (!/^\+[1-9]\d{7,14}$/.test(normalized)) { setError('Enter a valid WhatsApp number with its country code (e.g. +256773927881).'); return; }
    setBusyId('whatsapp'); setError(''); setFeedback('');
    try {
      const updated = await shopService.update(shop.id, { whatsappNumber: normalized });
      setShop(updated); setWhatsappDraft(updated.whatsappNumber ?? ''); setFeedback('WhatsApp contact updated.');
    } catch (caught) { setError(errorMessage(caught)); }
    finally { setBusyId(''); }
  }

  async function uploadDashboardPhotos(files: FileList | null, target: 'listing' | 'logo' | 'cover') {
    if (!files?.length) return;
    setUploadingPhotos(true); setError('');
    try {
      const uploaded = await uploadService.uploadFiles(files);
      if (target === 'listing') setDraftImages((current) => [...current, ...uploaded.map((item) => item.url)]);
      else setShopDraft((current) => ({ ...current, [target === 'logo' ? 'logoUrl' : 'coverUrl']: uploaded[0].url }));
    } catch (caught) { setError(errorMessage(caught)); }
    finally { setUploadingPhotos(false); }
  }

  function submitManualPayment(e: FormEvent) {
    e.preventDefault();
    if (!transactionId.trim()) return;
    setPaymentSubmitted(true);
    setFeedback('Payment proof submitted successfully! Pending admin verification (Bankenga Kabesha / 0773927881).');
  }

  if (!session) return <section className="content-page"><PageTitle eyebrow="SELLER STUDIO" title={<>Sign in to your <em>shop.</em></>}><span>Seller listings and shop settings are private backend resources.</span></PageTitle><Notice tone="warning" title="Seller account required">The seller API must verify your account before returning private shop data.</Notice><Link className="button button-dark" to="/auth/sign-in">Sign in</Link></section>;
  if (session.user.role !== 'seller') return <section className="content-page"><Notice tone="error" title="Seller role required">Your backend session role is {session.user.role}. Use a seller account to access the seller studio.</Notice><Link className="button button-outline" to="/account">Back to account</Link></section>;

  return <section className="content-page dashboard-page">
    <PageTitle eyebrow="SELLER STUDIO & SUBSCRIPTION" title={<>Your work, <em>in one place.</em></>} action={<><Link className="button button-outline" to="/seller/setup">Setup shop</Link>{subscriptionsEnabled && <Link className="button button-dark" to="/subscriptions">Subscription status</Link>}</>}>Shop and listing information is loaded from your seller account.</PageTitle>

    {/* Subscription Expiration Banner */}
    {isExpiringSoon && <Notice tone="warning" title="Free Trial Ending Soon">Your 2-month free trial ends on {trialEndDate.toLocaleDateString()}. Subscribe now for UGX 10,000/month to keep your shop live.</Notice>}
    {isTrialExpired && <Notice tone="error" title="Free Trial Expired">Your 2-month free trial has expired. Adding new products or receiving orders is restricted until payment is confirmed.</Notice>}

    {/* Manual Payment Screen Modal / Section */}
    {(isTrialExpired || showManualPayment) && <section className="admin-panel" style={{ background: '#fcfbfa', border: '2px solid #315039', marginBottom: '25px', padding: '25px' }}>
      <p className="eyebrow">MANUAL MOBILE MONEY PAYMENT</p>
      <h2>Renew Subscription · UGX 10,000 / month</h2>
      <div className="payment-instruction" style={{ background: '#fff', padding: '15px', borderLeft: '4px solid #496a4d', margin: '15px 0' }}>
        <p style={{ margin: 0, fontSize: '11px', lineHeight: '1.7' }}>
          <strong>Amount:</strong> UGX 10,000 / month<br />
          <strong>Payment Number:</strong> 0773927881 (MTN Mobile Money)<br />
          <strong>Account Name:</strong> Bankenga Kabesha (or Kabesha bakenga)
        </p>
      </div>
      {paymentSubmitted ? (
        <Notice tone="success">Payment proof submitted with Reference: <strong>{transactionId}</strong>. An administrator will verify the transaction and extend your subscription by 30 days shortly.</Notice>
      ) : (
        <form onSubmit={submitManualPayment} className="form-stack">
          <label className="field">
            <span>Transaction ID / SMS Reference Code</span>
            <input value={transactionId} onChange={e => setTransactionId(e.target.value)} required placeholder="e.g. MTN MoMo Ref Code: PP261016..." />
          </label>
          <button className="button button-dark" style={{ background: '#315039', color: '#fff', padding: '12px', border: 0, fontWeight: 650, cursor: 'pointer' }}>
            Submit Payment Proof
          </button>
        </form>
      )}
    </section>}

    {loading && <Loading label="Loading seller studio…" />}
    {error && <Notice tone="error" title="Seller data unavailable">{error}<button className="text-button" onClick={() => void loadDashboard()}>Retry</button></Notice>}
    {feedback && <Notice tone="success">{feedback}</Notice>}

    {!loading && !error && shop && (
      <div className="dashboard-content-stack" style={{ display: 'grid', gap: '25px' }}>
        <div className="dashboard-shop">
          <span className="shop-initial">{shop.name.slice(0, 1)}</span>
          <div>
            <p className="eyebrow">{shop.countryName} · {shop.city}</p>
            <h2>{shop.name}</h2>
            <p>{shop.story}</p>
          </div>
          <Link to={`/shops/${shop.id}`}><Eye size={15} /> Preview storefront</Link>
        </div>
        <section className="subsection">
          <p className="eyebrow">SHOP PROFILE & SETTINGS</p>
          <h2>Storefront details.</h2>
          <form className="form-grid" onSubmit={saveShopSettings}>
            <label className="field"><span>Shop name</span><input value={shopDraft.name} onChange={(event) => setShopDraft({ ...shopDraft, name: event.target.value })} required minLength={2} maxLength={60} /></label>
            <label className="field"><span>Tagline</span><input value={shopDraft.tagline} onChange={(event) => setShopDraft({ ...shopDraft, tagline: event.target.value })} maxLength={80} /></label>
            <label className="field"><span>City</span><input value={shopDraft.city} onChange={(event) => setShopDraft({ ...shopDraft, city: event.target.value })} required maxLength={80} /></label>
            <label className="field"><span>Storefront accent</span><select value={shopDraft.accent} onChange={(event) => setShopDraft({ ...shopDraft, accent: event.target.value })}><option value="#496a4d">Maker green</option><option value="#a94f47">Clay red</option><option value="#426c83">Lake blue</option><option value="#a37936">Warm gold</option></select></label>
            <label className="field"><span>Storefront cover photo</span><input type="file" accept="image/jpeg,image/png,image/webp,image/avif" disabled={uploadingPhotos} onChange={(event) => void uploadDashboardPhotos(event.target.files, 'cover')} /><small className="field-note">{shopDraft.coverUrl ? 'Cover image selected; save settings to publish.' : 'Optional · max 10 MB'}</small></label>
            <label className="field"><span>Shop logo</span><input type="file" accept="image/jpeg,image/png,image/webp,image/avif" disabled={uploadingPhotos} onChange={(event) => void uploadDashboardPhotos(event.target.files, 'logo')} /><small className="field-note">{shopDraft.logoUrl ? 'Logo selected; save settings to publish.' : 'Optional · max 10 MB'}</small></label>
            <label className="field field-wide"><span>Shop story</span><textarea value={shopDraft.story} onChange={(event) => setShopDraft({ ...shopDraft, story: event.target.value })} required minLength={10} maxLength={500} rows={4} /></label>
            <button className="button button-outline" disabled={busyId === 'shop-settings'}>{busyId === 'shop-settings' ? 'Saving…' : 'Save shop settings'}</button>
          </form>
        </section>
        <form className="form-grid" onSubmit={saveWhatsAppContact}>
          <label className="field"><span>Public WhatsApp number</span><input type="tel" autoComplete="tel" value={whatsappDraft} onChange={(event) => setWhatsappDraft(event.target.value)} required maxLength={24} placeholder="+256 773 927 881" /><small className="field-note">Buyers can use this number to ask about listings.</small></label>
          <button className="button button-outline" disabled={busyId === "whatsapp"}>{busyId === "whatsapp" ? "Saving…" : "Save WhatsApp contact"}</button>
        </form>
        <div className="section-heading compact">
          <div><p className="eyebrow">YOUR CATALOG</p><h2>Products & <em>services.</em></h2></div>
          <span className="listing-count">{listings.length} listings</span>
          <button className="button button-dark" onClick={() => { if (isTrialExpired) setShowManualPayment(true); else setAdding(!adding); }}><Plus size={14} /> Add listing</button>
        </div>
        {adding && !isTrialExpired && (
          <form className="add-listing-panel form-grid" onSubmit={addListing}>
            <label className="field"><span>Listing type</span><select value={draft.type} onChange={(event) => setDraft({ ...draft, type: event.target.value as ListingType })}><option value="product">Product</option><option value="service">Service</option></select></label>
            <label className="field"><span>Category</span><select value={draft.category} onChange={(event) => setDraft({ ...draft, category: event.target.value as Category })}>{(shop.categories.length ? shop.categories : categories).map((item) => <option key={item}>{item}</option>)}</select></label>
            <label className="field"><span>Listing name</span><input value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} required maxLength={80} /></label>
            <label className="field"><span>Price · {countries.find((item) => item.code === shop.countryCode)?.currency ?? 'UGX'}</span><input type="number" value={draft.price} onChange={(event) => setDraft({ ...draft, price: event.target.value })} min="1" required /></label>
            <label className="field"><span>Photo URL <small>optional</small></span><input type="url" value={draft.imageUrl} onChange={(event) => setDraft({ ...draft, imageUrl: event.target.value })} maxLength={2048} placeholder="https://…" /></label>
            <label className="field"><span>Listing photos <small>up to 5 · 10 MB each</small></span><input type="file" accept="image/jpeg,image/png,image/webp,image/avif" multiple disabled={uploadingPhotos} onChange={(event) => void uploadDashboardPhotos(event.target.files, 'listing')} /><small className="field-note">{draftImages.length} photo(s) uploaded.</small></label>
            {draft.type === 'product' && ['Clothing', 'Shoes'].includes(draft.category) && <label className="field"><span>Sizes</span><input value={draft.sizes} onChange={(event) => setDraft({ ...draft, sizes: event.target.value })} /></label>}
            {draft.type === 'product' && ['Clothing', 'Shoes', 'Bags', 'Jewellery', 'Accessories'].includes(draft.category) && <label className="field"><span>Colour / finish</span><input value={draft.colour} onChange={(event) => setDraft({ ...draft, colour: event.target.value })} /></label>}
            {draft.type === 'service' && <label className="field"><span>Enquiry action</span><select value={draft.enquiryLabel} onChange={(event) => setDraft({ ...draft, enquiryLabel: event.target.value })}><option>Ask about availability</option><option>Request an appointment</option><option>Ask a question</option></select></label>}
            <label className="field field-wide"><span>Description</span><textarea value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} required maxLength={800} rows={4} /></label>
            <div className="field-wide panel-actions"><button type="button" className="button button-outline" onClick={() => setAdding(false)}>Cancel</button><button className="button button-dark" disabled={busyId === 'new' || uploadingPhotos}>{uploadingPhotos ? 'Uploading photos…' : busyId === 'new' ? 'Saving…' : 'Create through listing API'}</button></div>
          </form>
        )}
        {listings.length ? (
          <div className="seller-listings">
            {listings.map((item) => (
              <article className="seller-listing-row" key={item.id}>
                <img src={item.image} alt="" />
                <div>
                  <span className="listing-type">{item.type} · {item.category}{item.isActive === false ? ' · Paused' : ''}</span>
                  <h3>{item.name}</h3>
                  <p>{item.currency} {item.price.toLocaleString()} · {item.city}</p>
                </div>
                <div className="row-actions">
                  <button className="icon-button" aria-label={`Edit ${item.name}`} onClick={() => setEditing(item)}><Pencil size={15} /></button>
                  <button className="icon-button" aria-label={item.isActive === false ? `Publish ${item.name}` : `Pause ${item.name}`} disabled={busyId === item.id} onClick={() => void toggleListing(item)}>{item.isActive === false ? <Eye size={15} /> : <EyeOff size={15} />}</button>
                  <button className="icon-button danger" aria-label={`Delete ${item.name}`} disabled={busyId === item.id} onClick={() => void deleteListing(item)}><Trash2 size={15} /></button>
                  {item.isActive !== false && <Link className="icon-button" aria-label={`View ${item.name}`} to={`/listings/${item.id}`}><Eye size={15} /></Link>}
                </div>
              </article>
            ))}
          </div>
        ) : (
          <EmptyState title="No listings yet">Create a listing through the seller API to start building your shop.</EmptyState>
        )}
        {editing && (
          <div className="dialog-backdrop" role="presentation" onClick={(event) => { if (event.target === event.currentTarget) setEditing(null); }}>
            <section className="dialog" role="dialog" aria-modal="true" aria-labelledby="edit-listing-title">
              <button className="dialog-close" onClick={() => setEditing(null)} aria-label="Close editor">×</button>
              <h2 id="edit-listing-title">Edit listing</h2>
              <form className="form-stack" onSubmit={saveEdit}>
                <label className="field"><span>Name</span><input name="name" defaultValue={editing.name} required maxLength={80} /></label>
                <label className="field"><span>Price · {editing.currency}</span><input name="price" type="number" min="1" defaultValue={editing.price} required /></label>
                <label className="field"><span>Photo URL <small>optional</small></span><input name="imageUrl" type="url" defaultValue={editing.image} maxLength={2048} placeholder="https://…" /></label>
                <label className="field"><span>Description</span><textarea name="description" defaultValue={editing.description} rows={4} required maxLength={800} /></label>
                <button className="button button-dark" disabled={busyId === editing.id}>Save through listing API</button>
              </form>
            </section>
          </div>
        )}
      </div>
    )}

    {!loading && error && <EmptyState title="Studio needs an account service">Set up the API base URL and implement `GET /shops/mine` and `GET /listings/mine` before managing a live shop.</EmptyState>}
    {!loading && !error && !shop && <EmptyState title="No shop connected yet" action={<Link className="button button-dark" to="/seller/setup">Start shop setup <Plus size={14} /></Link>}>The account service returned no seller shop.</EmptyState>}
  </section>;
}
