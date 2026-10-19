import type { Order, OrderCreateInput, OrderStatusUpdate } from '../types';
import { patchJson, postJson, request } from './http';

export const orderService = {
  create: (input: OrderCreateInput) => request<Order>('/orders', postJson(input)),
  mine: () => request<Order[]>('/account/orders'),
  sellerOrders: () => request<Order[]>('/seller/orders'),
  updateStatus: (id: string, input: OrderStatusUpdate) => request<Order>(`/orders/${encodeURIComponent(id)}/status`, patchJson(input)),
  markReadyForPickup: (id: string, note?: string) => request<Order>(`/seller/orders/${encodeURIComponent(id)}/pickup-ready`, postJson({ note })),
  markInDelivery: (id: string, note?: string) => request<Order>(`/seller/orders/${encodeURIComponent(id)}/delivery`, postJson({ note })),
};
