"use client";

import type { StellarWalletsKit as Kit } from "@creit.tech/stellar-wallets-kit/sdk";
import type { ModuleInterface } from "@creit.tech/stellar-wallets-kit/types";
import type { PaymentInstructionsDto } from "@/lib/api/dto";
import { FRIENDBOT_URL, GROUP_USDC_ISSUER, HORIZON_URL, NETWORK_PASSPHRASE, USDC_ISSUERS, type UsdcKind } from "@/lib/stellar/config";

/**
 * The real wallets, through Stellar Wallets Kit: Freighter, xBull, Albedo, LOBSTR, Hana (browser)
 * and, with a WalletConnect project, the Freighter / LOBSTR phone apps. Loaded on first use (it's
 * large and touches the DOM). Saji never sees a key: wallets sign, Horizon submits.
 */

const WALLETCONNECT_PROJECT_ID = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ?? "";

let kitPromise: Promise<typeof Kit> | null = null;

function loadKit(): Promise<typeof Kit> {
	kitPromise ??= (async () => {
		const [{ StellarWalletsKit }, { defaultModules }, { Networks }] = await Promise.all([
			import("@creit.tech/stellar-wallets-kit/sdk"),
			import("@creit.tech/stellar-wallets-kit/modules/utils"),
			import("@creit.tech/stellar-wallets-kit/types"),
		]);
		const modules: ModuleInterface[] = [...defaultModules()];
		if (WALLETCONNECT_PROJECT_ID) {
			// Phones have no extensions: WalletConnect deep-links into the wallet apps.
			const { WalletConnectModule, WalletConnectTargetChain } = await import("@creit.tech/stellar-wallets-kit/modules/wallet-connect");
			modules.push(
				new WalletConnectModule({
					projectId: WALLETCONNECT_PROJECT_ID,
					metadata: {
						name: "Saji",
						description: "Community savings on Stellar",
						url: window.location.origin,
						icons: [`${window.location.origin}${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/images/link-preview.png`],
					},
					allowedChains: [WalletConnectTargetChain.TESTNET],
				}),
			);
		}
		StellarWalletsKit.init({ modules, network: Networks.TESTNET });
		return StellarWalletsKit;
	})();
	return kitPromise;
}

/** Opens the kit's wallet picker and connects; resolves with the public address. */
export async function connect() {
	const kit = await loadKit();
	const { address } = await kit.authModal();
	const { networkPassphrase } = await kit.getNetwork().catch(() => ({ networkPassphrase: NETWORK_PASSPHRASE }));
	if (networkPassphrase !== NETWORK_PASSPHRASE) throw new Error("WRONG_NETWORK");
	return address;
}

/** SEP-53 message signature (base64), for linking the wallet to the account. */
export async function signMessage(message: string, address: string) {
	const kit = await loadKit();
	const { signedMessage } = await kit.signMessage(message, { address, networkPassphrase: NETWORK_PASSPHRASE });
	return signedMessage;
}

/** Pays a group's escrow exactly as the API asks (`CycleDto.payment`); resolves with the transaction hash. */
export async function pay(instructions: PaymentInstructionsDto, address: string) {
	const kit = await loadKit();
	const { Asset, BASE_FEE, Horizon, Memo, Operation, TransactionBuilder } = await import("@stellar/stellar-sdk");
	const server = new Horizon.Server(HORIZON_URL);
	const account = await server.loadAccount(address);
	const asset =
		instructions.assetCode === "XLM" ? Asset.native() : new Asset(instructions.assetCode, instructions.assetIssuer ?? GROUP_USDC_ISSUER);
	const tx = new TransactionBuilder(account, { fee: BASE_FEE, networkPassphrase: NETWORK_PASSPHRASE })
		.addOperation(Operation.payment({ destination: instructions.destination, asset, amount: instructions.amount }))
		.addMemo(Memo.text(instructions.memo))
		.setTimeout(180)
		.build();
	const { signedTxXdr } = await kit.signTransaction(tx.toXDR(), { address, networkPassphrase: NETWORK_PASSPHRASE });
	return submit(signedTxXdr, instructions.assetCode);
}

/** Opens a trustline so the wallet can hold (and pay) one of the test USDCs. Only the account's own key can. */
export async function addUsdcTrustline(address: string, kind: UsdcKind) {
	const kit = await loadKit();
	const { Asset, BASE_FEE, Horizon, Operation, TransactionBuilder } = await import("@stellar/stellar-sdk");
	const server = new Horizon.Server(HORIZON_URL);
	const account = await server.loadAccount(address);
	const tx = new TransactionBuilder(account, { fee: BASE_FEE, networkPassphrase: NETWORK_PASSPHRASE })
		.addOperation(Operation.changeTrust({ asset: new Asset("USDC", USDC_ISSUERS[kind]) }))
		.setTimeout(180)
		.build();
	const { signedTxXdr } = await kit.signTransaction(tx.toXDR(), { address, networkPassphrase: NETWORK_PASSPHRASE });
	return submit(signedTxXdr, "USDC");
}

/** Signs a transaction the API prepared (`xdr`) for `address`; the API submits it. */
export async function signTransaction(xdr: string, address: string) {
	const kit = await loadKit();
	const { signedTxXdr } = await kit.signTransaction(xdr, { address, networkPassphrase: NETWORK_PASSPHRASE });
	return signedTxXdr;
}

/** A signed transaction's hash (hex), to retry a confirm without submitting it twice. */
export async function transactionHash(signedXdr: string) {
	const { TransactionBuilder } = await import("@stellar/stellar-sdk");
	return TransactionBuilder.fromXDR(signedXdr, NETWORK_PASSPHRASE).hash().toString("hex");
}

/** Signs a transaction the API prepared and submits it to Horizon itself (the faucet's trustline has no confirm). */
export async function signAndSubmit(xdr: string, address: string) {
	return submit(await signTransaction(xdr, address), "USDC");
}

/** Creates the account on Testnet with test XLM (Friendbot). An account that already exists is fine. */
export async function fundAccount(address: string) {
	const response = await fetch(`${FRIENDBOT_URL}?addr=${encodeURIComponent(address)}`, { signal: AbortSignal.timeout(30_000) }).catch(() => {
		throw new Error("Friendbot didn’t answer. Try again in a moment.");
	});
	if (response.ok) return;
	const body = (await response.json().catch(() => null)) as { detail?: string } | null;
	if (/already funded|createAccountAlreadyExist/i.test(body?.detail ?? "")) return;
	throw new Error("Friendbot couldn’t fund this wallet. Try again in a moment.");
}

/** The wallet's two test USDCs on Testnet (group and savings), from Horizon (public, read-only). */
export async function usdcBalance(address: string) {
	// Horizon Testnet sometimes leaves a request hanging; give up rather than spin forever.
	const response = await fetch(`${HORIZON_URL}/accounts/${encodeURIComponent(address)}`, { signal: AbortSignal.timeout(15_000) }).catch(() => {
		throw new Error("We couldn’t read your balance from Stellar Testnet. Try again in a moment.");
	});
	const none = { usdc: "0", trustline: false };
	if (response.status === 404) return { funded: false, group: none, savings: none };
	if (!response.ok) throw new Error("We couldn’t read your balance from Stellar Testnet. Try again in a moment.");
	const account = (await response.json()) as { balances: { asset_code?: string; asset_issuer?: string; balance: string }[] };
	const of = (kind: UsdcKind) => {
		const line = account.balances.find((b) => b.asset_code === "USDC" && b.asset_issuer === USDC_ISSUERS[kind]);
		return { usdc: line ? String(Number(line.balance)) : "0", trustline: !!line };
	};
	return { funded: true, group: of("group"), savings: of("savings") };
}

export async function disconnect() {
	if (!kitPromise) return;
	const kit = await kitPromise;
	await kit.disconnect().catch(() => undefined);
}

async function submit(signedXdr: string, code: string) {
	const response = await fetch(`${HORIZON_URL}/transactions`, {
		method: "POST",
		headers: { "Content-Type": "application/x-www-form-urlencoded" },
		body: new URLSearchParams({ tx: signedXdr }).toString(),
	});
	const body = (await response.json().catch(() => null)) as {
		hash?: string;
		extras?: { result_codes?: { transaction?: string; operations?: string[] } };
	} | null;
	if (response.ok && body?.hash) return body.hash;
	const codes = [body?.extras?.result_codes?.transaction, ...(body?.extras?.result_codes?.operations ?? [])].filter(Boolean).join(" ");
	if (/op_underfunded|tx_insufficient_balance/.test(codes)) throw new Error(`Not enough ${code} in your wallet for this payment and the network fee.`);
	if (/op_no_trust/.test(codes)) throw new Error(`Your wallet can't hold ${code} yet. Add a ${code} trustline, then try again.`);
	if (/tx_bad_seq|tx_too_late/.test(codes)) throw new Error("The signed payment expired. Try again.");
	throw new Error(`Stellar Testnet refused the payment${codes ? ` (${codes})` : ""}.`);
}
