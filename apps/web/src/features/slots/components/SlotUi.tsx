"use client";

import { HiCheckCircle, HiXCircle } from "react-icons/hi2";
import { StatusPill } from "@repo/ui/panel";
import { Card, ProgressBar } from "@/components/Cards";
import { LinkButton } from "@/components/LinkButton";
import { contributionsLeft, LISTING_STATUS, perPeriod, personName, TAKEOVER_STATUS } from "@/features/slots/copy";
import type { SlotCheckDto, SlotListingDto, SlotTakeoverDto, SlotTermsDto } from "@/lib/api/dto";
import { formatMoney, longDate, shortDate } from "@/lib/format";

/** The slot screens' shared pieces (v3 screens 02–07). */

/** Eligibility lines, each marked as holding or not. */
export function ChecksCard({ title, checks }: { title: string; checks: SlotCheckDto[] }) {
	return (
		<Card title={title}>
			<ul className="space-y-3">
				{checks.map((c) => (
					<li key={c.label} className="flex items-start gap-2">
						{c.ok ? (
							<HiCheckCircle className="mt-px shrink-0 text-base text-success-500" aria-label="Met" />
						) : (
							<HiXCircle className="mt-px shrink-0 text-base text-accent" aria-label="Not met" />
						)}
						<span className={c.ok ? undefined : "text-accent"}>{c.label}</span>
					</li>
				))}
			</ul>
		</Card>
	);
}

/** "Oct 24, 2025 · 250.00 USDC due · Your payout" — the rounds still to pay. */
export function ScheduleCard({
	title,
	terms,
	asset = "USDC",
	payoutNote = "Payout",
}: {
	title: string;
	terms: SlotTermsDto;
	asset?: string;
	payoutNote?: string;
}) {
	return (
		<Card title={title}>
			{terms.schedule.length === 0 ? (
				<p>Nothing left to pay.</p>
			) : (
				terms.schedule.map((d) => (
					<p key={d.round}>
						{longDate(d.dueAt)} · {formatMoney(d.amount, asset)} due{d.payout ? ` · ${payoutNote}` : ""}
					</p>
				))
			)}
		</Card>
	);
}

/** What the new owner takes over (v3 screen 04, right). */
export function TermsCard({
	title,
	terms,
	slotNumber,
	totalRounds,
	asset = "USDC",
}: {
	title: string;
	terms: SlotTermsDto;
	slotNumber: number;
	totalRounds: number;
	asset?: string;
}) {
	return (
		<Card title={title}>
			<p>Contribution · {perPeriod(terms, asset)}</p>
			<p>Remaining obligations · {formatMoney(terms.remainingAmount, asset)}</p>
			<p>
				Payout position · #{slotNumber} of {totalRounds}
			</p>
			<p>
				Expected payout · {formatMoney(terms.payoutAmount, asset)} on {shortDate(terms.payoutAt)}
			</p>
			{terms.lastContributionAt && <p>Last contribution · {longDate(terms.lastContributionAt)}</p>}
		</Card>
	);
}

/** Group approval: "3 of 4 required approvals", who may review and until when, the tally. */
export function ApprovalCard({ takeover: t }: { takeover: SlotTakeoverDto }) {
	const notVoted = Math.max(0, t.eligible - t.yes - t.no);
	return (
		<Card title="Group approval">
			<p>
				{t.yes} of {t.required} required approvals
			</p>
			<p>
				{t.eligible} {t.eligible === 1 ? "member" : "members"} eligible to review
				{t.status === "voting" ? ` · Ends ${shortDate(t.votingEndsAt)}` : ""}
			</p>
			<p className="pb-1">
				{t.yes} approve · {t.no} reject · {notVoted} {notVoted === 1 ? "has" : "have"} not voted
			</p>
			<ProgressBar percent={(t.yes / Math.max(t.required, 1)) * 100} label="Approvals toward the threshold" />
		</Card>
	);
}

export const TakeoverPill = ({ status }: { status: SlotTakeoverDto["status"] }) => (
	<StatusPill tone={TAKEOVER_STATUS[status].tone}>{TAKEOVER_STATUS[status].label}</StatusPill>
);

export const ListingPill = ({ status }: { status: SlotListingDto["status"] }) => (
	<StatusPill tone={LISTING_STATUS[status].tone}>{LISTING_STATUS[status].label}</StatusPill>
);

/** One listing in the marketplace (v3 screen 03). */
export function ListingCard({ listing: l, href, index = 0 }: { listing: SlotListingDto; href: string; index?: number }) {
	return (
		<section className="animate-rise rounded-[20px] bg-panel p-5" style={{ "--i": index } as React.CSSProperties}>
			<div className="flex items-start justify-between gap-3">
				<h3 className="min-w-0 truncate text-base md:text-lg">
					{l.group.name} · Slot #{l.slotNumber}
				</h3>
				{(l.mine || l.status !== "open") && <ListingPill status={l.status} />}
			</div>
			<p className="mt-3 text-xs font-light text-ink-muted md:text-sm">
				{perPeriod(l.terms, l.group.asset)} · {contributionsLeft(l.terms.remainingContributions)}
			</p>
			<p className="mt-2 text-xs font-light text-ink-muted md:text-sm">
				Expected payout · {formatMoney(l.terms.payoutAmount, l.group.asset)} · {longDate(l.terms.payoutAt)}
			</p>
			<LinkButton href={href} variant="ghost" className="mt-4 w-full text-sm lg:text-base">
				{l.mine ? "View your listing" : l.status === "open" ? "View slot & request takeover" : "View slot"}
			</LinkButton>
		</section>
	);
}

/** "Amara → Dean" */
export const Handover = ({ takeover: t, me }: { takeover: SlotTakeoverDto; me?: string | null }) => (
	<>
		{personName(t.from, me)} → {personName(t.to, me)}
	</>
);
