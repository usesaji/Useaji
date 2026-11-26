import { readDb, updateDb } from "@/mocks/db";
import { stellarAccount, txHash } from "@/mocks/ids";
import { payFromWallet } from "@/mocks/handlers/wallet";
import { money, num } from "@/mocks/engine";
import { hashOf, signXdr } from "@/mocks/xdr";
import type { PaymentInstructionsDto } from "@/lib/api/dto";

/**
 * The simulated wallet (NEXT_PUBLIC_WALLET_SOURCE unset): no extension, ~1 s per step, 500 test USDC
 * per address, kept in the mock DB. When the account already has a linked wallet, "connecting"
 * picks that one, as if the person opened the wallet they linked.
 */

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function connect(preferred?: string | null) {
	await wait(900);
	const address = preferred ?? stellarAccount();
	updateDb((db) => {
		db.walletBalances[address] ??= "500.00";
	});
	return address;
}

export async function signMessage(message: string, address: string) {
	await wait(900);
	return btoa(`mock-sep53:${address}:${message.length}`);
}

export async function pay(instructions: PaymentInstructionsDto, address: string) {
	await wait(1200);
	updateDb((db) => payFromWallet(db, address, num(instructions.amount)));
	return txHash();
}

/** "Signs" a transaction the mock API prepared: the mock confirm checks who signed (`mocks/xdr.ts`). */
export async function signTransaction(xdr: string, address: string) {
	await wait(1000);
	return signXdr(xdr, address);
}

export async function signAndSubmit(xdr: string, address: string) {
	await signTransaction(xdr, address);
	return txHash();
}

export async function transactionHash(signedXdr: string) {
	return hashOf(signedXdr);
}

/** The simulated wallet keeps one balance and shows it for both test USDCs (group and savings). */
export async function usdcBalance(address: string) {
	const usdc = money(num(readDb().walletBalances[address] ?? "0"));
	return { funded: true, group: { usdc, trustline: true }, savings: { usdc, trustline: true } };
}

export async function disconnect() {}
