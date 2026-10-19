import { Link } from 'react-router-dom';
import { LockKeyhole, ShieldCheck } from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import { subscriptionsEnabled } from '../config/features';
import { useStorefrontAccess } from '../hooks/useStorefrontAccess';
import { Notice } from './ui';

export function StorefrontAccessPrompt({ itemLabel = 'full storefronts and listing details' }: { itemLabel?: string }) {
  const { session, accessStatus, accessRulesAreSeeded } = useStorefrontAccess();
  const pending = accessStatus === 'pending';
  return <section className="access-prompt content-page">
    <span className="access-lock"><LockKeyhole size={21} /></span>
    <p className="eyebrow">MEGA BUYER ACCESS</p>
    <h1>{pending ? 'Your membership is pending.' : 'A little more access.'}</h1>
    <p>{pending ? 'Your payment is pending manual verification. Full seller storefronts remain locked until the subscription service confirms an active membership.' : `A Mega Buyer subscription is required to open ${itemLabel}. Marketplace previews remain available while you choose a plan.`}</p>
    {accessRulesAreSeeded && <Notice tone="warning">The buyer subscription requirement shown here is a development default. The backend access policy has not been connected.</Notice>}
    {pending && <Notice tone="info" title="Pending verification">Submitting a transaction reference does not activate membership. Only the backend admin review can update access.</Notice>}
    <div className="access-actions">{session ? <Link className="button button-dark" to="/subscriptions">{pending ? 'Check subscription status' : 'View Mega Buyer plan'} <ShieldCheck size={14} /></Link> : <Link className="button button-dark" to="/auth/sign-in">Sign in or create an account</Link>}<Link className="button button-outline" to="/subscriptions">See subscription plans</Link><Link className="text-button" to="/">Back to marketplace</Link></div>
  </section>;
}

export function MegaMemberBadge() {
  if (!subscriptionsEnabled) return null;
  const { session, subscriptionAccess } = useAppContext();
  const record = subscriptionAccess?.activeRecord;
  if (session?.user.role !== 'buyer' || subscriptionAccess?.status !== 'active' || !record || !(record.planId === 'mega-buyer' || record.planName === 'Mega Buyer')) return null;
  return <span className="mega-member-badge" title="Paid Mega Buyer membership. This is not an identity verification badge."><ShieldCheck size={13} /> MEGA MEMBER · PAID</span>;
}
