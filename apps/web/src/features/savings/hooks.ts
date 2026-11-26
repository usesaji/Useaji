"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "@repo/ui/sonner";
import { errorMessage } from "@/features/auth/hooks";
import {
	createSavingsPlan,
	getSavingsPlan,
	getSavingsSummary,
	listSavingsPlans,
	listSavingsTransactions,
	recordDeposit,
	withdrawSavings,
} from "@/features/savings/api";
import { isWalletDismissal, payWithWallet, signMessage, walletErrorMessage, walletFor } from "@/features/wallet/kit";
import type { CreateSavingsPlanDto, SavingsPlanDto } from "@/lib/api/dto";

export function useSavingsSummary() {
	return useQuery({ queryKey: ["savings", "summary"], queryFn: getSavingsSummary });
}

export function useSavingsPlans() {
	return useQuery({ queryKey: ["savings", "plans"], queryFn: () => listSavingsPlans({ limit: 50 }) });
}

/** Polled, so a locked plan opens on its release date without a reload. */
export function useSavingsPlan(id: string) {
	return useQuery({ queryKey: ["savings", "plan", id], queryFn: () => getSavingsPlan(id), refetchInterval: 60_000 });
}

export function useSavingsTransactions(id: string, limit = 10) {
	return useQuery({
		queryKey: ["savings", "plan", id, "transactions", limit],
		queryFn: () => listSavingsTransactions(id, { limit }),
	});
}

const invalidateSavings = (queryClient: ReturnType<typeof useQueryClient>) => {
	void queryClient.invalidateQueries({ queryKey: ["savings"] });
	void queryClient.invalidateQueries({ queryKey: ["wallet", "usdc"] });
};

export function useCreateSavingsPlan() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (input: CreateSavingsPlanDto) => createSavingsPlan(input),
		onSuccess: (plan) => {
			invalidateSavings(queryClient);
			toast.success("Savings goal created", { description: `${plan.name} is ready for your first deposit.` });
		},
		onError: (error) => toast.error("Could not create the goal", { description: errorMessage(error) }),
	});
}

/** Which step a deposit or withdrawal is on: drives the "Transaction status" card and the button. */
export type MovePhase = "idle" | "wallet" | "submitting";

function moveError(title: string, error: unknown) {
	if (isWalletDismissal(error)) toast.info("Cancelled", { description: "Nothing was sent." });
	else toast.error(title, { description: walletErrorMessage(error, errorMessage(error)) });
}

/**
 * Depositing from the owner wallet: the wallet pays `amount` to the plan's contract (`plan.deposit`:
 * destination, asset, memo), then the API records it with the hash. No `deposit` = simulated: the
 * API records it directly.
 */
export function useDeposit(plan: SavingsPlanDto | undefined) {
	const queryClient = useQueryClient();
	const [phase, setPhase] = useState<MovePhase>("idle");
	const mutation = useMutation({
		mutationFn: async (amount: string) => {
			if (!plan) throw new Error("The plan hasn't loaded yet.");
			try {
				if (!plan.deposit) {
					setPhase("submitting");
					return await recordDeposit(plan.id, { amount });
				}
				setPhase("wallet");
				const address = await walletFor(plan.ownerWallet);
				const txHash = await payWithWallet({ ...plan.deposit, amount }, address);
				setPhase("submitting");
				return await recordDeposit(plan.id, { amount, txHash });
			} finally {
				setPhase("idle");
			}
		},
		onSuccess: () => {
			invalidateSavings(queryClient);
			toast.success("Deposit confirmed", { description: "Your savings balance is updated." });
		},
		onError: (error) => moveError("Could not deposit", error),
	});
	return { ...mutation, phase };
}

/** What the owner wallet signs to authorize a withdrawal (the backend will define the real request). */
const withdrawalMessage = (plan: SavingsPlanDto, amount: string) =>
	`Saji: withdraw ${amount} ${plan.asset} from "${plan.name}" (${plan.id}) to ${plan.ownerWallet}.`;

/**
 * Withdrawing to the owner wallet: the owner wallet signs, the contract checks ownership and the
 * plan's rules, then releases the funds to that wallet (never anywhere else).
 */
export function useWithdraw(plan: SavingsPlanDto | undefined) {
	const queryClient = useQueryClient();
	const [phase, setPhase] = useState<MovePhase>("idle");
	const mutation = useMutation({
		mutationFn: async (amount: string) => {
			if (!plan) throw new Error("The plan hasn't loaded yet.");
			try {
				setPhase("wallet");
				const address = await walletFor(plan.ownerWallet);
				const signature = await signMessage(withdrawalMessage(plan, amount), address);
				setPhase("submitting");
				return await withdrawSavings(plan.id, { amount, signature });
			} finally {
				setPhase("idle");
			}
		},
		onSuccess: () => {
			invalidateSavings(queryClient);
			toast.success("Withdrawal sent", { description: "The funds are on their way to your wallet." });
		},
		onError: (error) => moveError("Could not withdraw", error),
	});
	return { ...mutation, phase };
}
