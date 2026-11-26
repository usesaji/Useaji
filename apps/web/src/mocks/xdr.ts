/**
 * The mock's stand-in for Stellar transactions. A "prepare" route returns `xdr` (what the
 * transaction does, for which wallet, readable by the mock alone); the simulated wallet "signs" it
 * by appending its address; the confirm route reads it back and checks the right wallet signed.
 * Real XDR never passes through here: live, the API builds it and a real wallet signs it.
 */

import type { SavingsLock } from "@/lib/api/dto";

const PREFIX = "mock-xdr:";
const SIGNED = ".signed-by.";

export interface MockTx {
	op: "create_plan" | "deposit" | "withdraw" | "trustline" | "accept_slot";
	/** The wallet that must sign. */
	source: string;
	planId?: string;
	listingId?: string;
	amount?: string;
	/** `create_plan`: the goal it creates (the plan id is reserved for this user). */
	plan?: { userId: string; name: string; target: string; lock: SavingsLock; unlockAt: string | null };
	/** Prepared at (ms): a signed transaction stays valid for 3 minutes, like the API's `setTimeout(180)`. */
	at: number;
}

export const MOCK_TX_TTL = 3 * 60_000;

export const buildXdr = (tx: MockTx) => PREFIX + btoa(JSON.stringify(tx));

export const signXdr = (xdr: string, address: string) => `${xdr}${SIGNED}${address}`;

/** A stable 64-hex "transaction hash" for a signed mock transaction: the same transaction, the same hash. */
export function hashOf(signed: string) {
	let out = "";
	for (let seed = 0; out.length < 64; seed++) {
		let h = 0x811c9dc5 ^ seed;
		for (let i = 0; i < signed.length; i++) h = Math.imul(h ^ signed.charCodeAt(i), 0x01000193);
		out += (h >>> 0).toString(16).padStart(8, "0");
	}
	return out.slice(0, 64);
}

/** The transaction and who signed it, or null when it isn't one the mock prepared and a wallet signed. */
export function readSignedXdr(signed: string): { tx: MockTx; signer: string } | null {
	const [xdr, signer] = signed.split(SIGNED);
	if (!xdr?.startsWith(PREFIX) || !signer) return null;
	try {
		return { tx: JSON.parse(atob(xdr.slice(PREFIX.length))) as MockTx, signer };
	} catch {
		return null;
	}
}
