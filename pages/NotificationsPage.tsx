import { useEffect, useState } from 'react';
import { Bell, CheckCheck, RefreshCw } from 'lucide-react';
import { Link } from 'react-router-dom';
import { EmptyState, Loading, Notice, PageTitle } from '../components/ui';
import { notificationService } from '../services/notificationService';
import { errorMessage } from '../services/http';
import { useAppContext } from '../context/AppContext';
import type { Notification } from '../types';

export function NotificationsPage() {
  const { session } = useAppContext();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  async function load() {
    if (!session) return;
    setLoading(true); setError('');
    try { setNotifications(await notificationService.mine()); }
    catch (caught) { setError(errorMessage(caught)); }
    finally { setLoading(false); }
  }
  useEffect(() => { void load(); }, [session]);

  async function markRead(item: Notification) {
    setBusyId(item.id); setError('');
    try {
      const updated = await notificationService.markRead(item.id);
      setNotifications((current) => current.map((notification) => notification.id === updated.id ? updated : notification));
    } catch (caught) { setError(errorMessage(caught)); }
    finally { setBusyId(''); }
  }

  async function markAllRead() {
    setBusyId('all'); setError(''); setMessage('');
    try { await notificationService.markAllRead(); await load(); setMessage('The notification service confirmed all messages as read.'); }
    catch (caught) { setError(errorMessage(caught)); }
    finally { setBusyId(''); }
  }

  return <section className="content-page notifications-page">
    <PageTitle eyebrow="ACCOUNT NOTIFICATIONS" title={<>Your latest <em>updates.</em></>} action={<button className="button button-outline" onClick={() => void markAllRead()} disabled={!session || busyId !== ''}><CheckCheck size={14} /> Mark all read</button>}>Notifications are loaded from your account service. They are not generated or stored locally.</PageTitle>
    {!session && <Notice tone="warning" title="Sign in required">Notifications are private to your authenticated backend account.</Notice>}
    {session && error && <Notice tone="error" title="Notifications unavailable">{error}<button className="text-button" onClick={() => void load()}>Retry</button></Notice>}
    {message && <Notice tone="success">{message}</Notice>}
    {loading && <Loading label="Loading notifications…" />}
    {session && !loading && notifications.length ? <div className="notification-list">{notifications.map((item) => <article className={`notification-row ${item.readAt ? 'is-read' : 'is-unread'}`} key={item.id}><span className="notification-icon"><Bell size={16} /></span><div><span className="listing-type">{item.kind}</span><h2>{item.title}</h2><p>{item.message}</p><time dateTime={item.createdAt}>{new Date(item.createdAt).toLocaleString()}</time>{item.href && <Link to={item.href}>Open <span>↗</span></Link>}</div>{!item.readAt && <button className="text-button" disabled={busyId === item.id} onClick={() => void markRead(item)}>{busyId === item.id ? 'Updating…' : 'Mark read'}</button>}</article>)}</div> : session && !loading && <EmptyState title="No notifications">The notification service has not returned any account updates.</EmptyState>}
    <button className="text-button reload-link" onClick={() => void load()} disabled={loading}><RefreshCw size={14} /> Refresh notifications</button>
  </section>;
}
