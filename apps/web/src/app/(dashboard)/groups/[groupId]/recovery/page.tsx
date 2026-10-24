"use client";

import { useParams } from "next/navigation";
import { HiBanknotes, HiCalendarDays, HiExclamationTriangle, HiOutlineShieldCheck, HiOutlineUser, HiRectangleStack } from "react-icons/hi2";
import { Button } from "@repo/ui/button";
import { PageHeader } from "@/components/PageHeader";
import { useCycle, useDetectDefaults, useSettleDefault } from "@/features/circle/hooks";
import { PAY_PHASE_LABEL } from "@/features/circle/pay";
import { Hero, InfoList, Note, PageState, Panel, PrimaryAction, TxCard } from "@/features/governance/components/ui";
import { useProposals } from "@/features/governance/hooks";
import { useGroup } from "@/features/groups/hooks";
import { useMemberNames } from "@/features/groups/use-names";
import type { DefaultDto, ProposalDto } from "@/lib/api/dto";
import { dateTime, formatMoney } from "@/lib/format";
import { pageRoutes } from "@/lib/routes";

/**
 * p6 / p7 — Missed contributions: what was missed, that payouts are held, and the way forward for
 * each open default (vote on a recovery, follow the vote in progress, wait for an extension, or —
 * for the member in default — pay it).
 */
export default function RecoveryPage() {
	const { groupId } = useParams<{ groupId: string }>();
	const group = useGroup(groupId);
	const cycle = useCycle(groupId);
	const open = useProposals(groupId, { status: "open", limit: 50 });
	const detect = useDetectDefaults(groupId);
	const c = cycle.data;
	const defaults = c?.openDefaults ?? [];

	return (
		<div className="w-full space-y-6 pb-10">
			<PageHeader title={group.data?.name ?? "Recovery"} back backHref={pageRoutes.dashboardRoutes.CIRCLE(groupId)} />
			<PageState loading={cycle.isLoading} error={cycle.error} onRetry={() => void cycle.refetch()} />

			{c && defaults.length === 0 && (
				<Panel className="space-y-3 py-10 text-center text-sm">
					<p>No missed contributions. The cycle is running normally.</p>
					<button type="button" onClick={() => detect.mutate()} disabled={detect.isPending} className="text-xs text-primary underline disabled:opacity-50">
						{detect.isPending ? "Checking…" : "Check for missed contributions now"}
					</button>
				</Panel>
			)}

			{c &&
				defaults.map((d) => (
					<DefaultBlock key={d.id} d={d} groupId={groupId} asset={group.data?.asset ?? "USDC"} proposal={d.proposalId ? (open.data?.results ?? []).find((p) => p.id === d.proposalId) : undefined} />
				))}
		</div>
	);
}

function DefaultBlock({ d, groupId, asset, proposal }: { d: DefaultDto; groupId: string; asset: string; proposal: ProposalDto | undefined }) {
	const { name, first, me } = useMemberNames(groupId);
	const settle = useSettleDefault(groupId);
	const mine = d.member.userId === me;
	const who = first(d.member, { you: false });
	const routes = pageRoutes.dashboardRoutes;

	const next = mine ? (
		<Button
			onClick={() => settle.mutate(d)}
			isLoading={settle.isPending && settle.phase === "recording"}
			disabled={settle.isPending}
		>
			{settle.phase !== "idle" ? PAY_PHASE_LABEL[settle.phase] : `Pay ${formatMoney(d.amount, asset)} now`}
		</Button>
	) : proposal ? (
		<PrimaryAction href={routes.PROPOSAL(groupId, proposal.id)}>View recovery vote</PrimaryAction>
	) : d.availableActions.length > 0 ? (
		<PrimaryAction href={routes.RECOVERY_OPTIONS(groupId, d.id)}>View recovery options</PrimaryAction>
	) : null;

	return (
		<section className="space-y-4">
			<Hero tone="pink" Icon={HiExclamationTriangle} title={mine ? "You missed a contribution" : `${who} missed a contribution`}>
				The grace period ended without payment. SAJI recorded it on Stellar and payouts are on hold until it&apos;s resolved.
			</Hero>
			<div className="grid items-start gap-4 md:grid-cols-2">
				<div className="space-y-4">
					<InfoList
						rows={[
							{ Icon: HiOutlineUser, label: "Member", value: name(d.member) },
							{ Icon: HiRectangleStack, label: "Round", value: `Round ${d.round + 1}` },
							{ Icon: HiBanknotes, label: "Amount owed", value: formatMoney(d.amount, asset), tone: "pink" },
							{ Icon: HiCalendarDays, label: "Grace period ended", value: dateTime(d.deadline) },
							...(d.graceUntil ? [{ Icon: HiCalendarDays, label: "Extended to", value: dateTime(d.graceUntil), tone: "green" as const }] : []),
							{ Icon: HiOutlineShieldCheck, label: "Record", value: d.txHash ? "On Stellar" : "Recorded", tone: "green" },
						]}
					/>
					<TxCard hash={d.txHash} state="Missed contribution recorded" />
				</div>
				<div className="space-y-4">
					{mine ? (
						<Note tone="yellow" title={d.graceUntil ? "The group gave you more time" : "The group is deciding what to do"}>
							{d.graceUntil
								? `Pay what you owe before ${dateTime(d.graceUntil)} and the round pays out right away.`
								: "Paying what you owe (the late fee included) ends the recovery right away. Members in default don't vote on their own recovery."}
						</Note>
					) : proposal ? (
						<Note tone="yellow" title="A recovery vote is open">
							Members are voting on what to do. Payouts stay on hold until it&apos;s decided.
						</Note>
					) : d.graceUntil ? (
						<Note tone="yellow" title={`Waiting for ${who} to pay`}>
							The group gave {who} until {dateTime(d.graceUntil)}. The round pays out as soon as they do.
						</Note>
					) : (
						<Note tone="yellow" title={`Round ${d.round + 1} is on hold`}>
							No payout moves forward until members approve a recovery action. Everyone&apos;s saved funds stay in the group&apos;s escrow.
						</Note>
					)}
					<div className="md:flex md:justify-end">{next}</div>
				</div>
			</div>
		</section>
	);
}
