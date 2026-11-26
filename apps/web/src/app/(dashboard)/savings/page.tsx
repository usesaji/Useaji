"use client";

import { QueryState } from "@repo/ui/query-state";
import { LinkButton } from "@/components/LinkButton";
import { Money } from "@/components/Money";
import { PageHeader } from "@/components/PageHeader";
import { useAccount } from "@/features/auth/hooks";
import { ConnectWalletPanel } from "@/features/savings/components/ConnectWalletPanel";
import { Card } from "@/components/Cards";
import { NoPlansCard, PlanCard } from "@/features/savings/components/SavingsUi";
import { useSavingsPlans, useSavingsSummary } from "@/features/savings/hooks";
import { formatMoney } from "@/lib/format";
import { pageRoutes } from "@/lib/routes";

/** Personal savings: every goal, what's saved in total and what could leave today. */
export default function SavingsPage() {
	const account = useAccount();
	const plans = useSavingsPlans();
	const summary = useSavingsSummary();
	const list = plans.data?.results ?? [];
	const r = pageRoutes.dashboardRoutes;

	if (account.data && !account.data.wallet && plans.data && list.length === 0) {
		return (
			<div className="w-full pb-10">
				<ConnectWalletPanel purpose="create a personal savings plan and deposit simulated USDC" />
			</div>
		);
	}

	return (
		<div className="w-full space-y-6 pb-10">
			<PageHeader
				title="Personal savings"
				subtitle="Goals you save toward on your own, from your own wallet."
				back
				backHref={r.WALLET}
				actions={
					<LinkButton href={r.NEW_SAVINGS} className="text-sm max-md:px-4 lg:text-base">
						New goal
					</LinkButton>
				}
			/>
			{summary.data && list.length > 0 && (
				<Card title="Total in personal savings">
					<p className="text-[32px] leading-none font-medium tracking-tight text-ink md:text-[40px]">
						<Money amount={summary.data.totalSaved} asset={summary.data.asset} />
					</p>
					<p>
						{summary.data.activePlans} {summary.data.activePlans === 1 ? "goal" : "goals"} ·{" "}
						{formatMoney(summary.data.withdrawable, summary.data.asset)} available to withdraw now
					</p>
				</Card>
			)}
			<QueryState isLoading={plans.isLoading} error={plans.error} onRetry={() => void plans.refetch()} />
			{plans.data && list.length === 0 && <NoPlansCard href={r.NEW_SAVINGS} />}
			<div className="grid gap-5 md:grid-cols-2">
				{list.map((plan, i) => (
					<PlanCard key={plan.id} plan={plan} index={i} href={r.SAVINGS_PLAN(plan.id)} />
				))}
			</div>
		</div>
	);
}
