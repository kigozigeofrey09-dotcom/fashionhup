import { Link } from 'react-router-dom';
import { ArrowUpRight, Heart, MapPin, MessageCircle } from 'lucide-react';
import type { Listing } from '../types';

export function PageTitle({ eyebrow, title, children, action }: { eyebrow: string; title: React.ReactNode; children?: React.ReactNode; action?: React.ReactNode }) {
  return <div className="page-title"><div><p className="eyebrow"><span className="eyebrow-line" />{eyebrow}</p><h1>{title}</h1>{children && <p className="page-description">{children}</p>}</div>{action && <div className="page-title-action">{action}</div>}</div>;
}

export function Notice({ tone = 'info', title, children }: { tone?: 'info' | 'warning' | 'error' | 'success'; title?: string; children: React.ReactNode }) {
  return <div className={`notice notice-${tone}`} role={tone === 'error' ? 'alert' : 'status'}>{title && <strong>{title}</strong>}<div>{children}</div></div>;
}

export function Loading({ label = 'Loading…' }: { label?: string }) {
  return <div className="loading-state" role="status"><span className="spinner" />{label}</div>;
}

export function EmptyState({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return <div className="empty-state"><span className="empty-mark">✳</span><h2>{title}</h2><p>{children}</p>{action}</div>;
}

export function SeedNotice() {
  return <Notice tone="warning" title="Development seed data">These sample listings are bundled for preview. They are not live, shared, or available to purchase.</Notice>;
}

export function whatsappHref(phone: string, message: string) {
  const internationalDigits = phone.replace(/\D/g, '');
  return `https://wa.me/${internationalDigits}?text=${encodeURIComponent(message)}`;
}

export function ListingCard({ listing, onSave, saved = false }: { listing: Listing; onSave?: (listing: Listing) => void; saved?: boolean }) {
  return <article className="listing-card">
    <Link className="listing-image" to={`/listings/${listing.id}`} aria-label={`View ${listing.name}`}>
      <img src={listing.image} alt={listing.name} loading="lazy" />
      <span className="listing-category">{listing.category}</span>
      {listing.isSeed && <span className="sample-corner">SAMPLE</span>}
      {listing.promotionLabel && <span className="paid-promotion-badge">{listing.promotionLabel === 'Sponsored' ? 'SPONSORED' : 'FEATURED'}</span>}
    </Link>
    {onSave && <button className={`icon-button save-button ${saved ? 'is-saved' : ''}`} aria-label={saved ? `Remove ${listing.name} from saved items` : `Save ${listing.name}`} onClick={() => onSave(listing)}><Heart size={17} fill={saved ? 'currentColor' : 'none'} /></button>}
    <div className="listing-card-body">
      <div className="listing-name-price"><Link to={`/listings/${listing.id}`}><h3>{listing.name}</h3></Link><strong>{listing.currency} {listing.price.toLocaleString()}</strong></div>
      <Link className="listing-shop" to={`/shops/${listing.shopId}`}>{listing.shopName}<ArrowUpRight size={13} /></Link>
      <div className="listing-location"><MapPin size={12} />{listing.city}, {listing.countryName}<span>· {listing.type}</span></div>
      {listing.sellerWhatsapp ? <a className="button button-outline" href={whatsappHref(listing.sellerWhatsapp, `Hi, I found ${listing.name} on FashionHub. Is it available?`)} target="_blank" rel="noopener noreferrer"><MessageCircle size={14} /> WhatsApp seller</a> : <Link className="button button-outline" to={`/listings/${listing.id}#whatsapp-order`}><MessageCircle size={14} /> WhatsApp seller</Link>}
    </div>
  </article>;
}

export function StatusBadge({ children, status }: { children: React.ReactNode; status: string }) {
  return <span className={`status-badge status-${status.replaceAll('_', '-')}`}>{children}</span>;
}

export function FormError({ message }: { message?: string }) {
  return message ? <p className="field-error" role="alert">{message}</p> : null;
}
