"use client";

import { useWalletStore } from "@/features/wallet/store";
import { LIVE_WALLET } from "@/lib/api/source";
import type { PaymentInstructionsDto } from "@/lib/api/dto";

/**
 * The wallet surface the screens use. Live: the real wallets through Stellar Wallets Kit
 * (`stellarKit.ts`, loaded on first use). Otherwise the simulated wallet (`mocks/wallet.ts`).
 */

const source = () => (LIVE_WALLET ? import("@/features/wallet/stellarKit") : import("@/mocks/wallet"));

/** Connects a wallet and remembers it in this browser. `linked` = the account's wallet, if any. */
export async function connectWallet(linked?: string | null) {
	let address: string;
	try {
		address = LIVE_WALLET
			? await (await import("@/features/wallet/stellarKit")).connect()
			: await (await import("@/mocks/wallet")).connect(linked);
	} catch (error) {
		if (walletErrorMessage(error, "") === "WRONG_NETWORK") throw new Error("Your wallet is on the wrong network. Switch it to Testnet, then connect again.");
		throw error;
	}
	useWalletStore.getState().setConnected(address);
	return address;
}

/**
 * A wallet that can sign for `linked` right now: the one connected in this browser, or a fresh
 * connection. Refuses a different wallet than the account's, since the API checks payments come
 * from it.
 */
export async function walletFor(linked: string) {
	const current = useWalletStore.getState().address;
	const address = current === linked ? current : await connectWallet(linked);
	if (address !== linked) {
		throw new Error(`This wallet isn't the one linked to your account (${linked.slice(0, 4)}…${linked.slice(-4)}). Switch wallets and try again.`);
	}
	return address;
}

export async function signMessage(message: string, address: string) {
	return (await source()).signMessage(message, address);
}

/** Pays what the API asked for (`CycleDto.payment`) from `address`; resolves with the transaction hash. */
export async function payWithWallet(instructions: PaymentInstructionsDto, address: string) {
	return (await source()).pay(instructions, address);
}

/** Real wallets only (the simulated one always holds USDC): one signature, then Horizon. */
export async function addUsdcTrustline(address: string) {
	if (!LIVE_WALLET) return;
	await (await import("@/features/wallet/stellarKit")).addUsdcTrustline(address);
}

export async function walletUsdc(address: string) {
	return (await source()).usdcBalance(address);
}

export async function disconnectWallet() {
	await (await source()).disconnect();
	useWalletStore.getState().clear();
}

/** Real wallets reject with `{ code, message }` objects, not Errors. */
export function walletErrorMessage(error: unknown, fallback = "The wallet didn’t complete the request.") {
	if (error instanceof Error) return error.message || fallback;
	if (error && typeof error === "object" && "message" in error && typeof error.message === "string") return error.message || fallback;
	return fallback;
}

/** Closing the picker or declining a prompt is a choice, not a failure. */
export function isWalletDismissal(error: unknown) {
	const message = walletErrorMessage(error, "");
	return !message || /declin|reject|cancel|denied|(modal|popup|window) (was )?closed|user closed|closed by (the )?user/i.test(message);
}
