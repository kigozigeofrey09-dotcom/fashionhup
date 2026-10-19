import { useEffect, useState, type FormEvent } from 'react';
import { ArrowRight, RefreshCw, ShieldCheck } from 'lucide-react';
import { Link } from 'react-router-dom';
import { EmptyState, Loading, Notice, PageTitle, StatusBadge } from '../components/ui';
import { useAppContext } from '../context/AppContext';
import { seedCountries, seedPlans } from '../data/seed';
import { countryService } from '../services/countryService';
import { errorMessage } from '../services/http';
import { paymentSubmissionService } from '../services/paymentSubmissionService';
import { subscriptionService } from '../services/subscriptionService';
import type { AccountRole, SubscriptionPlan, SubscriptionRecord } from '../types';

function priceFor(plan: SubscriptionPlan, countryCode: string) {
  const local = plan.countryPrices?.[countryCode];
  if (local) return `${local.currency} ${local.amount.toLocaleString()} / ${plan.renewalPeriod || 'Awaiting confirmation'}`;
  if (countryCode === 'UG' && plan.currency === 'UGX' && plan.amount) return `UGX ${plan.amount.toLocaleString()} / ${plan.renewalPeriod || 'Awaiting confirmation'}`;
  return 'Awaiting admin price for this country';
}

function normalizedStatus(record: SubscriptionRecord) {
  return record.status === 'pending_verification' ? 'pending' : record.status;
}

export function SubscriptionsPage() {
  const { countries, session, refreshSubscriptionAccess } = useAppContext();
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [records, setRecords] = useState<SubscriptionRecord[]>([]);
  const [countryCode, setCountryCode] = useState(session?.user.countryCode ?? 'UG');
  const [planId, setPlanId] = useState('');
  const [payerType, setPayerType] = useState<'buyer' | 'seller'>(session?.user.role === 'seller' ? 'seller' : 'buyer');
  const [reference, setReference] = useState('');
  const [receipt, setReceipt] = useState<File | null>(null);
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [plansConnected, setPlansConnected] = useState(false);
  const [countriesConnected, setCountriesConnected] = useState(false);
  const country = countries.find((item) => item.code === countryCode) ?? seedCountries[0];
  const userRole = session?.user.role === 'seller' ? 'seller' : 'buyer';
  const selectedPlan = plans.find((plan) => plan.id === planId);
  const configuredPrice = selectedPlan ? priceFor(selectedPlan, countryCode) : 'Awaiting admin price for this country';
  const selectedPlanIsConfigured = Boolean(selectedPlan && selectedPlan.payerTypes !== 'awaiting confirmation' && selectedPlan.renewalPeriod && selectedPlan.renewalPeriod !== 'Awaiting confirmation' && configuredPrice !== 'Awaiting admin price for this country' && configuredPrice !== 'Awaiting confirmation');
  const rolePlans = plans.filter((plan) => {
    if (!session) return true;
    if (plan.targetRoles) return plan.targetRoles.includes(userRole);
    return plan.payerTypes === 'awaiting confirmation' || plan.payerTypes.includes(userRole) || plan.payerTypes.includes('both');
  });

  async function load() {
    setLoading(true); setError('');
    const [planResult, recordResult, countryResult] = await Promise.allSettled([
      subscriptionService.plans(),
      session ? subscriptionService.mine() : Promise.resolve([] as SubscriptionRecord[]),
      countryService.list(),
    ]);
    if (planResult.status === 'fulfilled' && planResult.value.length) {
      setPlans(planResult.value); setPlansConnected(true);
      setPlanId((current) => planResult.value.some((plan) => plan.id === current) ? current : planResult.value[0].id);
    } else {
      setPlans(seedPlans); setPlansConnected(false);
      if (planResult.status === 'rejected') setError(errorMessage(planResult.reason));
      setPlanId((current) => seedPlans.some((plan) => plan.id === current) ? current : seedPlans[0].id);
    }
    if (recordResult.status === 'fulfilled') setRecords(recordResult.value);
    else setError((current) => current || errorMessage(recordResult.reason));
    if (countryResult.status === 'fulfilled') setCountriesConnected(true);
    else setCountriesConnected(false);
    setLoading(false);
  }
  useEffect(() => { void load(); }, [session]);
  useEffect(() => { if (session?.user.role === 'buyer' || session?.user.role === 'seller') setPayerType(session.user.role); }, [session]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(''); setMessage('');
    if (!session) { setError('Sign in before submitting a payment reference.'); return; }
    if (!plansConnected || !selectedPlan) { setError('Subscription purchases are unavailable until the plans service returns a configured plan.'); return; }
    setBusy(true);
    try {
      const created = await paymentSubmissionService.submit({ planId, payerType, countryCode, transactionReference: reference.trim(), receipt: receipt ?? undefined, requestType: 'new' });
      if (!['pending', 'pending_verification'].includes(created.status)) throw new Error('A new payment request must remain pending until a manual administrator review.');
      setRecords((current) => [created, ...current]);
      setMessage(`Payment reference ${created.transactionReference} is pending manual verification. No payment was processed in the front end.`);
      setReference(''); setReceipt(null);
      (event.currentTarget as HTMLFormElement).reset();
      await refreshSubscriptionAccess();
    } catch (caught) { setError(errorMessage(caught)); }
    finally { setBusy(false); }
  }

  async function renew(record: SubscriptionRecord) {
    setBusy(true); setError(''); setMessage('');
    try {
      const request = await subscriptionService.requestRenewal(record.id);
      if (!['pending', 'pending_verification'].includes(request.status)) throw new Error('A renewal request must remain pending until an administrator reviews it.');
      setRecords((current) => [request, ...current]);
      setMessage(`Renewal for ${record.planName ?? record.planId ?? 'subscription'} is pending manual verification.`);
      await refreshSubscriptionAccess();
    } catch (caught) { setError(errorMessage(caught)); }
    finally { setBusy(false); }
  }

  async function cancel(record: SubscriptionRecord) {
    if (!window.confirm('Request cancellation of this subscription? The backend will confirm the resulting status.')) return;
    setBusy(true); setError(''); setMessage('');
    try {
      const updated = await subscriptionService.cancel(record.id);
      if (updated.status !== 'cancelled') throw new Error('The subscription service did not confirm cancellation.');
      setRecords((current) => current.map((item) => item.id === updated.id ? updated : item));
      setMessage('Cancellation was confirmed by the subscription service.');
      await refreshSubscriptionAccess();
    } catch (caught) { setError(errorMessage(caught)); }
    finally { setBusy(false); }
  }

  const visibleRecords = records.filter((record) => filter === 'all' || normalizedStatus(record) === filter);
  const instructions = country.paymentInstructions || 'Payment instructions for this country are awaiting country-specific admin configuration. Ask an authorized administrator before sending payment.';
  const paidRecords = records.filter((record) => ['approved', 'pending', 'pending_verification'].includes(record.status));
  const currentRecord = paidRecords.find((record) => record.status === 'approved') ?? paidRecords[0];

  return <section className="content-page subscriptions-page">
    <PageTitle eyebrow="SUBSCRIPTIONS" title={<>A plan for <em>your FashionHub.</em></>} action={<span className="config-label">Prices are country-configured</span>}>Premium seller promotion is labelled and comparative. Mega Buyer is a paid membership badge, not identity verification. Membership does not guarantee increased sales.</PageTitle>
    {error && <Notice tone="error" title="Subscription action unavailable">{error}<button className="text-button" onClick={() => void load()}>Retry</button></Notice>}
    {message && <Notice tone="success" title="Subscription status">{message}</Notice>}
    <div className="subscription-layout"><div className="subscription-main">
      <section className="plan-section"><div className="section-subhead"><div><p className="eyebrow">{session?.user.role === 'seller' ? 'SELLER PLANS' : session?.user.role === 'buyer' ? 'BUYER PLAN' : 'MEMBERSHIP PLANS'}</p><h2>Choose your plan.</h2></div></div>
        {loading ? <Loading label="Loading plans…" /> : <><div className="plan-grid">{rolePlans.map((plan) => <label className={`plan-card ${planId === plan.id ? 'is-selected' : ''}`} key={plan.id}><input type="radio" name="plan" checked={planId === plan.id} onChange={() => { setPlanId(plan.id); if (plan.targetRoles?.length === 1 && plan.targetRoles[0] !== 'admin') setPayerType(plan.targetRoles[0] as 'buyer' | 'seller'); }} /><span className="plan-check" /><span className="plan-seed-label">{plan.isSeed ? 'PLAN PREVIEW' : 'BACKEND PLAN'}</span><h3>{plan.name ?? plan.id}</h3><strong>{priceFor(plan, countryCode)}</strong><p>Renewal: {plan.renewalPeriod || 'Awaiting confirmation'}</p><ul>{(plan.benefits ?? []).map((benefit) => <li key={benefit}>{benefit}</li>)}</ul>{plan.id === 'premium-seller' && <p className="promotion-disclosure"><span className="promotion-badge">{plan.promotionLabel ?? 'Featured'}</span> Paid placement is labelled. No sales outcome is promised.</p>}{plan.id === 'mega-buyer' && <p><span className="mega-member-badge"><ShieldCheck size={13} /> MEGA MEMBER · PAID</span> Not identity-verified.</p>}</label>)}</div>{rolePlans.some((plan) => plan.isSeed) && <Notice tone="warning" title="Plan previews only">The three displayed plans are development definitions, not live purchasable products. Backend plan configuration is required to submit a payment.</Notice>}</>}
      </section>
      <section className="current-plan-section"><div className="section-subhead"><div><p className="eyebrow">CURRENT MEMBERSHIP</p><h2>Your subscription status.</h2></div><button className="text-button" onClick={() => void load()} disabled={loading}><RefreshCw size={13} /> Refresh</button></div>
        {loading ? <Loading label="Checking subscription status…" /> : currentRecord ? <article className="subscription-record"><div><StatusBadge status={normalizedStatus(currentRecord)}>{normalizedStatus(currentRecord).replaceAll('_', ' ')}</StatusBadge><h3>{currentRecord.planName ?? currentRecord.planId ?? 'Subscription'}</h3><p>Payment: {currentRecord.paymentStatus ?? normalizedStatus(currentRecord)} · Country: {countryServiceName(countries, currentRecord.countryCode)}</p><p>Renewal date: {currentRecord.renewalDate ? new Date(currentRecord.renewalDate).toLocaleDateString() : 'Awaiting backend confirmation'}</p><p>Transaction: {currentRecord.transactionReference || 'Not submitted'}</p></div><div className="subscription-actions">{['approved', 'expired', 'declined', 'cancelled'].includes(currentRecord.status) && <button className="button button-outline" disabled={busy} onClick={() => void renew(currentRecord)}>Request renewal</button>}{currentRecord.status === 'approved' && <button className="button button-outline danger-action" disabled={busy} onClick={() => void cancel(currentRecord)}>Cancel subscription</button>}</div></article> : <EmptyState title="No current subscription">An active status is only shown when returned by the authenticated subscription service.</EmptyState>}
      </section>
      <form className="subscription-form" onSubmit={submit}><div className="panel-heading"><span className="step-number">01</span><div><h2>Manual payment submission</h2><p>Submit a reference for review. New submissions are always pending until admin approval.</p></div></div>
        {!session && <Notice tone="warning" title="Account required">Sign in to submit a subscription request.</Notice>}
        <div className="form-grid"><label className="field"><span>Payer account type</span><select value={payerType} onChange={(event) => setPayerType(event.target.value as 'buyer' | 'seller')} required><option value="buyer">Buyer</option><option value="seller">Seller</option></select></label><label className="field"><span>Country</span><select value={countryCode} onChange={(event) => setCountryCode(event.target.value)} required>{countries.map((item) => <option key={item.code} value={item.code}>{item.name} · {item.currency}</option>)}</select></label><label className="field"><span>Plan</span><select value={planId} onChange={(event) => setPlanId(event.target.value)} required disabled={!plansConnected}><option value="">{plansConnected ? 'Choose a plan' : 'Purchases await backend plan configuration'}</option>{rolePlans.filter((plan) => !plan.isSeed).map((plan) => <option key={plan.id} value={plan.id}>{plan.name ?? plan.id} · {priceFor(plan, countryCode)}</option>)}</select></label><label className="field"><span>Transaction reference</span><input value={reference} onChange={(event) => setReference(event.target.value)} required maxLength={120} autoComplete="off" placeholder="Reference from your payment receipt" /></label><label className="field field-wide"><span>Receipt image or PDF <small>optional</small></span><input type="file" accept="image/*,.pdf" onChange={(event) => setReceipt(event.target.files?.[0] ?? null)} /><small className="field-note">Sent to the subscription service when connected. It is not stored by this front end.</small></label></div>
        <div className="payment-instruction"><div><p className="eyebrow">{country.name.toUpperCase()} PAYMENT INSTRUCTIONS</p><p>{instructions}</p></div><span className="country-currency">{country.currency}</span></div>
        <Notice tone="warning" title="Safety">Never enter or share a mobile-money PIN, password or OTP. Uganda's 0773927881 instruction applies to Uganda only.</Notice>
        <label className="confirm-line"><input type="checkbox" required /><span>I understand this request remains pending until a human administrator reviews it.</span></label>
        <button className="button button-dark" type="submit" disabled={busy || loading || !session || !plansConnected || !selectedPlanIsConfigured || selectedPlan?.isSeed}>{busy ? 'Submitting to subscription service…' : <>Submit for verification <ArrowRight size={14} /></>}</button>
        {!plansConnected && <p className="field-note">Plan previews are not purchasable. Payment submission is disabled until a backend plan is configured.</p>}
        {plansConnected && !selectedPlanIsConfigured && <p className="field-note">This plan still needs confirmed payer eligibility, local price and renewal period before it can be purchased.</p>}
      </form>
      <section className="status-section"><div className="section-subhead"><div><p className="eyebrow">HISTORY</p><h2>Subscription history.</h2></div><select value={filter} onChange={(event) => setFilter(event.target.value)} aria-label="Filter subscription status"><option value="all">All statuses</option><option value="pending">Pending</option><option value="approved">Approved</option><option value="declined">Declined</option><option value="expired">Expired</option><option value="cancelled">Cancelled</option></select></div>
        {loading ? <Loading label="Loading subscription history…" /> : visibleRecords.length ? <div className="subscription-records">{visibleRecords.map((record) => <article className="subscription-record" key={record.id}><div><StatusBadge status={normalizedStatus(record)}>{normalizedStatus(record).replaceAll('_', ' ')}</StatusBadge><h3>{record.planName ?? record.planId ?? record.payerType} · {countryServiceName(countries, record.countryCode)}</h3><p>Payment: {record.paymentStatus ?? normalizedStatus(record)} · Renewal: {record.renewalDate ? new Date(record.renewalDate).toLocaleDateString() : 'Awaiting backend confirmation'}</p><p>Reference: {record.transactionReference || 'Not submitted'} · {record.requestType ?? 'new'}</p>{record.reviewerNote && <p>Review note: {record.reviewerNote}</p>}</div><div className="subscription-actions">{['approved', 'declined', 'expired', 'cancelled'].includes(record.status) && <button className="button button-outline" disabled={busy} onClick={() => void renew(record)}>Renew</button>}{record.status === 'approved' && <button className="button button-outline danger-action" disabled={busy} onClick={() => void cancel(record)}>Cancel</button>}</div></article>)}</div> : <EmptyState title="No subscription requests">A record appears here only after the subscription service confirms receipt.</EmptyState>}
      </section>
    </div><aside className="subscription-aside"><span className="aside-icon"><ShieldCheck size={20} /></span><p className="eyebrow">VERIFICATION STATUS</p><h2>Admin review is required.</h2><p>Submitted references never approve themselves. Basic Seller and Premium Seller are separate plans; Premium placement is labelled Featured or Sponsored and does not guarantee sales.</p><p>Blue Mega Member badges indicate paid membership only, not verified identity.</p><Notice tone="info">Other-country plan prices and payment instructions must be configured by an administrator. There are no currency conversions.</Notice><Link className="text-button" to="/support">Read subscription FAQ</Link></aside></div>
  </section>;
}

function countryServiceName(countries: ReturnType<typeof useAppContext>['countries'], code: string) {
  return countries.find((item) => item.code === code)?.name ?? code;
}
