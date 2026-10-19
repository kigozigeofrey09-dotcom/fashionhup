import type { AdminSettings, Country, MarketplaceReport, SafetyReport, SubscriptionRecord, SubscriptionStatus } from '../types';
import { postJson, putJson, request } from './http';

export const adminService = {
  settings: () => request<AdminSettings>('/admin/settings'),
  updateSettings: (input: AdminSettings) => request<AdminSettings>('/admin/settings', putJson(input)),
  updateSubscriptionAccess: (requiredRoles: Array<'buyer' | 'seller'>) => request<{ requiredRoles: Array<'buyer' | 'seller'> }>('/admin/settings/subscription-access', putJson({ requiredRoles })),
  sellersReport: () => request<MarketplaceReport[]>('/admin/reports/sellers'),
  listingsReport: () => request<MarketplaceReport[]>('/admin/reports/listings'),
  reportsQueue: () => request<SafetyReport[]>('/admin/reports'),
  reviewReport: (id: string, status: Extract<SafetyReport['status'], 'reviewing' | 'resolved' | 'dismissed'>) => request<SafetyReport>(`/admin/reports/${encodeURIComponent(id)}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) }),
  paymentQueue: () => request<SubscriptionRecord[]>('/admin/subscriptions'),
  reviewPayment: (id: string, input: { decision: 'approved' | 'declined'; note?: string }) => request<SubscriptionRecord>(`/admin/subscriptions/${encodeURIComponent(id)}/review`, postJson(input)),
  setSubscriptionStatus: (id: string, status: SubscriptionStatus, note?: string) => request<SubscriptionRecord>(`/admin/subscriptions/${encodeURIComponent(id)}/status`, postJson({ status, note })),
  createCountry: (country: Country) => request<Country>('/admin/countries', postJson(country)),
  updatePaymentInstructions: (code: string, paymentInstructions: string) => request<Country>(`/admin/countries/${encodeURIComponent(code)}/payment-instructions`, putJson({ paymentInstructions })),
  mapNodes: () => request<import('../types').AdminMapNode[]>('/admin/map'),
  verifyShop: (id: string, isVerified: boolean) => request<import('../types').Shop>(`/admin/shops/${encodeURIComponent(id)}/verify`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ isVerified }) }),
  promotions: () => request<import('../types').PromotionAd[]>('/admin/promotions'),
  savePromotion: (input: { title: string; type: string; budget: string; expiresAt: string }) => request<import('../types').PromotionAd>('/admin/promotions', postJson(input)),
  analytics: () => request<import('../types').PlatformAnalytics>('/admin/analytics'),
};
