/**
 * Stellar network settings. The MVP is Testnet-only (brief: "Stellar Testnet"); switching networks
 * is a change here and nowhere else.
 */
export const STELLAR_NETWORK = "testnet" as const;
export const STELLAR_NETWORK_LABEL = "Stellar Testnet";
export const HORIZON_URL = "https://horizon-testnet.stellar.org";
/** Networks.TESTNET — what wallets sign against. */
export const NETWORK_PASSPHRASE = "Test SDF Network ; September 2015";
/** Circle's USDC issuer on Stellar Testnet. */
export const USDC_ISSUER = "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5";
/** Where "Get test USDC" sends people. */
export const USDC_FAUCET_URL = "https://faucet.circle.com/";

const EXPLORER_BASE = `https://stellar.expert/explorer/${STELLAR_NETWORK}`;

/** Public explorer page for a transaction (contribution, payout, vote anchor). */
export function explorerTxUrl(txHash: string) {
	return `${EXPLORER_BASE}/tx/${txHash}`;
}

/** Public explorer page for an account (a group's escrow, a wallet). */
export function explorerAccountUrl(address: string) {
	return `${EXPLORER_BASE}/account/${address}`;
}

/** GABC…WXYZ */
export const shortAddress = (address: string) => `${address.slice(0, 4)}…${address.slice(-4)}`;
