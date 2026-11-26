# SAJI v3 frontend integration guide

This guide covers every API added or changed in v3:
- the savings slot marketplace;
- personal savings plans;
- the savings dashboard;
- the testnet faucet;
- changes to existing responses.

The OpenAPI document at `/docs` (with `SWAGGER_ENABLED=true`) is the source of truth for exact schemas. This guide explains how to use the endpoints together.

Contents:
1. Basics: envelope, errors, amounts, modes
2. Wallet signing (shared by every on-chain action)
3. Test USDC faucet (testnet)
4. Savings dashboard
5. Personal savings plans
6. Slot marketplace
7. Changes to existing APIs
8. Notifications and history
9. Screen-by-screen checklist

---

## 1. Basics

**Base path.** Every route is under `/v1` and needs `Authorization: Bearer <accessToken>`.

**Envelope.** Successful responses look like this:

```json
{ "data": <payload>, "statusCode": 200, "message": "Savings goal retrieved" }
```

Paginated lists put this in `data`:

```json
{ "results": [...], "paginationMeta": { "nextPage": true, "previousPage": false, "totalCount": 42, "count": 20, "totalPages": 3, "currentPage": 1 } }
```

Paginated routes take `?page=1&limit=20`, with `limit` at most 100.

**Errors.** Every non-2xx response has the same shape:

```json
{ "statusCode": 409, "code": "CONFLICT", "message": "This plan is locked until 2027-01-01T00:00:00.000Z", "details": ["..."], "requestId": "...", "timestamp": "...", "path": "/v1/..." }
```

`details` appears only on validation errors (400). Show `message` to the user. It is always written to be shown to a person.

**Amounts.** Amounts are decimal strings in USDC with at most 7 decimals, for example `"12.5"`. Never send numbers. Never round on the client: display what the API returns.

**Dates.** Dates are ISO 8601 strings in UTC. When you send a date (`unlockAt`), include a timezone, e.g. `2027-01-01T00:00:00Z`.

**Ids.** Ids are UUIDs.

**Two modes.** The same API runs in two modes. Branch on the response (`xdr` null or not), not on configuration.

| Mode | When | On-chain steps |
| --- | --- | --- |
| `stellar` | Staging and production on Stellar testnet | The user's wallet signs every money-moving action. |
| `simulated` | Local development | No chain and no signing. `.../prepare` endpoints return 409, and confirm endpoints work without a transaction. |

---

## 2. Wallet signing

The backend never holds user keys. Every on-chain action follows the same three steps.

```
1. POST .../prepare          -> { xdr }           (unsigned, built for the user's linked wallet)
2. wallet.signTransaction(xdr)                     (user approves in Freighter / xBull / ...)
3. POST .../<confirm>  { signedXdr }  -> result   (the API submits it and reads the contract events)
```

If the wallet submits the transaction itself, send `{ txHash }` in step 3 instead of `{ signedXdr }`.

**Prerequisites.** The user must have linked a wallet (`POST /wallet/challenge`, then `POST /wallet/link`, unchanged from v2). The wallet account must exist on testnet, and must trust USDC before it can hold any (see section 3).

**Network.** Testnet, passphrase `Test SDF Network ; September 2015`.

### Signing with Stellar Wallets Kit (recommended)

Stellar Wallets Kit supports Freighter, xBull, Albedo, Lobstr and others behind one API.

```ts
import {
  StellarWalletsKit, WalletNetwork, allowAllModules, FREIGHTER_ID,
} from '@creit.tech/stellar-wallets-kit';

const kit = new StellarWalletsKit({
  network: WalletNetwork.TESTNET,
  selectedWalletId: FREIGHTER_ID,
  modules: allowAllModules(),
});

async function signAndConfirm(prepareUrl: string, prepareBody: object, confirmUrl: string) {
  const { data: { xdr } } = await api.post(prepareUrl, prepareBody);
  const { address } = await kit.getAddress();
  const { signedTxXdr } = await kit.signTransaction(xdr, {
    address,
    networkPassphrase: WalletNetwork.TESTNET,
  });
  return (await api.post(confirmUrl, { signedXdr: signedTxXdr })).data;
}
```

With `@stellar/freighter-api` directly: `const { signedTxXdr } = await signTransaction(xdr, { networkPassphrase })`. Check the exact signature against the version you install.

### Rules
- **Sign the wallet the API built for.** It is the linked wallet, or the plan's owner wallet. If the user switched accounts in their wallet extension, signing fails or the confirm returns 400.
- **Confirm calls can wait.** They block until Stellar confirms, up to about 10 seconds. Show a "Confirming on Stellar…" state.
- **Retries are safe.** If confirm times out (503, "not found on Stellar yet"), call it again with the same `txHash`. The API records each transaction once.
- **Closed tabs are fine.** A background poller records signed transactions the app never reported, within about 10 seconds. If confirm was never called, refetch the plan or listing and it will be there.
- **Every response has a `txUrl`.** It is a Stellar Expert link: use it as the "View on Stellar" link, which the demo needs.

---

## 3. Test USDC faucet (testnet only)

SAJI issues its own testnet USDC, so no captcha faucet is needed. The faucet returns **404 when it is off** (production, simulated mode, or misconfigured). Hide the faucet UI on 404.

```
1. Fund the wallet account once (it must exist on testnet):
   GET https://friendbot.stellar.org?addr=G...
2. POST /v1/faucet/trustline/prepare            -> { xdr }
   Sign it AND SUBMIT IT WITH THE WALLET (this call has no confirm endpoint).
   409 "already trusts USDC" means skip this step.
3. POST /v1/faucet/usdc                          -> { txHash, amount: "1000" }
```

| Status | Meaning |
| --- | --- |
| 404 | Faucet off |
| 409 | No linked wallet; the wallet doesn't exist on testnet (use Friendbot); no trustline yet (do step 2 first; this doesn't use up the allowance); or the trustline limit is too low |
| 429 | This wallet already got USDC in the last hour, or the global hourly cap is reached |
| 503 | Stellar is slow or unreachable. If the message says "check your wallet before trying again", the payment may still land. |

---

## 4. Savings dashboard

`GET /v1/savings/overview`

```ts
interface SavingsDashboard {
  groups: {                 // same object as GET /groups/overview
    asset: string;
    totalSaved: string;     // contributed to groups that have not completed (before payouts)
    totalPending: string;   // owed now across active groups
    activeGroups: number;
    nextDue: { groupId: string; groupName: string; amount: string; deadline: string } | null;
  };
  personal: {
    asset: string;
    plans: number;
    balance: string;        // held in all plans now
    target: string;         // sum of plan targets
  };
  totalSaved: string;       // groups.totalSaved + personal.balance
}
```

Label `totalSaved` as "contributed and saved", not as a wallet balance.

---

## 5. Personal savings plans

### Types

```ts
type SavingsLock = 'flexible' | 'until_date' | 'until_target' | 'until_date_or_target';

interface Plan {
  id: string;
  name: string;
  target: string;
  asset: 'USDC';
  lock: SavingsLock;
  unlockAt: string | null;      // set for the date locks
  balance: string;
  progressPercent: number;      // 0..100, capped, 2 decimals
  canWithdraw: boolean;         // lock allows it now and balance > 0
  ownerAddress: string | null;  // wallet that owns the plan on Stellar (null in simulated mode)
  txHash: string | null;
  txUrl: string | null;
  createdAt: string;
  movements: Movement[] | null; // only on GET /savings/plans/{id}
}

interface Movement {
  id: string;
  kind: 'deposit' | 'withdrawal';
  amount: string;
  balanceAfter: string;
  txHash: string | null;
  txUrl: string | null;
  createdAt: string;
}
```

### Lock rules (show these in the create form)

| `lock` | Withdrawals allowed | `unlockAt` |
| --- | --- | --- |
| `flexible` | Any time | Must be omitted |
| `until_date` | From `unlockAt` on | Required |
| `until_target` | While the balance is at least the target. A withdrawal that drops the balance below the target locks the plan again. | Must be omitted |
| `until_date_or_target` | When either holds | Required |

`unlockAt` must be at least a minute in the future, at most 10 years ahead, and include a timezone.

### Create a goal

```
POST /v1/savings/plans
{ "name": "Laptop", "target": "500", "lock": "until_date", "unlockAt": "2027-06-01T00:00:00Z" }
-> 201 { planId, xdr, plan }
```

- **Stellar mode** (`xdr` is a string, `plan` is null):
  1. Sign `xdr`.
  2. `POST /v1/savings/plans/{planId}/confirm` with `{ signedXdr }` or `{ txHash }`. The response is the Plan.
  - The `planId` is reserved for this user and wallet for 24 hours. Confirming twice returns the same plan.
- **Simulated mode** (`xdr` is null): `plan` is already created.

| Status | When |
| --- | --- |
| 400 | Name not 2 to 60 characters; target not a positive amount; lock and `unlockAt` don't match; date in the past or too far ahead; no timezone |
| 409 | No linked wallet (Stellar) |
| 400 on confirm | The transaction did not create this plan for the user's wallet |
| 404 on confirm | Unknown `planId`, or prepared by another user |

### Deposit

```
POST /v1/savings/plans/{id}/deposits/prepare   { "amount": "50" }  -> { xdr }
POST /v1/savings/plans/{id}/deposits           { "signedXdr": "..." } -> Plan
```

In simulated mode, skip prepare and send `{ "amount": "50" }` to `/deposits`.

### Withdraw

```
POST /v1/savings/plans/{id}/withdrawals/prepare  { "amount": "20" } -> { xdr }
POST /v1/savings/plans/{id}/withdrawals          { "signedXdr": "..." } -> Plan
```

| Status | When |
| --- | --- |
| 409 at prepare | Locked. The message says until when, e.g. "This plan is locked until 2027-06-01T00:00:00.000Z". Disable the button when `canWithdraw` is false. |
| 409 at prepare | Amount above the balance |
| 409 at prepare | The user linked a different wallet than `ownerAddress`. The message names the owner wallet. |
| 400 at confirm | The transaction did not deposit into, or withdraw from, this plan |
| 400 at prepare | Stellar refused, e.g. "Not enough USDC in the wallet" |

The contract enforces the lock too, so a hand-built transaction fails as well.

### Read

- `GET /v1/savings/plans` returns `Plan[]`, newest first, with `movements: null`.
- `GET /v1/savings/plans/{id}` returns a Plan with its last 100 movements, newest first. Another user's plan gives 404.

The balance always comes from the contract, so refetch after each confirm rather than computing it.

---

## 6. Slot marketplace

A member of an **active, public** group can sell a **future** payout slot (not the current round's, and not one already paid out) to someone outside the group. The group votes on it. The buyer then pays the asking price and takes the slot in one Stellar transaction.

### Types

```ts
interface MemberPreview {
  userId: string; firstName: string | null; lastName: string | null;
  tag: string | null; initials: string; avatarUrl: string | null;
}

interface Listing {
  id: string;
  group: {
    id: string; name: string; contributionAmount: string; asset: string;
    frequency: 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'custom';
    totalRounds: number; currentRound: number; roundDeadline: string;
  };
  seller: MemberPreview;
  position: number;              // 0-based payout round of the slot (show position + 1)
  askingPrice: string;
  roundsToPay: number;           // rounds the buyer would still pay
  remainingObligation: string;   // roundsToPay x contribution
  expectedPayout: string;        // contribution x totalRounds
  status: 'open' | 'sold' | 'withdrawn' | 'invalidated';
  createdAt: string;
  mine: boolean;                 // you are the seller
  requested: boolean;            // you have a pending takeover request
  requests: { buyer: MemberPreview; requestedAt: string }[] | null; // seller only
  transfer: {                    // the buyer put to a vote; seller, that buyer and members see it
    proposalId: string;
    buyer: MemberPreview;
    proposalStatus: 'active' | 'approved' | 'rejected' | 'expired' | 'executed';
    approval: { expiresAt: string; acceptable: boolean } | null;
  } | null;
}

interface SlotTransfer {
  id: string; from: MemberPreview; to: MemberPreview;
  position: number; price: string; effectiveRound: number;
  txHash: string | null; txUrl: string | null; transferredAt: string;
}
```

### The flow

```
SELLER                                   BUYER                                MEMBERS
POST /groups/{id}/slots/listings
  { askingPrice }            ───────►  GET /slots/marketplace
                                       GET /slots/listings/{id}
                                       POST /slots/listings/{id}/takeover-requests
notification slot_takeover_requested ◄─
GET /slots/listings/{id} (requests)
POST /slots/listings/{id}/takeover-requests/{buyerId}/select
                                  ───────────────────────────────────────►  notification proposal_created
                                                                             POST /groups/{id}/proposals/{proposalId}/votes
                                       notification slot_transfer_approved ◄─ (vote passes, approval created)
                                       POST /slots/listings/{id}/accept/prepare -> { xdr }
                                       wallet signs (within ~2 min)
                                       POST /slots/listings/{id}/accept { signedXdr }
notification slot_transferred ◄────────  -> Listing { status: "sold" }
```

### Seller endpoints

| Call | Notes |
| --- | --- |
| `POST /v1/groups/{groupId}/slots/listings` `{ askingPrice }` | 201, returns a Listing. `"0"` gives the slot away. |
| `DELETE /v1/groups/{groupId}/slots/listings/mine` | Withdraws the open listing (404 if none). An approved buyer can no longer accept it. |
| `GET /v1/slots/listings/{id}` | Includes `requests` for the seller. |
| `POST /v1/slots/listings/{id}/takeover-requests/{buyerId}/select` | Opens the `slot_transfer` vote and returns the Listing with `transfer`. Every member except the seller votes. |

Listing is refused with **409** when:
- the group is not active or not public;
- the group is paused;
- the slot's payout isn't still ahead;
- the seller has an unresolved missed contribution;
- the slot is already listed.

Non-members get **404**.

Selecting a buyer is refused with **409** while a vote on this listing is open, or while an earlier approval can still be accepted. A non-seller gets **403**; an unknown request gets **404**.

### Buyer endpoints

| Call | Notes |
| --- | --- |
| `GET /v1/slots/marketplace?page=&limit=` | Open listings in active public groups, newest first. |
| `GET /v1/slots/listings/{id}` | Anyone can see listings in public groups. Private-group listings give 404 to outsiders. |
| `POST /v1/slots/listings/{id}/takeover-requests` | Returns the Listing with `requested: true`. Repeating it is a no-op. |
| `DELETE /v1/slots/listings/{id}/takeover-requests` | Withdraws the request. |
| `POST /v1/slots/listings/{id}/accept/prepare` | Returns `{ xdr }`, already co-signed by SAJI. **The co-signature lasts about 2 minutes**: open the wallet right away. If it lapses, call prepare again. |
| `POST /v1/slots/listings/{id}/accept` `{ signedXdr }` or `{ txHash }` | Returns the Listing with `status: "sold"`. On Stellar, repeating it with the same transaction returns the same result. |

Requesting a takeover is refused when:

| Status | When |
| --- | --- |
| 400 | The caller is the seller |
| 403 | An admin removed the caller from this group |
| 409 | No linked wallet; already a member; already holds a slot in the group; or an unresolved missed contribution in any group |
| 404 | Listing not open |

Accept outcomes:

| Status | When |
| --- | --- |
| 404 | No approved takeover for this user, or the listing closed |
| 409 | Approval expired; the group is paused; a rule is no longer met; "the schedule changed since this slot was listed"; "a transfer to your previous wallet is still valid" (the user relinked within the 2-minute window; wait and retry) |
| 400 at prepare | Not enough USDC in the buyer's wallet, or the seller's wallet has no USDC trustline |
| 400 at accept | The transaction did not transfer this slot to the user's wallet |
| Simulated mode | Prepare returns 409; call accept with an empty body `{}` |

Show **Accept** only when `transfer.buyer.userId === me`, `transfer.proposalStatus === 'executed'` and `transfer.approval.acceptable`. Show a countdown to `transfer.approval.expiresAt`.

### History

`GET /v1/groups/{groupId}/slots/transfers` returns `SlotTransfer[]`, newest first, for members only. Use it for the "Slot transfer history" screen.

### Listings that close by themselves (`status: "invalidated"`)

A listing is invalidated when:
- the seller misses a contribution;
- the seller is removed by a recovery vote;
- the schedule is rewritten (schedule vote, write-off, removal);
- the slot becomes the open round;
- the group completes.

Refetch the listing on any of the related notifications.

### What a transfer changes (show this on the group screens)
- The buyer becomes a member at the seller's payout position, and the seller leaves the group.
- If the seller had already paid the current round, the buyer starts paying from the next round (`myAmountDue` is null for them this round).
- Past contributions and payouts keep the seller's name.

---

## 7. Changes to existing APIs

| API | Change | What to do |
| --- | --- | --- |
| `GET /groups/{id}/cycle`, `contributions[]` | New field `coveredByPreviousHolder: boolean`. When true, this member took the slot after the previous holder paid this round; `paid`, `amount` and `paidAt` describe that earlier payment. There is one row per slot owed this round. | Show "Paid by previous holder" instead of the member's own payment. |
| `GET /groups/{id}/proposals`, `GET .../proposals/{id}` | New proposal `type: "slot_transfer"` and field `slotTransfer: { listingId, buyer: MemberPreview, price } \| null`. | Render slot-transfer votes ("Transfer slot 3 to Ada for 5 USDC") and link to the listing. Voting is unchanged. |
| `POST /groups/{id}/proposals` | `type: "slot_transfer"` is refused (400). | Create slot-transfer votes only through the marketplace "select" endpoint. |
| `GET /activity`, `GET /activity/{id}` | New kinds `savings_deposit` and `savings_withdrawal`, and a new field `plan: { id, name } \| null` (set for savings kinds; `group` is null for them). `?type=` accepts the new kinds. | Add the kinds to the activity filter, and link the `plan` to the plan screen. |
| `GET /statements` | `totals` adds `savingsDeposits` and `savingsWithdrawals`. | Show them in the statement totals and the CSV. |
| `GET /groups/{id}/defaults` | A former member who sold their slot can still list and settle their own defaults (no longer 404). | No change for current members. |
| Group schedule and recovery votes | Executing a schedule change, write-off or removal may return 409 "A slot transfer is being signed; try again in a few minutes". The proposal stays `approved` and is retried automatically. | Show the message; no action is needed. |
| Notifications | New kinds (see section 8). | Add icons and deep links. |
| Group history (`GET /groups/{id}/history`) | New event kinds (see section 8). | Add them to the timeline. |

Unchanged: auth, wallet link/challenge, destinations, group creation, joining, contributions, defaults/settle, governance settings, voting.

---

## 8. Notifications and history

New notification kinds (`GET /notifications`; polling as before):

| `kind` | Sent to | `data` | Deep link |
| --- | --- | --- | --- |
| `slot_takeover_requested` | Seller | `groupId`, `listingId`, `userId` (buyer) | Listing (requests tab) |
| `slot_transfer_approved` | Buyer and seller | `groupId`, `listingId` | Listing (Accept button for the buyer) |
| `slot_transferred` | Buyer and seller | `groupId`, `listingId` | Group (buyer) / listing (seller) |

A `slot_transfer` vote also sends the existing `proposal_created`, `proposal_approved`, `proposal_rejected` and `proposal_executed` notifications to voters.

New history event kinds:
- `slot_listed`: `{ listingId, position, askingPrice }`
- `slot_listing_closed`: `{ listingId, reason }`
- `slot_takeover_requested`: `{ listingId, buyerId }`
- `slot_transferred`: `{ listingId, proposalId, fromUserId, toUserId, position, price, coveredRound }`, plus `txHash` on Stellar

---

## 9. Screen-by-screen checklist

| Screen | Calls | Notes |
| --- | --- | --- |
| Savings dashboard | `GET /savings/overview`, `GET /savings/plans` | Group and personal totals; plan cards with `progressPercent` |
| Group savings details | `GET /groups/{id}`, `GET /groups/{id}/cycle` | Handle `coveredByPreviousHolder`. Show "List my slot" when the user is a member and their slot's position is after `round`. |
| Savings slot marketplace | `GET /slots/marketplace` | Card: group, position + 1, `roundsToPay`, `remainingObligation`, `expectedPayout`, `askingPrice` |
| List a savings slot | `POST /groups/{id}/slots/listings`, `DELETE .../listings/mine` | Explain the rules from section 6 on a 409 |
| Slot takeover request | `GET /slots/listings/{id}`, `POST/DELETE .../takeover-requests` | Needs a linked wallet; link to wallet setup on 409 |
| Group approval | Seller: `.../select`. Members: proposal vote endpoints. | Show `slotTransfer` details on the proposal |
| Accept takeover | `.../accept/prepare`, wallet sign, `.../accept` | Act within the 2-minute window; show `txUrl` after |
| Slot transfer history | `GET /groups/{id}/slots/transfers` | `txUrl` links |
| Create personal savings goal | `POST /savings/plans`, wallet sign, `POST /savings/plans/{planId}/confirm` | Lock picker per section 5 |
| Personal savings details | `GET /savings/plans/{id}` | Movements with `txUrl`; disable Withdraw when `!canWithdraw` |
| Deposit and withdrawal | `.../deposits/prepare` → sign → `.../deposits`; the same for `/withdrawals` | Refetch the plan after confirm |
| Wallet setup (testnet) | Friendbot, `POST /faucet/trustline/prepare` (sign and submit in the wallet), `POST /faucet/usdc` | Hide on 404 |

### Testnet contract addresses (for "View on Stellar" and the submission)

- Slot registry: `CAB6L4JEIJHJXOQSRFEW745SKXGHMS5W7IABUKRORM27TJBXCZ2S5FJY`
- Personal savings: `CAKEMTM6ZSMCTSV4WOKXVRCVWHFUBZ46CXGPOFH7IFJOUI4RR3VN7GPZ`
- Test USDC: `USDC:GDICTJYAZKLZPQGH6OHTLHEZJXYGAWDS5JQGC2OBANQ7NMNFCA6CRWJH` (contract `CB5DNCC6ZREAZ5IEVKD2LMX6XAD2XQOEUB6OGN4USEM7ZC52CW3SZEHE`)

Explorer: `https://stellar.expert/explorer/testnet/contract/<address>`.
