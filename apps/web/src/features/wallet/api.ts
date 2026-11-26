/** The linked wallet, payout address and withdraw destinations (`/v1/wallet/*`). */
import { apiDelete, apiGet, apiPost, apiPut } from "@/lib/api/client";
import type {
	AddDestinationDto,
	DestinationDto,
	FaucetFundedDto,
	LinkedWalletDto,
	PreparedTrustlineDto,
	ReauthDto,
	WalletChallengeDto,
	WalletSummaryDto,
} from "@/lib/api/dto";

/**
 * Changes to where money goes re-check who you are: `proof` is `currentPassword` (or a Google ID
 * token), and a wrong one answers 401 without ending the session (`credentialCheck`). Screens get the
 * proof through `withIdentity` (features/auth/reauth.tsx).
 */
const CHECKED = { credentialCheck: true } as const;

/** Linked wallet, totals, Useful Insights, and `payoutAddress` — where payouts go (SAJI holds no balance). */
export const getWallet = () => apiGet<WalletSummaryDto>("/wallet");

export const unlinkWallet = (proof: ReauthDto) => apiDelete("/wallet", proof, CHECKED);

/** Step 1 of linking: a message to sign with the wallet (SEP-53), valid 5 minutes. */
export const walletChallenge = (publicKey: string) => apiPost<WalletChallengeDto>("/wallet/challenge", { publicKey });

/** Step 2: the signature, with `proof`. A wallet can be linked to one account only. */
export const linkWallet = (input: { publicKey: string; signature: string } & ReauthDto) => apiPost<LinkedWalletDto>("/wallet/link", input, CHECKED);

export const listDestinations = () => apiGet<DestinationDto[]>("/wallet/destinations");

/** The first destination becomes primary — and payouts go to the primary. */
export const addDestination = (input: AddDestinationDto) => apiPost<DestinationDto>("/wallet/destinations", input, CHECKED);

export const setPrimaryDestination = (id: string, proof: ReauthDto) => apiPut<DestinationDto[]>(`/wallet/destinations/${id}/primary`, proof, CHECKED);

/** The API doesn't re-check removals. Removing the primary makes the oldest remaining one primary. */
export const removeDestination = (id: string) => apiDelete<DestinationDto[]>(`/wallet/destinations/${id}`);

// ---------------------------------------------------------------- test USDC faucet (testnet only)

/**
 * A transaction that adds Saji's test USDC to the linked wallet. The wallet signs and submits it
 * itself (no confirm call). 404: the faucet is off. 409 "already trusts USDC": skip this step.
 */
export const prepareFaucetTrustline = () => apiPost<PreparedTrustlineDto>("/faucet/trustline/prepare");

/** Sends test USDC (1000) to the linked wallet. 429: once per wallet per hour, and a global hourly cap. */
export const requestTestUsdc = () => apiPost<FaucetFundedDto>("/faucet/usdc");
