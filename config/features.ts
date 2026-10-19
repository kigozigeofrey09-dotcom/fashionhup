// Keep subscription code available while it is temporarily paused.
// Set VITE_SUBSCRIPTIONS_ENABLED=true to restore plan pages and access checks.
export const subscriptionsEnabled = import.meta.env.VITE_SUBSCRIPTIONS_ENABLED === 'true';
export const demoDataEnabled = false;
