"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Button } from "@repo/ui/button";
import { QueryState } from "@repo/ui/query-state";
import { Card, TwoColumns } from "@/components/Cards";
import { LinkButton } from "@/components/LinkButton";
import { PageHeader } from "@/components/PageHeader";
import { useAccount } from "@/features/auth/hooks";
import { personName } from "@/features/slots/copy";
import { ApprovalCard, ChecksCard, ListingPill, ScheduleCard, TakeoverPill } from "@/features/slots/components/SlotUi";
import {
	useCancelSlotListing,
	useRequestTakeover,
	useSignTakeover,
	useSlotListing,
	useWithdrawTakeover,
} from "@/features/slots/hooks";
import type { SlotListingDto, SlotTakeoverDto } from "@/lib/api/dto";
import { formatMoney, frequencyLabel, longDate, shortDate } from "@/lib/format";
import { pageRoutes } from "@/lib/routes";
import { explorerTxUrl } from "@/lib/stellar/config";

const r = pageRoutes.dashboardRoutes;

/**
 * One listed slot. For someone outside the group: Request slot takeover (v3 screen 05) — the
 * obligations, their eligibility, then the request; afterwards, its approval and the signature. For
 * the seller: their listing and where it stands. For a member: a way to the review.
 */
export default function SlotListingPage() {
	const { listingId } = useParams<{ listingId: string }>();
	const listing = useSlotListing(listingId);
	const { data: account } = useAccount();
	const l = listing.data;
	const me = account?.id ?? null;
	const t = l?.takeover ?? null;
	const requester = !!t && t.to.userId === me;

	return (
		<div className="w-full space-y-6 pb-10">
			<PageHeader
				title={l?.mine ? "Your slot listing" : requester ? "Your takeover request" : "Request slot takeover"}
				subtitle={
					l
						? l.mine
							? `Offering your position in ${l.group.name} to an eligible member.`
							: `Review the obligations before joining ${l.group.name}.`
						: undefined
				}
				back
				backHref={l?.mine ? r.MY_LISTINGS : r.MARKETPLACE}
			/>
			<QueryState isLoading={listing.isLoading} error={listing.error} onRetry={() => void listing.refetch()} />
			{l && (
				<TwoColumns
					main={
						<>
							<SlotSummary listing={l} me={me} />
							<ScheduleCard
								title="Remaining contribution schedule"
								terms={l.terms}
								asset={l.group.asset}
								payoutNote="Slot payout"
							/>
						</>
					}
					side={
						l.mine ? (
							<SellerSide listing={l} me={me} />
						) : t && requester ? (
							<RequesterSide takeover={t} />
						) : (
							<RequestSide listing={l} me={me} />
						)
					}
				/>
			)}
		</div>
	);
}

function SlotSummary({ listing: l, me }: { listing: SlotListingDto; me: string | null }) {
	return (
		<section className="rounded-[20px] bg-panel p-5">
			<div className="flex items-start justify-between gap-3">
				<h3 className="min-w-0 text-base md:text-lg">
					{l.group.name} · Slot #{l.slotNumber} of {l.group.totalRounds}
				</h3>
				<ListingPill status={l.status} />
			</div>
			<div className="mt-3 space-y-3 text-xs font-light text-ink-muted md:text-sm">
				<p>
					Listed by {personName(l.seller, me)} · Expires {shortDate(l.expiresAt)}
				</p>
				<p>
					{formatMoney(l.terms.contributionAmount, l.group.asset)}{" "}
					{frequencyLabel(l.terms.frequency, l.terms.customIntervalDays).toLowerCase()} ·{" "}
					{formatMoney(l.terms.remainingAmount, l.group.asset)} remaining
				</p>
				<p>
					Payout · {formatMoney(l.terms.payoutAmount, l.group.asset)} on {longDate(l.terms.payoutAt)}
				</p>
				{l.reason && <p>“{l.reason}”</p>}
			</div>
		</section>
	);
}

/** Someone outside the group, before asking (or when the slot isn't open). */
function RequestSide({ listing: l, me }: { listing: SlotListingDto; me: string | null }) {
	const request = useRequestTakeover();
	const { data: account } = useAccount();
	const [accepted, setAccepted] = useState(false);
	const checks = l.eligibility?.checks ?? [];
	const t = l.takeover;
	// A member of the group sees the request under review (they may be one of the reviewers).
	if (t) {
		return (
			<>
				<Card title="A takeover is under review">
					<p className="flex flex-wrap items-center gap-2">
						{personName(t.from, me)} → {personName(t.to, me)} <TakeoverPill status={t.status} />
					</p>
				</Card>
				<LinkButton href={r.TAKEOVER(l.group.id, t.id)} className="w-full text-sm lg:text-base">
					{t.canVote ? "Review takeover" : "View takeover"}
				</LinkButton>
			</>
		);
	}
	const walletMissing = !!account && !account.wallet;
	return (
		<>
			<ChecksCard title="Your eligibility" checks={checks} />
			{walletMissing && (
				<LinkButton href={r.WALLET} variant="ghost" className="w-full text-sm lg:text-base">
					Connect your wallet
				</LinkButton>
			)}
			<Card tone="lilac" title="What happens next">
				<p>
					{l.approval.required} of {l.approval.eligible} eligible members must approve. You will sign the Soroban transfer once
					approved. The current owner stays responsible until confirmation.
				</p>
			</Card>
			{l.status === "open" ? (
				<>
					<label className="flex items-center gap-3 text-xs md:text-sm">
						<input
							type="checkbox"
							checked={accepted}
							onChange={(e) => setAccepted(e.target.checked)}
							className="size-4 accent-primary"
						/>
						I accept all remaining contributions.
					</label>
					<Button
						className="w-full text-sm lg:text-base"
						disabled={!accepted || !l.eligibility?.canRequest}
						isLoading={request.isPending}
						onClick={() => request.mutate(l.id)}
					>
						Submit takeover request
					</Button>
				</>
			) : (
				<Card>
					<p>This slot isn&apos;t open for requests right now.</p>
				</Card>
			)}
		</>
	);
}

/** The person who asked: approval progress, then the signature, then the result. */
function RequesterSide({ takeover: t }: { takeover: SlotTakeoverDto }) {
	const sign = useSignTakeover();
	const withdraw = useWithdrawTakeover();
	return (
		<>
			<Card title="Your request">
				<p className="flex flex-wrap items-center gap-2">
					Requested {longDate(t.requestedAt)} <TakeoverPill status={t.status} />
				</p>
			</Card>
			{t.status === "voting" && (
				<>
					<ApprovalCard takeover={t} />
					<Card tone="lilac" title="What happens next">
						<p>
							Once {t.required} members approve, you sign the Soroban transfer. The current owner stays responsible until then.
						</p>
					</Card>
				</>
			)}
			{t.status === "approved" && (
				<Card tone="lilac" title="Approved: sign the transfer">
					<p>
						The group approved your takeover. Sign with your wallet by {longDate(t.signBy)} to take over slot #{t.slotNumber}. Its
						contribution and payout records stay with the slot.
					</p>
				</Card>
			)}
			{t.status === "transferred" && (
				<Card tone="lilac" title="The slot is yours">
					<p>
						Transferred on {longDate(t.transferredAt)}. You now contribute{" "}
						{formatMoney(t.terms.contributionAmount, t.group.asset)} each round and collect round {t.slotNumber}.
					</p>
					{t.txHash && (
						<a href={explorerTxUrl(t.txHash)} target="_blank" rel="noopener noreferrer" className="inline-block text-primary">
							View transaction on explorer →
						</a>
					)}
				</Card>
			)}
			{t.canSign && (
				<Button
					className="w-full text-sm lg:text-base"
					onClick={() => sign.mutate(t)}
					isLoading={sign.isPending && sign.phase === "submitting"}
					disabled={sign.isPending}
				>
					{sign.phase === "wallet" ? "Check your wallet…" : "Sign transfer in wallet"}
				</Button>
			)}
			{t.status === "transferred" && (
				<LinkButton href={r.CIRCLE(t.group.id)} className="w-full text-sm lg:text-base">
					Open {t.group.name}
				</LinkButton>
			)}
			{t.canWithdraw && (
				<Button
					variant="soft"
					className="w-full text-sm lg:text-base"
					onClick={() => withdraw.mutate(t.id)}
					isLoading={withdraw.isPending}
				>
					Withdraw request
				</Button>
			)}
		</>
	);
}

/** The slot's owner: where the listing stands. */
function SellerSide({ listing: l, me }: { listing: SlotListingDto; me: string | null }) {
	const cancel = useCancelSlotListing();
	const t = l.takeover;
	return (
		<>
			{!t && l.status === "open" && (
				<Card tone="lilac" title="Waiting for requests">
					<p>
						Eligible people can request your slot until {longDate(l.expiresAt)}. You stay responsible for your contributions until
						a transfer is confirmed.
					</p>
				</Card>
			)}
			{t && (
				<>
					<Card title={`${personName(t.to, me)} asked to take over`}>
						<p className="flex flex-wrap items-center gap-2">
							Requested {longDate(t.requestedAt)} <TakeoverPill status={t.status} />
						</p>
						{t.status === "approved" && <p>Waiting for {personName(t.to, me)} to sign the transfer.</p>}
						{t.status === "transferred" && (
							<p>Transferred on {longDate(t.transferredAt)}. Your contribution history stays with the slot.</p>
						)}
					</Card>
					{t.status === "voting" && <ApprovalCard takeover={t} />}
					<LinkButton
						href={t.status === "transferred" ? r.MARKETPLACE : r.TAKEOVER(l.group.id, t.id)}
						variant="soft"
						className="w-full text-sm lg:text-base"
					>
						{t.status === "transferred" ? "Back to the marketplace" : "View takeover"}
					</LinkButton>
				</>
			)}
			{!t && l.status !== "open" && (
				<Card>
					<p>This listing is {l.status}. Your slot stays yours.</p>
				</Card>
			)}
			{l.status === "open" && (
				<Button
					variant="soft"
					className="w-full text-sm lg:text-base"
					onClick={() => cancel.mutate(l.id)}
					isLoading={cancel.isPending}
				>
					Cancel listing
				</Button>
			)}
			{l.status !== "transferred" && (
				<Link href={r.CIRCLE(l.group.id)} className="block text-center text-xs text-primary md:text-sm">
					Back to {l.group.name}
				</Link>
			)}
		</>
	);
}
