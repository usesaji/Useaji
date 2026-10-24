/** Activity, statements (`/v1/activity`, `/v1/statements`) and notifications (`/v1/notifications/*`). */
import { apiGet, apiPost, type Page } from "@/lib/api/client";
import type { ActivityItemDto, ActivityKind, NotificationDto, StatementDto, UnreadCountDto } from "@/lib/api/dto";

export const listActivity = (query: { type?: ActivityKind; groupId?: string; page?: number; limit?: number } = {}) =>
	apiGet<Page<ActivityItemDto>>("/activity", query);

/** One activity item (your own only), for the transaction details screen. */
export const getActivityItem = (id: string) => apiGet<ActivityItemDto>(`/activity/${id}`);

/** `from` / `to` are UTC dates (YYYY-MM-DD), inclusive. The screen builds the CSV. */
export const getStatement = (query: { from?: string; to?: string }) => apiGet<StatementDto>("/statements", query);

export const listNotifications = (query: { unreadOnly?: boolean; page?: number; limit?: number } = {}) =>
	apiGet<Page<NotificationDto>>("/notifications", query);

export const unreadCount = () => apiGet<UnreadCountDto>("/notifications/unread-count");

export const markAllRead = () => apiPost<{ updated: number }>("/notifications/read-all");

export const markRead = (id: string) => apiPost<null>(`/notifications/${id}/read`);
