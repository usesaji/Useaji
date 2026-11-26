"use client";

import { useParams } from "next/navigation";
import { Button } from "@repo/ui/button";
import { QueryState } from "@repo/ui/query-state";
import { LinkButton } from "@/components/LinkButton";
import { PageHeader } from "@/components/PageHeader";
import { LOCK, lockOpen, lockReason, planRules, withdrawBlocked } from "@/features/savings/copy";
import { Card, TwoColumns } from "@/components/Cards";
import { MovementLines, PlanBalanceCard } from "@/features/savings/components/SavingsUi";
import { useSavingsPlan } from "@/features/savings/hooks";
import { formatMoney, longDate } from "@/lib/format";
import { pageRoutes } from "@/lib/routes";
import { explorerContractUrl, SAVINGS_CONTRACT, shortAddress, STELLAR_NETWORK_LABEL } from "@/lib/stellar/config";
import { useNow } from "@/lib/use-now";

/**
 * One personal savings goal (v3 screens 09 flexible, 12 locked; the other locks follow 12): balance
 * and progress, deposit / withdraw, the goal's rules, recent movements, and the wallet and contract
 * behind it. `canWithdraw` (the API) decides the Withdraw button; the copy explains why.
 */
export default function SavingsPlanPage() {
	const { planId } = useParams<{ planId: string }>();
	const plan = useSavingsPlan(planId);
	const now = useNow();
	const r = pageRoutes.dashboardRoutes;
	const p = plan.data;
	const flexible = p?.lock === "flexible";
	const locked = p ? !lockOpen(p, now) : false;
	const rows = (p?.movements ?? []).slice(0, 5);

	return (
		<div className="w-full space-y-6 pb-10">
			<PageHeader title={p?.name ?? "Savings goal"} subtitle={p ? LOCK[p.lock].intro : undefined} back backHref={r.SAVINGS} />
			<QueryState isLoading={plan.isLoading} error={plan.error} onRetry={() => void plan.refetch()} />

			{p && (
				<TwoColumns
					main={
						<>
							<PlanBalanceCard plan={p} />
							{!flexible &&
								(locked ? (
									<Card tone="lilac" title="Withdrawal unavailable">
										<p>{lockReason(p)}.</p>
										<p>Available to withdraw now · {formatMoney(0, p.asset)}</p>
										{p.lock === "until_date" && <p>Reaching the target early does not unlock this date-based plan.</p>}
									</Card>
								) : (
									<Card tone="lilac" title="Your savings are released">
										<p>
											{p.lock === "until_target" || (p.lock === "until_date_or_target" && !(p.unlockAt && new Date(p.unlockAt).getTime() <= now))
												? "You reached your target."
												: `Released on ${longDate(p.unlockAt)}.`}
										</p>
										<p>Available to withdraw now · {formatMoney(p.balance, p.asset)}</p>
										{p.lock === "until_target" && <p>A withdrawal that takes the balance below the target locks it again.</p>}
									</Card>
								))}
							{/* As designed: flexible → Deposit · Withdraw (09); locked → the disabled Withdraw · Deposit (12). */}
							<div className="grid grid-cols-2 gap-3">
								{p.canWithdraw ? (
									<>
										<LinkButton href={r.SAVINGS_DEPOSIT(p.id)} className="w-full text-sm lg:text-base">
											Deposit USDC
										</LinkButton>
										<LinkButton href={r.SAVINGS_WITHDRAW(p.id)} variant="ghost" className="w-full text-sm lg:text-base">
											Withdraw USDC
										</LinkButton>
									</>
								) : (
									<>
										<Button variant="soft" disabled className="w-full text-sm lg:text-base">
											{withdrawBlocked(p, now)}
										</Button>
										<LinkButton href={r.SAVINGS_DEPOSIT(p.id)} className="w-full text-sm lg:text-base">
											Deposit USDC
										</LinkButton>
									</>
								)}
							</div>
							{flexible && (
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
							{!flexible && (
								<Card title="Your release condition">
									{planRules(p).map((rule) => (
										<p key={rule}>{rule}</p>
									))}
								</Card>
							)}
							<Card title="Recent activity">
								<MovementLines rows={rows} asset={p.asset} />
							</Card>
							<Card tone="lilac" title="Wallet & contract">
								<p>Owner wallet · {p.ownerAddress ? shortAddress(p.ownerAddress) : "Simulated"}</p>
								<p>Network · {STELLAR_NETWORK_LABEL}</p>
								<p>Personal savings contract · {p.ownerAddress ? shortAddress(SAVINGS_CONTRACT) : "Simulated"}</p>
								{p.txUrl && (
									<a href={p.txUrl} target="_blank" rel="noopener noreferrer" className="inline-block text-primary">
										Goal created on {longDate(p.createdAt)} · View transaction
									</a>
								)}
							</Card>
							{p.ownerAddress && (
								<Button asChild variant="soft" className="w-full text-sm lg:text-base">
									<a href={explorerContractUrl(SAVINGS_CONTRACT)} target="_blank" rel="noopener noreferrer">
										View contract on explorer
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
