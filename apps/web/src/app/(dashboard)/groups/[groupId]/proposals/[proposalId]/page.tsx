"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import {
	HiArrowPath,
	HiCalendarDays,
	HiCheckCircle,
	HiClock,
	HiExclamationTriangle,
	HiOutlineUserGroup,
	HiPlayCircle,
	HiRectangleStack,
} from "react-icons/hi2";
import { PageHeader } from "@/components/PageHeader";
import { ConfirmVoteButton, VoteChoices, VoteStatusNote, useCastVote } from "@/features/governance/components/CastVote";
import {
	ACTIONS,
	RECOVERY_ACTIONS,
	actionCaption,
	proposalTitle,
	resultHeadline,
	thresholdLabel,
} from "@/features/governance/copy";
import {
	Hero,
	InfoList,
	Note,
	PageState,
	Panel,
	PrimaryAction,
	StatusPill,
	TxCard,
	VoteProgress,
	timeLeft,
} from "@/features/governance/components/ui";
import { useExecute, useProposal } from "@/features/governance/hooks";
import { useGroup } from "@/features/groups/hooks";
import { useMemberNames } from "@/features/groups/use-names";
import type { ProposalDto } from "@/lib/api/dto";
import { dateTime, formatMoney, shortDate } from "@/lib/format";
import { pageRoutes } from "@/lib/routes";
import { useNow } from "@/lib/use-now";

type First = (m: ProposalDto["proposer"]) => string;

/**
 * One proposal in whichever state it's in: open for votes (details p3, or the recovery vote p10),
 * approved and waiting to be carried out, carried out (result p5 / recovery complete p11), or not
 * approved (rejected / expired).
 */
export default function ProposalPage() {
	const { groupId, proposalId } = useParams<{ groupId: string; proposalId: string }>();
	const { data: p, isLoading, error, refetch } = useProposal(groupId, proposalId);
	const group = useGroup(groupId);
	const { name, first } = useMemberNames(groupId);
	const firstName: First = (m) => first(m, { you: false });
	const groupName = group.data?.name ?? "the group";
	const asset = group.data?.asset ?? "USDC";

	const title = !p
		? "Proposal"
		: p.status === "active"
			? p.type === "recovery"
				? "Recovery Vote"
				: "Proposal Details"
			: p.status === "approved"
				? "Approved"
				: p.type === "recovery" && p.status === "executed"
					? "Recovery Complete"
					: "Proposal Result";

	return (
		<div className="w-full space-y-6 pb-10">
			<PageHeader title={title} back backHref={pageRoutes.dashboardRoutes.PROPOSALS(groupId)} />
			<PageState loading={isLoading} error={error} onRetry={() => void refetch()} />
			{p &&
				(p.status === "active" ? (
					p.type === "recovery" ? (
						<RecoveryVote proposal={p} groupId={groupId} firstName={firstName} asset={asset} />
					) : (
						<Details proposal={p} groupId={groupId} firstName={firstName} proposer={name(p.proposer)} />
					)
				) : p.status === "approved" ? (
					<AwaitingExecution proposal={p} groupId={groupId} firstName={firstName} />
				) : p.status === "executed" ? (
					p.type === "recovery" ? (
						<RecoveryComplete proposal={p} groupId={groupId} groupName={groupName} firstName={firstName} />
					) : (
						<Result proposal={p} groupId={groupId} groupName={groupName} firstName={firstName} />
					)
				) : (
					<NotApproved proposal={p} groupId={groupId} firstName={firstName} />
				))}
		</div>
	);
}

/** p3 — an open governance proposal. */
function Details({
	proposal: p,
	groupId,
	firstName,
	proposer,
}: {
	proposal: ProposalDto;
	groupId: string;
	firstName: First;
	proposer: string;
}) {
	const now = useNow();
	const effect = p.type !== "recovery" ? ACTIONS[p.type].effect : "";
	return (
		<div className="grid items-start gap-6 md:grid-cols-2">
			<div className="space-y-4">
				<div>
					<div className="flex items-center justify-between gap-3">
						<StatusPill tone="green">Voting open</StatusPill>
						<StatusPill tone="lilac">{timeLeft(p.votingEndsAt, now)}</StatusPill>
					</div>
					<h3 className="mt-3 text-xl md:text-2xl">{proposalTitle(p, firstName)}</h3>
					<p className="text-xs font-light">
						Proposal #{p.number} by {proposer} · {shortDate(p.createdAt)}
					</p>
				</div>
				<Panel>
					<p className="text-sm">Why this is proposed</p>
					<p className="mt-1 text-xs font-light">{p.description}</p>
				</Panel>
				<section className="rounded-[14px] bg-primary-light px-4 py-4 md:px-5">
					<p className="text-sm text-primary">Proposed action</p>
					<p className="mt-1 text-xs text-primary">{effect}</p>
					{p.slotTransfer && (
						<div className="mt-3 space-y-1 text-xs text-primary">
							<p>
								Slot {p.slotTransfer.position + 1} · {firstName(p.slotTransfer.seller)} → {firstName(p.slotTransfer.buyer)}
							</p>
							<p>Asking price · {Number(p.slotTransfer.price) === 0 ? "Free" : formatMoney(p.slotTransfer.price, "USDC")}</p>
							<Link href={pageRoutes.dashboardRoutes.SLOT_LISTING(p.slotTransfer.listingId)} className="inline-block underline-offset-4 hover:underline">
								View the listing →
							</Link>
						</div>
					)}
					{p.scheduleChange && (
						<ol className="mt-3 space-y-1 text-xs text-primary">
							{p.scheduleChange.recipients.map((m, i) => (
								<li key={m.userId}>
									Round {p.scheduleChange!.fromRound + i + 1}: {firstName(m)}
								</li>
							))}
						</ol>
					)}
				</section>
			</div>
			<div className="space-y-4">
				<InfoList
					rows={[
						{ Icon: HiCalendarDays, label: "Voting closes", value: dateTime(p.votingEndsAt) },
						{
							Icon: HiOutlineUserGroup,
							label: "Approval threshold",
							value: `${p.required} of ${p.eligible} For (${thresholdLabel(p.threshold)})`,
						},
					]}
				/>
				<VoteProgress proposal={p} title="Current vote" />
				{p.canVote ? (
					<PrimaryAction href={pageRoutes.dashboardRoutes.VOTE(groupId, p.id)}>Cast your vote</PrimaryAction>
				) : (
					<VoteStatusNote proposal={p} />
				)}
			</div>
		</div>
	);
}

/** p10 — an open recovery proposal, voted on in place. */
function RecoveryVote({
	proposal: p,
	groupId,
	firstName,
	asset,
}: {
	proposal: ProposalDto;
	groupId: string;
	firstName: First;
	asset: string;
}) {
	const vote = useCastVote(groupId, p.id);
	const now = useNow();
	const r = p.recovery!;
	const who = firstName(r.default.member);
	const outcome =
		r.action === "grace_extension"
			? `If approved, ${who} can pay by ${dateTime(r.graceUntil)}. Round ${r.default.round + 1} pays out as soon as they do.`
			: r.action === "write_off"
				? `If approved, ${who}'s round ${r.default.round + 1} contribution is forgiven and the round pays out without it.`
				: `If approved, ${who} leaves the group and every round they haven't been paid for. Round ${r.default.round + 1} pays out without them.`;

	return (
		<div className="grid items-start gap-6 md:grid-cols-2">
			<div className="space-y-4">
				<div className="flex items-center justify-between gap-3">
					<StatusPill tone="yellow">Recovery proposed</StatusPill>
					<StatusPill tone="pink">{timeLeft(p.votingEndsAt, now)}</StatusPill>
				</div>
				<div>
					<h3 className="text-xl md:text-2xl">{proposalTitle(p, firstName)}</h3>
					<p className="mt-1 text-xs font-light">{outcome}</p>
				</div>
				<Panel>
					<p className="text-sm">Rationale</p>
					<p className="mt-1 text-xs font-light">{p.description}</p>
				</Panel>
				<InfoList
					rows={[
						{ Icon: HiRectangleStack, label: "Affected round", value: `Round ${r.default.round + 1}` },
						{ Icon: HiCalendarDays, label: "Amount missed", value: formatMoney(r.default.amount, asset), tone: "pink" },
						...(r.graceUntil ? [{ Icon: HiClock, label: "New deadline", value: dateTime(r.graceUntil) }] : []),
						{ Icon: HiOutlineUserGroup, label: "Approval needed", value: `${p.required} of ${p.eligible} For` },
					]}
				/>
				<div className="max-md:hidden">
					{p.canVote && (
						<ConfirmVoteButton
							label="Confirm Recovery Vote"
							disabled={!vote.choice}
							submitting={vote.submitting}
							onClick={vote.submit}
						/>
					)}
				</div>
			</div>
			<div className="space-y-4">
				{p.canVote ? (
					<VoteChoices proposal={p} choice={vote.choice} onChoose={vote.setChoice} firstName={firstName} />
				) : (
					<VoteStatusNote proposal={p} />
				)}
				<VoteProgress proposal={p} heading="Progress toward approval" title="Current result" mode="needed" />
			</div>
			{p.canVote && (
				<div className="md:hidden">
					<ConfirmVoteButton
						label="Confirm recovery vote"
						disabled={!vote.choice}
						submitting={vote.submitting}
						onClick={vote.submit}
					/>
				</div>
			)}
		</div>
	);
}

/**
 * Approved, but not carried out yet: execution runs as the threshold is reached, so landing here
 * means it failed (a network error) — any member can retry until the execution window closes.
 */
function AwaitingExecution({ proposal: p, groupId, firstName }: { proposal: ProposalDto; groupId: string; firstName: First }) {
	const execute = useExecute(groupId, p.id);
	const now = useNow();
	// The scanner expires it at `executeBy`; until it does, don't offer a retry that can't run.
	const windowOpen = !p.executeBy || now === 0 || new Date(p.executeBy).getTime() > now;
	return (
		<div className="space-y-4">
			<Hero tone="yellow" Icon={HiArrowPath} title="Approved — waiting to be carried out">
				&ldquo;{proposalTitle(p, firstName)}&rdquo; reached its threshold, but carrying it out on Stellar hasn&apos;t completed.
				Any member can retry
				{p.executeBy ? ` until ${dateTime(p.executeBy)} (${timeLeft(p.executeBy, now)})` : ""}.
			</Hero>
			<div className="grid items-start gap-4 md:grid-cols-2">
				<VoteProgress proposal={p} heading="Voting result" title="Final approval" />
				<div className="space-y-4">
					<Note title="Why retry?">
						If the group changed since the vote (for example it was already resumed), the action no longer applies and can&apos;t
						run.
					</Note>
					<div className="md:flex md:justify-end">
						<PrimaryAction onClick={() => execute.mutate()} disabled={execute.isPending || !windowOpen}>
							{!windowOpen
								? "The window to carry it out has closed"
								: execute.isPending
									? "Carrying it out…"
									: "Carry it out now"}
						</PrimaryAction>
					</div>
				</div>
			</div>
		</div>
	);
}

/** p5 — an executed governance proposal. */
function Result({
	proposal: p,
	groupId,
	groupName,
	firstName,
}: {
	proposal: ProposalDto;
	groupId: string;
	groupName: string;
	firstName: First;
}) {
	const headline = resultHeadline(p, groupName, firstName);
	return (
		<div className="space-y-4">
			<Hero tone="lilac" title={headline.title}>
				{headline.body}
			</Hero>
			<div className="grid items-start gap-4 md:grid-cols-2">
				<div className="space-y-4">
					<InfoList
						rows={[
							{ Icon: HiRectangleStack, label: "Decision", value: actionCaption(p) },
							{ Icon: HiCalendarDays, label: "Effective", value: "Immediately" },
							{ Icon: HiCheckCircle, label: "Executed", value: dateTime(p.executedAt), tone: "green" },
						]}
					/>
					<TxCard hash={p.executionTxHash} state="Confirmed on Stellar Testnet" />
				</div>
				<div className="space-y-4">
					<VoteProgress proposal={p} heading="Voting result" title="Final approval" />
					<div className="md:flex md:justify-end">
						<PrimaryAction href={pageRoutes.dashboardRoutes.PROPOSALS(groupId)}>Back to Proposals</PrimaryAction>
					</div>
				</div>
			</div>
		</div>
	);
}

/** p11 — an executed recovery proposal. */
function RecoveryComplete({
	proposal: p,
	groupId,
	groupName,
	firstName,
}: {
	proposal: ProposalDto;
	groupId: string;
	groupName: string;
	firstName: First;
}) {
	const r = p.recovery;
	const who = r ? firstName(r.default.member) : "The member";
	const extension = r?.action === "grace_extension";
	return (
		<div className="space-y-4">
			<Hero
				tone="green"
				title={extension ? `${who} has more time` : r ? `Round ${r.default.round + 1} can pay out` : "The cycle has resumed"}
			>
				{r ? RECOVERY_ACTIONS[r.action].outcome(who) : "The approved action was carried out."}
			</Hero>
			<div className="grid items-start gap-4 md:grid-cols-2">
				<div className="space-y-4">
					<InfoList
						rows={[
							{ Icon: HiCheckCircle, label: "Approved action", value: r ? RECOVERY_ACTIONS[r.action].label(who) : "Recovery" },
							...(extension && r?.graceUntil ? [{ Icon: HiClock, label: "New deadline", value: dateTime(r.graceUntil) }] : []),
							{
								Icon: HiPlayCircle,
								label: "Group",
								value: extension ? "Waiting for payment" : "Saving again",
								tone: "green" as const,
							},
							{ Icon: HiCheckCircle, label: "Execution", value: `Completed ${shortDate(p.executedAt)}`, tone: "green" as const },
						]}
					/>
					<div className="max-md:hidden">
						<PrimaryAction href={pageRoutes.dashboardRoutes.CIRCLE(groupId)}>Return to {groupName}</PrimaryAction>
					</div>
				</div>
				<div className="space-y-4">
					<VoteProgress proposal={p} heading="Resolution result" title="Final vote" />
					<TxCard hash={p.executionTxHash} state="Confirmed on Stellar Testnet" />
				</div>
			</div>
			<div className="md:hidden">
				<PrimaryAction href={pageRoutes.dashboardRoutes.CIRCLE(groupId)}>Return to {groupName}</PrimaryAction>
			</div>
		</div>
	);
}

/** Rejected or expired: the threshold wasn't reached (or it was never carried out), so nothing changed. */
function NotApproved({ proposal: p, groupId, firstName }: { proposal: ProposalDto; groupId: string; firstName: First }) {
	const expiredAfterApproval = p.status === "expired" && p.yes >= p.required;
	return (
		<div className="space-y-4">
			<Hero
				tone="pink"
				Icon={HiExclamationTriangle}
				title={p.status === "rejected" ? "Proposal not approved" : "Proposal expired"}
			>
				&ldquo;{proposalTitle(p, firstName)}&rdquo;{" "}
				{expiredAfterApproval
					? "was approved but not carried out before its execution window closed."
					: p.status === "rejected"
						? `can no longer reach ${p.required} For votes.`
						: `didn't reach ${p.required} For votes before voting closed.`}{" "}
				Nothing changed.
			</Hero>
			<div className="grid items-start gap-4 md:grid-cols-2">
				<InfoList
					rows={[
						{ Icon: HiRectangleStack, label: "Decision", value: actionCaption(p) },
						{ Icon: HiCalendarDays, label: "Voting closed", value: dateTime(p.votingEndsAt) },
					]}
				/>
				<div className="space-y-4">
					<VoteProgress proposal={p} heading="Voting result" title="Final tally" />
					<div className="md:flex md:justify-end">
						<PrimaryAction href={pageRoutes.dashboardRoutes.PROPOSALS(groupId)}>Back to Proposals</PrimaryAction>
					</div>
				</div>
			</div>
		</div>
	);
}
