"use client";

import { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { QueryState } from "@repo/ui/query-state";
import { Card, TwoColumns } from "@/components/Cards";
import { LinkButton } from "@/components/LinkButton";
import { PageHeader } from "@/components/PageHeader";
import { HOW_TAKEOVER_WORKS } from "@/features/slots/copy";
import { ListingCard, TakeoverPill } from "@/features/slots/components/SlotUi";
import { useMyTakeovers, useSlotListings } from "@/features/slots/hooks";
import { longDate } from "@/lib/format";
import { pageRoutes } from "@/lib/routes";

const AMOUNTS = [
	{ value: "all", label: "All amounts", test: () => true },
	{ value: "small", label: "Up to 50 USDC", test: (n: number) => n <= 50 },
	{ value: "mid", label: "50 – 200 USDC", test: (n: number) => n > 50 && n <= 200 },
	{ value: "large", label: "Over 200 USDC", test: (n: number) => n > 200 },
] as const;

const field =
	"h-10.75 w-full rounded-[900px] border border-neutral-light-hover bg-white px-6 text-base outline-none focus:border-primary md:h-12";

/**
 * Savings slot marketplace (v3 screen 03): slots members have listed for takeover, across groups.
 * `?mine=1`: the caller's own listings and the requests they've made.
 */
export default function MarketplacePage() {
	const mine = useSearchParams().get("mine") === "1";
	const r = pageRoutes.dashboardRoutes;
	const listings = useSlotListings(mine);
	const requests = useMyTakeovers();
	const [query, setQuery] = useState("");
	const [amount, setAmount] = useState<(typeof AMOUNTS)[number]["value"]>("all");

	const test = AMOUNTS.find((a) => a.value === amount)!.test;
	const rows = (listings.data?.results ?? []).filter(
		(l) => l.group.name.toLowerCase().includes(query.trim().toLowerCase()) && test(Number(l.terms.contributionAmount)),
	);
	const myRequests = requests.data?.results ?? [];

	return (
		<div className="w-full space-y-6 pb-10">
			<PageHeader
				title={mine ? "My listings & requests" : "Savings slot marketplace"}
				subtitle={
					mine ? "Slots you've listed and slots you've asked for." : "Take over a position that works for your savings journey."
				}
				back
				backHref={mine ? r.MARKETPLACE : r.GROUPS}
			/>
			<TwoColumns
				main={
					<>
						{!mine && (
							<div className="space-y-4">
								<label className="block space-y-2">
									<span className="text-sm font-light">Search slots</span>
									<input
										value={query}
										onChange={(e) => setQuery(e.target.value)}
										placeholder="Search by group name"
										className={field}
									/>
								</label>
								<label className="block space-y-2">
									<span className="text-sm font-light">Contribution amount</span>
									<select value={amount} onChange={(e) => setAmount(e.target.value as typeof amount)} className={field}>
										{AMOUNTS.map((a) => (
											<option key={a.value} value={a.value}>
												{a.label}
											</option>
										))}
									</select>
								</label>
							</div>
						)}
						{mine && <h3 className="text-base md:text-lg">Your listings</h3>}
						<QueryState isLoading={listings.isLoading} error={listings.error} onRetry={() => void listings.refetch()} />
						{listings.data && rows.length === 0 && (
							<Card>
								<p>
									{mine
										? "You haven't listed a slot. Open one of your running groups and choose “List your slot”."
										: query || amount !== "all"
											? "No slots match. Try another search or amount."
											: "No slots are listed right now. Check back soon."}
								</p>
							</Card>
						)}
						{rows.map((l, i) => (
							<ListingCard key={l.id} listing={l} index={i} href={r.SLOT_LISTING(l.id)} />
						))}

						{mine && (
							<>
								<h3 className="pt-2 text-base md:text-lg">Your takeover requests</h3>
								{requests.data && myRequests.length === 0 && (
									<Card>
										<p>You haven&apos;t asked to take over a slot yet.</p>
									</Card>
								)}
								{myRequests.map((t) => (
									<Link
										key={t.id}
										href={r.SLOT_LISTING(t.listingId)}
										className="block rounded-[20px] bg-panel p-5 transition hover:bg-neutral-comment"
									>
										<div className="flex items-start justify-between gap-3">
											<p className="min-w-0 truncate text-base md:text-lg">
												{t.group.name} · Slot #{t.slotNumber}
											</p>
											<TakeoverPill status={t.status} />
										</div>
										<p className="mt-2 text-xs font-light text-ink-muted md:text-sm">Requested {longDate(t.requestedAt)}</p>
									</Link>
								))}
							</>
						)}
					</>
				}
				side={
					<>
						<Card tone="lilac" title="How takeover works">
							<ol className="space-y-3">
								{HOW_TAKEOVER_WORKS.map((step, i) => (
									<li key={step}>
										{i + 1}. {step}
									</li>
								))}
							</ol>
						</Card>
						<Card title="Ownership stays protected">
							<p>One owner per slot. Contribution and payout records remain unchanged.</p>
						</Card>
						<LinkButton href={mine ? r.MARKETPLACE : r.MY_LISTINGS} variant="soft" className="w-full text-sm lg:text-base">
							{mine ? "All listings" : "My listings"}
						</LinkButton>
					</>
				}
			/>
		</div>
	);
}
