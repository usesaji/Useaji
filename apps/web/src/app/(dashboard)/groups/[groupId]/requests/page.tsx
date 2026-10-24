"use client";

import { useParams } from "next/navigation";
import { PageHeader } from "@/components/PageHeader";
import { QueryState } from "@repo/ui/query-state";
import { PendingRequests } from "@/features/groups/components/PendingRequests";
import { useGroup, useJoinRequests } from "@/features/groups/hooks";
import { pageRoutes } from "@/lib/routes";

/** Full "Member Requests" page — pending join requests with Approve / Decline (admins). */
export default function GroupRequestsPage() {
	const { groupId } = useParams<{ groupId: string }>();
	const { data: group } = useGroup(groupId);
	const isAdmin = group?.myRole === "admin";
	const requests = useJoinRequests(groupId, isAdmin);

	return (
		<div className="w-full max-w-4xl space-y-6 pb-10">
			<PageHeader title="Requests" subtitle="People asking to join your group." back backHref={pageRoutes.dashboardRoutes.GROUP(groupId)} />
			{group && !isAdmin ? (
				<p className="text-sm text-ink-muted">Only the admin can review join requests.</p>
			) : (
				<>
					<QueryState isLoading={requests.isLoading} error={requests.error} onRetry={() => void requests.refetch()} />
					{requests.data && requests.data.length === 0 && <p className="text-sm text-ink-muted">No pending requests.</p>}
					<PendingRequests groupId={groupId} requests={requests.data ?? []} />
				</>
			)}
		</div>
	);
}
