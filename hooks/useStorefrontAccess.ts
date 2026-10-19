import { useAppContext } from '../context/AppContext';
import { subscriptionsEnabled } from '../config/features';

export function useStorefrontAccess() {
  const { session, subscriptionRequiredRoles, subscriptionAccess, accessRulesAreSeeded } = useAppContext();
  const role = session?.user.role ?? 'buyer';
  const required = subscriptionsEnabled && subscriptionRequiredRoles.includes(role);
  const active = !subscriptionsEnabled || !required || subscriptionAccess?.status === 'active';
  return { session, required, active, accessStatus: subscriptionAccess?.status, accessRulesAreSeeded };
}
