import type { Enquiry, EnquiryMessage } from '../types';
import { postJson, request } from './http';

export const enquiryService = {
  create: (input: { listingId: string; message: string }) => request<Enquiry>('/enquiries', postJson(input)),
  mine: () => request<Enquiry[]>('/account/enquiries'),
  sellerInbox: () => request<Enquiry[]>('/seller/enquiries'),
  reply: (id: string, message: string) => request<Enquiry>(`/seller/enquiries/${encodeURIComponent(id)}/reply`, postJson({ message })),
  messages: (id: string) => request<EnquiryMessage[]>(`/enquiries/${encodeURIComponent(id)}/messages`),
  sendMessage: (id: string, message: string) => request<EnquiryMessage>(`/enquiries/${encodeURIComponent(id)}/messages`, postJson({ message })),
};
