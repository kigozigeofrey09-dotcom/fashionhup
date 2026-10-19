import type { Listing, Shop } from '../types';
import { request } from './http';

export const marketplaceService = {
  searchListings: (filters: URLSearchParams) => request<Listing[]>(`/listings?${filters.toString()}`),
  searchShops: (filters: URLSearchParams) => request<Shop[]>(`/shops?${filters.toString()}`),
};
