"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { EmptyState } from "@repo/ui/empty-state";
import { PageHeader } from "@/components/PageHeader";
import { QueryState } from "@repo/ui/query-state";
import { DiscoverCard } from "@/features/groups/components/DiscoverGroups";
import { GroupRow } from "@/features/groups/components/GroupCards";
import { useDiscover, useGroups } from "@/features/groups/hooks";

/** Header search: your groups (`GET /groups?search=`) and public ones (`GET /groups/discover?search=`). */
export default function SearchPage() {
	return (
		<Suspense>
			<Results />
		</Suspense>
	);
}

function Results() {
	const q = useSearchParams().get("q")?.trim() ?? "";
	const mine = useGroups({ search: q, limit: 20 });
	const publicGroups = useDiscover({ search: q, limit: 12 });
	const found = mine.data?.results ?? [];
	const others = publicGroups.data?.results ?? [];

	return (
		<div className="w-full space-y-8 pb-10">
			<PageHeader title="Search" subtitle={q ? `Results for “${q}”` : "Search your groups from the bar above."} back />
			<section className="space-y-3">
				<h3 className="text-lg">Your groups</h3>
				<QueryState isLoading={mine.isLoading} error={mine.error} onRetry={() => void mine.refetch()} skeletonClassName="h-24" />
				{mine.data && found.length === 0 && <p className="text-sm font-light">None of your groups match.</p>}
				<div className="stagger space-y-3">
					{found.map((group, i) => (
						<GroupRow key={group.id} group={group} index={i} />
					))}
				</div>
			</section>
			<section className="space-y-3">
				<h3 className="text-lg">Public groups</h3>
				{publicGroups.data && others.length === 0 && <EmptyState title="No public groups match" />}
				<div className="stagger grid grid-cols-[repeat(auto-fill,minmax(16rem,1fr))] gap-4">
					{others.map((group) => (
						<DiscoverCard key={group.id} group={group} />
					))}
				</div>
			</section>
		</div>
	);
}
