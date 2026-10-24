"use client";

/* eslint-disable @next/next/no-img-element */
import { Button } from "@repo/ui/button";
import { SectionHeader } from "@/components/SectionHeader";
import { useDiscover, useJoin } from "@/features/groups/hooks";
import { coverOf } from "@/features/groups/view";
import type { GroupSummaryDto } from "@/lib/api/dto";
import { formatMoney, frequencyLabel } from "@/lib/format";
import { pageRoutes } from "@/lib/routes";

/**
 * Public groups still taking members (`GET /groups/discover`), as a swipeable row. Asking to join
 * sends a request to the admin, or joins at once when the group auto-approves.
 */
export function DiscoverGroups({ title = "Discover Groups", limit = 6 }: { title?: string; limit?: number }) {
	const { data, isLoading } = useDiscover({ limit });
	const groups = data?.results ?? [];
	if (!isLoading && groups.length === 0) return null;

	return (
		<section>
			<SectionHeader title={title} href={pageRoutes.dashboardRoutes.DISCOVER} />
			<div className="stagger hide-scroll -mx-3 mt-4 flex snap-x scroll-px-3 gap-3 overflow-x-auto px-3 sm:mx-0 sm:scroll-px-0 sm:px-0 md:mt-6 md:gap-4">
				{isLoading
					? [0, 1, 2].map((i) => <div key={i} className="h-56 w-64 shrink-0 skeleton rounded-[20px] bg-panel" />)
					: groups.map((group) => <DiscoverCard key={group.id} group={group} />)}
			</div>
		</section>
	);
}

export function DiscoverCard({ group }: { group: GroupSummaryDto }) {
	const join = useJoin();
	const sent = join.isSuccess;
	return (
		<article className="flex w-64 shrink-0 snap-start flex-col rounded-[20px] bg-panel p-5 md:w-72">
			<img src={coverOf(group)} alt="" className="h-24 w-full rounded-xl bg-primary-light object-cover" />
			<p className="mt-4 truncate text-base">{group.name}</p>
			<p className="text-[11px] font-light">
				{formatMoney(group.contributionAmount, group.asset)} · {frequencyLabel(group.frequency)} · {group.memberCount}{" "}
				{group.memberCount === 1 ? "member" : "members"}
			</p>
			<Button
				size="sm"
				variant={sent ? "soft" : "default"}
				className="mt-4 w-full text-sm lg:text-sm"
				isLoading={join.isPending}
				disabled={sent}
				onClick={() => join.mutate({ groupId: group.id })}
			>
				{sent ? (join.data?.status === "joined" ? "Joined" : "Request sent") : "Ask to join"}
			</Button>
		</article>
	);
}
