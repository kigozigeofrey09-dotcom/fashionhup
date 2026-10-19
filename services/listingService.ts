import type { Listing } from '../types';
import { patchJson, postJson, request } from './http';

export const listingService = {
  search: (filters: URLSearchParams) => request<Listing[]>(`/listings?${filters.toString()}`),
  get: (id: string) => request<Listing>(`/listings/${encodeURIComponent(id)}`),
  forShop: (shopId: string) => request<Listing[]>(`/listings?shopId=${encodeURIComponent(shopId)}`),
  mine: () => request<Listing[]>('/listings/mine'),
  create: (input: Record<string, unknown>) => request<Listing>('/listings', postJson(input)),
  update: (id: string, input: Record<string, unknown>) => request<Listing>(`/listings/${encodeURIComponent(id)}`, patchJson(input)),
  remove: (id: string) => request<void>(`/listings/${encodeURIComponent(id)}`, { method: 'DELETE' }),
};
