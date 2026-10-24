"use client";

import { useState } from "react";
import { CiSearch } from "react-icons/ci";
import { EmptyState } from "@repo/ui/empty-state";
import { InputField } from "@repo/ui/input-field";
import { PageHeader } from "@/components/PageHeader";
import { Pager } from "@repo/ui/pager";
import { QueryState } from "@repo/ui/query-state";
import { DiscoverCard } from "@/features/groups/components/DiscoverGroups";
import { useDiscover } from "@/features/groups/hooks";
import { pageRoutes } from "@/lib/routes";

/** Public groups still taking members (`GET /groups/discover`). */
export default function DiscoverPage() {
	const [search, setSearch] = useState("");
	const [page, setPage] = useState(1);
	const { data, isLoading, error, refetch } = useDiscover({ search: search.trim() || undefined, page, limit: 12 });
	const groups = data?.results ?? [];

	return (
		<div className="w-full space-y-6 pb-10">
			<PageHeader title="Discover Groups" subtitle="Public savings groups that are still taking members." back backHref={pageRoutes.dashboardRoutes.GROUPS} />
			<div className="relative max-w-120">
				<CiSearch className="absolute top-3 left-4 z-10 text-2xl text-neutral-light-active md:top-3.5" />
				<InputField
					name="discover-search"
					aria-label="Search public groups"
					value={search}
					onChange={(e) => {
						setSearch(e.target.value);
						setPage(1);
					}}
					className="bg-neutral-comment pl-12"
					placeholder="Search by name"
				/>
			</div>
			<QueryState isLoading={isLoading} error={error} onRetry={() => void refetch()} />
			{data && groups.length === 0 && <EmptyState title="No public groups found">Try another name, or start your own group.</EmptyState>}
			<div className="stagger grid grid-cols-[repeat(auto-fill,minmax(16rem,1fr))] gap-4">
				{groups.map((group) => (
					<DiscoverCard key={group.id} group={group} />
				))}
			</div>
			<Pager meta={data?.paginationMeta} onPageChange={setPage} />
		</div>
	);
}
