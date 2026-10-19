import { useEffect, useState, type FormEvent } from 'react';
import { Plus, Save, ShieldCheck, MapPin, TrendingUp, Megaphone, CheckCircle2, Globe } from 'lucide-react';
import { EmptyState, Loading, Notice, PageTitle, StatusBadge } from '../components/ui';
import { seedCountries, seedPlans } from '../data/seed';
import { useAppContext } from '../context/AppContext';
import { subscriptionsEnabled } from '../config/features';
import { adminService } from '../services/adminService';
import { countryService } from '../services/countryService';
import { shopService } from '../services/shopService';
import { errorMessage } from '../services/http';
import type { AccountRole, AdminSettings, Country, MarketplaceReport, SafetyReport, SubscriptionPlan, SubscriptionRecord, AdminMapNode, PromotionAd, PlatformAnalytics, Shop } from '../types';

const awaitingPlan: SubscriptionPlan = { id: 'awaiting-confirmation', name: 'New plan', payerTypes: 'awaiting confirmation', priceLabel: 'Awaiting confirmation', renewalPeriod: 'Awaiting confirmation' };

export function AdminPage() {
  const { refreshAccessRules } = useAppContext();
  const [settings, setSettings] = useState<AdminSettings>({ plans: seedPlans, countries: seedCountries, subscriptionAccess: { requiredRoles: ['buyer'] } });
  const [planId, setPlanId] = useState(seedPlans[0].id);
  const [planName, setPlanName] = useState(seedPlans[0].name ?? 'Basic Seller');
  const [payerTypes, setPayerTypes] = useState<Array<'buyer' | 'seller' | 'both'>>(['seller']);
  const [price, setPrice] = useState('10000');
  const [currency, setCurrency] = useState('UGX');
  const [renewal, setRenewal] = useState('Monthly');
  const [requiredRoles, setRequiredRoles] = useState<AccountRole[]>(['buyer']);
  const [countryCode, setCountryCode] = useState('UG');
  const [instructions, setInstructions] = useState(seedCountries[0].paymentInstructions ?? '');
  const [countries, setCountries] = useState<Country[]>(seedCountries);
  const [newCountry, setNewCountry] = useState({ code: '', name: '', currency: '', cities: '' });
  const [queue, setQueue] = useState<SubscriptionRecord[]>([]);
  const [reports, setReports] = useState<SafetyReport[]>([]);
  const [sellerReport, setSellerReport] = useState<MarketplaceReport[]>([]);
  const [listingReport, setListingReport] = useState<MarketplaceReport[]>([]);

  const [mapNodes, setMapNodes] = useState<AdminMapNode[]>([]);
  const [promotions, setPromotions] = useState<PromotionAd[]>([]);
  const [analytics, setAnalytics] = useState<PlatformAnalytics | null>(null);
  const [allShops, setAllShops] = useState<Shop[]>([]);
  const [newPromoTitle, setNewPromoTitle] = useState('');
  const [newPromoType, setNewPromoType] = useState('featured');
  const [newPromoBudget, setNewPromoBudget] = useState('UGX 250,000');
  const [newPromoExpiry, setNewPromoExpiry] = useState('2026-12-31');

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [settingsConnected, setSettingsConnected] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const planOptions = [...seedPlans, ...settings.plans].filter((plan, index, items) => items.findIndex((item) => item.id === plan.id) === index);
  const selectedPlan = planOptions.find((plan) => plan.id === planId) ?? planOptions[0] ?? awaitingPlan;

  function loadPlanDraft(plan: SubscriptionPlan) {
    setPlanId(plan.id);
    setPlanName(plan.name ?? plan.id);
    setPayerTypes(plan.payerTypes === 'awaiting confirmation' ? [] : plan.payerTypes as Array<'buyer' | 'seller' | 'both'>);
    const local = plan.countryPrices?.[countryCode];
    setPrice(local ? String(local.amount) : countryCode === 'UG' && plan.currency === 'UGX' && plan.amount ? String(plan.amount) : '');
    setCurrency(local?.currency ?? (countryCode === 'UG' ? plan.currency ?? 'UGX' : countries.find((item) => item.code === countryCode)?.currency ?? ''));
    setRenewal(plan.renewalPeriod === 'Awaiting confirmation' ? '' : plan.renewalPeriod);
  }

  async function loadAdmin() {
    setLoading(true); setError('');
    const [settingsResult, payments, sellers, listings, reportQueue, mapResult, promoResult, analyticsResult, shopsResult] = await Promise.allSettled([
      adminService.settings(),
      subscriptionsEnabled ? adminService.paymentQueue() : Promise.resolve([] as SubscriptionRecord[]),
      adminService.sellersReport(),
      adminService.listingsReport(),
      adminService.reportsQueue(),
      adminService.mapNodes(),
      adminService.promotions(),
      adminService.analytics(),
      shopService.list()
    ]);
    if (settingsResult.status === 'fulfilled') {
      const result = settingsResult.value;
      const editorPlans = result.plans.length ? result.plans : seedPlans;
      setSettings(result);
      setCountries(result.countries);
      setRequiredRoles(result.subscriptionAccess.requiredRoles);
      setSettingsConnected(true);
      const country = result.countries.find((item) => item.code === countryCode) ?? result.countries.find((item) => item.code === 'UG') ?? result.countries[0];
      if (country) { setCountryCode(country.code); setInstructions(country.paymentInstructions ?? ''); }
      const plan = editorPlans.find((item) => item.id === planId) ?? editorPlans[0];
      if (plan) loadPlanDraft(plan);
    } else { setSettingsConnected(false); setError(errorMessage(settingsResult.reason)); }
    if (payments.status === 'fulfilled') setQueue(payments.value);
    if (sellers.status === 'fulfilled') setSellerReport(sellers.value);
    if (listings.status === 'fulfilled') setListingReport(listings.value);
    if (reportQueue.status === 'fulfilled') setReports(reportQueue.value);
    if (mapResult.status === 'fulfilled') setMapNodes(mapResult.value);
    if (promoResult.status === 'fulfilled') setPromotions(promoResult.value);
    if (analyticsResult.status === 'fulfilled') setAnalytics(analyticsResult.value);
    if (shopsResult.status === 'fulfilled') setAllShops(shopsResult.value);
    setLoading(false);
  }
  useEffect(() => { void loadAdmin(); }, []);

  function choosePlan(id: string) {
    const plan = settings.plans.find((item) => item.id === id);
    if (plan) loadPlanDraft(plan);
  }

  async function saveSettings(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!payerTypes.length) { setError('Choose at least one plan payer type.'); return; }
    setBusy(true); setError(''); setMessage('');
    const localPrices = { ...selectedPlan.countryPrices, [countryCode]: price.trim() && Number(price) > 0 ? { amount: Number(price), currency: currency.trim().toUpperCase() } : null };
    const updatedPlan: SubscriptionPlan = {
      ...selectedPlan,
      id: planId,
      name: planName.trim(),
      payerTypes,
      targetRoles: payerTypes.includes('both') ? ['buyer', 'seller'] : payerTypes.filter((item): item is 'buyer' | 'seller' => item !== 'both'),
      priceLabel: countryCode === 'UG' && price ? `UGX ${Number(price).toLocaleString()} / ${renewal || 'Awaiting confirmation'}` : selectedPlan.priceLabel,
      amount: countryCode === 'UG' && price ? Number(price) : selectedPlan.amount,
      currency: countryCode === 'UG' ? 'UGX' : selectedPlan.currency,
      renewalPeriod: renewal.trim() || 'Awaiting confirmation',
      countryPrices: localPrices,
      isSeed: false,
    };
    const configuredPlans = settings.plans.filter((plan) => plan.id !== planId).map((plan) => { const backendPlan = { ...plan }; delete backendPlan.isSeed; return backendPlan; });
    const backendPlan = { ...updatedPlan };
    delete backendPlan.isSeed;
    const nextSettings: AdminSettings = { plans: [...configuredPlans, backendPlan], countries, subscriptionAccess: { requiredRoles } };
    try {
      const result = await adminService.updateSettings(nextSettings);
      setSettings(result); setCountries(result.countries); setRequiredRoles(result.subscriptionAccess.requiredRoles); setSettingsConnected(true);
      await refreshAccessRules();
      setMessage('Plans, access rules and country settings were saved by the admin service.');
    } catch (caught) { setError(errorMessage(caught)); }
    finally { setBusy(false); }
  }

  async function saveInstructions(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(''); setMessage('');
    if (countryCode === 'UG' && !instructions.includes('0773927881')) { setError('Uganda instructions must retain its country-specific 0773927881 number.'); setBusy(false); return; }
    try {
      const updated = await countryService.updatePaymentInstructions(countryCode, instructions.trim());
      const nextCountries = countries.map((item) => item.code === updated.code ? updated : item);
      setCountries(nextCountries); setSettings((current) => ({ ...current, countries: nextCountries }));
      setMessage(`${updated.name} instructions were saved by the country service.`);
    } catch (caught) { setError(errorMessage(caught)); }
    finally { setBusy(false); }
  }

  async function addCountry(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(''); setMessage('');
    const country: Country = { code: newCountry.code.trim().toUpperCase(), name: newCountry.name.trim(), currency: newCountry.currency.trim().toUpperCase(), cities: newCountry.cities.split(',').map((city) => city.trim()).filter(Boolean) };
    try {
      const created = await countryService.create(country);
      const nextCountries = [...countries, created]; setCountries(nextCountries); setSettings((current) => ({ ...current, countries: nextCountries }));
      setCountryCode(created.code); setInstructions(created.paymentInstructions ?? ''); setNewCountry({ code: '', name: '', currency: '', cities: '' });
      setMessage(`${created.name} was added by the country service.`);
    } catch (caught) { setError(errorMessage(caught)); }
    finally { setBusy(false); }
  }

  async function toggleShopVerification(shop: Shop) {
    setBusy(true); setError(''); setMessage('');
    const nextState = !shop.isVerified;
    try {
      await adminService.verifyShop(shop.id, nextState);
      setAllShops((current) => current.map((item) => item.id === shop.id ? { ...item, isVerified: nextState } : item));
      setMessage(`Shop "${shop.name}" verification status updated to ${nextState ? 'Verified (Blue Tick ✓)' : 'Unverified'}.`);
    } catch (caught) { setError(errorMessage(caught)); }
    finally { setBusy(false); }
  }

  async function createPromotion(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(''); setMessage('');
    try {
      const created = await adminService.savePromotion({ title: newPromoTitle, type: newPromoType, budget: newPromoBudget, expiresAt: newPromoExpiry });
      setPromotions((current) => [created, ...current]);
      setNewPromoTitle('');
      setMessage(`Promotion campaign "${created.title}" launched successfully.`);
    } catch (caught) { setError(errorMessage(caught)); }
    finally { setBusy(false); }
  }

  function toggleRequiredRole(role: 'buyer' | 'seller') {
    setRequiredRoles((current) => current.includes(role) ? current.filter((item) => item !== role) : [...current, role]);
  }

  async function review(record: SubscriptionRecord, decision: 'approved' | 'declined') {
    setBusy(true); setError(''); setMessage('');
    try {
      const updated = await adminService.reviewPayment(record.id, { decision });
      if (updated.status !== decision) throw new Error('The review service did not confirm the selected status.');
      setQueue((current) => current.map((item) => item.id === updated.id ? updated : item));
      setMessage(`Submission ${updated.id} was ${decision} by the admin review service.`);
    } catch (caught) { setError(errorMessage(caught)); }
    finally { setBusy(false); }
  }

  async function reviewSafetyReport(report: SafetyReport, status: Extract<SafetyReport['status'], 'reviewing' | 'resolved' | 'dismissed'>) {
    setBusy(true); setError(''); setMessage('');
    try {
      const updated = await adminService.reviewReport(report.id, status);
      setReports((current) => current.map((item) => item.id === updated.id ? updated : item));
      setMessage(`Safety report marked ${status}.`);
    } catch (caught) { setError(errorMessage(caught)); }
    finally { setBusy(false); }
  }

  const pending = queue.filter((item) => item.status === 'pending_verification' || item.status === 'pending');
  const reviewed = queue.filter((item) => !pending.some((pendingRecord) => pendingRecord.id === item.id));
  const selectedCountry = countries.find((item) => item.code === countryCode);

  return <section className="content-page admin-page">
    <PageTitle eyebrow="FASHIONHUB OPERATIONS & CONTROL" title={<>Serious Admin <em>control center & backend map.</em></>}><span>Connected directly to live backend database, geographical map nodes, blue tick verification, and campaign management.</span></PageTitle>
    {loading && <Loading label="Loading live app data, geographical map, and reports…" />}
    {error && <Notice tone="error" title="Admin service unavailable">{error}<button className="text-button" onClick={() => void loadAdmin()}>Retry</button></Notice>}
    {message && <Notice tone="success">{message}</Notice>}
    {!loading && <>
      {analytics && <div className="analytics-overview-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
        <div className="admin-panel" style={{ padding: '1.25rem' }}><p className="eyebrow">TOTAL USERS</p><h3 style={{ fontSize: '1.75rem', marginTop: '0.25rem' }}>{analytics.totalUsers.toLocaleString()}</h3></div>
        <div className="admin-panel" style={{ padding: '1.25rem' }}><p className="eyebrow">ACTIVE SHOPS</p><h3 style={{ fontSize: '1.75rem', marginTop: '0.25rem' }}>{analytics.totalShops.toLocaleString()}</h3></div>
        <div className="admin-panel" style={{ padding: '1.25rem' }}><p className="eyebrow">VERIFIED (BLUE TICK)</p><h3 style={{ fontSize: '1.75rem', marginTop: '0.25rem', color: '#1d9bf0' }}>{analytics.verifiedShops.toLocaleString()} ✓</h3></div>
        <div className="admin-panel" style={{ padding: '1.25rem' }}><p className="eyebrow">LISTINGS</p><h3 style={{ fontSize: '1.75rem', marginTop: '0.25rem' }}>{analytics.activeListings.toLocaleString()}</h3></div>
        <div className="admin-panel" style={{ padding: '1.25rem' }}><p className="eyebrow">VOLUME</p><h3 style={{ fontSize: '1.5rem', marginTop: '0.25rem' }}>UGX {(analytics.monthlyVolumeUgx / 1000000).toFixed(1)}M</h3></div>
      </div>}

      <div className="admin-grid">
        {/* Interactive Geographical World Map Canvas */}
        <section className="admin-panel" style={{ gridColumn: '1 / -1' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <div><p className="eyebrow">INTERACTIVE WORLDWIDE GEOGRAPHICAL MAP</p><h2>Global store distribution & live nodes</h2></div>
            <span className="status-badge status-approved"><MapPin size={14} /> {mapNodes.length} Active Worldwide Nodes</span>
          </div>
          <div style={{ background: '#0a0f0d', borderRadius: '12px', padding: '1.5rem', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', position: 'relative', overflow: 'hidden' }}>
            <div style={{ width: '100%', height: '380px', position: 'relative', background: '#0d1310', borderRadius: '8px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.08)' }}>
              <svg viewBox="0 0 1000 500" style={{ width: '100%', height: '100%', display: 'block' }}>
                <g stroke="rgba(255,255,255,0.06)" strokeWidth="1">
                  <line x1="0" y1="250" x2="1000" y2="250" strokeDasharray="4 4" />
                  <line x1="500" y1="0" x2="500" y2="500" strokeDasharray="4 4" />
                  <circle cx="500" cy="250" r="180" fill="none" />
                </g>
                <g fill="rgba(255,255,255,0.05)" stroke="rgba(255,255,255,0.1)">
                  <path d="M 480,260 Q 510,240 530,280 Q 540,320 520,360 Q 490,380 470,330 Z" />
                  <path d="M 460,160 Q 510,150 520,190 Q 480,200 460,160 Z" />
                  <path d="M 540,140 Q 650,130 720,200 Q 680,260 560,220 Z" />
                  <path d="M 150,140 Q 250,120 280,200 Q 220,240 160,190 Z" />
                  <path d="M 280,280 Q 340,270 320,380 Q 280,400 260,320 Z" />
                  <path d="M 780,360 Q 860,350 850,420 Q 780,440 760,380 Z" />
                </g>
                {mapNodes.map((node) => {
                  const cx = (node.lng + 180) * (1000 / 360);
                  const cy = (90 - node.lat) * (500 / 180);
                  return <g key={node.id} style={{ cursor: 'pointer' }} onClick={() => setMessage(`Selected live node: ${node.name} (${node.city}, ${node.countryCode})`)}>
                    <circle cx={cx} cy={cy} r="14" fill={node.isVerified ? '#1d9bf0' : '#496a4d'} fillOpacity="0.3">
                      <animate attributeName="r" values="8;20;8" dur="2.5s" repeatCount="indefinite" />
                      <animate attributeName="opacity" values="0.8;0.1;0.8" dur="2.5s" repeatCount="indefinite" />
                    </circle>
                    <circle cx={cx} cy={cy} r="6" fill={node.isVerified ? '#1d9bf0' : '#496a4d'} stroke="#fff" strokeWidth="1.5" />
                    <text x={cx} y={cy - 12} fill="#fff" fontSize="11" textAnchor="middle" fontWeight="600" style={{ textShadow: '0 1px 4px rgba(0,0,0,0.9)' }}>
                      {node.name} {node.isVerified ? '✓' : ''}
                    </text>
                  </g>;
                })}
              </svg>
            </div>
            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginTop: '1rem', maxHeight: '140px', overflowY: 'auto' }}>
              {mapNodes.map((node) => <div key={node.id} style={{ background: 'rgba(255,255,255,0.06)', padding: '0.6rem 0.85rem', borderRadius: '6px', fontSize: '0.82rem', borderLeft: `3px solid ${node.isVerified ? '#1d9bf0' : '#496a4d'}` }}>
                <strong>{node.name}</strong> {node.isVerified && <span style={{ color: '#1d9bf0' }}>✓</span>} · <span style={{ opacity: 0.7 }}>{node.city}, {node.countryCode}</span>
              </div>)}
            </div>
          </div>
        </section>

        {/* Blue Tick Verification Manager */}
        <section className="admin-panel">
          <p className="eyebrow">VERIFICATION CONTROL</p>
          <h2>Blue Tick Storefront Factions</h2>
          <p style={{ fontSize: '0.85rem', opacity: 0.8, marginBottom: '1rem' }}>Grant or revoke verified status (Blue Tick ✓) for legitimate storefronts connected to our backend.</p>
          <div className="form-stack" style={{ maxHeight: '350px', overflowY: 'auto' }}>
            {allShops.map((shop) => <div key={shop.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem', background: 'rgba(0,0,0,0.03)', borderRadius: '8px', border: '1px solid rgba(0,0,0,0.06)' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <strong>{shop.name}</strong>
                  {shop.isVerified && <span style={{ color: '#1d9bf0', fontWeight: 'bold' }} title="Verified">✓</span>}
                </div>
                <small>{shop.city}, {shop.countryCode} · {shop.sellType}</small>
              </div>
              <button className={`button ${shop.isVerified ? 'button-outline' : 'button-dark'}`} style={{ fontSize: '0.8rem', padding: '0.4rem 0.8rem' }} disabled={busy} onClick={() => void toggleShopVerification(shop)}>
                {shop.isVerified ? 'Revoke Tick' : 'Grant Blue Tick ✓'}
              </button>
            </div>)}
            {!allShops.length && <EmptyState title="No shops found">No storefronts available for verification.</EmptyState>}
          </div>
        </section>

        {/* Promotions & Ads Manager */}
        <section className="admin-panel">
          <p className="eyebrow">MONETIZATION & ADS</p>
          <h2>Promotions & sponsored campaigns</h2>
          <form className="form-stack" onSubmit={createPromotion} style={{ marginBottom: '1.25rem' }}>
            <label className="field"><span>Campaign title</span><input value={newPromoTitle} onChange={(e) => setNewPromoTitle(e.target.value)} placeholder="e.g. Summer Runway Spotlight" required /></label>
            <label className="field"><span>Placement type</span><select value={newPromoType} onChange={(e) => setNewPromoType(e.target.value)}><option value="featured">Featured Banner</option><option value="sponsored">Sponsored Listing</option><option value="hero">Hero Spotlight</option></select></label>
            <label className="field"><span>Budget allocation</span><input value={newPromoBudget} onChange={(e) => setNewPromoBudget(e.target.value)} required /></label>
            <button className="button button-dark" disabled={busy}><Megaphone size={14} /> Launch Campaign</button>
          </form>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {promotions.map((promo) => <div key={promo.id} style={{ padding: '0.75rem', background: 'rgba(0,0,0,0.03)', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div><strong>{promo.title}</strong><br /><small>{promo.type} · {promo.budget} · Expires {promo.expiresAt}</small></div>
              <StatusBadge status="approved">{promo.status}</StatusBadge>
            </div>)}
          </div>
        </section>

        {subscriptionsEnabled && <section className="admin-panel"><p className="eyebrow">PLAN CATALOG</p><h2>Seller & buyer plans</h2>
          <form className="form-stack" onSubmit={saveSettings}>
            <label className="field"><span>Plan to configure</span><select value={planId} onChange={(event) => choosePlan(event.target.value)}>{planOptions.map((plan) => <option value={plan.id} key={plan.id}>{plan.name ?? plan.id}{plan.isSeed ? ' · template' : ''}</option>)}</select></label>
            <label className="field"><span>Display name</span><input value={planName} onChange={(event) => setPlanName(event.target.value)} required /></label>
            <fieldset className="payer-options"><legend>Plan payer types</legend>{(['seller', 'buyer', 'both'] as const).map((role) => <label key={role}><input type="checkbox" checked={payerTypes.includes(role)} onChange={() => setPayerTypes((current) => current.includes(role) ? current.filter((item) => item !== role) : [...current, role])} /><span>{role[0].toUpperCase() + role.slice(1)}</span></label>)}</fieldset>
            <label className="field"><span>Price country</span><select value={countryCode} onChange={(event) => { const code = event.target.value; setCountryCode(code); const localPrice = selectedPlan.countryPrices?.[code]; setPrice(localPrice ? String(localPrice.amount) : ''); setCurrency(localPrice?.currency ?? countries.find((item) => item.code === code)?.currency ?? ''); }}><option value="">Select a country</option>{countries.map((item) => <option value={item.code} key={item.code}>{item.name} · {item.currency}</option>)}</select></label>
            <label className="field"><span>Price amount <small>{currency || selectedCountry?.currency || 'currency to configure'}</small></span><input type="number" min="1" value={price} onChange={(event) => setPrice(event.target.value)} placeholder="Awaiting confirmation" /></label>
            <label className="field"><span>Renewal period</span><input value={renewal} onChange={(event) => setRenewal(event.target.value)} placeholder="Awaiting confirmation" /></label>
            <p className="field-note">All three named plans are configured independently. Non-Uganda prices are entered per currency; no exchange rates are applied.</p>
            <button className="button button-dark" disabled={busy || !settingsConnected}>{busy ? 'Saving…' : <>Save through admin API <Save size={14} /></>}</button>
          </form>
        </section>}
        {subscriptionsEnabled && <section className="admin-panel"><p className="eyebrow">SUBSCRIPTION ACCESS</p><h2>Roles requiring active membership</h2><p>Change which roles need an active subscription to open full shops, listing details, or submit enquiries/orders.</p><fieldset className="payer-options">{(['buyer', 'seller'] as const).map((role) => <label key={role}><input type="checkbox" checked={requiredRoles.includes(role)} onChange={() => toggleRequiredRole(role)} /><span>{role[0].toUpperCase() + role.slice(1)}</span></label>)}</fieldset><p className="field-note">Current policy: {requiredRoles.length ? requiredRoles.join(' and ') : 'No roles'} require an active plan. The backend must also enforce this access rule.</p></section>}
        {subscriptionsEnabled && <section className="admin-panel"><p className="eyebrow">COUNTRY PAYMENT SETTINGS</p><h2>Manual instructions</h2><form className="form-stack" onSubmit={saveInstructions}><label className="field"><span>Country</span><select value={countryCode} onChange={(event) => { setCountryCode(event.target.value); setInstructions(countries.find((item) => item.code === event.target.value)?.paymentInstructions ?? ''); }}><option value="">Select country</option>{countries.map((item) => <option value={item.code} key={item.code}>{item.name} · {item.currency}</option>)}</select></label><label className="field"><span>Instructions for {selectedCountry?.name ?? countryCode}</span><textarea rows={5} value={instructions} onChange={(event) => setInstructions(event.target.value)} maxLength={1000} placeholder="Country-specific instructions awaiting configuration" /></label><button className="button button-outline" disabled={busy || !settingsConnected}>Save country instructions</button></form><Notice tone="warning">0773927881 is Uganda-only. Configure every other country separately. Never request or store a PIN, password or OTP.</Notice></section>}
        <section className="admin-panel country-admin"><p className="eyebrow">COUNTRY & CURRENCY DATA</p><h2>Supported countries</h2><form className="form-grid" onSubmit={addCountry}><label className="field"><span>Country name</span><input value={newCountry.name} onChange={(event) => setNewCountry({ ...newCountry, name: event.target.value })} required /></label><label className="field"><span>Country code</span><input value={newCountry.code} onChange={(event) => setNewCountry({ ...newCountry, code: event.target.value.toUpperCase() })} required minLength={2} maxLength={2} /></label><label className="field"><span>Currency code</span><input value={newCountry.currency} onChange={(event) => setNewCountry({ ...newCountry, currency: event.target.value.toUpperCase() })} required minLength={3} maxLength={3} /></label><label className="field"><span>Cities <small>comma-separated</small></span><input value={newCountry.cities} onChange={(event) => setNewCountry({ ...newCountry, cities: event.target.value })} /></label><div className="field-wide"><button className="button button-outline" disabled={busy || !settingsConnected}><Plus size={14} /> Add via country API</button></div></form><div className="country-directory">{countries.map((item) => <span key={item.code}>{item.name} <b>{item.currency}</b></span>)}</div></section>
        <ReportPanel title="Seller report" data={sellerReport} unavailable={!settingsConnected} />
        <ReportPanel title="Listing report" data={listingReport} unavailable={!settingsConnected} />
        <section className="admin-panel review-panel"><p className="eyebrow">TRUST & SAFETY</p><h2>Listing and account reports</h2>{reports.length ? reports.map((report) => <article className="review-row" key={report.id}><div><StatusBadge status={report.status}>{report.status}</StatusBadge><h3>{report.reason.replaceAll('_', ' ')} · {report.listingId ? 'Listing' : 'Account'}</h3><p>{report.details || 'No additional details provided.'} · {new Date(report.createdAt).toLocaleString()}</p><small>Report {report.id}</small></div><div className="review-actions"><button className="button button-outline" disabled={busy || report.status === 'resolved' || report.status === 'dismissed'} onClick={() => void reviewSafetyReport(report, 'reviewing')}>Reviewing</button><button className="button button-outline" disabled={busy || report.status === 'resolved'} onClick={() => void reviewSafetyReport(report, 'resolved')}>Resolve</button><button className="button button-outline" disabled={busy || report.status === 'dismissed'} onClick={() => void reviewSafetyReport(report, 'dismissed')}>Dismiss</button></div></article>) : <EmptyState title="No safety reports">New user reports will appear here for administrator review.</EmptyState>}</section>
        {subscriptionsEnabled && <section className="admin-panel review-panel"><p className="eyebrow">SUBSCRIPTION REVIEW</p><h2>Manual payment queue</h2><p>New references stay pending until an administrator chooses a review action.</p>{pending.length ? pending.map((record) => <article className="review-row" key={record.id}><div><StatusBadge status={record.status}>{record.status.replaceAll('_', ' ')}</StatusBadge><h3>{record.planName ?? record.planId ?? record.payerType} · {record.countryCode}</h3><p>Reference {record.transactionReference} · {record.receiptUrl ? 'Receipt attached' : 'No receipt'} · {new Date(record.submittedAt).toLocaleString()}</p></div><div className="review-actions"><button className="button button-outline" disabled={busy} onClick={() => void review(record, 'declined')}>Decline</button><button className="button button-dark" disabled={busy} onClick={() => void review(record, 'approved')}>Approve</button></div></article>) : <EmptyState title="No pending submissions">Only payment records returned by the admin subscription service appear here.</EmptyState>}</section>}
      </div>
      {subscriptionsEnabled && <section className="status-section"><div className="section-subhead"><div><p className="eyebrow">REVIEW HISTORY</p><h2>Recent decisions</h2></div></div>{reviewed.length ? reviewed.map((record) => <article className="subscription-record" key={record.id}><div><StatusBadge status={record.status}>{record.status}</StatusBadge><h3>{record.planName ?? record.planId} · {record.countryCode}</h3><p>{record.transactionReference} · {record.reviewedAt ? new Date(record.reviewedAt).toLocaleString() : 'Review time not supplied'}</p></div></article>) : <p className="field-note">No review decisions were returned.</p>}</section>}
    </>}
  </section>;
}

function ReportPanel({ title, data, unavailable }: { title: string; data: MarketplaceReport[]; unavailable: boolean }) {
  return <section className="admin-panel"><p className="eyebrow">REPORTS</p><h2>{title}</h2>{unavailable ? <p className="field-note">Waiting for an authenticated reports endpoint.</p> : data.length ? data.map((report, index) => <article className="report-row" key={`${report.generatedAt}-${index}`}><strong>{report.total.toLocaleString()} records</strong><span>{report.active} active · {report.pending} pending · {report.flagged} flagged</span><small>Updated {new Date(report.generatedAt).toLocaleString()}</small></article>) : <EmptyState title="No report data">No report summary has been returned.</EmptyState>}</section>;
}
