"use client";

import { useDeferredValue, useState } from "react";
import { HiOutlineMagnifyingGlass } from "react-icons/hi2";
import { Avatar } from "@repo/ui/avatar";
import { Pager } from "@repo/ui/pager";
import { StatusPill } from "@repo/ui/panel";
import { QueryState } from "@repo/ui/query-state";
import { DataTable, FilterPills, PageTitle, type Column } from "@/components/Console";
import { useUsers } from "@/features/admin/hooks";
import { initials, longDate, shortId } from "@/features/admin/format";
import type { Role, UserSummaryDto } from "@/lib/api/dto";

type RoleFilter = "all" | Role;

const COLUMNS: Column<UserSummaryDto>[] = [
	{
		header: "User",
		cell: (u) => (
			<span className="flex items-center gap-3">
				<Avatar initials={initials(u.email)} label={u.email} />
				<span className="truncate">{u.email}</span>
			</span>
		),
	},
	{
		header: "Role",
		cell: (u) => (
			<StatusPill tone={u.role === "admin" ? "yellow" : "lilac"}>{u.role === "admin" ? "Admin" : "Member"}</StatusPill>
		),
	},
	{ header: "Joined", cell: (u) => <span className="font-light">{longDate(u.createdAt)}</span> },
	{
		header: "ID",
		cell: (u) => <span className="font-mono text-xs text-ink-muted">{shortId(u.id)}</span>,
		className: "hidden md:table-cell",
	},
];

export default function UsersPage() {
	const [search, setSearch] = useState("");
	const [role, setRole] = useState<RoleFilter>("all");
	const [page, setPage] = useState(1);
	const term = useDeferredValue(search.trim());
	const users = useUsers({ page, limit: 20, search: term || undefined, role: role === "all" ? undefined : role });

	return (
		<div className="space-y-6">
			<PageTitle
				title="Users"
				subtitle={
					users.data ? `${users.data.paginationMeta.totalCount.toLocaleString()} accounts` : "Everyone with a Saji account."
				}
			/>

			<div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
				<label className="flex w-full items-center gap-2 rounded-full bg-neutral-comment px-4 py-2.5 md:max-w-sm">
					<HiOutlineMagnifyingGlass className="text-ink-muted" aria-hidden />
					<input
						type="search"
						value={search}
						onChange={(e) => {
							setSearch(e.target.value);
							setPage(1);
						}}
						placeholder="Search by email or ID"
						aria-label="Search users"
						className="w-full bg-transparent text-sm outline-none placeholder:text-ink-muted"
					/>
				</label>
				<FilterPills<RoleFilter>
					value={role}
					onChange={(r) => {
						setRole(r);
						setPage(1);
					}}
					options={[
						{ value: "all", label: "All" },
						{ value: "user", label: "Members" },
						{ value: "admin", label: "Admins" },
					]}
				/>
			</div>

			<QueryState isLoading={users.isLoading} error={users.error} onRetry={() => users.refetch()} skeletonClassName="h-96" />
			{users.data && (
				<div className={users.isPlaceholderData ? "opacity-60 transition-opacity" : "transition-opacity"}>
					<DataTable
						columns={COLUMNS}
						rows={users.data.results}
						rowKey={(u) => u.id}
						href={(u) => `/users/${u.id}`}
						empty="No user matches that."
					/>
				</div>
			)}
			<Pager meta={users.data?.paginationMeta} onPageChange={setPage} />
		</div>
	);
}
