"use client";

import { useState } from "react";
import Link from "next/link";
import { IoReload } from "react-icons/io5";
import { CreateGroupFloatBtn } from "@/features/groups/components/CreateGroupFloatBtn";
import { DiscoverGroups } from "@/features/groups/components/DiscoverGroups";
import { GroupFilter, type GroupFilterValue } from "@/features/groups/components/GroupFilter";
import { GroupList } from "@/features/groups/components/GroupList";
import { GroupStats } from "@/features/groups/components/GroupStats";
import { useGroups } from "@/features/groups/hooks";
import { pageRoutes } from "@/lib/routes";

const PAGE_SIZE = 4;

export default function GroupsPage() {
	const [filter, setFilter] = useState<GroupFilterValue>("all");
	const [page, setPage] = useState(1);
	const groups = useGroups({ status: filter === "all" ? undefined : filter, page, limit: PAGE_SIZE });

	return (
		<div className="w-full space-y-6 pb-10 md:space-y-8">
			<section className="flex items-center justify-between gap-3">
				<h2 className="text-[28px] font-light md:text-[34px] md:font-normal">My Groups</h2>
				<div className="flex items-center gap-2">
					<Link
						href={pageRoutes.dashboardRoutes.MARKETPLACE}
						className="flex h-10 items-center rounded-full bg-primary-light px-4 text-xs text-primary transition hover:bg-primary hover:text-white md:h-11 md:text-sm"
					>
						Slot marketplace
					</Link>
					<GroupFilter
						value={filter}
						onChange={(value) => {
							setFilter(value);
							setPage(1);
						}}
					/>
					<button
						type="button"
						onClick={() => void groups.refetch()}
						disabled={groups.isFetching}
						aria-label="Refresh"
						className="flex h-10 w-10 items-center justify-center rounded-full bg-neutral-comment text-lg transition hover:bg-neutral-light md:h-11 md:w-11 md:text-xl"
					>
						<IoReload className={groups.isFetching ? "animate-spin" : ""} />
					</button>
				</div>
			</section>

			<GroupStats />

			<GroupList
				page={groups.data}
				isLoading={groups.isLoading}
				error={groups.error}
				onRetry={() => void groups.refetch()}
				onPageChange={setPage}
				filtered={filter !== "all"}
			/>

			<div className="pt-4">
				<DiscoverGroups />
			</div>

			<CreateGroupFloatBtn />
		</div>
	);
}
