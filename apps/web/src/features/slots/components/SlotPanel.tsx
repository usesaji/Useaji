"use client";

import { Button } from "@repo/ui/button";
import { Card } from "@/components/Cards";
import { LinkButton } from "@/components/LinkButton";
import { SectionHeader } from "@/components/SectionHeader";
import { contributions, perPeriod } from "@/features/slots/copy";
import { ScheduleCard } from "@/features/slots/components/SlotUi";
import { useMySlot, useSlotTransfers } from "@/features/slots/hooks";
import { formatMoney, longDate } from "@/lib/format";
import { pageRoutes } from "@/lib/routes";

/**
 * A running group's slot section (v3 screen 02): your slot (what you still pay, your payout, list
 * it), your remaining schedule, and the group's slot transfers (requests to review, the history).
 * Hidden when there's nothing to show: no slot left to collect and no transfers.
 */
export function SlotPanel({ groupId, asset }: { groupId: string; asset: string }) {
	const r = pageRoutes.dashboardRoutes;
	const slot = useMySlot(groupId);
	const transfers = useSlotTransfers(groupId);
	const s = slot.data;
	const all = transfers.data?.results ?? [];
	const voting = all.filter((t) => t.status === "voting" || t.status === "approved");
	const toReview = voting.find((t) => t.canVote) ?? voting[0];
	if (!s && all.length === 0) return null;

	return (
		<section className="space-y-4">
			<SectionHeader title={<span className="text-sm md:text-base">Your slot & transfers</span>} />
			<div className="grid items-start gap-5 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
				<div className="min-w-0 space-y-5">
					{s ? (
						<section className="rounded-[20px] bg-panel p-5">
							<h3 className="text-base md:text-lg">
								Your slot · #{s.slotNumber} of {s.totalRounds}
							</h3>
							<div className="mt-3 space-y-3 text-xs font-light text-ink-muted md:text-sm">
								<p>Contribution · {perPeriod(s.terms, asset)}</p>
								<p>
									Payout · {formatMoney(s.terms.payoutAmount, asset)} on {longDate(s.terms.payoutAt)}
								</p>
								<p>
									Remaining · {contributions(s.terms.remainingContributions)} / {formatMoney(s.terms.remainingAmount, asset)}
								</p>
							</div>
							{s.listing ? (
								<LinkButton href={r.SLOT_LISTING(s.listing.id)} variant="ghost" className="mt-4 w-full text-sm lg:text-base">
									{s.listing.status === "pending"
										? "Your slot has a takeover request · View"
										: "Listed in the marketplace · View"}
								</LinkButton>
							) : s.canList ? (
								<LinkButton href={r.LIST_SLOT(groupId)} className="mt-4 w-full text-sm lg:text-base">
									List your slot
								</LinkButton>
							) : (
								<Button disabled className="mt-4 w-full text-sm lg:text-base">
									{s.checks.find((c) => !c.ok)?.label ?? "Can't list right now"}
								</Button>
							)}
						</section>
					) : (
						<Card title="Your slot">
							<p>You&apos;ve collected your payout in this group, so there&apos;s no slot left to list.</p>
						</Card>
					)}
				</div>
				<div className="min-w-0 space-y-5">
					{s && <ScheduleCard title="Remaining schedule" terms={s.terms} asset={asset} payoutNote="Your payout" />}
					<Card tone="lilac" title="Slot transfers">
						{voting.length > 0 ? (
							<>
								<p>
									{voting.length} {voting.length === 1 ? "request" : "requests"} awaiting{" "}
									{toReview?.status === "approved" ? "signature" : "group approval"}
								</p>
								{toReview && toReview.status === "voting" && (
									<p>
										{toReview.required} of {toReview.eligible} eligible members must approve
									</p>
								)}
							</>
						) : (
							<p>No requests open.</p>
						)}
					</Card>
					<div className="grid grid-cols-2 gap-3">
						{toReview ? (
							<LinkButton href={r.TAKEOVER(groupId, toReview.id)} variant="ghost" className="w-full text-sm lg:text-base">
								{toReview.canVote ? "Review takeover" : "View takeover"}
							</LinkButton>
						) : (
							<LinkButton href={r.MARKETPLACE} variant="ghost" className="w-full text-sm lg:text-base">
								Marketplace
							</LinkButton>
						)}
						<LinkButton href={r.SLOT_TRANSFERS(groupId)} variant="soft" className="w-full text-sm lg:text-base">
							Transfer history
						</LinkButton>
					</div>
				</div>
			</div>
		</section>
	);
}
