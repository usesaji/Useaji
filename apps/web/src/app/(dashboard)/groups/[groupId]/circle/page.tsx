"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@repo/ui/button";
import { PageHeader } from "@/components/PageHeader";
import { QueryState } from "@repo/ui/query-state";
import { SectionHeader } from "@/components/SectionHeader";
import {
	Banner,
	CycleActivityList,
	DecideTogether,
	PayoutRotationStrip,
	SavingsCard,
	ThisCycleCard,
} from "@/features/circle/components/CircleSections";
import { OnboardingModal } from "@/features/circle/components/OnboardingModal";
import { useContribute, useCycle, useSettleDefault } from "@/features/circle/hooks";
import { PAY_PHASE_LABEL } from "@/features/circle/pay";
import { ProposalCard } from "@/features/governance/components/ProposalCard";
import { SlotPanel } from "@/features/slots/components/SlotPanel";
import { describeEvent } from "@/features/governance/events";
import { useHistory, useProposals } from "@/features/governance/hooks";
import { useGroup } from "@/features/groups/hooks";
import { useMemberNames } from "@/features/groups/use-names";
import { circleStatus, roundsProgress } from "@/features/groups/view";
import { EmptyState } from "@repo/ui/empty-state";
import { formatMoney, relative, shortDate } from "@/lib/format";
import { pageRoutes } from "@/lib/routes";
import { useNow } from "@/lib/use-now";

/**
 * A running group (`GET /groups/{id}/cycle`): what's been paid out, what's due, the payout rotation,
 * open proposals and recent activity — with the one action that matters right now (pay, pay what you
 * missed, or see the recovery).
 */
export default function CirclePage() {
	const { groupId } = useParams<{ groupId: string }>();
	const router = useRouter();
	const routes = pageRoutes.dashboardRoutes;
	const group = useGroup(groupId);
	const cycle = useCycle(groupId);
	const open = useProposals(groupId, { status: "open", limit: 5 });
	const history = useHistory(groupId, { limit: 8 });
	const { name, first, me } = useMemberNames(groupId);
	const contribute = useContribute(groupId);
	const settle = useSettleDefault(groupId);
	const now = useNow();
	const [hidden, setHidden] = useState(false);

	const g = group.data;
	const c = cycle.data;

	// A group that hasn't started lives on the forming page.
	useEffect(() => {
		if (g?.status === "forming") router.replace(routes.GROUP(groupId));
	}, [g?.status, groupId, router, routes]);

	if (!g || !c) {
		return (
			<div className="w-full pb-10">
				<PageHeader title={g?.name ?? "Group"} back backHref={routes.GROUPS} />
				<QueryState
					isLoading={group.isLoading || cycle.isLoading}
					error={group.error ?? cycle.error}
					onRetry={() => void cycle.refetch()}
					className="mt-6"
				/>
			</div>
		);
	}

	const completed = c.status === "completed";
	const progress = roundsProgress(c);
	const round = c.round ?? 0;
	const recipientIsMe = !!c.recipient && c.recipient.userId === me;
	const myDefault = c.openDefaults.find((d) => d.member.userId === me);
	const otherDefault = c.openDefaults.find((d) => d.member.userId !== me);
	const paidCount = c.contributions.filter((x) => x.paid).length;
	const pastDeadline = !!c.deadline && now > 0 && new Date(c.deadline).getTime() < now;
	const paidOutTotal = Number(c.totalPaidOut);
	const iPaid = c.contributions.some((x) => x.member.userId === me && x.paid);
	const openProposals = open.data?.results ?? [];
	const faces = c.schedule.map((s) => s.member);
	const memberCount = g.memberCount;

	// Everyone pays every round, this round's recipient included (the pot is the sum of what was paid).
	const ownStatus = myDefault
		? { value: `${formatMoney(myDefault.amount, g.asset)} overdue`, tone: "pink" as const }
		: iPaid
			? { value: recipientIsMe ? "Paid · you collect" : "Paid", tone: "green" as const }
			: c.myAmountDue
				? { value: `${formatMoney(c.myAmountDue, g.asset)} due`, tone: "pink" as const }
				: { value: recipientIsMe ? "Your turn to collect" : "Nothing due", tone: recipientIsMe ? ("green" as const) : undefined };

	const payLabel =
		contribute.phase !== "idle"
			? PAY_PHASE_LABEL[contribute.phase]
			: c.paused
				? "Group paused"
				: c.myAmountDue
					? `Pay ${formatMoney(c.myAmountDue, g.asset)}`
					: iPaid
						? "Paid this round"
						: "Nothing due";

	// What needs attention, most urgent first.
	const banner = myDefault ? (
		<Banner
			tone="pink"
			title={`You missed round ${myDefault.round + 1}`}
			action={
				<Button
					onClick={() => settle.mutate(myDefault)}
					isLoading={settle.isPending && settle.phase === "recording"}
					disabled={settle.isPending}
					className="shrink-0"
				>
					{settle.phase !== "idle" ? PAY_PHASE_LABEL[settle.phase] : `Pay ${formatMoney(myDefault.amount, g.asset)}`}
				</Button>
			}
		>
			{myDefault.graceUntil
				? `The group gave you until ${shortDate(myDefault.graceUntil)}. Pay what you owe (late fee included) to end the recovery.`
				: "The group is in recovery until it's resolved. Paying what you owe (late fee included) ends it right away."}
		</Banner>
	) : otherDefault ? (
		<Banner
			tone="pink"
			title={`${first(otherDefault.member)} missed a contribution`}
			href={routes.RECOVERY(groupId)}
			cta={c.actionRequired ? "Decide together" : "View recovery"}
		>
			{c.actionRequired
				? "Payouts are on hold until members agree on a recovery action."
				: "A recovery decision is in progress. Payouts resume once it's resolved."}
		</Banner>
	) : c.paused ? (
		<Banner tone="yellow" title="This group is paused" href={routes.PROPOSALS(groupId)} cta="Proposals">
			Members voted to pause{c.paused.since ? ` on ${shortDate(c.paused.since)}` : ""}. Contributions and payouts restart once a
			resume proposal passes — deadlines don&apos;t run meanwhile.
		</Banner>
	) : completed ? (
		<Banner tone="lilac" title="Every round has been paid out" href={routes.GROUP_COMPLETE(groupId)} cta="Cycle summary">
			The group has completed its rotation.
		</Banner>
	) : c.myAmountDue ? (
		<Banner
			tone={pastDeadline ? "pink" : "lilac"}
			title={`${formatMoney(c.myAmountDue, g.asset)} due ${c.deadline && now ? relative(pastDeadline ? (c.graceEndsAt ?? c.deadline) : c.deadline, now) : "this round"}`}
		>
			{pastDeadline
				? `The deadline has passed — this includes the late fee. Pay before the grace period ends (${shortDate(c.graceEndsAt)}) or it's recorded as missed.`
				: `Your round ${round + 1} contribution is due by ${shortDate(c.deadline)}.${recipientIsMe ? " You collect this round's pot once everyone has paid." : " Keep enough USDC in your wallet to avoid the late fee."}`}
		</Banner>
	) : recipientIsMe ? (
		<Banner tone="lilac" title="It's your turn to collect this round">
			Once every member has paid, the pot goes straight to your wallet (or your primary payout address).
		</Banner>
	) : null;

	return (
		<div className="w-full pb-10">
			<PageHeader
				title={g.name}
				back
				backHref={routes.GROUPS}
				actions={
					<>
						<Link
							href={routes.GROUP_RULES(groupId)}
							className="rounded-full bg-neutral-comment px-4 py-2 text-xs transition hover:bg-primary-light md:text-sm"
						>
							Rules
						</Link>
						<Link
							href={`${routes.GROUP(groupId)}?manage=1`}
							className="rounded-full bg-neutral-comment px-4 py-2 text-xs transition hover:bg-primary-light md:text-sm"
						>
							Members
						</Link>
					</>
				}
			/>

			<div className="mt-6 space-y-8">
				<div className="space-y-4">
					<SavingsCard
						total={paidOutTotal}
						asset={g.asset}
						hidden={hidden}
						onToggleHidden={() => setHidden((h) => !h)}
						status={circleStatus(g, c)}
						faces={faces}
						memberCount={memberCount}
						percent={progress.percent}
						roundLabel={
							completed
								? `All ${progress.total} rounds done`
								: `Round ${round + 1} of ${c.totalRounds} · ${c.recipient ? (recipientIsMe ? "You collect" : `${name(c.recipient)} collects`) : ""}`
						}
						nextPayout={completed ? null : shortDate(c.deadline)}
					/>
					{banner}
					{c.chainSync?.lastError ? (
						<p role="status" className="rounded-[14px] bg-warning-50 px-5 py-3 text-xs text-warning-900">
							Some Stellar work for this group hasn&apos;t gone through yet ({c.chainSync.lastError}). Saji retries it
							automatically.
						</p>
					) : (
						c.chainSync?.pending && (
							<p role="status" className="animate-breathe rounded-[14px] bg-panel px-5 py-3 text-xs">
								Settling on Stellar… payouts and records confirm in a few minutes.
							</p>
						)
					)}
				</div>

				{!completed && <SlotPanel groupId={groupId} asset={g.asset} />}

				<div className="grid items-start gap-6 lg:grid-cols-2">
					<section className="space-y-3">
						<SectionHeader
							title={
								<span className="flex items-center gap-2 text-sm md:text-base">
									Open proposals
									{openProposals.length > 0 && (
										<span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-error-400 px-1 text-[10px] text-white">
											{openProposals.length}
										</span>
									)}
								</span>
							}
							action={
								<Link href={routes.PROPOSALS(groupId)} className="text-xs text-primary md:text-sm">
									View proposals →
								</Link>
							}
						/>
						{openProposals[0] ? (
							<ProposalCard
								proposal={openProposals[0]}
								groupId={groupId}
								firstName={(m) => first(m)}
								tone={openProposals[0].canVote ? "lilac" : "grey"}
							/>
						) : (
							<div className="rounded-[14px] bg-panel px-5 py-6 text-center text-xs font-light">
								Nothing is being voted on right now.
							</div>
						)}
					</section>
					<div className="space-y-4">
						<ThisCycleCard
							historyHref={routes.GROUP_HISTORY(groupId)}
							rows={[
								{ label: "Your contribution", ...ownStatus },
								{ label: "Group contributions", value: completed ? "—" : `${paidCount} of ${c.contributions.length} paid` },
								{
									label: "Missed contributions",
									value: c.openDefaults.length === 0 ? "None" : `${c.openDefaults.length} open`,
									tone: c.openDefaults.length === 0 ? "green" : "pink",
								},
							]}
						/>
						<DecideTogether href={routes.PROPOSALS(groupId)} />
					</div>
				</div>

				<PayoutRotationStrip schedule={c.schedule} currentRound={completed ? null : round} name={(m) => name(m)} />

				{(history.data?.results.length ?? 0) > 1 ? (
					<CycleActivityList
						events={history.data!.results}
						viewAllHref={routes.GROUP_HISTORY(groupId)}
						describe={(e) => describeEvent(e, (m) => name(m), g.asset)}
					/>
				) : (
					<EmptyState title="Nothing to see yet" />
				)}

				{/* The page's main action, kept in reach while scrolling. Everyone pays, the recipient too. */}
				<div className="sticky bottom-24 z-30 flex gap-3 lg:bottom-6">
					{completed ? (
						<Link
							href={routes.GROUP_COMPLETE(groupId)}
							className="flex h-12 flex-1 items-center justify-center rounded-full bg-primary text-sm text-white shadow-lg md:max-w-xs"
						>
							View Cycle Summary
						</Link>
					) : (
						!myDefault && (
							<button
								type="button"
								onClick={() => contribute.mutate(c)}
								disabled={contribute.isPending || !c.myAmountDue}
								className="h-12 flex-1 rounded-full bg-primary text-sm text-white shadow-lg transition hover:bg-primary-hover disabled:cursor-not-allowed disabled:bg-neutral-light-hover disabled:text-neutral-light-active disabled:shadow-none md:max-w-xs md:text-base"
							>
								{payLabel}
							</button>
						)
					)}
				</div>
			</div>

			{(history.data?.results.length ?? 0) <= 2 && !completed && <OnboardingModal groupId={groupId} />}
		</div>
	);
}
