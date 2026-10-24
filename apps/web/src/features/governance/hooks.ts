"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "@repo/ui/sonner";
import {
	createProposal,
	executeProposal,
	getGovernance,
	getHistory,
	getProposal,
	listProposals,
	setGovernance,
	vote,
	type HistoryQuery,
	type ProposalFilter,
} from "@/features/governance/api";
import { errorMessage } from "@/features/auth/hooks";
import type { CreateProposalDto, GovernanceSettingsDto, ProposalDto } from "@/lib/api/dto";

export function useGovernance(id: string, enabled = true) {
	return useQuery({ queryKey: ["governance", id], queryFn: () => getGovernance(id), enabled });
}

export function useProposals(id: string, query: { status?: ProposalFilter; page?: number; limit?: number } = {}, enabled = true) {
	return useQuery({
		queryKey: ["proposals", id, query],
		queryFn: () => listProposals(id, query),
		enabled,
		placeholderData: keepPreviousData,
		refetchInterval: 20_000,
	});
}

export function useProposal(id: string, proposalId: string) {
	return useQuery({ queryKey: ["proposals", id, "one", proposalId], queryFn: () => getProposal(id, proposalId), refetchInterval: 15_000 });
}

export function useHistory(id: string, query: HistoryQuery = {}) {
	return useQuery({ queryKey: ["history", id, query], queryFn: () => getHistory(id, query), placeholderData: keepPreviousData });
}

/** A vote, a proposal or an execution changes the cycle, the history and the notifications too. */
function invalidate(queryClient: ReturnType<typeof useQueryClient>, id: string) {
	for (const key of [["proposals", id], ["cycle", id], ["history", id], ["group", id], ["notifications"]]) {
		void queryClient.invalidateQueries({ queryKey: key });
	}
}

export function useSetGovernance(id: string) {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (input: GovernanceSettingsDto) => setGovernance(id, input),
		onSuccess: (settings) => {
			queryClient.setQueryData(["governance", id], settings);
			toast.success("Approval rules saved");
		},
		onError: (error) => toast.error("Could not save the rules", { description: errorMessage(error) }),
	});
}

export function useCreateProposal(id: string) {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (input: CreateProposalDto) => createProposal(id, input),
		onSuccess: (proposal) => {
			queryClient.setQueryData(["proposals", id, "one", proposal.id], proposal);
			invalidate(queryClient, id);
			toast.success("Proposal created", { description: "Members can now vote on it." });
		},
		onError: (error) => toast.error("Could not create the proposal", { description: errorMessage(error) }),
	});
}

export function useVote(id: string, proposalId: string) {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (choice: "yes" | "no") => vote(id, proposalId, choice),
		onSuccess: (proposal: ProposalDto, choice) => {
			queryClient.setQueryData(["proposals", id, "one", proposalId], proposal);
			invalidate(queryClient, id);
			toast.success("Vote recorded", {
				description:
					proposal.status === "executed"
						? "Your vote reached the threshold — the decision has been carried out."
						: proposal.status === "approved"
							? "Approved. Carrying it out on Stellar…"
							: proposal.status === "rejected"
								? "The proposal can no longer pass."
								: `You voted ${choice === "yes" ? "For" : "Against"}. We'll tell everyone when voting closes.`,
			});
		},
		onError: (error) => toast.error("Vote failed", { description: errorMessage(error) }),
	});
}

export function useExecute(id: string, proposalId: string) {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: () => executeProposal(id, proposalId),
		onSuccess: (proposal) => {
			queryClient.setQueryData(["proposals", id, "one", proposalId], proposal);
			invalidate(queryClient, id);
			toast.success("Decision carried out", { description: "It's recorded on Stellar." });
		},
		onError: (error) => toast.error("Could not carry it out", { description: errorMessage(error) }),
	});
}
