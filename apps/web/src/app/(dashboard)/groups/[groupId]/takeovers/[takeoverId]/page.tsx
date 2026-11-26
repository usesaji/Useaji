"use client";

import { useParams } from "next/navigation";
import { Button } from "@repo/ui/button";
import { QueryState } from "@repo/ui/query-state";
import { Card, TwoColumns } from "@/components/Cards";
import { LinkButton } from "@/components/LinkButton";
import { PageHeader } from "@/components/PageHeader";
import { useAccount } from "@/features/auth/hooks";
import { personName } from "@/features/slots/copy";
import { ApprovalCard, ChecksCard, Handover, TakeoverPill, TermsCard } from "@/features/slots/components/SlotUi";
import { useTakeover, useVoteOnTakeover } from "@/features/slots/hooks";
import { longDate } from "@/lib/format";
import { pageRoutes } from "@/lib/routes";

/**
 * Approve slot takeover (v3 screen 06): a reviewing member sees who takes over which slot, that the
 * incoming member was verified, the group's approval so far, and approves or rejects. Votes are final.
 * Everyone else who can see the request (the two people in it, members who voted) sees where it stands.
 */
export default function TakeoverPage() {
	const { groupId, takeoverId } = useParams<{ groupId: string; takeoverId: string }>();
	const r = pageRoutes.dashboardRoutes;
	const takeover = useTakeover(takeoverId);
	const vote = useVoteOnTakeover(takeoverId);
	const { data: account } = useAccount();
	const me = account?.id ?? null;
	const t = takeover.data;

	return (
		<div className="w-full space-y-6 pb-10">
			<PageHeader
				title={t?.canVote ? "Approve slot takeover" : "Slot takeover"}
				subtitle={
					t?.canVote
						? "You're an eligible group reviewer. Review eligibility and decide together."
						: "A request to take over a slot in this group."
				}
				back
				backHref={r.CIRCLE(groupId)}
			/>
			<QueryState isLoading={takeover.isLoading} error={takeover.error} onRetry={() => void takeover.refetch()} />
			{t && (
				<TwoColumns
					main={
						<>
							<section className="rounded-[20px] bg-panel p-5">
								<div className="flex items-start justify-between gap-3">
									<h3 className="text-base md:text-lg">
										<Handover takeover={t} me={me} />
									</h3>
									<TakeoverPill status={t.status} />
								</div>
								<div className="mt-3 space-y-3 text-xs font-light text-ink-muted md:text-sm">
									<p>
										{t.group.name} · Slot #{t.slotNumber} of {t.group.totalRounds}
									</p>
									<p>
										Requested {longDate(t.requestedAt)}
										{t.status === "voting" ? " · Approval open" : ""}
									</p>
								</div>
							</section>
							<ChecksCard title="Incoming member verified" checks={t.checks} />
							<TermsCard
								title="What the incoming member takes over"
								terms={t.terms}
								slotNumber={t.slotNumber}
								totalRounds={t.group.totalRounds}
								asset={t.group.asset}
							/>
						</>
					}
					side={
						<>
							<ApprovalCard takeover={t} />
							<Card tone="lilac" title="Protected through transfer">
								<p>
									All contribution and payout history stays with the slot. Ownership changes only after approval, signatures and a
									confirmed Soroban transaction.
								</p>
							</Card>
							{t.canVote ? (
								<div className="grid grid-cols-2 gap-3">
									<Button
										className="w-full text-sm lg:text-base"
										onClick={() => vote.mutate("yes")}
										isLoading={vote.isPending && vote.variables === "yes"}
										disabled={vote.isPending}
									>
										Approve takeover
									</Button>
									<Button
										variant="soft"
										className="w-full text-sm lg:text-base"
										onClick={() => vote.mutate("no")}
										isLoading={vote.isPending && vote.variables === "no"}
										disabled={vote.isPending}
									>
										Reject request
									</Button>
								</div>
							) : (
								<Card>
									<p>
										{t.myVote
											? `You voted to ${t.myVote === "yes" ? "approve" : "reject"}. Votes are final.`
											: t.from.userId === me
												? "It's your slot, so the other members decide."
												: t.status === "voting"
													? "You aren't one of the reviewers for this request."
													: "Voting has closed."}
									</p>
									{t.status === "approved" && <p>Waiting for {personName(t.to, me)} to sign the transfer.</p>}
								</Card>
							)}
							{t.status === "transferred" && (
								<LinkButton href={r.SLOT_TRANSFERS(groupId)} variant="soft" className="w-full text-sm lg:text-base">
									View transfer history
								</LinkButton>
							)}
						</>
					}
				/>
			)}
		</div>
	);
}
