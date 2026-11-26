"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "@repo/ui/sonner";
import { errorMessage } from "@/features/auth/hooks";
import {
	cancelSlotListing,
	createSlotListing,
	getMySlot,
	getSlotListing,
	getTakeover,
	listSlotListings,
	listSlotTransfers,
	listTakeovers,
	requestTakeover,
	signTakeover,
	voteOnTakeover,
	withdrawTakeover,
} from "@/features/slots/api";
import { isWalletDismissal, signMessage, walletErrorMessage, walletFor } from "@/features/wallet/kit";
import { ApiError } from "@/lib/api/client";
import type { CreateSlotListingDto, SlotTakeoverDto } from "@/lib/api/dto";

/** Slot state moves on its own (members vote, requests expire): polled like the cycle. */
const POLL = 20_000;

export function useSlotListings(mine = false) {
	return useQuery({
		queryKey: ["slots", "listings", mine],
		queryFn: () => listSlotListings({ mine, limit: 50 }),
		refetchInterval: POLL,
	});
}

export function useSlotListing(id: string) {
	return useQuery({ queryKey: ["slots", "listing", id], queryFn: () => getSlotListing(id), refetchInterval: POLL });
}

/** The caller's slot in a group; `null` when they have none left to collect (404). */
export function useMySlot(groupId: string, enabled = true) {
	return useQuery({
		queryKey: ["slots", "mine", groupId],
		queryFn: async () => {
			try {
				return await getMySlot(groupId);
			} catch (error) {
				if (error instanceof ApiError && error.status === 404) return null;
				throw error;
			}
		},
		enabled,
		refetchInterval: POLL,
	});
}

export function useMyTakeovers() {
	return useQuery({
		queryKey: ["slots", "takeovers", "mine"],
		queryFn: () => listTakeovers({ mine: true, limit: 50 }),
		refetchInterval: POLL,
	});
}

export function useTakeover(id: string) {
	return useQuery({ queryKey: ["slots", "takeover", id], queryFn: () => getTakeover(id), refetchInterval: POLL });
}

export function useSlotTransfers(groupId: string, enabled = true) {
	return useQuery({
		queryKey: ["slots", "transfers", groupId],
		queryFn: () => listSlotTransfers(groupId, { limit: 50 }),
		enabled,
		refetchInterval: POLL,
	});
}

/** A slot change touches the group too (members, schedule, cycle). */
function invalidate(queryClient: ReturnType<typeof useQueryClient>, groupId?: string) {
	void queryClient.invalidateQueries({ queryKey: ["slots"] });
	void queryClient.invalidateQueries({ queryKey: ["notifications"] });
	if (groupId) {
		for (const key of [["cycle", groupId], ["group", groupId], ["groups"], ["history", groupId]])
			void queryClient.invalidateQueries({ queryKey: key });
	}
}

export function useCreateSlotListing(groupId: string) {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (input: CreateSlotListingDto) => createSlotListing(groupId, input),
		onSuccess: () => {
			invalidate(queryClient, groupId);
			toast.success("Slot listed", { description: "Eligible people can now request it. The group decides together." });
		},
		onError: (error) => toast.error("Could not list your slot", { description: errorMessage(error) }),
	});
}

export function useCancelSlotListing() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: cancelSlotListing,
		onSuccess: (listing) => {
			invalidate(queryClient, listing.group.id);
			toast.success("Listing cancelled", { description: "Your slot stays yours." });
		},
		onError: (error) => toast.error("Could not cancel", { description: errorMessage(error) }),
	});
}

export function useRequestTakeover() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: requestTakeover,
		onSuccess: () => {
			invalidate(queryClient);
			toast.success("Takeover requested", { description: "The group reviews it. You'll sign the transfer once it's approved." });
		},
		onError: (error) => toast.error("Could not request the slot", { description: errorMessage(error) }),
	});
}

export function useVoteOnTakeover(id: string) {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (choice: "yes" | "no") => voteOnTakeover(id, choice),
		onSuccess: (t, choice) => {
			queryClient.setQueryData(["slots", "takeover", id], t);
			invalidate(queryClient, t.group.id);
			toast.success(choice === "yes" ? "You approved the takeover" : "You rejected the request", {
				description:
					t.status === "approved" ? "It reached the threshold. The incoming member signs next." : "Your vote is recorded.",
			});
		},
		onError: (error) => toast.error("Could not record your vote", { description: errorMessage(error) }),
	});
}

/** What the incoming member's wallet signs (the backend will define the real Soroban request). */
const transferMessage = (t: SlotTakeoverDto) =>
	`Saji: take over slot #${t.slotNumber} in "${t.group.name}" (${t.id}) from ${t.from.userId} to ${t.toWallet}.`;

/** The incoming member signs the Soroban transfer with the wallet they requested with. */
export function useSignTakeover() {
	const queryClient = useQueryClient();
	const [phase, setPhase] = useState<"idle" | "wallet" | "submitting">("idle");
	const mutation = useMutation({
		mutationFn: async (t: SlotTakeoverDto) => {
			try {
				setPhase("wallet");
				const address = await walletFor(t.toWallet);
				const signature = await signMessage(transferMessage(t), address);
				setPhase("submitting");
				return await signTakeover(t.id, signature);
			} finally {
				setPhase("idle");
			}
		},
		onSuccess: (t) => {
			invalidate(queryClient, t.group.id);
			toast.success("Slot transferred", { description: `You now hold slot #${t.slotNumber} in ${t.group.name}.` });
		},
		onError: (error) => {
			if (isWalletDismissal(error)) toast.info("Cancelled", { description: "Nothing was signed." });
			else toast.error("Could not complete the transfer", { description: walletErrorMessage(error, errorMessage(error)) });
		},
	});
	return { ...mutation, phase };
}

export function useWithdrawTakeover() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: withdrawTakeover,
		onSuccess: (t) => {
			invalidate(queryClient, t.group.id);
			toast.success("Request withdrawn");
		},
		onError: (error) => toast.error("Could not withdraw", { description: errorMessage(error) }),
	});
}
