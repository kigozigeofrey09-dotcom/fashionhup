import type { SubscriptionAccess, SubscriptionPlan, SubscriptionRecord, SubscriptionStatus } from '../types';
import { request } from './http';

export const subscriptionService = {
  plans: () => request<SubscriptionPlan[]>('/subscriptions/plans'),
  mine: () => request<SubscriptionRecord[]>('/subscriptions/mine'),
  accessRules: () => request<{ requiredRoles: Array<'buyer' | 'seller'> }>('/subscription-access/rules'),
  access: () => request<SubscriptionAccess>('/subscriptions/access'),
  cancel: (id: string) => request<SubscriptionRecord>(`/subscriptions/${encodeURIComponent(id)}/cancel`, { method: 'POST' }),
  requestRenewal: (id: string) => request<SubscriptionRecord>(`/subscriptions/${encodeURIComponent(id)}/renew`, { method: 'POST' }),
  status: (id: string) => request<SubscriptionRecord>(`/subscriptions/${encodeURIComponent(id)}`),
  normalizeStatus: (status: SubscriptionStatus) => status,
};
