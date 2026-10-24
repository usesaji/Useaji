"use client";

import { useState } from "react";
import { HiHandThumbDown, HiHandThumbUp } from "react-icons/hi2";
import { voteCopy } from "@/features/governance/copy";
import { Note, OptionCard, PrimaryAction } from "@/features/governance/components/ui";
import { useVote } from "@/features/governance/hooks";
import type { ProposalDto } from "@/lib/api/dto";

type First = (m: ProposalDto["proposer"]) => string;

/** For / Against choices for a proposal. Controlled, so pages can place the confirm button. */
export function VoteChoices({ proposal, choice, onChoose, firstName }: { proposal: ProposalDto; choice: "yes" | "no" | null; onChoose: (choice: "yes" | "no") => void; firstName: First }) {
	const copy = voteCopy(proposal, firstName);
	return (
		<div className="space-y-3" role="radiogroup" aria-label="Your vote">
			<OptionCard selected={choice === "yes"} onSelect={() => onChoose("yes")} Icon={HiHandThumbUp} title="Vote For" subtitle={copy.voteFor} />
			<OptionCard selected={choice === "no"} onSelect={() => onChoose("no")} Icon={HiHandThumbDown} title="Vote Against" subtitle={copy.voteAgainst} />
		</div>
	);
}

/** Submits a vote (`POST …/votes`). Votes are final, so the button stays off until a choice is made. */
export function useCastVote(groupId: string, proposalId: string, onVoted?: (p: ProposalDto) => void) {
	const [choice, setChoice] = useState<"yes" | "no" | null>(null);
	const vote = useVote(groupId, proposalId);
	const submit = () => choice && vote.mutate(choice, { onSuccess: (p) => onVoted?.(p) });
	return { choice, setChoice, submitting: vote.isPending, submit };
}

/** Shown instead of the vote form when the viewer can't, or already did, vote. */
export function VoteStatusNote({ proposal }: { proposal: ProposalDto }) {
	if (proposal.myVote) {
		return (
			<Note title={`You voted ${proposal.myVote === "yes" ? "For" : "Against"}`}>Votes are final. You&apos;ll be notified when the outcome is decided.</Note>
		);
	}
	if (!proposal.canVote && proposal.status === "active") {
		return (
			<Note tone="yellow" title="You can't vote on this proposal">
				{proposal.type === "recovery" ? "Members don't vote on the recovery of their own missed contribution." : "Only members of the group when it was proposed can vote."}
			</Note>
		);
	}
	return null;
}

export function ConfirmVoteButton({ label, disabled, submitting, onClick }: { label: string; disabled: boolean; submitting: boolean; onClick: () => void }) {
	return (
		<PrimaryAction onClick={onClick} disabled={disabled || submitting}>
			{submitting ? "Recording…" : label}
		</PrimaryAction>
	);
}
