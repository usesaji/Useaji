"use client";

import { useParams } from "next/navigation";
import { Button } from "@repo/ui/button";
import { QueryState } from "@repo/ui/query-state";
import { LinkButton } from "@/components/LinkButton";
import { PageHeader } from "@/components/PageHeader";
import { isLockedNow, KIND, planRules } from "@/features/savings/copy";
import { Card, TwoColumns } from "@/components/Cards";
import { PlanBalanceCard, TransactionLines } from "@/features/savings/components/SavingsUi";
import { useSavingsPlan, useSavingsTransactions } from "@/features/savings/hooks";
import { formatMoney, longDate, shortDate } from "@/lib/format";
import { pageRoutes } from "@/lib/routes";
import { explorerContractUrl, shortAddress, STELLAR_NETWORK_LABEL } from "@/lib/stellar/config";
import { useNow } from "@/lib/use-now";

/**
 * One personal savings plan (v3 screens 09 flexible, 12 locked): balance and progress, deposit /
 * withdraw, the plan's rules, recent activity, and the wallet and contract behind it.
 */
export default function SavingsPlanPage() {
	const { planId } = useParams<{ planId: string }>();
	const plan = useSavingsPlan(planId);
	const txs = useSavingsTransactions(planId, 5);
	const now = useNow();
	const r = pageRoutes.dashboardRoutes;
	const p = plan.data;
	const locked = p ? isLockedNow(p, now) : false;
	const rows = txs.data?.results ?? [];

	return (
		<div className="w-full space-y-6 pb-10">
			<PageHeader title={p?.name ?? "Savings goal"} subtitle={p ? KIND[p.kind].intro : undefined} back backHref={r.SAVINGS} />
			<QueryState isLoading={plan.isLoading} error={plan.error} onRetry={() => void plan.refetch()} />

			{p && (
				<TwoColumns
					main={
						<>
							<PlanBalanceCard plan={p} />
							{p.kind === "locked" &&
								(locked ? (
									<Card tone="lilac" title="Withdrawal unavailable">
										<p>Release date · {longDate(p.unlocksAt)}</p>
										<p>Available to withdraw now · {formatMoney(p.withdrawable, p.asset)}</p>
										<p>Reaching the target early does not unlock this date-based plan.</p>
									</Card>
								) : (
									<Card tone="lilac" title="Your savings are released">
										<p>Released on {longDate(p.unlocksAt)}.</p>
										<p>Available to withdraw now · {formatMoney(p.withdrawable, p.asset)}</p>
									</Card>
								))}
							{/* As designed: flexible → Deposit · Withdraw (09); locked → the disabled Withdraw · Deposit (12). */}
							<div className="grid grid-cols-2 gap-3">
								{locked ? (
									<>
										<Button variant="soft" disabled className="w-full text-sm lg:text-base">
											Withdraw · Available {shortDate(p.unlocksAt)}
										</Button>
										<LinkButton href={r.SAVINGS_DEPOSIT(p.id)} className="w-full text-sm lg:text-base">
											Deposit USDC
										</LinkButton>
									</>
								) : (
									<>
										<LinkButton href={r.SAVINGS_DEPOSIT(p.id)} className="w-full text-sm lg:text-base">
											Deposit USDC
										</LinkButton>
										{Number(p.withdrawable) > 0 ? (
											<LinkButton href={r.SAVINGS_WITHDRAW(p.id)} variant="ghost" className="w-full text-sm lg:text-base">
												Withdraw USDC
											</LinkButton>
										) : (
											<Button variant="soft" disabled className="w-full text-sm lg:text-base">
												Nothing to withdraw
											</Button>
										)}
									</>
								)}
							</div>
							{p.kind === "flexible" && (
								<Card title="Plan rules">
									{planRules(p).map((rule) => (
										<p key={rule}>{rule}</p>
									))}
								</Card>
							)}
						</>
					}
					side={
						<>
							{p.kind === "locked" && (
								<Card title="Your release condition">
									<p>
										Funds become withdrawable on {longDate(p.unlocksAt)}. Only your connected owner wallet can request a
										withdrawal after that date.
									</p>
								</Card>
							)}
							<Card title={p.kind === "locked" ? "Recent deposits" : "Recent activity"}>
								{txs.isLoading ? <p>Loading…</p> : <TransactionLines rows={rows} />}
							</Card>
							<Card tone="lilac" title="Wallet & contract">
								<p>Owner wallet · {shortAddress(p.ownerWallet)}</p>
								<p>Network · {STELLAR_NETWORK_LABEL}</p>
								<p>Personal savings contract · {p.contractId ? shortAddress(p.contractId) : "Simulated"}</p>
							</Card>
							{p.contractId && (
								<Button asChild variant="soft" className="w-full text-sm lg:text-base">
									<a href={explorerContractUrl(p.contractId)} target="_blank" rel="noopener noreferrer">
										View activity on explorer
									</a>
								</Button>
							)}
						</>
					}
				/>
			)}
		</div>
	);
}
