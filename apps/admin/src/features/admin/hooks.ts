"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { getHealth, getUser, listAuditLogs, listUsers } from "@/features/admin/api";
import type { Role } from "@/lib/api/dto";

export function useUsers(query: { page?: number; limit?: number; search?: string; role?: Role }) {
	return useQuery({ queryKey: ["users", query], queryFn: () => listUsers(query), placeholderData: keepPreviousData });
}

export function useUser(id: string) {
	return useQuery({ queryKey: ["user", id], queryFn: () => getUser(id) });
}

export function useAuditLogs(
	query: { page?: number; limit?: number; action?: string; actorId?: string },
	refetchInterval?: number,
) {
	return useQuery({
		queryKey: ["audit", query],
		queryFn: () => listAuditLogs(query),
		placeholderData: keepPreviousData,
		refetchInterval,
	});
}

/** Checked every 30 s while a page shows it. */
export function useHealth() {
	return useQuery({ queryKey: ["health"], queryFn: getHealth, refetchInterval: 30_000 });
}
