import type { AccountSettings, Listing, Session } from '../types';
import { patchJson, request } from './http';

export const accountService = {
  savedListings: () => request<Listing[]>('/account/saved'),
  saveListing: (id: string) => request<void>(`/account/saved/${encodeURIComponent(id)}`, { method: 'PUT' }),
  removeSavedListing: (id: string) => request<void>(`/account/saved/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  settings: () => request<AccountSettings>('/account/settings'),
  updateSettings: (input: Partial<AccountSettings>) => request<AccountSettings>('/account/settings', patchJson(input)),
  deleteAccount: (confirmation: string) => request<void>('/account', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ confirmation }) }),
  requestSessionRefresh: () => request<Session>('/auth/session'),
};
