"use client";

import Link from "next/link";
import { cn } from "@repo/ui/lib/utils";
import { actionCaption, proposalPill, proposalTitle } from "@/features/governance/copy";
import { StatusPill } from "@/features/governance/components/ui";
import type { ProposalDto } from "@/lib/api/dto";
import { dateTime, shortDate } from "@/lib/format";
import { pageRoutes } from "@/lib/routes";

/** A proposal in a list. Open proposals show approval progress; closed ones show how they ended. */
export function ProposalCard({
	proposal: p,
	groupId,
	firstName,
	tone = "grey",
}: {
	proposal: ProposalDto;
	groupId: string;
	firstName: (m: ProposalDto["proposer"]) => string;
	tone?: "grey" | "lilac";
}) {
	const pill = proposalPill(p.status);
	const open = p.status === "active";
	const percent = Math.min(100, Math.round((p.yes / Math.max(p.required, 1)) * 100));

	const meta = open
		? `${actionCaption(p)} · Ends ${dateTime(p.votingEndsAt)}`
		: p.status === "executed"
			? `Executed ${shortDate(p.executedAt)} · Action completed`
			: p.status === "approved"
				? `Approved · Waiting to be carried out`
				: p.status === "rejected"
					? `Closed · Approval not reached`
					: `Expired ${shortDate(p.votingEndsAt)}`;

	return (
		<Link
			href={pageRoutes.dashboardRoutes.PROPOSAL(groupId, p.id)}
			className={cn("block rounded-[14px] px-4 py-4 transition md:px-5", tone === "lilac" ? "bg-primary-light hover:bg-primary-light-hover" : "bg-panel hover:bg-[#f2f2f2]")}
		>
			<div className="flex items-start justify-between gap-3">
				<div className="min-w-0">
					<p className="truncate text-sm md:text-base">{proposalTitle(p, firstName)}</p>
					<p className="mt-0.5 truncate text-[11px] font-light">{meta}</p>
				</div>
				<StatusPill tone={pill.tone}>{pill.label}</StatusPill>
			</div>
			{open && (
				<>
					<div className="mt-5 flex items-center justify-between text-[11px]">
						<span className="flex items-center gap-2 font-light">
							{!p.myVote && p.canVote && (
								<span aria-hidden className="relative flex size-2">
									<span className="animate-ping-soft absolute inset-0 rounded-full bg-primary" />
									<span className="relative size-2 rounded-full bg-primary" />
								</span>
							)}
							{p.myVote ? `You voted ${p.myVote === "yes" ? "For" : "Against"}` : p.canVote ? "Your vote is needed" : "Approval progress"}
						</span>
						<span>
							{p.yes} / {p.required} for
						</span>
					</div>
					<div className="mt-1.5 h-1.5 rounded-full bg-primary-light">
						<div className="animate-grow h-full rounded-full bg-primary" style={{ width: `${percent}%` }} />
					</div>
				</>
			)}
		</Link>
	);
}
