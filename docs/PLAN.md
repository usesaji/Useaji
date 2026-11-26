# Plan: MVP 2 — governance, defaults and recovery

Brief: https://docs.google.com/document/d/1PBheqZumL-k_8tWr7DAUegv-nUQmGVJd-r1vpIKis5k (text copy:
`mvp2-brief.txt`). Backend: the Saji API, https://pay.usesaji.com/docs
(spec copy: `openapi.json`).

**Status:** every screen is built against the API's contract and runs on the in-browser mock
(`apps/web/src/mocks`). The API is **not connected yet**: that waits on `BACKEND-GAPS.md`.

## Definition of done (brief) → where it lives

| Brief | API | Screen | Mock |
|---|---|---|---|
| A member creates a supported proposal | `POST /groups/{id}/proposals` | Create Proposal, Recovery Proposal | ✅ |
| Members vote | `POST …/proposals/{id}/votes` | Vote, Recovery Vote | ✅ |
| Configurable thresholds decide approval | `GET/PUT /groups/{id}/governance` | Create Group step 2, Approval Rules | ✅ |
| An approved proposal executes | executes at the threshold; `POST …/execute` retries | Proposal Result / "Approved — waiting" | ✅ |
| Pause / resume a group by vote | `type: pause / resume` | Create Proposal, circle banner | ✅ |
| Approve future payout schedule changes | `type: update_schedule` (`fromRound`, `recipients`) | Create Proposal (reorder) | ✅ |
| Missed contribution detected after its deadline | scanner + `POST /defaults/detect` | Recovery ("check now") | ✅ |
| Default recorded on-chain | `DefaultDto.txHash` | Recovery | ✅ (anchored, see BACKEND-GAPS §5) |
| The cycle enters recovery | `CycleDto.inRecovery`, `actionRequired` | Circle banner, Recovery | ✅ |
| Members vote on a permitted recovery action | `type: recovery`, `availableActions` | Recovery Options, Recovery Proposal, Recovery Vote | ✅ |
| An approved recovery action executes | — | Recovery Complete | ✅ |
| The cycle resumes | `recovery_resolved` | Circle, History | ✅ |
| Verifiable on Stellar Testnet | `txHash`, `txUrl`, `anchorHash` | History, transaction cards | ✅ (links) |

## The 12 design screens

| # | Screen | Route |
|---|---|---|
| 1 | Group Dashboard | `/groups/[id]/circle` |
| 2 | Governance / Proposals | `/groups/[id]/proposals` |
| 3 | Create Proposal | `/groups/[id]/proposals/new` |
| 4 | Proposal Details | `/groups/[id]/proposals/[pid]` |
| 5 | Voting Screen | `/groups/[id]/proposals/[pid]/vote` |
| 6 | Proposal Result / Execution Status | `/groups/[id]/proposals/[pid]` (approved · executed · rejected · expired) |
| 7 | Missed Contribution Alert | circle banner + `/groups/[id]/recovery` + notification |
| 8 | Default / Recovery State | `/groups/[id]/recovery` |
| 9 | Create / View Recovery Proposal | `/groups/[id]/recovery/options` → `/recovery/propose` |
| 10 | Recovery Voting | `/groups/[id]/proposals/[pid]` (recovery) |
| 11 | Recovery Resolution | `/groups/[id]/proposals/[pid]` (executed recovery) |
| 12 | Governance & Recovery History | `/groups/[id]/history` |

## To go live

1. The backend fixes the blockers in `BACKEND-GAPS.md` (withdrawals, `CreateGroupDto` types,
   pagination params, `DefaultDto` payment instructions) and answers §4.
2. Regenerate the types (`pnpm --filter web api:types`); TypeScript lists what changed.
3. `NEXT_PUBLIC_API_SOURCE=live`, `NEXT_PUBLIC_WALLET_SOURCE=live`, `NEXT_PUBLIC_GOOGLE_CLIENT_ID`.
4. Walk the Definition of Done on Testnet with two real wallets and record the transaction links.

---

# Plan: v3 — slot marketplace & personal savings

Brief: https://docs.google.com/document/d/1yrKJLD56qoJxdL1laIrxmHjNdLh_C_peFUvjBCDnNHs (text copy:
`v3-brief.txt`). Designs: Figma "SAJI 3.0 · Slot marketplace & personal savings" (13 screens, each in
a desktop and a mobile version). The backend's v3 is in the spec; how to use it:
`frontend-integration.md`.

**Status:** all of v3 is on the real API — personal savings, the savings dashboard, the test USDC
faucet and the slot marketplace — and the mock follows the API's rules.

| # | Screen | Route | Status |
|---|---|---|---|
| 01 | Savings dashboard | `/overview` (top: total saved = group + personal, goal card, create goal) | Built |
| 02 | Group savings details | `/groups/[id]/circle` (+ `SlotPanel`: your slot, schedule, slot transfers) | Built |
| 03 | Savings slot marketplace | `/groups/marketplace` (`?mine=1`: my listings & requests) | Built |
| 04 | List a savings slot | `/groups/[id]/slot/list` | Built |
| 05 | Slot takeover request | `/groups/marketplace/[listingId]` | Built |
| 06 | Group approval | `/groups/[id]/proposals/[proposalId]` (a `slot_transfer` proposal) | Built |
| 07 | Slot transfer history | `/groups/[id]/transfers` | Built |
| 08 | Create personal savings goal | `/savings/new` | Built |
| 09 | Personal savings details (flexible) | `/savings/[planId]` | Built |
| 10 | Deposit USDC | `/savings/[planId]/deposit` | Built |
| 11 | Withdraw USDC | `/savings/[planId]/withdraw` | Built |
| 12 | Locked savings · withdrawal unavailable | `/savings/[planId]` (any lock that holds) | Built |
| 13 | Connect Stellar wallet | `ConnectWalletPanel` on `/savings` and `/savings/new` without a wallet | Built |

Not in the designs but needed: the plan list (`/savings`), a "Personal Savings" section on `/wallet`,
the state after a locked plan's release date, and the confirmation after a deposit or withdrawal.
Added for the API (built in the designs' style): a picker for the four locks on 08 (the design has
flexible / locked; the date field shows only for the date locks), each lock's rules and "released"
state on 09/12, a "Transaction status" card (prepare → sign → confirming on Stellar) on 08, 10 and 11,
Testnet wallet setup and "Get test USDC" on the wallet card, and savings deposits and withdrawals in
Activity (two new filters, linked to the goal), the transaction page and the statement (totals and CSV).
In the nav, Wallet stays active on `/savings/*`. For slots, built in the designs' style for what the API
does and the designs leave out: an asking price (04 input, "0 gives it away"; shown on 03, 05, the vote
and 07), the API's checklists on 04 and 05, the seller's requests with "Put to a vote" and "Withdraw
listing" (05), the chosen buyer's states (group voting → "Accept & pay" with a countdown to the approval's
end and a Transaction status card → transferred, or expired / not approved), closed listings, "My
listings & requests" as Selling / Requests tabs, an asking-price filter, slot details on the proposal
page (06 is the group's proposal screen now), and 07's seller contributions and payout per transfer.
Demo: as Ada, vote on Dean taking Amara's slot in Summer Fund (Dean accepts on his own); in Community
Circle ask for Dami's slot 7, wait about a minute (Dami picks you, the members approve), then accept and
pay 20 USDC; list your own slot 6 and a simulated buyer asks within a minute.

**Design questions** (for the designer): the approval counts disagree (02 "4 of 5", 06 "3 of 4
required · 5 eligible", 07 "4 of 5"); there's no screen for the incoming member signing the transfer
(step 4 of "How takeover works"), and none for approved-unsigned, rejected or expired takeovers, or
for "My listings"; 07's receipt copy is a placeholder ("Demo receipt · TX-SLOT-005").
