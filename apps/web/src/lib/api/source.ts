/**
 * Where data comes from (`NEXT_PUBLIC_API_SOURCE`).
 *
 * - `live` (the default): the Railway API, through this app's `/api/v1` proxy (next.config.ts).
 * - `mock`: the in-browser mock (`src/mocks`, localStorage) answers every route with the API's DTOs —
 *   offline demos (`demo@usesaji.com`), the dev panel's clock, and `pnpm test:mock`.
 *
 * Wallets follow the API: real wallets (Freighter / xBull / Albedo / LOBSTR through Stellar Wallets
 * Kit, Testnet) when live, a simulated one (500 test USDC) with the mock — the API verifies real
 * signatures and payments. `NEXT_PUBLIC_WALLET_SOURCE=live|mock` overrides it.
 */
export const USE_MOCK_API = process.env.NEXT_PUBLIC_API_SOURCE === "mock";

const walletSource = process.env.NEXT_PUBLIC_WALLET_SOURCE;
export const LIVE_WALLET = walletSource ? walletSource === "live" : !USE_MOCK_API;

