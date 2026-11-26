"use client";

import { QueryState } from "@repo/ui/query-state";
import { CreateGroupFloatBtn } from "@/features/groups/components/CreateGroupFloatBtn";
import { DiscoverGroups } from "@/features/groups/components/DiscoverGroups";
import { useGroups, useOverview } from "@/features/groups/hooks";
import { WhatsNewTour } from "@/features/governance/components/WhatsNewTour";
import { ExploreCommunities, MyActiveGroups, RecentActivities } from "@/features/overview/OverviewSections";
import { SavingsDashboard } from "@/features/overview/SavingsDashboard";
import { LinkWalletPrompt } from "@/features/wallet/components/LinkWalletPrompt";

export default function OverviewPage() {
	const overview = useOverview();
	const groups = useGroups({ limit: 50 });
	const mine = (groups.data?.results ?? []).filter((g) => g.status !== "completed");

	return (
		<div className="w-full space-y-8 pb-10 md:space-y-12">
			{overview.isLoading || overview.error ? (
				<QueryState isLoading={overview.isLoading} error={overview.error} onRetry={overview.refetch} skeletonClassName="h-52 md:h-72 bg-primary-light" />
			) : (
				<div className="space-y-4">
					<SavingsDashboard overview={overview.data} />
					<LinkWalletPrompt />
				</div>
			)}
			<MyActiveGroups groups={mine} loading={groups.isLoading} />
			<DiscoverGroups />
			<RecentActivities />
			<ExploreCommunities />
			<CreateGroupFloatBtn desktop />
			<WhatsNewTour />
		</div>
	);
}
