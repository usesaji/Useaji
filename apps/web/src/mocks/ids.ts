/** Ids and hashes that look like the real ones (UUIDs, 64-hex Stellar hashes, G… accounts). */

export const uuid = () => crypto.randomUUID();

function hex(bytes: number) {
	const values = crypto.getRandomValues(new Uint8Array(bytes));
	return Array.from(values, (b) => b.toString(16).padStart(2, "0")).join("");
}

/** A Stellar transaction hash. */
export const txHash = () => hex(32);

/** The 32-hex invite code at the end of an invite link. */
export const inviteCode = () => hex(16);

/** A sha256-looking anchor hash (the memo of an event's anchor transaction). */
export const anchorHash = () => hex(32);

/** A signup token (20–100 chars on the API). */
export const signupToken = () => hex(24);

const BASE32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

/** A plausible Stellar account id (G + 55 base32 chars). Not checksummed: the mock never verifies it. */
export function stellarAccount() {
	const values = crypto.getRandomValues(new Uint8Array(55));
	return "G" + Array.from(values, (b) => BASE32[b % 32]).join("");
}

/** A Soroban contract id (C + 55 base32 chars), not checksummed. */
export function contractId() {
	const values = crypto.getRandomValues(new Uint8Array(55));
	return "C" + Array.from(values, (b) => BASE32[b % 32]).join("");
}

export const explorerTx = (hash: string) => `https://stellar.expert/explorer/testnet/tx/${hash}`;
