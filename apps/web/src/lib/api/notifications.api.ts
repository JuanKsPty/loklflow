import { api } from './client';
import type { Notification, UnreadCount } from '@loklflow/types';

export const notificationsApi = {
  getAll: () => api.get<Notification[]>('/notifications'),
  unreadCount: () => api.get<UnreadCount>('/notifications/unread-count'),
  markRead: (id: string) => api.patch<Notification>(`/notifications/${id}/read`),
  markAllRead: () => api.patch<UnreadCount>('/notifications/read-all'),
};
