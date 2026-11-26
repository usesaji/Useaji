"use client";

import { transactionHash } from "@/features/wallet/kit";
import { ApiError } from "@/lib/api/client";

/**
 * The on-chain steps every money-moving action shares (docs/frontend-integration.md §2):
 * `…/prepare` returns an unsigned transaction for the user's wallet, the wallet signs it, and a
 * confirm call submits it and waits for Stellar.
 */

/** Where a signed action is: drives the "Transaction status" card and the button. */
export type TxPhase = "idle" | "preparing" | "wallet" | "confirming";

export const TX_PHASE_LABEL: Record<TxPhase, string> = {
	idle: "Ready when you are",
	preparing: "Preparing the transaction…",
	wallet: "Awaiting your signature",
	confirming: "Confirming on Stellar…",
};

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Sends the signed transaction to its confirm call. A 503 (Stellar slow, or the transaction isn't
 * on Stellar yet) is retried twice after a few seconds with the transaction's hash, so it's never
 * submitted twice; the API records each transaction once. Not a TanStack retry: those stay off for
 * mutations.
 */
export async function confirmSigned<T>(confirm: (body: { signedXdr: string } | { txHash: string }) => Promise<T>, signedXdr: string): Promise<T> {
	let body: { signedXdr: string } | { txHash: string } = { signedXdr };
	for (let attempt = 0; ; attempt++) {
		try {
			return await confirm(body);
		} catch (error) {
			if (!(error instanceof ApiError && error.status === 503) || attempt >= 2) throw error;
			await wait(4000);
			body = { txHash: await transactionHash(signedXdr) };
		}
	}
}

/** 400 "prepare and sign it again": the signature expired before it landed (a slot accept lasts ~2 minutes). */
export const needsNewSignature = (error: unknown) =>
	error instanceof ApiError && error.status === 400 && /prepare and sign it again|no longer be submitted/i.test(error.message);
