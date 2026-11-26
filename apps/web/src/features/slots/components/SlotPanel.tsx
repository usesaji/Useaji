"use client";

import { Button } from "@repo/ui/button";
import { Card } from "@/components/Cards";
import { LinkButton } from "@/components/LinkButton";
import { SectionHeader } from "@/components/SectionHeader";
import { useCycle } from "@/features/circle/hooks";
import { useProposals } from "@/features/governance/hooks";
import { checkLabel, contributions, priceLabel, slotLabel } from "@/features/slots/copy";
import { StagePill } from "@/features/slots/components/SlotUi";
import { useMyListings, useSellerEligibility, useSlotTransfers } from "@/features/slots/hooks";
import { pageRoutes } from "@/lib/routes";

/**
 * A running group's slot section (v3 screen 02): your slot and whether you can list it (the API's
 * checklist), your open listing and its requests, the group's open slot-transfer votes, and the
 * transfer history. Hidden when there's nothing to show.
 */
export function SlotPanel({ groupId, asset }: { groupId: string; asset: string }) {
	const r = pageRoutes.dashboardRoutes;
	const eligibility = useSellerEligibility(groupId);
	const mine = useMyListings();
	const cycle = useCycle(groupId);
	const votes = useProposals(groupId, { status: "active", limit: 20 });
	const transfers = useSlotTransfers(groupId);
	const e = eligibility.data;
	const c = cycle.data;
	const listing = mine.data?.selling.find((l) => l.group.id === groupId && l.status === "open");
	const transferVotes = (votes.data?.results ?? []).filter((p) => p.type === "slot_transfer" && p.slotTransfer);
	const history = transfers.data ?? [];
	const position = e?.position ?? null;
	if (position === null && transferVotes.length === 0 && history.length === 0) return null;
	const blocker = e?.checks.find((x) => !x.ok);
	const total = c?.schedule.length;

	return (
		<section className="space-y-4">
			<SectionHeader title={<span className="text-sm md:text-base">Your slot & transfers</span>} />
			<div className="grid items-start gap-5 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
				<div className="min-w-0 space-y-5">
					{position !== null ? (
						<section className="rounded-[20px] bg-panel p-5">
							<div className="flex items-start justify-between gap-3">
								<h3 className="text-base md:text-lg">Your slot · {slotLabel(position, total)}</h3>
								{listing && <StagePill listing={listing} />}
							</div>
							<div className="mt-3 space-y-3 text-xs font-light text-ink-muted md:text-sm">
								{c && <p>You collect the payout in round {position + 1}.</p>}
								{c && <p>Still to pay · {contributions(Math.max(0, c.schedule.length - (c.round ?? 0)))} (this round included)</p>}
								{listing && (
									<p>
										Listed for {priceLabel(listing.askingPrice, asset)}
										{listing.requests?.length
											? ` · ${listing.requests.length} ${listing.requests.length === 1 ? "request" : "requests"} waiting for you`
											: ""}
									</p>
								)}
							</div>
							{listing ? (
								<LinkButton href={r.SLOT_LISTING(listing.id)} variant="ghost" className="mt-4 w-full text-sm lg:text-base">
									{listing.requests?.length ? "Choose a buyer" : "View your listing"}
								</LinkButton>
							) : e?.eligible ? (
								<LinkButton href={r.LIST_SLOT(groupId)} className="mt-4 w-full text-sm lg:text-base">
									List your slot
								</LinkButton>
							) : (
								<Button disabled className="mt-4 w-full text-sm lg:text-base">
									{blocker ? checkLabel(blocker) : "Checking whether you can list…"}
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
					<Card tone="lilac" title="Slot transfers">
						{transferVotes.length > 0 ? (
							transferVotes.map((p) => (
								<p key={p.id}>
									Vote open · {slotLabel(p.slotTransfer!.position)} from {p.slotTransfer!.seller.firstName ?? "a member"} to{" "}
									{p.slotTransfer!.buyer.firstName ?? "a buyer"} for {priceLabel(p.slotTransfer!.price, asset)}
								</p>
							))
						) : (
							<p>No transfer votes open.</p>
						)}
						<p>
							{history.length} {history.length === 1 ? "transfer" : "transfers"} in this group so far.
						</p>
					</Card>
					<div className="grid grid-cols-2 gap-3">
						{transferVotes[0] ? (
							<LinkButton href={r.PROPOSAL(groupId, transferVotes[0].id)} variant="ghost" className="w-full text-sm lg:text-base">
								{transferVotes[0].canVote ? "Review & vote" : "View the vote"}
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
