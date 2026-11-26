"use client";

import { useParams } from "next/navigation";
import { Button } from "@repo/ui/button";
import { QueryState } from "@repo/ui/query-state";
import { Card, TwoColumns } from "@/components/Cards";
import { LinkButton } from "@/components/LinkButton";
import { PageHeader } from "@/components/PageHeader";
import { useAccount } from "@/features/auth/hooks";
import { CLOSED_NOTE, personName, priceLabel, slotLabel } from "@/features/slots/copy";
import { ChecksCard, Countdown, ListingPill, StagePill, TermsCard } from "@/features/slots/components/SlotUi";
import {
	useAcceptSlot,
	useListing,
	useRequestTakeover,
	useSelectBuyer,
	useWithdrawListing,
	useWithdrawTakeoverRequest,
} from "@/features/slots/hooks";
import { TX_PHASE_LABEL } from "@/features/wallet/transactions";
import type { ListingDto } from "@/lib/api/dto";
import { dateTime, formatMoney, longDate } from "@/lib/format";
import { pageRoutes } from "@/lib/routes";
import { shortAddress } from "@/lib/stellar/config";

const r = pageRoutes.dashboardRoutes;

/**
 * One listed slot (v3 screen 05), for whoever is looking:
 * - someone outside the group: the terms, their eligibility (the API's checklist), then the request;
 * - the buyer the seller chose: the group's vote, then Accept within the approval window
 *   (prepare → wallet → accept), then done;
 * - the seller: the requests (put one to a vote), where the vote stands, withdraw;
 * - a member: where the vote stands, and a way to it.
 */
export default function SlotListingPage() {
	const { listingId } = useParams<{ listingId: string }>();
	const listing = useListing(listingId);
	const { data: account } = useAccount();
	const l = listing.data;
	const me = account?.id ?? null;
	const chosen = !!l?.transfer && l.transfer.buyer.userId === me;
	const member = !!l?.transfer && !l.mine && !chosen;

	return (
		<div className="w-full space-y-6 pb-10">
			<PageHeader
				title={l?.mine ? "Your slot listing" : chosen ? "Your slot takeover" : "Request slot takeover"}
				subtitle={
					l
						? l.mine
							? `Offering your position in ${l.group.name}.`
							: `Review what you'd take over before joining ${l.group.name}.`
						: undefined
				}
				back
				backHref={l?.mine || chosen ? r.MY_LISTINGS : r.MARKETPLACE}
			/>
			<QueryState isLoading={listing.isLoading} error={listing.error} onRetry={() => void listing.refetch()} />
			{l && (
				<TwoColumns
					main={
						<>
							<Summary listing={l} me={me} />
							<TermsCard title={l.mine ? "What the buyer takes over" : "What you'd take over"} listing={l} />
						</>
					}
					side={
						l.mine ? (
							<SellerSide listing={l} me={me} />
						) : chosen ? (
							<ChosenBuyerSide listing={l} wallet={account?.wallet?.publicKey ?? null} />
						) : member ? (
							<MemberSide listing={l} me={me} />
						) : (
							<RequestSide listing={l} walletLinked={!!account?.wallet} />
						)
					}
				/>
			)}
		</div>
	);
}

function Summary({ listing: l, me }: { listing: ListingDto; me: string | null }) {
	return (
		<section className="rounded-[20px] bg-panel p-5">
			<div className="flex items-start justify-between gap-3">
				<h3 className="min-w-0 text-base md:text-lg">
					{l.group.name} · {slotLabel(l.position, l.group.totalRounds)}
				</h3>
				<span className="flex shrink-0 flex-wrap justify-end gap-1.5">
					<ListingPill status={l.status} />
					{l.status === "open" && <StagePill listing={l} />}
				</span>
			</div>
			<div className="mt-3 space-y-3 text-xs font-light text-ink-muted md:text-sm">
				<p>
					Listed by {personName(l.seller, me)} on {longDate(l.createdAt)}
				</p>
				<p>
					Round {l.group.currentRound + 1} of {l.group.totalRounds} is open · due {dateTime(l.group.roundDeadline)}
				</p>
			</div>
			<p className="mt-4 text-[28px] leading-none font-medium tracking-tight md:text-[34px]">{priceLabel(l.askingPrice, l.group.asset)}</p>
			<p className="mt-1 text-xs font-light text-ink-muted">Asking price</p>
		</section>
	);
}

/** A closed listing, for anyone. */
function Closed({ listing: l, me }: { listing: ListingDto; me: string | null }) {
	if (l.status === "sold") {
		const toMe = l.transfer?.buyer.userId === me;
		return (
			<>
				<Card title="Transfer completed">
					<p className="animate-pop">
						{toMe ? "The slot is yours." : `${personName(l.transfer?.buyer ?? l.seller, me)} took over this slot.`} The schedule entry moved
						and the earlier contributions stay on record.
					</p>
				</Card>
				{(toMe || l.mine) && (
					<LinkButton href={toMe ? r.CIRCLE(l.group.id) : r.MY_LISTINGS} className="w-full text-sm lg:text-base">
						{toMe ? `Go to ${l.group.name}` : "My listings"}
					</LinkButton>
				)}
			</>
		);
	}
	return (
		<Card title={l.status === "withdrawn" ? "Listing withdrawn" : "Listing closed"}>
			<p>{l.status === "withdrawn" ? "The seller took this slot off the marketplace." : CLOSED_NOTE}</p>
		</Card>
	);
}

/** The transfer under way: buyer, stage, the vote. */
function TransferCard({ listing: l, me }: { listing: ListingDto; me: string | null }) {
	const t = l.transfer!;
	return (
		<Card tone="lilac" title="Transfer to the group's vote">
			<p className="flex flex-wrap items-center gap-2">
				{personName(l.seller, me)} → {personName(t.buyer, me)} <StagePill listing={l} />
			</p>
			{t.approval && t.approval.acceptable && (
				<p>
					The buyer can accept until {dateTime(t.approval.expiresAt)} · <Countdown until={t.approval.expiresAt} />
				</p>
			)}
		</Card>
	);
}

function SellerSide({ listing: l, me }: { listing: ListingDto; me: string | null }) {
	const select = useSelectBuyer(l);
	const withdraw = useWithdrawListing(l.group.id);
	if (l.status !== "open") return <Closed listing={l} me={me} />;
	const t = l.transfer;
	const busy = !!t && (t.proposalStatus === "active" || t.proposalStatus === "approved" || !!t.approval?.acceptable);
	const requests = l.requests ?? [];
	return (
		<>
			{t && <TransferCard listing={l} me={me} />}
			{t && (
				<LinkButton href={r.PROPOSAL(l.group.id, t.proposalId)} variant="ghost" className="w-full text-sm lg:text-base">
					View the vote
				</LinkButton>
			)}
			<Card title={requests.length ? `Requests · ${requests.length}` : "Requests"}>
				{requests.length === 0 ? (
					<p>{t ? "No other requests." : "No one has asked yet. You'll get a notification when someone does."}</p>
				) : (
					<ul className="space-y-3">
						{requests.map((q) => (
							<li key={q.buyer.userId} className="flex flex-wrap items-center justify-between gap-2">
								<span>
									{personName(q.buyer, me)} · asked {longDate(q.requestedAt)}
								</span>
								<Button
									size="sm"
									variant="ghost"
									onClick={() => select.mutate(q.buyer.userId)}
									isLoading={select.isPending && select.variables === q.buyer.userId}
									disabled={busy || select.isPending}
								>
									Put to a vote
								</Button>
							</li>
						))}
					</ul>
				)}
				{busy && requests.length > 0 && <p>You can choose someone else once this vote ends or the approval runs out.</p>}
			</Card>
			<Card title="How it works">
				<p>Choose a buyer and every other member votes. Once they approve, the buyer accepts: they pay you the asking price and take your place.</p>
			</Card>
			<Button
				variant="soft"
				className="w-full text-sm lg:text-base"
				onClick={() => withdraw.mutate()}
				isLoading={withdraw.isPending}
				disabled={withdraw.isPending}
			>
				Withdraw listing
			</Button>
		</>
	);
}

/** The buyer the seller put to the vote: wait for it, then accept within the window. */
function ChosenBuyerSide({ listing: l, wallet }: { listing: ListingDto; wallet: string | null }) {
	const accept = useAcceptSlot(l);
	const t = l.transfer!;
	if (l.status !== "open") return <Closed listing={l} me={t.buyer.userId} />;
	const ready = t.proposalStatus === "executed" && !!t.approval?.acceptable;

	if (!ready) {
		const note =
			t.proposalStatus === "active"
				? "The seller chose you. The group's members are voting now; you'll get a notification when it's decided."
				: t.proposalStatus === "approved"
					? "The group approved. It's being carried out; Accept opens in a moment."
					: t.proposalStatus === "executed"
						? "The approval ran out before you accepted. Ask the seller to put you to a vote again."
						: t.proposalStatus === "rejected"
							? "The group didn't approve this transfer."
							: "The vote ended without a decision.";
		return (
			<>
				<TransferCard listing={l} me={t.buyer.userId} />
				<Card>
					<p>{note}</p>
				</Card>
			</>
		);
	}

	return (
		<>
			<Card tone="lilac" title="Approved · accept the slot">
				<p>
					Accept until {dateTime(t.approval!.expiresAt)} · <Countdown until={t.approval!.expiresAt} />
				</p>
				<p>You pay · {priceLabel(l.askingPrice, l.group.asset)}, to the seller</p>
				<p>From · {wallet ? shortAddress(wallet) : "your linked wallet"}</p>
				<p>Then you join at {slotLabel(l.position)} and pay the rounds left: {formatMoney(l.remainingObligation, l.group.asset)}.</p>
			</Card>
			<Card title="Transaction status">
				<p className={accept.isPending ? "text-primary" : undefined} aria-live="polite">
					{TX_PHASE_LABEL[accept.phase]}
				</p>
				<p>Steps · Prepare → Sign in wallet → Confirm on Stellar</p>
				<p>Saji co-signs it for about 2 minutes, so your wallet opens right away. If it lapses, accept again.</p>
			</Card>
			{wallet ? (
				<Button
					className="w-full text-sm lg:text-base"
					onClick={() => accept.mutate(wallet)}
					isLoading={accept.isPending && accept.phase !== "wallet"}
					disabled={accept.isPending}
				>
					{accept.phase === "wallet" ? "Check your wallet…" : `Accept & pay ${priceLabel(l.askingPrice, l.group.asset)}`}
				</Button>
			) : (
				<LinkButton href={r.WALLET} className="w-full text-sm lg:text-base">
					Link your wallet to accept
				</LinkButton>
			)}
		</>
	);
}

/** A member of the group (they may be one of the voters). */
function MemberSide({ listing: l, me }: { listing: ListingDto; me: string | null }) {
	if (l.status !== "open") return <Closed listing={l} me={me} />;
	return (
		<>
			<TransferCard listing={l} me={me} />
			<LinkButton href={r.PROPOSAL(l.group.id, l.transfer!.proposalId)} className="w-full text-sm lg:text-base">
				{l.transfer!.proposalStatus === "active" ? "Review & vote" : "View the vote"}
			</LinkButton>
		</>
	);
}

/** Someone outside the group: eligibility, then the request. */
function RequestSide({ listing: l, walletLinked }: { listing: ListingDto; walletLinked: boolean }) {
	const request = useRequestTakeover(l);
	const withdraw = useWithdrawTakeoverRequest(l);
	if (l.status !== "open") return <Closed listing={l} me={null} />;
	const e = l.buyerEligibility;
	// Asking again is harmless, so "already asked" doesn't block anything here.
	const blocking = (e?.checks ?? []).filter((c) => !c.ok && c.key !== "notRequested");
	return (
		<>
			{e && <ChecksCard title="Your eligibility" checks={e.checks} />}
			{l.requested ? (
				<>
					<Card title="Request sent">
						<p>The seller chooses who goes to the group&apos;s vote. You&apos;ll get a notification if it&apos;s you.</p>
					</Card>
					<Button
						variant="soft"
						className="w-full text-sm lg:text-base"
						onClick={() => withdraw.mutate()}
						isLoading={withdraw.isPending}
						disabled={withdraw.isPending}
					>
						Withdraw request
					</Button>
				</>
			) : (
				<>
					{!walletLinked && (
						<LinkButton href={r.WALLET} variant="ghost" className="w-full text-sm lg:text-base">
							Link your wallet
						</LinkButton>
					)}
					<Button
						className="w-full text-sm lg:text-base"
						onClick={() => request.mutate()}
						isLoading={request.isPending}
						disabled={request.isPending || blocking.length > 0}
					>
						Request slot takeover
					</Button>
					<p className="text-center text-xs font-light text-ink-muted">
						Nothing is paid now. If you&apos;re approved, you pay {priceLabel(l.askingPrice, l.group.asset)} when you accept.
					</p>
				</>
			)}
		</>
	);
}
