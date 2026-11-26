"use client";

import Link from "next/link";
import { HiArrowTopRightOnSquare } from "react-icons/hi2";
import { Card, ProgressBar } from "@/components/Cards";
import { LinkButton } from "@/components/LinkButton";
import { Money } from "@/components/Money";
import { LOCK, lockReason, planTitle, progressNote } from "@/features/savings/copy";
import type { MovementDto, PlanDto } from "@/lib/api/dto";
import { formatMoney, longDate } from "@/lib/format";

/**
 * The personal savings screens' pieces (the generic cards and layout are in components/Cards.tsx).
 */

/** "FLEXIBLE SAVINGS · Target … · 1,200.00 USDC · 40% saved · bar" — the top of a plan's page. */
export function PlanBalanceCard({ plan }: { plan: PlanDto }) {
	return (
		<section className="rounded-[20px] bg-panel p-5">
			<p className="text-sm tracking-wide uppercase md:text-base">{LOCK[plan.lock].heading}</p>
			<p className="mt-2 text-xs font-light text-ink-muted md:text-sm">
				Target · {formatMoney(plan.target, plan.asset)}
				{plan.unlockAt ? ` · Unlocks ${longDate(plan.unlockAt)}` : ""}
			</p>
			<p className="mt-4 text-[36px] leading-none font-medium tracking-tight md:text-[44px]">
				<Money amount={plan.balance} asset={plan.asset} />
			</p>
			<p className="mt-4 mb-3 text-[11px] font-light text-ink-muted md:text-xs">
				{progressNote(plan)}
			</p>
			<ProgressBar percent={plan.progressPercent} label={`${plan.name} progress`} />
		</section>
	);
}

/** A plan at a glance (dashboard, wallet, plan list): name · kind, saved of target, progress, a link. */
export function PlanCard({
	plan,
	action = "View plan",
	href,
	index = 0,
}: {
	plan: PlanDto;
	action?: string;
	href: string;
	index?: number;
}) {
	return (
		<section className="animate-rise rounded-[20px] bg-panel p-5" style={{ "--i": index } as React.CSSProperties}>
			<h3 className="truncate text-base md:text-lg">{planTitle(plan)}</h3>
			<p className="mt-3 text-xs font-light text-ink-muted md:text-sm">
				{formatMoney(plan.balance)} of {formatMoney(plan.target, plan.asset)} saved
			</p>
			<p className="mt-2 mb-3 text-[11px] font-light text-ink-muted md:text-xs">
				{Number(plan.balance) >= Number(plan.target) ? "Goal reached" : `${plan.progressPercent}% of your goal`}
				{!plan.canWithdraw && plan.lock !== "flexible" && Number(plan.balance) > 0 ? ` · ${lockReason(plan)}` : ""}
			</p>
			<ProgressBar percent={plan.progressPercent} label={`${plan.name} progress`} />
			<LinkButton href={href} variant="ghost" className="mt-4 w-full text-sm lg:text-base">
				{action}
			</LinkButton>
		</section>
	);
}

/** "Oct 8, 2025 · Deposit · +300.00 USDC", each linking to its transaction on Stellar Expert. */
export function MovementLines({ rows, asset = "USDC", empty = "No deposits yet." }: { rows: MovementDto[]; asset?: string; empty?: string }) {
	if (rows.length === 0) return <p>{empty}</p>;
	return (
		<ul className="space-y-3">
			{rows.map((t) => {
				const text = `${longDate(t.createdAt)} · ${t.kind === "deposit" ? "Deposit" : "Withdrawal"} · ${t.kind === "deposit" ? "+" : "−"}${formatMoney(t.amount, asset)}`;
				return (
					<li key={t.id}>
						{t.txUrl ? (
							<a
								href={t.txUrl}
								target="_blank"
								rel="noopener noreferrer"
								className="inline-flex items-center gap-1.5 hover:text-primary"
							>
								{text}
								<HiArrowTopRightOnSquare className="shrink-0 text-xs" aria-label="View on Stellar explorer" />
							</a>
						) : (
							text
						)}
					</li>
				);
			})}
		</ul>
	);
}

/** "Start a goal" when there are no plans yet. */
export function NoPlansCard({ href }: { href: string }) {
	return (
		<Card title="Save toward something of your own">
			<p>Set a target, choose how it locks, and deposit from your own wallet whenever you like.</p>
			<Link href={href} className="inline-block text-primary">
				Create a savings goal →
			</Link>
		</Card>
	);
}
