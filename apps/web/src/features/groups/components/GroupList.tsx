"use client";

import Image from "next/image";
import { LinkButton } from "@/components/LinkButton";
import { Pager } from "@repo/ui/pager";
import { QueryState } from "@repo/ui/query-state";
import { GroupCard, GroupRow } from "@/features/groups/components/GroupCards";
import type { Page } from "@/lib/api/client";
import type { GroupSummaryDto } from "@/lib/api/dto";
import { pageRoutes } from "@/lib/routes";

/** A page of groups: compact rows on mobile, a 2-column card grid from md, the API's pagination below. */
export function GroupList({
	page,
	isLoading,
	error,
	onRetry,
	onPageChange,
	filtered,
}: {
	page: Page<GroupSummaryDto> | undefined;
	isLoading: boolean;
	error: unknown;
	onRetry: () => void;
	onPageChange: (page: number) => void;
	/** A filter or search is narrowing the list — changes what "empty" means. */
	filtered: boolean;
}) {
	if (isLoading || error) return <QueryState isLoading={isLoading} error={error} onRetry={onRetry} skeletonClassName="h-80" />;
	const groups = page?.results ?? [];
	if (groups.length === 0) {
		return filtered ? <p className="rounded-[20px] bg-panel p-6 text-center text-sm">No groups match this filter.</p> : <NoGroupPreview />;
	}
	return (
		<div>
			<div className="stagger space-y-3 md:hidden">
				{groups.map((group, index) => (
					<GroupRow key={group.id} group={group} index={index} />
				))}
			</div>
			<div className="stagger grid grid-cols-2 gap-4 max-md:hidden">
				{groups.map((group) => (
					<GroupCard key={group.id} group={group} />
				))}
			</div>
			<Pager meta={page?.paginationMeta} onPageChange={onPageChange} className="mt-6" />
		</div>
	);
}

export function NoGroupPreview() {
	return (
		<div>
			<h2 className="mt-2 text-center text-2xl">Build Your Circle</h2>
			<p className="mx-auto w-3/4 text-center">Create a savings group and reach your community targets together</p>
			<div className="mx-auto mt-10 w-70">
				<Image alt="" src="/images/auth/group-savings.svg" height={400} width={400} className="h-full w-full" />
			</div>
			<LinkButton href={pageRoutes.dashboardRoutes.NEW_GROUP} className="mt-16 w-full">
				Let&apos;s Start
			</LinkButton>
		</div>
	);
}
