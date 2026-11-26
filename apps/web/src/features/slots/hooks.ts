"use client";

import { useState } from "react";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "@repo/ui/sonner";
import { errorMessage } from "@/features/auth/hooks";
import {
	acceptListing,
	createListing,
	getListing,
	getMyListings,
	getSellerEligibility,
	listMarketplace,
	listSlotTransfers,
	prepareAccept,
	requestTakeover,
	selectBuyer,
	withdrawListing,
	withdrawTakeoverRequest,
	type MarketplaceQuery,
} from "@/features/slots/api";
import { isWalletDismissal, signTransaction, walletErrorMessage, walletFor } from "@/features/wallet/kit";
import { confirmSigned, needsNewSignature, type TxPhase } from "@/features/wallet/transactions";
import { ApiError } from "@/lib/api/client";
import type { ListingDto } from "@/lib/api/dto";

/** Slot data moves while you look (requests arrive, votes land, approvals expire): it's polled. */
const POLL = 15_000;

export function useMarketplace(query: MarketplaceQuery) {
	return useQuery({
		queryKey: ["slots", "marketplace", query],
		queryFn: () => listMarketplace(query),
		placeholderData: keepPreviousData,
		refetchInterval: POLL,
	});
}

export function useMyListings() {
	return useQuery({ queryKey: ["slots", "mine"], queryFn: getMyListings, refetchInterval: POLL });
}

export function useListing(id: string) {
	return useQuery({ queryKey: ["slots", "listing", id], queryFn: () => getListing(id), refetchInterval: 10_000 });
}

/** The caller's slot in a group and whether they can list it. A 404 (not a member) isn't retried. */
export function useSellerEligibility(groupId: string, enabled = true) {
	return useQuery({
		queryKey: ["slots", "eligibility", groupId],
		queryFn: () => getSellerEligibility(groupId),
		enabled,
		retry: false,
		refetchInterval: POLL,
	});
}

export function useSlotTransfers(groupId: string, enabled = true) {
	return useQuery({ queryKey: ["slots", "transfers", groupId], queryFn: () => listSlotTransfers(groupId), enabled, retry: false });
}

/** After anything that changes a listing: slots, and what a transfer touches (the group, its votes, wallets, activity). */
function useInvalidate() {
	const queryClient = useQueryClient();
	return (groupId?: string) => {
		void queryClient.invalidateQueries({ queryKey: ["slots"] });
		void queryClient.invalidateQueries({ queryKey: ["notifications"] });
		void queryClient.invalidateQueries({ queryKey: ["wallet", "usdc"] });
		void queryClient.invalidateQueries({ queryKey: ["activity"] });
		void queryClient.invalidateQueries({ queryKey: ["groups"] });
		if (groupId) {
			void queryClient.invalidateQueries({ queryKey: ["cycle", groupId] });
			void queryClient.invalidateQueries({ queryKey: ["proposals", groupId] });
			void queryClient.invalidateQueries({ queryKey: ["group", groupId] });
		}
	};
}

const fail = (title: string) => (error: unknown) => toast.error(title, { description: errorMessage(error) });

export function useCreateListing(groupId: string) {
	const invalidate = useInvalidate();
	return useMutation({
		mutationFn: (askingPrice: string) => createListing(groupId, { askingPrice }),
		onSuccess: () => {
			invalidate(groupId);
			toast.success("Slot listed", { description: "It's in the marketplace. You'll hear when someone asks for it." });
		},
		onError: fail("Could not list your slot"),
	});
}

export function useWithdrawListing(groupId: string) {
	const invalidate = useInvalidate();
	return useMutation({
		mutationFn: () => withdrawListing(groupId),
		onSuccess: () => {
			invalidate(groupId);
			toast.success("Listing withdrawn", { description: "Your slot stays yours." });
		},
		onError: fail("Could not withdraw the listing"),
	});
}

export function useRequestTakeover(listing: ListingDto | undefined) {
	const invalidate = useInvalidate();
	return useMutation({
		mutationFn: () => requestTakeover(listing!.id),
		onSuccess: () => {
			invalidate();
			toast.success("Request sent", { description: "The seller chooses who goes to the group's vote." });
		},
		onError: fail("Could not send your request"),
	});
}

export function useWithdrawTakeoverRequest(listing: ListingDto | undefined) {
	const invalidate = useInvalidate();
	return useMutation({
		mutationFn: () => withdrawTakeoverRequest(listing!.id),
		onSuccess: () => {
			invalidate();
			toast.success("Request withdrawn");
		},
		onError: fail("Could not withdraw your request"),
	});
}

/** The seller puts one buyer to the group's vote. */
export function useSelectBuyer(listing: ListingDto | undefined) {
	const invalidate = useInvalidate();
	return useMutation({
		mutationFn: (buyerId: string) => selectBuyer(listing!.id, buyerId),
		onSuccess: () => {
			invalidate(listing?.group.id);
			toast.success("Put to a vote", { description: "Every other member votes. The buyer can accept once it passes." });
		},
		onError: fail("Could not open the vote"),
	});
}

/**
 * The approved buyer takes the slot: prepare (Saji co-signs; it lasts ~2 minutes, so the wallet
 * opens right away) → the wallet signs → accept (waits for Stellar; a 503 is retried by hash). In
 * the API's simulated mode prepare answers 409 and accept takes `{}`.
 */
export function useAcceptSlot(listing: ListingDto | undefined) {
	const invalidate = useInvalidate();
	const [phase, setPhase] = useState<TxPhase>("idle");
	const mutation = useMutation({
		mutationFn: async (buyerWallet: string) => {
			if (!listing) throw new Error("The listing hasn't loaded yet.");
			try {
				// Connect the wallet first, so the 2-minute co-signature isn't spent on it.
				const address = await walletFor(buyerWallet);
				setPhase("preparing");
				let xdr: string;
				try {
					xdr = (await prepareAccept(listing.id)).xdr;
				} catch (error) {
					if (error instanceof ApiError && error.status === 409 && /simulated/i.test(error.message)) {
						setPhase("confirming");
						return await acceptListing(listing.id, {});
					}
					throw error;
				}
				setPhase("wallet");
				const signedXdr = await signTransaction(xdr, address);
				setPhase("confirming");
				return await confirmSigned((body) => acceptListing(listing.id, body), signedXdr);
			} finally {
				setPhase("idle");
			}
		},
		onSuccess: () => {
			invalidate(listing?.group.id);
			toast.success("Slot transferred", { description: `You're now a member of ${listing?.group.name}.` });
		},
		onError: (error) => {
			if (isWalletDismissal(error)) toast.info("Cancelled", { description: "Nothing was signed or paid." });
			else if (needsNewSignature(error))
				toast.error("The signature expired", { description: "Saji's co-signature lasts about 2 minutes. Accept again to sign a fresh one." });
			else toast.error("Could not take the slot", { description: walletErrorMessage(error, errorMessage(error)) });
		},
	});
	return { ...mutation, phase };
}
