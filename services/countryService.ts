import type { Country } from '../types';
import { postJson, putJson, request } from './http';

export const countryService = {
  list: () => request<Country[]>('/countries'),
  listAdmin: () => request<Country[]>('/admin/countries'),
  create: (country: Country) => request<Country>('/admin/countries', postJson(country)),
  updateCurrency: (code: string, currency: string) => request<Country>(`/admin/countries/${encodeURIComponent(code)}/currency`, putJson({ currency })),
  updatePaymentInstructions: (code: string, paymentInstructions: string) => request<Country>(`/admin/countries/${encodeURIComponent(code)}/payment-instructions`, putJson({ paymentInstructions })),
};
