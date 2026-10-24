"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "@repo/ui/sonner";
import { detectDefaults, getCycle, listDefaults, recordContribution, settleDefault, startGroup } from "@/features/circle/api";
import { errorMessage, useAccount } from "@/features/auth/hooks";
import { isWalletDismissal, payWithWallet, walletErrorMessage, walletFor } from "@/features/wallet/kit";
import type { CycleDto, DefaultDto, PaymentInstructionsDto } from "@/lib/api/dto";

/** The group's savings cycle. Polled while open, so payouts, defaults and votes show up on their own. */
export function useCycle(id: string, enabled = true) {
	return useQuery({ queryKey: ["cycle", id], queryFn: () => getCycle(id), enabled, refetchInterval: 20_000 });
}

export function useDefaults(id: string, status?: "open" | "resolved", enabled = true) {
	return useQuery({ queryKey: ["cycle", id, "defaults", status ?? "all"], queryFn: () => listDefaults(id, status), enabled });
}

/** Everything about a group the cycle touches. */
function invalidateGroup(queryClient: ReturnType<typeof useQueryClient>, id: string) {
	for (const key of [["cycle", id], ["group", id], ["groups"], ["proposals", id], ["history", id], ["wallet"], ["activity"], ["notifications"]]) {
		void queryClient.invalidateQueries({ queryKey: key });
	}
}

export function useStartGroup(id: string) {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (schedule?: string[]) => startGroup(id, schedule),
		onSuccess: (cycle) => {
			queryClient.setQueryData(["cycle", id], cycle);
			invalidateGroup(queryClient, id);
			toast.success("The cycle has started", { description: "Round 1 is open for contributions." });
		},
		onError: (error) => toast.error("Could not start the cycle", { description: errorMessage(error) }),
	});
}

type PayPhase = "idle" | "wallet" | "recording";

/**
 * Paying from the linked wallet, in the API's order: the wallet pays exactly what `payment` asks
 * (escrow account, amount, memo), then the API records it with the transaction hash. `phase` says
 * which step is running ("Confirm in your wallet…" / "Recording…").
 */
function usePayFromWallet() {
	const { data: account } = useAccount();
	const [phase, setPhase] = useState<PayPhase>("idle");
	const pay = async (payment: PaymentInstructionsDto, record: (txHash: string) => Promise<unknown>) => {
		const linked = account?.wallet?.publicKey;
		if (!linked) throw new Error("Link a Stellar wallet first (Wallet → Connect Wallet).");
		setPhase("wallet");
		try {
			const address = await walletFor(linked);
			const hash = await payWithWallet(payment, address);
			setPhase("recording");
			return await record(hash);
		} finally {
			setPhase("idle");
		}
	};
	return { pay, phase };
}

function payError(title: string, error: unknown) {
	if (isWalletDismissal(error)) toast.info("Payment cancelled", { description: "Nothing was sent." });
	else toast.error(title, { description: walletErrorMessage(error, errorMessage(error)) });
}

export function useContribute(id: string) {
	const queryClient = useQueryClient();
	const { pay, phase } = usePayFromWallet();
	const mutation = useMutation({
		mutationFn: (cycle: CycleDto) => {
			if (!cycle.myAmountDue) throw new Error("Nothing is due from you right now.");
			// Simulated mode (not on Stellar): no payment to make, the API records it directly.
			if (!cycle.payment) return recordContribution(id);
			return pay(cycle.payment, (hash) => recordContribution(id, hash));
		},
		onSuccess: (cycle) => {
			queryClient.setQueryData(["cycle", id], cycle);
			invalidateGroup(queryClient, id);
			toast.success("Contribution sent", { description: "Your payment is recorded on Stellar." });
		},
		onError: (error) => payError("Could not contribute", error),
	});
	return { ...mutation, phase };
}

/**
 * The member in default pays what they owe (`DefaultDto.payment`: amount, escrow, memo of the missed
 * round); when it was the last open default, recovery ends.
 */
export function useSettleDefault(id: string) {
	const queryClient = useQueryClient();
	const { pay, phase } = usePayFromWallet();
	const mutation = useMutation({
		mutationFn: (d: DefaultDto) =>
			// No payment instructions = simulated mode (not on Stellar): the API records it directly.
			d.payment ? pay(d.payment, (hash) => settleDefault(id, d.id, hash)) : settleDefault(id, d.id),
		onSuccess: () => {
			invalidateGroup(queryClient, id);
			toast.success("Missed contribution paid", { description: "Thank you — the group can carry on." });
		},
		onError: (error) => payError("Could not pay", error),
	});
	return { ...mutation, phase };
}

export function useDetectDefaults(id: string) {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: () => detectDefaults(id),
		onSuccess: ({ recorded }) => {
			invalidateGroup(queryClient, id);
			toast.info(recorded ? `${recorded} missed contribution${recorded === 1 ? "" : "s"} recorded` : "Nothing missed", {
				description: recorded ? "The group is now in recovery." : "Everyone due has paid, or the grace period isn't over.",
			});
		},
		onError: (error) => toast.error("Could not check", { description: errorMessage(error) }),
	});
}
