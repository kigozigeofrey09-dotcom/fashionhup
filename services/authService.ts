import type { AccountRole, Session, User } from '../types';
import { postJson, request } from './http';

export const authService = {
  getSession: () => request<Session>('/auth/session'),
  signIn: (input: { email: string; password: string; role: AccountRole }) => request<{ user: User }>('/auth/sign-in', postJson(input)),
  signUp: (input: { name: string; email: string; password: string; role: AccountRole; countryCode: string }) => request<{ message: string }>('/auth/sign-up-password', postJson(input)),
  requestPasswordReset: (email: string) => request<{ message: string }>('/auth/password/forgot', postJson({ email })),
  confirmPasswordReset: (password: string) => request<{ message: string }>('/auth/password/reset/confirm', postJson({ password })),
  whoAmI: () => request<User>('/auth/me'),
  signOut: () => request<void>('/auth/sign-out', { method: 'POST' }),
};
