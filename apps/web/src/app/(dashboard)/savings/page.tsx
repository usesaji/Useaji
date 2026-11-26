"use client";

import { QueryState } from "@repo/ui/query-state";
import { LinkButton } from "@/components/LinkButton";
import { Money } from "@/components/Money";
import { PageHeader } from "@/components/PageHeader";
import { useAccount } from "@/features/auth/hooks";
import { ConnectWalletPanel } from "@/features/savings/components/ConnectWalletPanel";
import { Card } from "@/components/Cards";
import { NoPlansCard, PlanCard } from "@/features/savings/components/SavingsUi";
import { useSavingsOverview, useSavingsPlans } from "@/features/savings/hooks";
import { formatMoney } from "@/lib/format";
import { pageRoutes } from "@/lib/routes";

/** Personal savings: every goal, what's saved in total and what could leave today. */
export default function SavingsPage() {
	const account = useAccount();
	const plans = useSavingsPlans();
	const overview = useSavingsOverview();
	const list = plans.data ?? [];
	const personal = overview.data?.personal;
	// What could leave today: the balance of every goal whose lock is open.
	const withdrawable = list.filter((p) => p.canWithdraw).reduce((sum, p) => sum + Number(p.balance), 0);
	const r = pageRoutes.dashboardRoutes;

	if (account.data && !account.data.wallet && plans.data && list.length === 0) {
		return (
			<div className="w-full pb-10">
				<ConnectWalletPanel purpose="create a personal savings plan and deposit test USDC" />
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
			{personal && list.length > 0 && (
				<Card title="Total in personal savings">
					<p className="text-[32px] leading-none font-medium tracking-tight text-ink md:text-[40px]">
						<Money amount={personal.balance} asset={personal.asset} />
					</p>
					<p>
						{personal.plans} {personal.plans === 1 ? "goal" : "goals"} · {formatMoney(personal.target, personal.asset)} in targets ·{" "}
						{formatMoney(withdrawable, personal.asset)} available to withdraw now
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
