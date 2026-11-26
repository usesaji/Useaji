"use client";

import { useState } from "react";
import { HiArrowTopRightOnSquare } from "react-icons/hi2";
import { Button } from "@repo/ui/button";
import { InputField } from "@repo/ui/input-field";
import { QueryState } from "@repo/ui/query-state";
import { LinkButton } from "@/components/LinkButton";
import { PageHeader } from "@/components/PageHeader";
import { lockReason, planTitle } from "@/features/savings/copy";
import { Card, TwoColumns } from "@/components/Cards";
import { useDeposit, useSavingsPlan, useWithdraw, type MoveResult } from "@/features/savings/hooks";
import { TX_PHASE_LABEL } from "@/features/wallet/transactions";
import { useWalletUsdc } from "@/features/wallet/hooks";
import type { PlanDto } from "@/lib/api/dto";
import { formatMoney, longDate } from "@/lib/format";
import { pageRoutes } from "@/lib/routes";
import { shortAddress, STELLAR_NETWORK_LABEL } from "@/lib/stellar/config";

type Mode = "deposit" | "withdraw";

/** As the API takes amounts: at most 7 decimals. */
const AMOUNT = /^\d+(\.\d{1,7})?$/;

const COPY = {
	deposit: {
		title: "Deposit USDC",
		subtitle: "Add test USDC from your owner wallet.",
		walletLabel: "From wallet",
		walletNote: "Connected",
		summary: "Deposit summary",
		action: "Continue to wallet",
		after: "Savings after deposit",
	},
	withdraw: {
		title: "Withdraw USDC",
		subtitle: "Move available savings back to your own wallet.",
		walletLabel: "To your wallet",
		walletNote: "Owner wallet",
		summary: "Withdrawal summary",
		action: "Confirm in wallet",
		after: "Savings after withdrawal",
	},
} as const;

/**
 * Deposit (v3 screen 10) and Withdraw (11): an amount, the owner wallet it comes from or goes to, a
 * summary, then the wallet signs the transaction the API prepared and the API submits it (a few
 * seconds: "Confirming on Stellar…"). Withdrawals only ever go to the plan's owner wallet; while the
 * lock holds they're refused (the contract and the API enforce it, the screen explains it).
 */
export function MoveMoney({ planId, mode }: { planId: string; mode: Mode }) {
	const plan = useSavingsPlan(planId);
	const p = plan.data;
	return (
		<div className="w-full space-y-6 pb-10">
			<PageHeader
				title={COPY[mode].title}
				subtitle={COPY[mode].subtitle}
				back
				backHref={pageRoutes.dashboardRoutes.SAVINGS_PLAN(planId)}
			/>
			<QueryState isLoading={plan.isLoading} error={plan.error} onRetry={() => void plan.refetch()} />
			{p && <MoveForm plan={p} mode={mode} />}
		</div>
	);
}

function MoveForm({ plan, mode }: { plan: PlanDto; mode: Mode }) {
	const [amount, setAmount] = useState("");
	const [touched, setTouched] = useState(false);
	const [done, setDone] = useState<MoveResult | null>(null);
	const deposit = useDeposit(plan);
	const withdraw = useWithdraw(plan);
	const move = mode === "deposit" ? deposit : withdraw;
	const walletUsdc = useWalletUsdc(mode === "deposit" ? plan.ownerAddress : null);
	const copy = COPY[mode];
	const back = pageRoutes.dashboardRoutes.SAVINGS_PLAN(plan.id);
	const owner = plan.ownerAddress ? shortAddress(plan.ownerAddress) : "Simulated wallet";

	const locked = mode === "withdraw" && !plan.canWithdraw && Number(plan.balance) > 0;
	const withdrawable = plan.canWithdraw ? Number(plan.balance) : 0;
	const value = Number(amount);
	const available = mode === "deposit" ? (walletUsdc.data ? Number(walletUsdc.data.usdc) : null) : withdrawable;
	const error = !amount.trim()
		? "Enter an amount"
		: !AMOUNT.test(amount.trim()) || value <= 0
			? "Enter an amount like 300 or 300.50"
			: available !== null && value > available + 1e-9
				? mode === "deposit"
					? `Your wallet holds ${formatMoney(available, plan.asset)}`
					: `You can withdraw up to ${formatMoney(available, plan.asset)}`
				: null;
	const after = Number(plan.balance) + (mode === "deposit" ? 1 : -1) * (error ? 0 : value);

	const submit = (event: React.FormEvent) => {
		event.preventDefault();
		setTouched(true);
		if (error || locked) return;
		move.mutate(amount.trim(), { onSuccess: (result) => setDone(result) });
	};

	if (done) {
		const m = done.movement;
		return (
			<TwoColumns
				main={
					<Card title={mode === "deposit" ? "Deposit confirmed" : "Withdrawal confirmed"}>
						<p className="animate-pop">
							{formatMoney(m?.amount ?? amount, plan.asset)} {mode === "deposit" ? `added to ${plan.name}` : `sent to ${owner}`}
							{m ? ` on ${longDate(m.createdAt)}` : ""}.
						</p>
						<p>
							{plan.name} now holds {formatMoney(done.plan.balance, plan.asset)}.
						</p>
						{m?.txUrl && (
							<a
								href={m.txUrl}
								target="_blank"
								rel="noopener noreferrer"
								className="inline-flex items-center gap-1.5 text-primary"
							>
								View transaction on explorer <HiArrowTopRightOnSquare />
							</a>
						)}
					</Card>
				}
				side={
					<LinkButton href={back} className="w-full text-sm lg:text-base">
						Back to {plan.name}
					</LinkButton>
				}
			/>
		);
	}

	return (
		<form noValidate onSubmit={submit}>
			<TwoColumns
				main={
					<section className="space-y-4 rounded-[20px] bg-panel p-5">
						<div>
							<h3 className="text-base md:text-lg">{planTitle(plan)}</h3>
							<p className="mt-2 text-xs font-light text-ink-muted md:text-sm">
								{mode === "deposit"
									? `Current savings · ${formatMoney(plan.balance, plan.asset)}`
									: `Available to withdraw · ${formatMoney(withdrawable, plan.asset)}`}
							</p>
						</div>
						<InputField
							name="amount"
							label="Amount · USDC"
							inputMode="decimal"
							placeholder="0.00"
							value={amount}
							onChange={(e) => setAmount(e.target.value)}
							onBlur={() => setTouched(true)}
							disabled={move.isPending || locked}
							error={touched ? error : null}
							description={
								mode === "deposit" && walletUsdc.data
									? `Wallet balance · ${formatMoney(walletUsdc.data.usdc, plan.asset)}`
									: undefined
							}
						/>
						<InputField
							name="wallet"
							label={copy.walletLabel}
							value={`${owner} · ${copy.walletNote}`}
							readOnly
						/>
					</section>
				}
				side={
					<>
						<Card title={copy.summary}>
							<p>
								{mode === "deposit" ? "Deposit" : "You receive"} · {formatMoney(error ? 0 : value, plan.asset)}
							</p>
							<p>
								{copy.after} · {formatMoney(after, plan.asset)}
							</p>
							<p>Network fee · Estimated in wallet (XLM)</p>
						</Card>
						{mode === "deposit" ? (
							<Card tone="lilac" title="Confirm with your wallet">
								<p>
									You stay in control of your keys. Your wallet shows the deposit into the Saji savings contract on{" "}
									{STELLAR_NETWORK_LABEL}; sign only that. Your balance updates after confirmation.
								</p>
							</Card>
						) : locked ? (
							<Card tone="lilac" title="Withdrawal unavailable">
								<p>{lockReason(plan)}.</p>
								{plan.lock === "until_date" && <p>Reaching the target early does not unlock it.</p>}
							</Card>
						) : (
							<Card tone="lilac" title="Withdrawal allowed">
								<p>
									This plan is {plan.lock === "flexible" ? "flexible" : "released"}. The contract checks your ownership and the
									balance before releasing funds to your owner wallet.
									{plan.lock === "until_target" ? " Going below your target locks the plan again." : ""}
								</p>
							</Card>
						)}
						<div className="grid grid-cols-2 gap-3">
							<Button
								type="submit"
								isLoading={move.isPending && move.phase !== "wallet"}
								disabled={move.isPending || locked}
								className="w-full text-sm lg:text-base"
							>
								{move.phase === "wallet" ? "Check your wallet…" : copy.action}
							</Button>
							<LinkButton href={back} variant="soft" className="w-full text-sm lg:text-base">
								Cancel
							</LinkButton>
						</div>
						<Card title="Transaction status">
							<p className={move.isPending ? "text-primary" : undefined} aria-live="polite">
								{TX_PHASE_LABEL[move.phase]}
							</p>
							<p>Steps · Prepare → Sign in wallet → Confirm on Stellar</p>
							<p>If you reject it or it fails, nothing moves.</p>
						</Card>
					</>
				}
			/>
		</form>
	);
}
