"use client";

import { HiCheckCircle, HiXCircle } from "react-icons/hi2";
import { StatusPill } from "@repo/ui/panel";
import { Card } from "@/components/Cards";
import { LinkButton } from "@/components/LinkButton";
import { checkLabel, contributions, LISTING_STATUS, perPeriod, priceLabel, slotLabel, transferStage } from "@/features/slots/copy";
import type { EligibilityCheckDto, ListingDto } from "@/lib/api/dto";
import { formatMoney } from "@/lib/format";
import { useNow } from "@/lib/use-now";

/** The slot screens' shared pieces (v3 screens 02–07). */

/** Eligibility lines from the API, each marked as holding or not; a failing one says what the API would answer. */
export function ChecksCard({ title, checks }: { title: string; checks: EligibilityCheckDto[] }) {
	return (
		<Card title={title}>
			<ul className="space-y-3">
				{checks.map((c) => (
					<li key={c.key} className="flex items-start gap-2">
						{c.ok ? (
							<HiCheckCircle className="mt-px shrink-0 text-base text-success-500" aria-label="Met" />
						) : (
							<HiXCircle className="mt-px shrink-0 text-base text-accent" aria-label="Not met" />
						)}
						<span className={c.ok ? undefined : "text-accent"}>{checkLabel(c)}</span>
					</li>
				))}
			</ul>
		</Card>
	);
}

/** What the new owner takes over (screens 04 and 05): price, contribution, what's left, the payout. */
export function TermsCard({ title, listing: l }: { title: string; listing: ListingDto }) {
	const asset = l.group.asset;
	return (
		<Card title={title}>
			<p>Asking price · {priceLabel(l.askingPrice, asset)}</p>
			<p>Contribution · {perPeriod(l.group)}</p>
			<p>
				Still to pay · {contributions(l.roundsToPay)} · {formatMoney(l.remainingObligation, asset)}
			</p>
			<p>Payout position · {slotLabel(l.position, l.group.totalRounds)}</p>
			<p>Expected payout · {formatMoney(l.expectedPayout, asset)} (when every member pays)</p>
		</Card>
	);
}

export const ListingPill = ({ status }: { status: ListingDto["status"] }) => (
	<StatusPill tone={LISTING_STATUS[status].tone}>{LISTING_STATUS[status].label}</StatusPill>
);

/** Where the transfer stands, or nothing when there's none. */
export function StagePill({ listing }: { listing: ListingDto }) {
	const stage = transferStage(listing);
	return stage ? <StatusPill tone={stage.tone}>{stage.label}</StatusPill> : null;
}

/** One listing in the marketplace or in "My listings & requests" (v3 screen 03). */
export function ListingCard({ listing: l, href, index = 0 }: { listing: ListingDto; href: string; index?: number }) {
	const asset = l.group.asset;
	return (
		<section className="animate-rise rounded-[20px] bg-panel p-5" style={{ "--i": index } as React.CSSProperties}>
			<div className="flex items-start justify-between gap-3">
				<h3 className="min-w-0 truncate text-base md:text-lg">
					{l.group.name} · {slotLabel(l.position)}
				</h3>
				<span className="flex shrink-0 flex-wrap justify-end gap-1.5">
					{l.status !== "open" ? <ListingPill status={l.status} /> : <StagePill listing={l} />}
				</span>
			</div>
			<p className="mt-3 text-xs font-light text-ink-muted md:text-sm">
				{perPeriod(l.group)} · {contributions(l.roundsToPay)} left · {formatMoney(l.remainingObligation, asset)}
			</p>
			<p className="mt-2 text-xs font-light text-ink-muted md:text-sm">Expected payout · {formatMoney(l.expectedPayout, asset)}</p>
			<p className="mt-2 text-sm md:text-base">Asking price · {priceLabel(l.askingPrice, asset)}</p>
			<LinkButton href={href} variant="ghost" className="mt-4 w-full text-sm lg:text-base">
				{l.mine ? "View your listing" : l.status === "open" && !l.requested && !l.transfer ? "View slot & request takeover" : "View slot"}
			</LinkButton>
		</section>
	);
}

/** "1:42 left" to the approval's end (to the second while it's short; by the hour otherwise). */
export function Countdown({ until }: { until: string }) {
	const now = useNow(1000);
	if (!now) return null;
	const left = Math.max(0, new Date(until).getTime() - now);
	const h = Math.floor(left / 3_600_000);
	const m = Math.floor((left % 3_600_000) / 60_000);
	const s = Math.floor((left % 60_000) / 1000);
	const text = h > 0 ? `${h}h ${m}m left` : `${m}:${String(s).padStart(2, "0")} left`;
	return (
		<span aria-live="off" className={left < 10 * 60_000 ? "text-accent" : undefined}>
			{left === 0 ? "Expired" : text}
		</span>
	);
}
