"use client";

import { useState } from "react";
import { cn } from "@repo/ui/lib/utils";
import { PageHeader } from "@/components/PageHeader";
import { Pager } from "@repo/ui/pager";
import { QueryState } from "@repo/ui/query-state";
import { ActivityCard } from "@/features/activity/components/ActivityCard";
import { useActivity } from "@/features/activity/hooks";
import type { ActivityKind } from "@/lib/api/dto";

type Filter = "all" | ActivityKind;

/** The tabs. `GET /activity?type=` also takes `withdrawal`, but payouts go straight to wallets now. */
const FILTERS: { value: Filter; label: string }[] = [
	{ value: "all", label: "All" },
	{ value: "contribution", label: "Contributions" },
	{ value: "payout", label: "Payouts" },
];

const EMPTY: Record<Filter, string> = {
	all: "No activity yet. Your contributions and payouts will show up here.",
	contribution: "No contributions yet.",
	payout: "No payouts yet.",
	withdrawal: "No withdrawals yet.",
};

export default function ActivityPage() {
	const [filter, setFilter] = useState<Filter>("all");
	const [page, setPage] = useState(1);
	const { data, isLoading, error, refetch } = useActivity({ type: filter === "all" ? undefined : filter, page, limit: 10 });
	const rows = data?.results ?? [];

	return (
		<div className="w-full space-y-6 pb-10">
			<PageHeader title="Activity" />
			<div className="hide-scroll -mx-3 flex gap-2 overflow-x-auto px-3 sm:mx-0 sm:px-0" role="tablist">
				{FILTERS.map(({ value, label }) => (
					<button
						key={value}
						type="button"
						role="tab"
						aria-selected={filter === value}
						onClick={() => {
							setFilter(value);
							setPage(1);
						}}
						className={cn("shrink-0 rounded-full px-5 py-2 text-sm transition", filter === value ? "bg-primary text-white" : "bg-neutral-comment text-neutral-dark hover:bg-primary-light")}
					>
						{label}
					</button>
				))}
			</div>
			<QueryState isLoading={isLoading} error={error} onRetry={() => void refetch()} skeletonClassName="h-32" />
			{data && rows.length === 0 && <p className="rounded-[20px] bg-panel p-6 text-sm">{EMPTY[filter]}</p>}
			{rows.length > 0 && (
				<>
					<div className="stagger grid gap-3 md:grid-cols-2 md:gap-4">
						{rows.map((row) => (
							<ActivityCard key={row.id} activity={row} />
						))}
					</div>
					<Pager meta={data?.paginationMeta} onPageChange={setPage} className="flex justify-center" />
				</>
			)}
		</div>
	);
}
