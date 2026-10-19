import { useEffect, useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { EmptyState, Loading, Notice, PageTitle, StatusBadge } from '../components/ui';
import { MegaMemberBadge, StorefrontAccessPrompt } from '../components/AccessPrompt';
import { useStorefrontAccess } from '../hooks/useStorefrontAccess';
import { errorMessage } from '../services/http';
import { enquiryService } from '../services/enquiryService';
import { orderService } from '../services/orderService';
import { seedListings } from '../data/seed';
import { listingService } from '../services/listingService';
import { demoDataEnabled } from '../config/features';
import { useAppContext } from '../context/AppContext';
import type { Enquiry, EnquiryMessage, Listing, Order } from '../types';

export function EnquiriesPage() {
  const { session } = useAppContext();
  const access = useStorefrontAccess();
  const [searchParams] = useSearchParams();
  const [listingId, setListingId] = useState(searchParams.get('listingId') ?? '');
  const [message, setMessage] = useState('');
  const [enquiries, setEnquiries] = useState<Enquiry[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [listings, setListings] = useState<Listing[]>([]);
  const [actionType, setActionType] = useState<'enquiry' | 'order'>('enquiry');
  const [quantity, setQuantity] = useState('1');
  const [fulfillment, setFulfillment] = useState<'pickup' | 'delivery'>('pickup');
  const [fulfillmentDetails, setFulfillmentDetails] = useState('');
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  async function load() {
    if (!session) return;
    setLoading(true);
    setError('');
    const [inbox, history] = await Promise.allSettled([
      session.user.role === 'seller' ? enquiryService.sellerInbox() : enquiryService.mine(),
      session.user.role === 'seller' ? orderService.sellerOrders() : orderService.mine(),
    ]);
    if (inbox.status === 'fulfilled') setEnquiries(inbox.value);
    else setError(errorMessage(inbox.reason));
    if (history.status === 'fulfilled') setOrders(history.value);
    else setError((current) => current || errorMessage(history.reason));
    setLoading(false);
  }

  useEffect(() => { void load(); }, [session]);
  useEffect(() => {
    if (!session || session.user.role === 'seller') return;
    void listingService.search(new URLSearchParams())
      .then(setListings)
      .catch((caught) => setError(errorMessage(caught)));
  }, [session]);

  async function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true); setError(''); setNotice('');
    try {
      const created = await enquiryService.create({ listingId, message: message.trim() });
      setNotice(`The enquiry service accepted reference ${created.id}.`);
      setMessage(''); await load();
    } catch (caught) { setError(errorMessage(caught)); }
    finally { setBusy(false); }
  }

  async function placeOrder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true); setError(''); setNotice('');
    try {
      const created = await orderService.create({ listingId, quantity: Number(quantity), fulfillment, fulfillmentDetails: fulfillmentDetails.trim(), buyerMessage: message.trim() || undefined });
      setNotice(`Order ${created.id} was received by the orders service with status ${created.status}.`);
      setMessage(''); setFulfillmentDetails(''); await load();
    } catch (caught) { setError(errorMessage(caught)); }
    finally { setBusy(false); }
  }

  async function updateOrderStatus(orderId: string, status: Order['status']) {
    setBusy(true); setError(''); setNotice('');
    try {
      const updated = status === 'ready_for_pickup'
        ? await orderService.markReadyForPickup(orderId)
        : status === 'in_delivery'
          ? await orderService.markInDelivery(orderId)
          : await orderService.updateStatus(orderId, { status });
      setOrders((current) => current.map((order) => order.id === updated.id ? updated : order));
      setNotice(`Order status updated to ${updated.status} by the orders service.`);
    } catch (caught) { setError(errorMessage(caught)); }
    finally { setBusy(false); }
  }

  const listingChoices = demoDataEnabled ? [...seedListings, ...listings] : listings;

  return (
    <section className="content-page">
      <PageTitle eyebrow="BUYER & SELLER" title={<>Enquiries & <em>order status.</em></>} action={<Link className="button button-outline" to="/">Browse listings</Link>}>
        Enquiry and order data is private to your authenticated backend session. No delivery integration is included.
      </PageTitle>
      {!session && <Notice tone="warning" title="Account required">Sign in to submit an enquiry or view account messages. No order or local success record is created here.</Notice>}
      {!session && <Link className="button button-dark" to="/auth/sign-in">Sign in</Link>}
      {session && !access.active && <StorefrontAccessPrompt itemLabel="enquiries and orders" />}
      {session && access.active && (
        <>
          <MegaMemberBadge />
          <div className="orders-layout">
            {session.user.role !== 'seller' && (
              <section className="subsection">
                <p className="eyebrow">CONTACT A SELLER</p>
                <div className="account-tabs">
                  <button className={actionType === 'enquiry' ? 'is-active' : ''} onClick={() => setActionType('enquiry')}>Enquiry</button>
                  <button className={actionType === 'order' ? 'is-active' : ''} onClick={() => setActionType('order')}>Order request</button>
                </div>
                <form className="form-stack" onSubmit={actionType === 'enquiry' ? send : placeOrder}>
                  <label className="field">
                    <span>Listing</span>
                    <select required value={listingId} onChange={(event) => setListingId(event.target.value)}>
                      <option value="">Choose a listing</option>
                      {listingChoices.map((item) => <option value={item.id} key={item.id}>{item.name} · {item.shopName}{item.isSeed ? ' · SAMPLE' : ''}</option>)}
                    </select>
                    {demoDataEnabled && <small className="field-note">Sample entries are examples only; the backend must validate live listing IDs.</small>}
                  </label>
                  {actionType === 'order' && <>
                    <label className="field"><span>Quantity</span><input type="number" min="1" max="99" value={quantity} onChange={(event) => setQuantity(event.target.value)} required /></label>
                    <label className="field"><span>Fulfillment</span><select value={fulfillment} onChange={(event) => setFulfillment(event.target.value as 'pickup' | 'delivery')}><option value="pickup">Pickup</option><option value="delivery">Delivery</option></select></label>
                    <label className="field"><span>{fulfillment === 'pickup' ? 'Pickup details' : 'Delivery address and details'}</span><textarea value={fulfillmentDetails} onChange={(event) => setFulfillmentDetails(event.target.value)} required minLength={5} maxLength={500} rows={3} placeholder={fulfillment === 'pickup' ? 'Preferred pickup location or time' : 'Address and delivery instructions'} /></label>
                  </>}
                  <label className="field"><span>{actionType === 'order' ? 'Message to seller (optional)' : 'Your message'}</span><textarea value={message} onChange={(event) => setMessage(event.target.value)} required={actionType === 'enquiry'} minLength={actionType === 'enquiry' ? 10 : 0} maxLength={800} rows={4} /></label>
                  <button className="button button-dark" disabled={busy || !listingChoices.length}>{busy ? 'Sending to backend…' : actionType === 'order' ? 'Submit order request' : 'Send enquiry'}</button>
                  {!listingChoices.length && <p className="field-note">No live listings are available to contact yet.</p>}
                </form>
              </section>
            )}
            {session.user.role === 'seller' ? (
              <section className="subsection">
                <p className="eyebrow">SELLER INBOX</p><h2>Buyer enquiries.</h2>
                {loading ? <Loading label="Loading seller enquiries…" /> : enquiries.length ? enquiries.map((item) => (
                  <article className="seller-enquiry" key={item.id}><div><StatusBadge status={item.status}>{item.status}</StatusBadge><h3>{item.message}</h3><p>Buyer enquiry · {new Date(item.createdAt).toLocaleDateString()}</p></div><ConversationThread item={item} /></article>
                )) : <EmptyState title="No seller enquiries">New buyer conversations will appear here.</EmptyState>}
              </section>
            ) : (
              <section className="subsection">
                <p className="eyebrow">YOUR INBOX</p><h2>Recent enquiries.</h2>
                {loading ? <Loading label="Loading enquiries…" /> : enquiries.length ? enquiries.map((item) => (
                  <article className="inquiry-row" key={item.id}><div><StatusBadge status={item.status}>{item.status}</StatusBadge><h3>{item.message}</h3><p>Enquiry {item.id} · {new Date(item.createdAt).toLocaleDateString()}</p></div><ConversationThread item={item} /></article>
                )) : <EmptyState title="No enquiries">Your conversations with sellers will appear here.</EmptyState>}
              </section>
            )}
          </div>
          <section className="subsection order-history">
            <p className="eyebrow">{session.user.role === 'seller' ? 'SELLER ORDER STATUS' : 'ORDER STATUS'}</p>
            <h2>{session.user.role === 'seller' ? 'Orders to fulfill.' : 'Order history.'}</h2>
            {loading ? <Loading /> : orders.length ? orders.map((item) => (
              <article className="inquiry-row" key={item.id}>
                <div><StatusBadge status={item.status}>{item.status.replaceAll('_', ' ')}</StatusBadge><h3>Order {item.id}</h3><p>{item.fulfillment} · Updated {new Date(item.updatedAt ?? item.createdAt).toLocaleDateString()}</p></div>
                {session.user.role === 'seller' && item.status === 'submitted' && <div className="subscription-actions"><button className="button button-dark" disabled={busy} onClick={() => void updateOrderStatus(item.id, 'accepted')}>Accept request</button><button className="button button-outline danger-action" disabled={busy} onClick={() => void updateOrderStatus(item.id, 'cancelled')}>Decline</button></div>}
                {session.user.role === 'seller' && item.status === 'accepted' && <div className="subscription-actions"><button className="button button-outline" disabled={busy} onClick={() => void updateOrderStatus(item.id, 'ready_for_pickup')}>Ready for pickup</button><button className="button button-outline" disabled={busy} onClick={() => void updateOrderStatus(item.id, 'in_delivery')}>In delivery</button></div>}
                {session.user.role === 'seller' && (item.status === 'ready_for_pickup' || item.status === 'in_delivery') && <button className="button button-outline" disabled={busy} onClick={() => void updateOrderStatus(item.id, 'completed')}>Mark order complete</button>}
              </article>
            )) : <EmptyState title="No orders">No order record is shown until the orders API returns one.</EmptyState>}
          </section>
          {error && <Notice tone="error" title="Request unavailable">{error}<button className="text-button" onClick={() => void load()}>Retry</button></Notice>}
          {notice && <Notice tone="success">{notice}</Notice>}
        </>
      )}
    </section>
  );
}

function ConversationThread({ item }: { item: Enquiry }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<EnquiryMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    let active = true;
    const refresh = async () => {
      try {
        const result = await enquiryService.messages(item.id);
        if (active) { setMessages(result); setError(''); }
      } catch (caught) { if (active) setError(errorMessage(caught)); }
      finally { if (active) setLoading(false); }
    };
    setLoading(true);
    void refresh();
    const timer = window.setInterval(() => void refresh(), 15000);
    return () => { active = false; window.clearInterval(timer); };
  }, [open, item.id]);

  async function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const body = draft.trim();
    if (!body) return;
    setBusy(true); setError('');
    try {
      const created = await enquiryService.sendMessage(item.id, body);
      setMessages((current) => [...current, created]);
      setDraft('');
    } catch (caught) { setError(errorMessage(caught)); }
    finally { setBusy(false); }
  }

  return <div className="form-stack">
    <button className="text-button" type="button" onClick={() => setOpen((value) => !value)}>{open ? 'Close conversation' : 'Open conversation'}</button>
    {open && <>
      <div className="conversation-messages" aria-live="polite">
        {loading && !messages.length ? <Loading label="Loading conversation…" /> : messages.map((message) => <article className="inquiry-row" key={message.id}><div><span className="listing-type">{message.senderRole === 'buyer' ? 'Buyer' : 'Seller'}</span><p>{message.body}</p><time dateTime={message.createdAt}>{new Date(message.createdAt).toLocaleString()}</time></div></article>)}
        {!loading && !messages.length && <p className="field-note">No messages in this conversation yet.</p>}
      </div>
      {error && <Notice tone="error" title="Conversation unavailable">{error}<button type="button" className="text-button" onClick={() => void enquiryService.messages(item.id).then(setMessages).catch((caught) => setError(errorMessage(caught)))}>Retry</button></Notice>}
      <form className="form-stack" onSubmit={send}>
        <label className="field"><span>Your message</span><textarea value={draft} onChange={(event) => setDraft(event.target.value)} minLength={1} maxLength={2000} required rows={3} placeholder="Write a message…" /></label>
        <button className="button button-outline" disabled={busy || !draft.trim()}>{busy ? 'Sending…' : 'Send message'}</button>
      </form>
    </>}
  </div>;
}
