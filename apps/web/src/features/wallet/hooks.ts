"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "@repo/ui/sonner";
import { addDestination, getWallet, linkWallet, listDestinations, removeDestination, setPrimaryDestination, unlinkWallet, walletChallenge } from "@/features/wallet/api";
import { addUsdcTrustline, connectWallet, disconnectWallet, isWalletDismissal, signMessage, walletErrorMessage, walletFor, walletUsdc } from "@/features/wallet/kit";
import { errorMessage } from "@/features/auth/hooks";
import { isReauthCancelled, withIdentity } from "@/features/auth/reauth";
import type { AddDestinationDto } from "@/lib/api/dto";

export function useWallet() {
	return useQuery({ queryKey: ["wallet"], queryFn: getWallet });
}

/** The wallet's own USDC (from Stellar, or the simulated wallet), for "can I afford this". */
export function useWalletUsdc(address: string | null | undefined) {
	return useQuery({ queryKey: ["wallet", "usdc", address], queryFn: () => walletUsdc(address!), enabled: !!address, refetchInterval: 30_000 });
}

/**
 * Linking a wallet to the account: connect it, ask the API for a challenge, sign it (SEP-53), confirm
 * it's you (payouts fall back to this wallet), send the signature. `step` drives the button label.
 */
export function useLinkWallet() {
	const queryClient = useQueryClient();
	const [step, setStep] = useState<"idle" | "connect" | "sign" | "confirm" | "link">("idle");
	const mutation = useMutation({
		mutationFn: async () => {
			try {
				setStep("connect");
				const publicKey = await connectWallet();
				const { message } = await walletChallenge(publicKey);
				setStep("sign");
				const signature = await signMessage(message, publicKey);
				setStep("confirm");
				return await withIdentity("Payouts can go to the wallet you link.", (proof) => {
					setStep("link");
					return linkWallet({ publicKey, signature, ...proof });
				});
			} finally {
				setStep("idle");
			}
		},
		onSuccess: () => {
			void queryClient.invalidateQueries({ queryKey: ["wallet"] });
			void queryClient.invalidateQueries({ queryKey: ["account"] });
			toast.success("Wallet linked", { description: "You can now contribute and receive payouts." });
		},
		onError: (error) => {
			if (isWalletDismissal(error) || isReauthCancelled(error)) toast.info("Linking cancelled");
			else toast.error("Could not link your wallet", { description: walletErrorMessage(error, errorMessage(error)) });
		},
	});
	return { ...mutation, step };
}

export function useAddUsdcTrustline() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: async (address: string) => addUsdcTrustline(await walletFor(address)),
		onSuccess: () => {
			void queryClient.invalidateQueries({ queryKey: ["wallet", "usdc"] });
			toast.success("USDC enabled", { description: "Your wallet can now hold and pay Testnet USDC." });
		},
		onError: (error) => {
			if (isWalletDismissal(error)) toast.info("Cancelled");
			else toast.error("Could not enable USDC", { description: walletErrorMessage(error, errorMessage(error)) });
		},
	});
}

export function useUnlinkWallet() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: async () => {
			await withIdentity("Payouts stop going to this wallet.", unlinkWallet);
			await disconnectWallet();
		},
		onSuccess: () => {
			void queryClient.invalidateQueries({ queryKey: ["wallet"] });
			void queryClient.invalidateQueries({ queryKey: ["account"] });
			toast.success("Wallet disconnected");
		},
		onError: (error) => !isReauthCancelled(error) && toast.error("Could not disconnect", { description: errorMessage(error) }),
	});
}

export function useDestinations() {
	return useQuery({ queryKey: ["destinations"], queryFn: listDestinations });
}

export function useDestinationActions() {
	const queryClient = useQueryClient();
	const set = (list: unknown) => queryClient.setQueryData(["destinations"], list);
	const onError = (error: unknown) => !isReauthCancelled(error) && toast.error("Could not update", { description: errorMessage(error) });
	return {
		add: useMutation({
			mutationFn: (input: Omit<AddDestinationDto, "currentPassword" | "googleIdToken">) =>
				withIdentity("This address can receive your payouts.", (proof) => addDestination({ ...input, ...proof })),
			onSuccess: () => {
				void queryClient.invalidateQueries({ queryKey: ["destinations"] });
				void queryClient.invalidateQueries({ queryKey: ["wallet"] });
				toast.success("Payout address added");
			},
			onError,
		}),
		makePrimary: useMutation({
			mutationFn: (id: string) => withIdentity("Your payouts will go to this address.", (proof) => setPrimaryDestination(id, proof)),
			onSuccess: (list) => {
				set(list);
				void queryClient.invalidateQueries({ queryKey: ["wallet"] });
				toast.success("Payouts will go to this address");
			},
			onError,
		}),
		remove: useMutation({
			mutationFn: removeDestination,
			onSuccess: (list) => {
				set(list);
				void queryClient.invalidateQueries({ queryKey: ["wallet"] });
				toast.success("Address removed");
			},
			onError,
		}),
	};
}

