"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "@repo/ui/sonner";
import {
	addDestination,
	getWallet,
	linkWallet,
	listDestinations,
	prepareFaucetTrustline,
	removeDestination,
	requestTestUsdc,
	setPrimaryDestination,
	unlinkWallet,
	walletChallenge,
} from "@/features/wallet/api";
import {
	addUsdcTrustline,
	connectWallet,
	disconnectWallet,
	fundTestnetAccount,
	isWalletDismissal,
	signAndSubmit,
	signMessage,
	walletErrorMessage,
	walletFor,
	walletUsdc,
} from "@/features/wallet/kit";
import { ApiError } from "@/lib/api/client";
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

/**
 * Whether the API's test USDC faucet is on (docs/frontend-integration.md §3). The only way to ask is
 * the trustline prepare call, which changes nothing: 404 = off (production, simulated mode), so the
 * faucet UI hides. Asked once per linked wallet.
 */
export function useFaucetAvailable(linked: string | null | undefined) {
	return useQuery({
		queryKey: ["faucet", "available", linked],
		enabled: !!linked,
		staleTime: Infinity,
		retry: false,
		queryFn: async () => {
			try {
				await prepareFaucetTrustline();
				return true;
			} catch (error) {
				if (error instanceof ApiError && error.status === 404) return false;
				return true; // 409 (already trusts USDC, not on Testnet yet…) means it's on
			}
		},
	});
}

export type FaucetStep = "idle" | "fund" | "trustline" | "usdc";

export const FAUCET_STEP_LABEL: Record<FaucetStep, string> = {
	idle: "Get test USDC",
	fund: "Creating your Testnet account…",
	trustline: "Confirm in your wallet…",
	usdc: "Sending test USDC…",
};

const alreadyTrusts = (error: unknown) => error instanceof ApiError && error.status === 409 && /already trusts/i.test(error.message);

/**
 * Wallet setup on Testnet, in one go: create the account with test XLM if it isn't on Testnet
 * (Friendbot), add Saji's test USDC to it (the API prepares the transaction; the wallet signs and
 * submits it), then ask the faucet for test USDC. Each step is skipped when it's already done.
 */
export function useGetTestUsdc() {
	const queryClient = useQueryClient();
	const [step, setStep] = useState<FaucetStep>("idle");
	const mutation = useMutation({
		mutationFn: async (linked: string) => {
			try {
				const balance = await walletUsdc(linked);
				if (!balance.funded) {
					setStep("fund");
					await fundTestnetAccount(linked);
				}
				if (!balance.trustline) {
					setStep("trustline");
					try {
						const { xdr } = await prepareFaucetTrustline();
						await signAndSubmit(xdr, await walletFor(linked));
					} catch (error) {
						if (!alreadyTrusts(error)) throw error;
					}
				}
				setStep("usdc");
				return await requestTestUsdc();
			} finally {
				setStep("idle");
			}
		},
		onSuccess: (sent) => {
			void queryClient.invalidateQueries({ queryKey: ["wallet", "usdc"] });
			toast.success("Test USDC sent", { description: `${Number(sent.amount).toLocaleString()} test USDC is on its way to your wallet.` });
		},
		onError: (error) => {
			if (isWalletDismissal(error)) toast.info("Cancelled", { description: "Your wallet wasn't changed." });
			else toast.error("Could not get test USDC", { description: walletErrorMessage(error, errorMessage(error)) });
		},
	});
	return { ...mutation, step };
}

/** Creates the wallet's account on Testnet with test XLM, when the faucet is off. */
export function useFundTestnetAccount() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (address: string) => fundTestnetAccount(address),
		onSuccess: () => {
			void queryClient.invalidateQueries({ queryKey: ["wallet", "usdc"] });
			toast.success("Account created on Testnet", { description: "Your wallet now holds test XLM for network fees." });
		},
		onError: (error) => toast.error("Could not fund the wallet", { description: walletErrorMessage(error, errorMessage(error)) }),
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

