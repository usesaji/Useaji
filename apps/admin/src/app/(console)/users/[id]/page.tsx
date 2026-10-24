"use client";

import { use, useState } from "react";
import Link from "next/link";
import { toast } from "@repo/ui/sonner";
import { HiArrowLeft, HiOutlineClipboardDocument } from "react-icons/hi2";
import { Avatar } from "@repo/ui/avatar";
import { Pager } from "@repo/ui/pager";
import { Panel, StatusPill } from "@repo/ui/panel";
import { QueryState } from "@repo/ui/query-state";
import { AuditTable } from "@/components/AuditTable";
import { PageTitle } from "@/components/Console";
import { useAuditLogs, useUser } from "@/features/admin/hooks";
import { initials, longDate } from "@/features/admin/format";

/** One account and everything it has done (the audit log filtered by `actorId`). */
export default function UserPage({ params }: PageProps<"/users/[id]">) {
	const { id } = use(params);
	const user = useUser(id);
	const [page, setPage] = useState(1);
	const trail = useAuditLogs({ actorId: id, page, limit: 15 });
	const u = user.data;

	return (
		<div className="space-y-6">
			<Link href="/users" className="inline-flex items-center gap-1.5 text-sm text-ink-muted hover:text-primary">
				<HiArrowLeft /> Users
			</Link>

			<QueryState isLoading={user.isLoading} error={user.error} onRetry={() => user.refetch()} skeletonClassName="h-40" />
			{u && (
				<Panel className="animate-rise flex flex-col gap-5 md:flex-row md:items-center md:justify-between md:p-7">
					<div className="flex min-w-0 items-center gap-4">
						<Avatar initials={initials(u.email)} label={u.email} className="size-16" textClassName="text-lg" />
						<div className="min-w-0">
							<p className="truncate text-xl md:text-2xl">{u.email}</p>
							<p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-ink-muted">
								<StatusPill tone={u.role === "admin" ? "yellow" : "lilac"}>{u.role === "admin" ? "Admin" : "Member"}</StatusPill>
								Joined {longDate(u.createdAt)}
							</p>
						</div>
					</div>
					<button
						type="button"
						onClick={() => navigator.clipboard.writeText(u.id).then(() => toast.success("User ID copied"))}
						className="flex items-center gap-2 self-start rounded-full bg-white px-4 py-2 font-mono text-xs hover:bg-primary-light md:self-auto"
					>
						<HiOutlineClipboardDocument className="text-base" /> {u.id}
					</button>
				</Panel>
			)}

			<PageTitle
				title={<span className="text-xl md:text-2xl">Activity</span>}
				subtitle={trail.data ? `${trail.data.paginationMeta.totalCount} events by this account` : undefined}
			/>
			<QueryState isLoading={trail.isLoading} error={trail.error} onRetry={() => trail.refetch()} skeletonClassName="h-72" />
			{trail.data && <AuditTable rows={trail.data.results} showActor={false} />}
			<Pager meta={trail.data?.paginationMeta} onPageChange={setPage} />

			<p className="text-xs font-light text-ink-muted">
				Groups, wallet and contributions per user need admin endpoints the API doesn&apos;t have yet (BACKEND-GAPS.md, C).
			</p>
		</div>
	);
}
