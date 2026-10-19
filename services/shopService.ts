import type { Shop } from '../types';
import { patchJson, postJson, request } from './http';

export const shopService = {
  get: (id: string) => request<Shop>(`/shops/${encodeURIComponent(id)}`),
  getMine: () => request<Shop | null>('/shops/mine'),
  list: () => request<Shop[]>('/shops'),
  create: (input: Record<string, unknown>) => request<Shop>('/shops', postJson(input)),
  update: (id: string, input: Record<string, unknown>) => request<Shop>(`/shops/${encodeURIComponent(id)}`, patchJson(input)),
};
