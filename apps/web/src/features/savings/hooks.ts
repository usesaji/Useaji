"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "@repo/ui/sonner";
import { errorMessage } from "@/features/auth/hooks";
import {
	confirmDeposit,
	confirmSavingsPlan,
	confirmWithdrawal,
	createSavingsPlan,
	getSavingsOverview,
	getSavingsPlan,
	listSavingsPlans,
	prepareDeposit,
	prepareWithdrawal,
} from "@/features/savings/api";
import { isWalletDismissal, signTransaction, walletErrorMessage, walletFor } from "@/features/wallet/kit";
import { confirmSigned, needsNewSignature, type TxPhase } from "@/features/wallet/transactions";
import type { CreatePlanDto, MovementDto, PlanDto } from "@/lib/api/dto";

export function useSavingsOverview() {
	return useQuery({ queryKey: ["savings", "overview"], queryFn: getSavingsOverview });
}

export function useSavingsPlans() {
	return useQuery({ queryKey: ["savings", "plans"], queryFn: listSavingsPlans });
}

/** Polled, so a date lock opens on its day without a reload (the contract keeps the balance). */
export function useSavingsPlan(id: string) {
	return useQuery({ queryKey: ["savings", "plan", id], queryFn: () => getSavingsPlan(id), refetchInterval: 60_000 });
}

const invalidateSavings = (queryClient: ReturnType<typeof useQueryClient>) => {
	void queryClient.invalidateQueries({ queryKey: ["savings"] });
	void queryClient.invalidateQueries({ queryKey: ["wallet", "usdc"] });
	void queryClient.invalidateQueries({ queryKey: ["activity"] });
};

function moveError(title: string, error: unknown) {
	if (isWalletDismissal(error)) toast.info("Cancelled", { description: "Nothing was signed or sent." });
	else if (needsNewSignature(error)) toast.error(title, { description: "The signature expired before it reached Stellar. Try again to sign a fresh one." });
	else toast.error(title, { description: walletErrorMessage(error, errorMessage(error)) });
}

/**
 * Create a goal. Stellar: the API returns a transaction that creates it for the linked wallet; the
 * wallet signs; confirm. Simulated: the plan comes back created.
 */
export function useCreateSavingsPlan(ownerAddress: string | null | undefined) {
	const queryClient = useQueryClient();
	const [phase, setPhase] = useState<TxPhase>("idle");
	const mutation = useMutation({
		mutationFn: async (input: CreatePlanDto) => {
			try {
				setPhase("preparing");
				const prepared = await createSavingsPlan(input);
				if (!prepared.xdr) {
					if (!prepared.plan) throw new Error("The goal wasn't created. Try again.");
					return prepared.plan;
				}
				if (!ownerAddress) throw new Error("Link a wallet first: it will own this goal.");
				setPhase("wallet");
				const signedXdr = await signTransaction(prepared.xdr, await walletFor(ownerAddress));
				setPhase("confirming");
				return await confirmSigned((body) => confirmSavingsPlan(prepared.planId, body), signedXdr);
			} finally {
				setPhase("idle");
			}
		},
		onSuccess: (plan) => {
			invalidateSavings(queryClient);
			toast.success("Savings goal created", { description: `${plan.name} is ready for your first deposit.` });
		},
		onError: (error) => moveError("Could not create the goal", error),
	});
	return { ...mutation, phase };
}

/** What a deposit or withdrawal leaves behind: the plan as it is now, and the movement it made. */
export interface MoveResult {
	plan: PlanDto;
	movement: MovementDto | null;
}

function useMove(plan: PlanDto | undefined, kind: "deposit" | "withdrawal") {
	const queryClient = useQueryClient();
	const [phase, setPhase] = useState<TxPhase>("idle");
	const [prepare, confirm] = kind === "deposit" ? [prepareDeposit, confirmDeposit] : [prepareWithdrawal, confirmWithdrawal];
	const mutation = useMutation({
		mutationFn: async (amount: string): Promise<MoveResult> => {
			if (!plan) throw new Error("The plan hasn't loaded yet.");
			try {
				if (!plan.ownerAddress) {
					// Simulated mode: no chain, nothing to sign.
					setPhase("confirming");
					await confirm(plan.id, { amount });
				} else {
					// Sign with the plan's owner wallet: the API built the transaction for it.
					const address = await walletFor(plan.ownerAddress);
					setPhase("preparing");
					const { xdr } = await prepare(plan.id, { amount });
					setPhase("wallet");
					const signedXdr = await signTransaction(xdr, address);
					setPhase("confirming");
					await confirmSigned((body) => confirm(plan.id, body), signedXdr);
				}
				// The balance comes from the contract: read the plan back rather than computing it.
				const fresh = await getSavingsPlan(plan.id);
				queryClient.setQueryData(["savings", "plan", plan.id], fresh);
				const movement = fresh.movements?.find((m) => m.kind === kind) ?? null;
				return { plan: fresh, movement };
			} finally {
				setPhase("idle");
			}
		},
		onSuccess: () => {
			invalidateSavings(queryClient);
			if (kind === "deposit") toast.success("Deposit confirmed", { description: "Your savings balance is updated." });
			else toast.success("Withdrawal confirmed", { description: "The funds are back in your owner wallet." });
		},
		onError: (error) => moveError(kind === "deposit" ? "Could not deposit" : "Could not withdraw", error),
	});
	return { ...mutation, phase };
}

/** Deposit from the owner wallet into the plan: prepare → the wallet signs → the API submits. */
export const useDeposit = (plan: PlanDto | undefined) => useMove(plan, "deposit");

/** Withdraw to the owner wallet (never anywhere else). Refused while the plan's lock holds. */
export const useWithdraw = (plan: PlanDto | undefined) => useMove(plan, "withdrawal");
