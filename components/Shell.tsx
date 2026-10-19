import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet } from 'react-router-dom';
import { ArrowUpRight, Bell, LogOut, Menu, X, Sparkles, Flame, ShieldAlert } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAppContext } from '../context/AppContext';
import { subscriptionsEnabled } from '../config/features';
import { notificationService } from '../services/notificationService';

const links = [
  { to: '/', label: 'Discover', end: true },
  { to: '/style-swipe', label: '🔥 Style Swipe' },
  { to: '/drip-ai', label: '✨ Drip AI Stylist' },
  { to: '/seller/setup', label: 'Open a shop' },
  { to: '/support', label: 'Support' },
];

export function Shell() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const { session, signOut } = useAppContext();
  const navigate = useNavigate();
  useEffect(() => {
    if (!session) { setUnread(0); return; }
    let active = true;
    const refreshUnread = () => void notificationService.unreadCount().then((result) => { if (active) setUnread(result.unread); }).catch(() => { if (active) setUnread(0); });
    refreshUnread();
    const timer = window.setInterval(refreshUnread, 30_000);
    window.addEventListener('focus', refreshUnread);
    return () => { active = false; window.clearInterval(timer); window.removeEventListener('focus', refreshUnread); };
  }, [session]);
  return <>
    <header className="site-header">
      <Link className="brand" to="/" aria-label="FashionHub home"><span className="brand-mark">F<span>h</span></span><span>fashion<span className="brand-light">hub</span></span></Link>
      <button className="mobile-menu" type="button" aria-label={menuOpen ? 'Close navigation' : 'Open navigation'} aria-expanded={menuOpen} onClick={() => setMenuOpen(!menuOpen)}>{menuOpen ? <X size={20} /> : <Menu size={20} />}</button>
      <nav className={`main-nav ${menuOpen ? 'is-open' : ''}`} aria-label="Main navigation">
        {links.map(link => <NavLink key={link.to} to={link.to} end={link.end} onClick={() => setMenuOpen(false)}>{link.label}</NavLink>)}
        {subscriptionsEnabled && <NavLink to="/subscriptions" onClick={() => setMenuOpen(false)}>Subscriptions</NavLink>}
        {session && <NavLink to="/notifications" onClick={() => setMenuOpen(false)}>Notifications</NavLink>}
        {session?.user.role === 'seller' && <NavLink to="/seller/dashboard" onClick={() => setMenuOpen(false)}>Seller studio</NavLink>}
        {session?.user.role === 'admin' && <NavLink to="/admin" onClick={() => setMenuOpen(false)}>Admin</NavLink>}
      </nav>
      <div className="header-actions">
        {session && <Link className="notification-link" to="/notifications" aria-label={`Notifications${unread ? `, ${unread} unread` : ''}`}><Bell size={17} />{unread > 0 && <span>{unread > 9 ? '9+' : unread}</span>}</Link>}
        <Link className="account-link" to="/account">{session ? session.user.name : 'My account'} <ArrowUpRight size={14} /></Link>
        {!session && <Link className="header-signin" to="/auth/sign-in">Sign in</Link>}
        {session && <span className="role-pill">{session.user.role}</span>}
        {session && <button type="button" className="button button-outline" onClick={async () => { await signOut().catch(() => undefined); setMenuOpen(false); navigate('/auth/sign-in', { replace: true }); }} aria-label="Sign out"><LogOut size={14} /><span>Sign out</span></button>}
      </div>
    </header>
    <main className="app-main"><Outlet /></main>
    <footer className="site-footer">
      <Link className="brand brand-footer" to="/"><span className="brand-mark">F<span>h</span></span><span>fashion<span className="brand-light">hub</span></span></Link>
      <nav aria-label="Footer links">{subscriptionsEnabled && <Link to="/subscriptions">Subscriptions</Link>}<Link to="/enquiries">Enquiries & orders</Link><Link to="/notifications">Notifications</Link><Link to="/support">FAQ & support</Link><Link to="/policies">Policies</Link></nav>
      <span>FashionHub · independent fashion marketplace</span>
    </footer>
  </>;
}
