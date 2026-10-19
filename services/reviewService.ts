import type { Review } from '../types';
import { postJson, request } from './http';

export const reviewService = {
  forListing: (listingId: string) => request<Review[]>(`/listings/${encodeURIComponent(listingId)}/reviews`),
  submitForOrder: (orderId: string, input: { rating: number; body: string }) => request<Review>(`/orders/${encodeURIComponent(orderId)}/review`, postJson(input)),
};
