"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getActivityItem, getStatement, listActivity, listNotifications, markAllRead, markRead, unreadCount } from "@/features/activity/api";
import type { ActivityKind, NotificationDto } from "@/lib/api/dto";
import { pageRoutes } from "@/lib/routes";

export function useActivity(query: { type?: ActivityKind; groupId?: string; page?: number; limit?: number } = {}) {
	return useQuery({ queryKey: ["activity", query], queryFn: () => listActivity(query), placeholderData: keepPreviousData });
}

export function useActivityItem(id: string) {
	return useQuery({ queryKey: ["activity", "item", id], queryFn: () => getActivityItem(id) });
}

export function useStatement(range: { from?: string; to?: string } | null) {
	return useQuery({ queryKey: ["statement", range], queryFn: () => getStatement(range!), enabled: !!range });
}

/** The bell's badge. Polled: the API has no push channel for notifications (see BACKEND-GAPS.md). */
export function useUnreadCount() {
	return useQuery({ queryKey: ["notifications", "unread"], queryFn: unreadCount, refetchInterval: 30_000 });
}

export function useNotifications(query: { unreadOnly?: boolean; page?: number; limit?: number } = {}, enabled = true) {
	return useQuery({ queryKey: ["notifications", "list", query], queryFn: () => listNotifications(query), enabled, placeholderData: keepPreviousData });
}

export function useMarkRead() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (id?: string) => (id ? markRead(id) : markAllRead()),
		onSettled: () => queryClient.invalidateQueries({ queryKey: ["notifications"] }),
	});
}

/** Where a notification leads, from the ids in its `data`. */
export function notificationHref(n: NotificationDto): string | null {
	const groupId = typeof n.data.groupId === "string" ? n.data.groupId : null;
	const proposalId = typeof n.data.proposalId === "string" ? n.data.proposalId : null;
	const routes = pageRoutes.dashboardRoutes;
	// v3 slot takeovers (provisional): their notifications carry the request's id.
	if (groupId && typeof n.data.takeoverId === "string") return routes.TAKEOVER(groupId, n.data.takeoverId);
	switch (n.kind) {
		case "proposal_created":
		case "proposal_approved":
		case "proposal_rejected":
		case "proposal_executed":
			return groupId && proposalId ? routes.PROPOSAL(groupId, proposalId) : null;
		case "contribution_missed":
		case "recovery_started":
			return groupId ? routes.RECOVERY(groupId) : null;
		case "group_join_requested":
			return groupId ? routes.GROUP_REQUESTS(groupId) : null;
		case "payout_received":
			return routes.WALLET;
		default:
			return groupId ? routes.GROUP(groupId) : null;
	}
}
