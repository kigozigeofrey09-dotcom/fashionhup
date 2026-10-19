import type { Notification } from '../types';
import { request } from './http';

export const notificationService = {
  mine: () => request<Notification[]>('/account/notifications'),
  unreadCount: () => request<{ unread: number }>('/account/notifications/unread-count'),
  markRead: (id: string) => request<Notification>(`/account/notifications/${encodeURIComponent(id)}/read`, { method: 'POST' }),
  markAllRead: () => request<void>('/account/notifications/read-all', { method: 'POST' }),
};
