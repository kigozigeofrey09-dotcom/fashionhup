import { postJson, request } from './http';

export const reportService = {
  submit: (input: { listingId: string; reason: 'counterfeit' | 'spam' | 'harassment' | 'misleading' | 'other'; details: string }) =>
    request<{ id: string; status: string; createdAt: string }>('/reports', postJson(input)),
};
