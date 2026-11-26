"use client";

/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { LinkButton } from "@/components/LinkButton";
import { Money } from "@/components/Money";
import { NoPlansCard, PlanCard } from "@/features/savings/components/SavingsUi";
import { useSavingsOverview, useSavingsPlans } from "@/features/savings/hooks";
import type { GroupsOverviewDto } from "@/lib/api/dto";
import { formatMoney, relative } from "@/lib/format";
import { pageRoutes } from "@/lib/routes";
import { useNow } from "@/lib/use-now";

/**
 * The savings dashboard (v3 screen 01): total saved across group savings and personal savings
 * (`GET /savings/overview`: "contributed and saved", not a wallet balance), the soonest
 * contribution due, a create-goal button, the newest personal goal, and the "save your way" card.
 * Until the savings overview answers, it shows the group half from `GET /groups/overview`.
 */
export function SavingsDashboard({ overview }: { overview: GroupsOverviewDto | undefined }) {
	const savings = useSavingsOverview();
	const plans = useSavingsPlans();
	const now = useNow();
	const r = pageRoutes.dashboardRoutes;
	const groups = savings.data?.groups ?? overview;
	const asset = groups?.asset ?? "USDC";
	const group = Number(groups?.totalSaved ?? 0);
	// If the savings overview fails, show group savings alone.
	const personal = savings.data ? Number(savings.data.personal.balance) : null;
	const total = savings.data ? Number(savings.data.totalSaved) : group;
	const plan = plans.data?.[0];
	const due = groups?.nextDue ?? null;

	return (
		<div className="space-y-4">
			<div>
				<h2 className="text-[26px] font-light md:text-[34px] md:font-normal">Savings dashboard</h2>
				<p className="mt-1 text-xs font-light md:text-sm">Your circles and personal goals, all in one place.</p>
			</div>
			<div className="grid items-start gap-5 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
				<div className="min-w-0 space-y-5">
					<section className="rounded-[20px] bg-panel p-5">
						<p className="text-xs tracking-wide uppercase">Total contributed &amp; saved</p>
						<div className="mt-3 space-y-2 text-xs font-light text-ink-muted md:text-sm">
							<p>Group savings · {formatMoney(group, asset)}</p>
							{personal !== null && <p>Personal savings · {formatMoney(personal, asset)}</p>}
						</div>
						<p className="mt-4 truncate text-[40px] leading-none font-medium tracking-tight md:text-[52px]">
							{groups ? <Money amount={total} asset={asset} /> : "…"}
						</p>
						{due && (
							<Link href={r.CIRCLE(due.groupId)} className="mt-4 inline-block text-xs text-primary md:text-sm">
								Next contribution · {formatMoney(due.amount, asset)} due {now ? relative(due.deadline, now) : "soon"} ·{" "}
								{due.groupName} →
							</Link>
						)}
					</section>
					<LinkButton href={r.NEW_SAVINGS} className="w-full text-sm lg:text-base">
						Create a savings goal
					</LinkButton>
				</div>
				<div className="min-w-0 space-y-5">
					{plan ? (
						<PlanCard plan={plan} href={r.SAVINGS} action="View personal savings" />
					) : (
						plans.data && <NoPlansCard href={r.NEW_SAVINGS} />
					)}
					<section className="relative overflow-hidden rounded-[20px] bg-primary px-5 pt-5 text-white">
						<p className="text-base md:text-lg">A little today. More possibilities tomorrow.</p>
						<p className="mt-2 text-xs font-light text-white/85 md:text-sm">Join a savings circle or build a goal on your own.</p>
						<img src="/images/piggy-savings.svg" alt="" aria-hidden className="animate-float mx-auto mt-3 h-40 md:h-48" />
					</section>
				</div>
			</div>
		</div>
	);
}
