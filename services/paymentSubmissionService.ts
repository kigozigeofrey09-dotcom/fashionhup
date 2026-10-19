import type { SubscriptionRecord } from '../types';
import { request } from './http';

export interface PaymentSubmissionInput {
  planId: string;
  payerType: 'buyer' | 'seller';
  countryCode: string;
  transactionReference: string;
  receipt?: File;
  requestType: 'new' | 'renewal';
}

export const paymentSubmissionService = {
  submit: (input: PaymentSubmissionInput) => {
    const form = new FormData();
    form.set('planId', input.planId);
    form.set('payerType', input.payerType);
    form.set('countryCode', input.countryCode);
    form.set('transactionReference', input.transactionReference);
    form.set('requestType', input.requestType);
    if (input.receipt) form.set('receipt', input.receipt);
    return request<SubscriptionRecord>('/subscriptions/submissions', { method: 'POST', body: form });
  },
};
