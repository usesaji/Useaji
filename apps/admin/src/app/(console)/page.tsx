"use client";

import Link from "next/link";
import { Avatar } from "@repo/ui/avatar";
import { Panel, StatusPill } from "@repo/ui/panel";
import { QueryState } from "@repo/ui/query-state";
import { PageTitle, StatTile } from "@/components/Console";
import { DependencyList } from "@/components/HealthCard";
import { useAuditLogs, useHealth, useUsers } from "@/features/admin/hooks";
import { actionLabel, actionTone, ago, initials } from "@/features/admin/format";
import { useMe } from "@/features/auth/hooks";

const DAY = 86_400_000;

/**
 * The console's front page. The API has no stats endpoint, so the numbers come from the lists:
 * totals from `paginationMeta`, recent counts from the newest 100 (no stats endpoint yet: BACKEND-GAPS.md, C).
 */
export default function OverviewPage() {
	const { data: me } = useMe();
	const users = useUsers({ limit: 100 });
	const admins = useUsers({ role: "admin", limit: 1 });
	const audit = useAuditLogs({ limit: 100 }, 60_000);
	const health = useHealth();

	const now = users.dataUpdatedAt || audit.dataUpdatedAt;
	const newUsers = users.data?.results.filter((u) => now - new Date(u.createdAt).getTime() < 7 * DAY);
	const eventsToday = audit.data?.results.filter((e) => now - new Date(e.createdAt).getTime() < DAY);
	const failedSignIns = eventsToday?.filter((e) => e.action === "auth.login_failed").length;
	const recentUsers = [...(users.data?.results ?? [])].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 6);

	return (
		<div className="space-y-8">
			<PageTitle title={`Hello${me ? `, ${me.email.split("@")[0]}` : ""}`} subtitle="What's happening on Saji right now." />

			<div className="grid grid-cols-2 gap-3 md:gap-4 xl:grid-cols-4">
				<StatTile label="Users" value={users.data?.paginationMeta.totalCount} tone="primary" href="/users" index={0} />
				<StatTile label="New this week" value={newUsers?.length} hint="Among the newest 100" tone="secondary" index={1} />
				<StatTile
					label="Events, last 24 h"
					value={eventsToday?.length}
					hint="Among the newest 100"
					tone="panel"
					href="/audit"
					index={2}
				/>
				<StatTile
					label="Failed sign-ins, 24 h"
					value={failedSignIns}
					tone="accent"
					href="/audit?action=auth.login_failed"
					index={3}
				/>
			</div>

			<div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
				<Panel className="animate-rise min-w-0 lg:col-span-1">
					<div className="flex items-center justify-between">
						<h2 className="text-lg">System</h2>
						{health.data && (
							<StatusPill tone={health.data.status === "ok" ? "green" : "pink"}>
								{health.data.status === "ok" ? "All good" : "Degraded"}
							</StatusPill>
						)}
					</div>
					<QueryState
						isLoading={health.isLoading}
						error={health.error}
						onRetry={() => health.refetch()}
						skeletonClassName="mt-4 h-24"
					/>
					{health.data && (
						<>
							<DependencyList details={health.data.details} />
							<p className="mt-2 text-[11px] font-light text-ink-muted">
								{health.data.latencyMs} ms · checked every 30 s ·{" "}
								<Link href="/health" className="text-primary hover:underline">
									details
								</Link>
							</p>
						</>
					)}
					<p className="mt-5 border-t border-neutral-light pt-4 text-sm">
						<span className="text-ink-muted">Admins: </span>
						{admins.data?.paginationMeta.totalCount ?? "—"}
					</p>
				</Panel>

				<Panel className="animate-rise min-w-0 lg:col-span-2">
					<div className="flex items-center justify-between">
						<h2 className="text-lg">Latest activity</h2>
						<Link href="/audit" className="text-xs text-primary hover:underline">
							Full audit log
						</Link>
					</div>
					<QueryState
						isLoading={audit.isLoading}
						error={audit.error}
						onRetry={() => audit.refetch()}
						skeletonClassName="mt-4 h-64"
					/>
					<ul className="mt-2">
						{audit.data?.results.slice(0, 8).map((e, i) => (
							<li
								key={e.id}
								className="animate-fade flex items-center justify-between gap-3 border-b border-neutral-light py-2.5 last:border-0"
								style={{ "--i": i } as React.CSSProperties}
							>
								<div className="flex min-w-0 items-center gap-3">
									<StatusPill tone={actionTone(e.action)}>{actionLabel(e.action)}</StatusPill>
									<span className="truncate text-sm font-light">{e.actorEmail ?? "System"}</span>
								</div>
								<span className="shrink-0 text-xs text-ink-muted">{ago(e.createdAt, audit.dataUpdatedAt)}</span>
							</li>
						))}
					</ul>
				</Panel>
			</div>

			<Panel className="animate-rise">
				<div className="flex items-center justify-between">
					<h2 className="text-lg">Newest members</h2>
					<Link href="/users" className="text-xs text-primary hover:underline">
						All users
					</Link>
				</div>
				<QueryState
					isLoading={users.isLoading}
					error={users.error}
					onRetry={() => users.refetch()}
					skeletonClassName="mt-4 h-32"
				/>
				<ul className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
					{recentUsers.map((u, i) => (
						<li key={u.id} className="animate-fade" style={{ "--i": i } as React.CSSProperties}>
							<Link href={`/users/${u.id}`} className="hover-lift flex items-center gap-3 rounded-xl bg-white px-3 py-2.5">
								<Avatar initials={initials(u.email)} label={u.email} />
								<span className="min-w-0">
									<span className="block truncate text-sm">{u.email}</span>
									<span className="block text-[11px] text-ink-muted">Joined {ago(u.createdAt, users.dataUpdatedAt)}</span>
								</span>
							</Link>
						</li>
					))}
				</ul>
			</Panel>
		</div>
	);
}
