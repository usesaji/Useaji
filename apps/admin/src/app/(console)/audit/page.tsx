"use client";

import { Suspense, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Pager } from "@repo/ui/pager";
import { QueryState } from "@repo/ui/query-state";
import { AuditTable } from "@/components/AuditTable";
import { PageTitle } from "@/components/Console";
import { useAuditLogs } from "@/features/admin/hooks";
import { actionLabel, KNOWN_ACTIONS } from "@/features/admin/format";

export default function AuditPage() {
	return (
		<Suspense>
			<Audit />
		</Suspense>
	);
}

/** Every recorded action, newest first. The filter lives in the URL (`?action=`) so it can be linked to. */
function Audit() {
	const router = useRouter();
	const pathname = usePathname();
	const action = useSearchParams().get("action") ?? "";
	const [page, setPage] = useState(1);
	const [live, setLive] = useState(true);
	const logs = useAuditLogs({ page, limit: 25, action: action || undefined }, live && page === 1 ? 15_000 : undefined);

	const setAction = (value: string) => {
		setPage(1);
		router.replace(value ? `${pathname}?action=${encodeURIComponent(value)}` : pathname, { scroll: false });
	};

	return (
		<div className="space-y-6">
			<PageTitle
				title="Audit log"
				subtitle={
					logs.data ? `${logs.data.paginationMeta.totalCount.toLocaleString()} events` : "Everything recorded, newest first."
				}
				actions={
					<label className="flex cursor-pointer items-center gap-2 rounded-full bg-neutral-comment px-4 py-2 text-xs">
						<input type="checkbox" checked={live} onChange={(e) => setLive(e.target.checked)} className="accent-primary" />
						<span className="relative flex size-2">
							{live && <span className="animate-ping-soft absolute inset-0 rounded-full bg-success-500" />}
							<span
								className={live ? "relative size-2 rounded-full bg-success-500" : "relative size-2 rounded-full bg-neutral-400"}
							/>
						</span>
						Live
					</label>
				}
			/>

			<div className="flex flex-wrap items-center gap-3">
				<select
					value={action}
					onChange={(e) => setAction(e.target.value)}
					aria-label="Filter by action"
					className="rounded-full bg-neutral-comment px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary"
				>
					<option value="">All actions</option>
					{KNOWN_ACTIONS.map((a) => (
						<option key={a} value={a}>
							{actionLabel(a)}
						</option>
					))}
				</select>
				{action && (
					<button type="button" onClick={() => setAction("")} className="text-xs text-primary hover:underline">
						Clear filter
					</button>
				)}
			</div>

			<QueryState isLoading={logs.isLoading} error={logs.error} onRetry={() => logs.refetch()} skeletonClassName="h-96" />
			{logs.data && (
				<div className={logs.isPlaceholderData ? "opacity-60 transition-opacity" : "transition-opacity"}>
					<AuditTable rows={logs.data.results} />
				</div>
			)}
			<Pager meta={logs.data?.paginationMeta} onPageChange={setPage} />
		</div>
	);
}
