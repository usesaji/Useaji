/**
 * Stellar network settings. The MVP is Testnet-only (brief: "Stellar Testnet"); switching networks
 * is a change here and nowhere else.
 */
export const STELLAR_NETWORK = "testnet" as const;
export const STELLAR_NETWORK_LABEL = "Stellar Testnet";
export const HORIZON_URL = "https://horizon-testnet.stellar.org";
/** Networks.TESTNET — what wallets sign against. */
export const NETWORK_PASSPHRASE = "Test SDF Network ; September 2015";
/**
 * Two test USDCs live side by side on Testnet (seen on the live API, Nov 2026):
 * - group contributions and payouts use Circle's (`CycleDto.payment.assetIssuer`);
 * - personal savings and slot purchases use Saji's own, which the API's faucet issues.
 * Payments always follow the issuer the API names; these are for showing balances and trustlines.
 */
export const GROUP_USDC_ISSUER = "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5";
export const SAVINGS_USDC_ISSUER = "GDICTJYAZKLZPQGH6OHTLHEZJXYGAWDS5JQGC2OBANQ7NMNFCA6CRWJH";
export type UsdcKind = "group" | "savings";
export const USDC_ISSUERS: Record<UsdcKind, string> = { group: GROUP_USDC_ISSUER, savings: SAVINGS_USDC_ISSUER };
/** Where to get Circle's test USDC (for group savings). Saji's comes from the API's faucet. */
export const GROUP_USDC_FAUCET_URL = "https://faucet.circle.com/";
/** Creates Testnet accounts with test XLM. */
export const FRIENDBOT_URL = "https://friendbot.stellar.org";
/** The personal savings contract every plan lives in (one shared contract, a plan id per goal). */
export const SAVINGS_CONTRACT = "CAKEMTM6ZSMCTSV4WOKXVRCVWHFUBZ46CXGPOFH7IFJOUI4RR3VN7GPZ";
/** The slot registry contract: who holds each group's payout slots (slot transfers). */
export const SLOT_REGISTRY_CONTRACT = "CAB6L4JEIJHJXOQSRFEW745SKXGHMS5W7IABUKRORM27TJBXCZ2S5FJY";

const EXPLORER_BASE = `https://stellar.expert/explorer/${STELLAR_NETWORK}`;

/** Public explorer page for a transaction (contribution, payout, vote anchor). */
export function explorerTxUrl(txHash: string) {
	return `${EXPLORER_BASE}/tx/${txHash}`;
}

/** Public explorer page for an account (a group's escrow, a wallet). */
export function explorerAccountUrl(address: string) {
	return `${EXPLORER_BASE}/account/${address}`;
}

/** Public explorer page for a Soroban contract (a personal savings plan's contract). */
export function explorerContractUrl(contractId: string) {
	return `${EXPLORER_BASE}/contract/${contractId}`;
}

/** GABC…WXYZ */
export const shortAddress = (address: string) => `${address.slice(0, 4)}…${address.slice(-4)}`;
