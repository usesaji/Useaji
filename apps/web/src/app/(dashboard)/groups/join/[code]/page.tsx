"use client";

import { useParams, useRouter } from "next/navigation";
import { Button } from "@repo/ui/button";
import { GoBack } from "@/components/GoBack";
import { QueryState } from "@repo/ui/query-state";
import { GroupPreview } from "@/features/groups/components/GroupPreview";
import { useInvitePreview, useJoin } from "@/features/groups/hooks";
import { pageRoutes } from "@/lib/routes";

/** What a prospective member sees behind an invite link (`POST /groups/invites/preview`, then `/join`). */
export default function JoinGroupPage() {
	const { code } = useParams<{ code: string }>();
	const router = useRouter();
	const preview = useInvitePreview(code);
	const join = useJoin();
	const group = preview.data;

	return (
		<div className="w-full max-w-4xl pb-10">
			<GoBack href={pageRoutes.dashboardRoutes.GROUPS} />
			<QueryState isLoading={preview.isLoading} error={preview.error} className="mt-6" />
			{group && (
				<GroupPreview group={group}>
					{group.myRole ? (
						<Button variant="secondary" onClick={() => router.push(pageRoutes.dashboardRoutes.GROUP(group.id))}>
							You&apos;re a member — open the group
						</Button>
					) : group.requestPending || join.data?.status === "requested" ? (
						<p className="rounded-xl bg-warning-100 px-4 py-3 text-sm text-warning-800">Your request is waiting for the admin&apos;s approval. We&apos;ll let you know.</p>
					) : group.status !== "forming" ? (
						<p className="rounded-xl bg-panel px-4 py-3 text-sm text-ink-muted">This group has already started and isn&apos;t taking new members.</p>
					) : (
						<Button
							variant="secondary"
							isLoading={join.isPending}
							onClick={() =>
								join.mutate(
									{ inviteCode: code },
									{ onSuccess: (r) => r.status === "joined" && router.push(pageRoutes.dashboardRoutes.GROUP(r.groupId)) },
								)
							}
						>
							Join Group
						</Button>
					)}
				</GroupPreview>
			)}
		</div>
	);
}
