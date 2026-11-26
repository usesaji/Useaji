"use client";

import Link from "next/link";
import { HiArrowDownLeft, HiArrowUpRight } from "react-icons/hi2";
import { PageHeader } from "@/components/PageHeader";
import { QueryState } from "@repo/ui/query-state";
import { SectionHeader } from "@/components/SectionHeader";
import { ACTIVITY_LABEL } from "@/features/activity/components/ActivityCard";
import { useActivity } from "@/features/activity/hooks";
import { useOverview } from "@/features/groups/hooks";
import { SavingsSummaryCard } from "@/features/overview/SavingsSummaryCard";
import { NoPlansCard, PlanCard } from "@/features/savings/components/SavingsUi";
import { useSavingsPlans } from "@/features/savings/hooks";
import { LinkedWalletCard, PayoutsCard, UsefulInsights } from "@/features/wallet/components/WalletSections";
import { useWallet } from "@/features/wallet/hooks";
import { dateTime, formatMoney, relative } from "@/lib/format";
import { pageRoutes } from "@/lib/routes";
import { useNow } from "@/lib/use-now";

export default function WalletPage() {
	const wallet = useWallet();
	const overview = useOverview();
	const history = useActivity({ limit: 10 });
	const plans = useSavingsPlans();
	const now = useNow();
	const next = overview.data?.nextDue ?? null;

	return (
		<div className="w-full space-y-8 pb-10 md:space-y-10">
			<PageHeader title="Wallet" />
			<QueryState isLoading={wallet.isLoading} error={wallet.error} onRetry={() => void wallet.refetch()} skeletonClassName="h-60 bg-primary-light" />
			{wallet.data && (
				<>
					<SavingsSummaryCard overview={overview.data} wallet={wallet.data} />
					<div className="grid items-start gap-4 lg:grid-cols-2">
						<PayoutsCard wallet={wallet.data} />
						<div className="space-y-4">
							<LinkedWalletCard wallet={wallet.data} />
							{next && (
								<section className="flex flex-col gap-4 rounded-[20px] bg-primary-light px-6 py-5 md:flex-row md:items-center md:justify-between">
									<div className="min-w-0">
										<p className="text-base md:text-lg">Upcoming Contribution</p>
										<p className="mt-1 max-w-2xl text-xs font-light md:text-sm">
											Your contribution of <span className="font-medium">{formatMoney(next.amount, wallet.data.asset)}</span> to “{next.groupName}” is due{" "}
											{now ? relative(next.deadline, now) : "soon"}. Keep enough USDC in your wallet to avoid a late fee.
										</p>
									</div>
									<Link
										href={pageRoutes.dashboardRoutes.CIRCLE(next.groupId)}
										className="flex shrink-0 items-center justify-center gap-2 rounded-full bg-primary-dark px-6 py-3 text-sm text-white transition hover:bg-primary-dark-hover"
									>
										Contribute now
									</Link>
								</section>
							)}
						</div>
					</div>
					<UsefulInsights wallet={wallet.data} />
				</>
			)}

			{plans.data && (
				<section>
					<SectionHeader title="Personal Savings" href={pageRoutes.dashboardRoutes.SAVINGS} />
					<div className="mt-4 grid gap-4 md:mt-6 md:grid-cols-2">
						{plans.data.length === 0 ? (
							<NoPlansCard href={pageRoutes.dashboardRoutes.NEW_SAVINGS} />
						) : (
							plans.data
								.slice(0, 2)
								.map((plan, i) => (
									<PlanCard key={plan.id} plan={plan} index={i} href={pageRoutes.dashboardRoutes.SAVINGS_PLAN(plan.id)} />
								))
						)}
					</div>
				</section>
			)}

			<section>
				<SectionHeader title="Wallet History" href={pageRoutes.dashboardRoutes.ACTIVITY} />
				<QueryState isLoading={history.isLoading} error={history.error} skeletonClassName="h-16" className="mt-4" />
				{history.data && history.data.results.length === 0 && <p className="mt-4 rounded-[20px] bg-panel p-6 text-sm">No transactions yet.</p>}
				<ul className="mt-4 space-y-2 md:mt-6">
					{(history.data?.results ?? []).map((tx) => {
						const incoming = tx.kind === "payout";
						const Icon = incoming ? HiArrowDownLeft : HiArrowUpRight;
						return (
							<li key={tx.id}>
								<Link href={pageRoutes.dashboardRoutes.TRANSACTION(tx.id)} className="flex items-center gap-4 rounded-xl bg-panel px-4 py-3 transition hover:bg-[#f2f2f2] md:px-5">
									<span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-lg ${incoming ? "bg-success-50 text-success-700" : "bg-accent-light text-accent"}`}>
										<Icon />
									</span>
									<div className="min-w-0 flex-1">
										<p className="truncate text-sm">
											{ACTIVITY_LABEL[tx.kind]}
											{tx.group && <span className="font-light"> · {tx.group.name}</span>}
										</p>
										<p className="text-xs font-light">{dateTime(tx.createdAt)}</p>
									</div>
									<p className="shrink-0 text-sm">
										{incoming ? "+" : "−"}
										{formatMoney(tx.amount, tx.asset)}
									</p>
								</Link>
							</li>
						);
					})}
				</ul>
			</section>
		</div>
	);
}
