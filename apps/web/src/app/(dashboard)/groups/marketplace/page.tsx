"use client";

import { useDeferredValue, useState } from "react";
import { useSearchParams } from "next/navigation";
import { cn } from "@repo/ui/lib/utils";
import { Pager } from "@repo/ui/pager";
import { QueryState } from "@repo/ui/query-state";
import { Card, TwoColumns } from "@/components/Cards";
import { LinkButton } from "@/components/LinkButton";
import { PageHeader } from "@/components/PageHeader";
import { HOW_TAKEOVER_WORKS } from "@/features/slots/copy";
import { ListingCard } from "@/features/slots/components/SlotUi";
import { useMarketplace, useMyListings } from "@/features/slots/hooks";
import type { ListingDto } from "@/lib/api/dto";
import { pageRoutes } from "@/lib/routes";

/** Asking-price bands, sent as `minPrice` / `maxPrice` (inclusive; the server filters across all pages). */
const PRICES = [
	{ value: "all", label: "Any asking price" },
	{ value: "free", label: "Free", maxPrice: "0" },
	{ value: "small", label: "Up to 50 USDC", maxPrice: "50" },
	{ value: "mid", label: "50 – 200 USDC", minPrice: "50", maxPrice: "200" },
	{ value: "large", label: "Over 200 USDC", minPrice: "200" },
] as const;

type Price = (typeof PRICES)[number]["value"];

const field =
	"h-10.75 w-full rounded-[900px] border border-neutral-light-hover bg-white px-6 text-base outline-none focus:border-primary md:h-12";

const r = pageRoutes.dashboardRoutes;

/**
 * Savings slot marketplace (v3 screen 03): open listings across public groups, searched and
 * filtered by the API. `?mine=1`: "My listings & requests" — slots you sell and slots you asked
 * for, were chosen for or bought, in any status (`GET /slots/listings/mine`).
 */
export default function MarketplacePage() {
	const mine = useSearchParams().get("mine") === "1";
	return (
		<div className="w-full space-y-6 pb-10">
			<PageHeader
				title={mine ? "My listings & requests" : "Savings slot marketplace"}
				subtitle={mine ? "Slots you've listed and slots you've asked for." : "Take over a position that works for your savings journey."}
				back
				backHref={mine ? r.MARKETPLACE : r.GROUPS}
			/>
			<TwoColumns
				main={mine ? <MyListings /> : <Browse />}
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
							<p>One slot per person per group. Past contributions and payouts keep the name of whoever made them.</p>
						</Card>
						<LinkButton href={mine ? r.MARKETPLACE : r.MY_LISTINGS} variant="soft" className="w-full text-sm lg:text-base">
							{mine ? "All listings" : "My listings & requests"}
						</LinkButton>
					</>
				}
			/>
		</div>
	);
}

function Browse() {
	const [query, setQuery] = useState("");
	const [price, setPrice] = useState<Price>("all");
	const [page, setPage] = useState(1);
	const search = useDeferredValue(query.trim().slice(0, 60));
	const band = PRICES.find((p) => p.value === price)!;
	const listings = useMarketplace({
		page,
		limit: 10,
		...(search ? { search } : {}),
		...("minPrice" in band ? { minPrice: band.minPrice } : {}),
		...("maxPrice" in band ? { maxPrice: band.maxPrice } : {}),
	});
	const rows = listings.data?.results ?? [];

	return (
		<>
			<div className="space-y-4">
				<label className="block space-y-2">
					<span className="text-sm font-light">Search slots</span>
					<input
						value={query}
						maxLength={60}
						onChange={(e) => {
							setQuery(e.target.value);
							setPage(1);
						}}
						placeholder="Search by group name"
						className={field}
					/>
				</label>
				<label className="block space-y-2">
					<span className="text-sm font-light">Asking price</span>
					<select
						value={price}
						onChange={(e) => {
							setPrice(e.target.value as Price);
							setPage(1);
						}}
						className={field}
					>
						{PRICES.map((p) => (
							<option key={p.value} value={p.value}>
								{p.label}
							</option>
						))}
					</select>
				</label>
			</div>
			<QueryState isLoading={listings.isLoading} error={listings.error} onRetry={() => void listings.refetch()} />
			{listings.data && rows.length === 0 && (
				<Card>
					<p>{search || price !== "all" ? "No slots match. Try another search or price." : "No slots are listed right now. Check back soon."}</p>
				</Card>
			)}
			{rows.map((l, i) => (
				<ListingCard key={l.id} listing={l} index={i} href={r.SLOT_LISTING(l.id)} />
			))}
			{rows.length > 0 && <Pager meta={listings.data?.paginationMeta} onPageChange={setPage} className="flex justify-center" />}
		</>
	);
}

/** Two tabs: what you sell, what you asked for. */
function MyListings() {
	const mine = useMyListings();
	const [tab, setTab] = useState<"selling" | "buying">("selling");
	const rows: ListingDto[] = mine.data?.[tab] ?? [];
	const tabs = [
		{ value: "selling", label: "Selling", count: mine.data?.selling.length },
		{ value: "buying", label: "Requests", count: mine.data?.buying.length },
	] as const;

	return (
		<>
			<div className="flex gap-2" role="tablist">
				{tabs.map((t) => (
					<button
						key={t.value}
						type="button"
						role="tab"
						aria-selected={tab === t.value}
						onClick={() => setTab(t.value)}
						className={cn(
							"rounded-full px-5 py-2 text-sm transition",
							tab === t.value ? "bg-primary text-white" : "bg-neutral-comment text-neutral-dark hover:bg-primary-light",
						)}
					>
						{t.label}
						{t.count ? ` · ${t.count}` : ""}
					</button>
				))}
			</div>
			<QueryState isLoading={mine.isLoading} error={mine.error} onRetry={() => void mine.refetch()} />
			{mine.data && rows.length === 0 && (
				<Card>
					<p>
						{tab === "selling"
							? "You haven't listed a slot. Open one of your running groups and choose “List your slot”."
							: "You haven't asked to take over a slot yet."}
					</p>
				</Card>
			)}
			{rows.map((l, i) => (
				<ListingCard key={l.id} listing={l} index={i} href={r.SLOT_LISTING(l.id)} />
			))}
		</>
	);
}
