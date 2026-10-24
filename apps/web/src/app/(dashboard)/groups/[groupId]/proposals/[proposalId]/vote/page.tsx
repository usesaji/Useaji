"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { HiShieldCheck } from "react-icons/hi2";
import { PageHeader } from "@/components/PageHeader";
import { ConfirmVoteButton, VoteChoices, useCastVote } from "@/features/governance/components/CastVote";
import { ACTIONS, actionCaption, proposalTitle } from "@/features/governance/copy";
import { Note, PageState, VoteProgress } from "@/features/governance/components/ui";
import { useProposal } from "@/features/governance/hooks";
import { useMemberNames } from "@/features/groups/use-names";
import { shortDate } from "@/lib/format";
import { pageRoutes } from "@/lib/routes";

/** p4 — Cast Your Vote on a governance proposal. */
export default function VotePage() {
	const { groupId, proposalId } = useParams<{ groupId: string; proposalId: string }>();
	const router = useRouter();
	const { data: p, isLoading, error, refetch } = useProposal(groupId, proposalId);
	const { first } = useMemberNames(groupId);
	const firstName = (m: Parameters<typeof first>[0]) => first(m, { you: false });
	const proposalHref = pageRoutes.dashboardRoutes.PROPOSAL(groupId, proposalId);
	const vote = useCastVote(groupId, proposalId, () => router.push(proposalHref));

	// Nothing to vote on here — closed, already voted, or not eligible: the proposal page is the place.
	const cannotVote = !!p && !p.canVote;
	useEffect(() => {
		if (cannotVote) router.replace(proposalHref);
	}, [cannotVote, proposalHref, router]);

	const effect = p && p.type !== "recovery" ? ACTIONS[p.type].effect : "";

	return (
		<div className="w-full space-y-6 pb-10">
			<PageHeader title="Cast Your Vote" back backHref={proposalHref} />
			<PageState loading={isLoading} error={error} onRetry={() => void refetch()} />
			{p && !cannotVote && (
				<>
					<div className="grid items-start gap-6 md:grid-cols-2">
						<div className="space-y-4">
							<div>
								<p className="text-[11px] tracking-wide text-primary uppercase">{actionCaption(p)}</p>
								<h3 className="mt-1 text-xl md:text-2xl">{proposalTitle(p, firstName)}</h3>
								<p className="text-xs font-light">Choose how you want the group to proceed. Your vote is final once confirmed.</p>
							</div>
							<VoteChoices proposal={p} choice={vote.choice} onChoose={vote.setChoice} firstName={firstName} />
						</div>
						<div className="space-y-4">
							<VoteProgress proposal={p} mode="needed" />
							<Note Icon={HiShieldCheck} title="How approval works">
								At least {p.required} of {p.eligible} members must vote For by {shortDate(p.votingEndsAt)}. When they do, SAJI carries it out on Stellar and
								notifies everyone. {effect}
							</Note>
							<div className="max-md:hidden">
								<ConfirmVoteButton label="Confirm Vote" disabled={!vote.choice} submitting={vote.submitting} onClick={vote.submit} />
							</div>
						</div>
					</div>
					<div className="md:hidden">
						<ConfirmVoteButton label="Confirm vote" disabled={!vote.choice} submitting={vote.submitting} onClick={vote.submit} />
					</div>
				</>
			)}
		</div>
	);
}
