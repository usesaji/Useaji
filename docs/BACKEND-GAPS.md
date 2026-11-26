# What the backend needs to do

**As of October 24, 2026.** API: https://saji-backend-production-0025.up.railway.app/docs
(spec copy: `docs/openapi.json`, 68 routes). The backend's answers to an earlier list are in `doc.md`;
this file is what is still open.

**Where things stand:** the web app and the admin console are connected to this API and were tested
end to end with two real accounts (`tlayefaah@gmail.com`, an admin, and `stellardev002@gmail.com`):
sign-up, profiles, wallets, creating a group, joining by invite, approving, editing settings,
starting the cycle, the round, a proposal voted through and carried out, notifications, history,
payout addresses, removing and leaving, and the admin console (search, role filter, a user's
activity, the audit log filter, health). Everything worked, and every live response matches the spec.

**Real payments work too.** With the Testnet USDC you sent, both members paid round 1 (10 USDC each,
built and submitted exactly as the app does); the API recorded both, refused a reused hash (409) and
a hash from the wrong round (400 "Memo must be "saji r1""), paid the recipient 20 USDC with a
confirmed `txUrl`, and opened round 2. Wallet totals, the overview's `nextDue` and the savings history
all followed. Still untested: settling a missed contribution — it needs a deadline to pass (on our
side, nothing for you to do).

**Done since the last list:** `GET /users` and `GET /audit-logs` document their 400s, and an invalid
`role` now says "role must be one of the following values: user, admin". Before that: Testnet USDC,
the admin account, admin filters, `AuditLogDto`, the missing error codes, `HealthDto`, clearing a late
fee, permission before validation on `PATCH /groups/{id}`, and answers to all six questions.

**Resolved for testing (as they are):** Google sign-in works with the current client, and emails keep
coming from `no-reply@usestellance.com`. Both are fine while we test; revisit before launch (a Saji
sender address, and `http://localhost:3000` in the client's origins if local Google sign-in is wanted).

**Nothing is blocking.** What's left is below.

---

## v3: Slot marketplace & takeover (new, proposed shapes)

The app's screens for slot trading are built on the mock (`apps/web/src/mocks/slots.ts` has the
rules; the shapes are in `lib/api/dto.ts`, marked PROVISIONAL). **A slot** is one round of a running
group's payout schedule, and its owner receives that round's payout. Adjust the shapes freely.

| Route | Body → answer | Rules the app relies on |
|---|---|---|
| `GET /slots/listings` | `?mine&page&limit` → page of `SlotListingDto` | The marketplace shows `open` + `pending` listings across groups. `mine=true` shows the caller's own, any status. |
| `GET /slots/listings/{id}` | → `SlotListingDto` | Includes the caller's `eligibility` (checks, `canRequest`) and the request under review. |
| `DELETE /slots/listings/{id}` | → `SlotListingDto` | Seller only. 409 while a request is under review. |
| `GET /groups/{id}/slot` | → `MySlotDto` | The caller's slot in a running group, the checks for listing it, and the open listing. 404 when they have no slot left to collect. |
| `POST /groups/{id}/slot/listings` | `{ expiresAt, reason? }` → `SlotListingDto` | 409 unless: the group is running (not paused), the seller has no open missed contribution, the slot's round hasn't opened, and the slot has no other live listing. 400 if `expiresAt` isn't in the future, is more than 30 days out, or isn't before the slot's round opens. |
| `POST /slots/listings/{id}/takeovers` | → `SlotTakeoverDto` | 409 unless the caller has a linked wallet, isn't in the group (**one slot per person per group**), has no other open request in the group, and isn't banned. Opens a vote: every member except the seller, at the group's governance threshold, ending at the listing's `expiresAt`. |
| `GET /slots/takeovers` | `?mine&page&limit` → page | `mine=true`: requests the caller made. |
| `GET /slots/takeovers/{id}` | → `SlotTakeoverDto` | Visible to the requester, the seller and group members. |
| `POST /slots/takeovers/{id}/votes` | `{ choice: "yes"\|"no" }` | Reviewers only, final. Reaching the threshold → `approved` (sign by `executionWindowHours`). Unreachable → `rejected`, and the listing reopens. |
| `POST /slots/takeovers/{id}/sign` | `{ signature }` | Requester only, while `approved`. Rechecks: the slot still belongs to the seller, its round hasn't opened, the seller owes nothing missed, and the requester holds no slot in the group. Then the schedule entry moves, the requester joins and the seller leaves. |
| `DELETE /slots/takeovers/{id}` | → `SlotTakeoverDto` | The requester withdraws their request. |
| `GET /groups/{id}/slot-transfers` | `?page&limit` → page | Every request in the group, newest first. |

**History is preserved.** Contributions stay recorded against whoever paid them. A round the previous
owner already paid counts for the new owner, so nobody pays it twice. `SlotTakeoverDto.history`
lists the slot's contributions by each owner, plus its payout (made or scheduled).

**Questions for you:**
1. **Approval.** We used a separate vote (members minus the seller, at the group's governance
   threshold). Would you rather make it a governance proposal type (`slot_transfer`)? That would
   reuse votes, expiry and history events. If so, the takeover screen can become a proposal screen.
2. **The Soroban transfer.** Who submits it? We assumed the incoming member signs (step 4 in the
   design). If the contract also needs the outgoing owner's signature, we'll add that step.
3. **Price.** The designs have no price for a slot, so a takeover transfers the position only. The
   new owner gets the full payout even though the previous owner paid earlier rounds. Is that intended,
   or should there be a settlement?
4. **Events and notifications.** `GroupEventDto.kind` and `NotificationDto.kind` have no slot
   kinds. The mock reuses the proposal notification kinds with a `takeoverId` in `data`. We'd like
   `slot_listed`, `takeover_requested`, `takeover_approved` and `slot_transferred`.

---

## v3: Personal savings (new, proposed shapes)

The v3 brief (`v3-brief.txt`) adds personal savings plans. The app's screens for them are built on
the mock. Below is the contract the app expects. Change anything you like: the shapes sit in one
section of `apps/web/src/lib/api/dto.ts` marked PROVISIONAL. Once they're in the spec, a regenerate
shows every screen your shapes affect.

| Route | Body → answer | Rules the app relies on |
|---|---|---|
| `GET /savings/summary` | → `{ asset, totalSaved, withdrawable, activePlans }` | Across the caller's plans. |
| `GET /savings/plans` | `?page&limit` → `{ results: SavingsPlanDto[], paginationMeta }` | Newest first. |
| `POST /savings/plans` | `{ name, kind: "flexible"\|"locked", targetAmount, targetDate? }` → `SavingsPlanDto` | 403 without a linked wallet (it becomes `ownerWallet`). `targetDate` is required for `locked` (it's the release date) and must be in the future. 409 for a duplicate name (our choice; drop it if you disagree). |
| `GET /savings/plans/{id}` | → `SavingsPlanDto` | 404 for someone else's plan. |
| `GET /savings/plans/{id}/transactions` | `?page&limit` → `{ results: SavingsTransactionDto[], … }` | Newest first, deposits and withdrawals. |
| `POST /savings/plans/{id}/deposits` | `{ amount, txHash }` → `SavingsTransactionDto` | Same as contributions: the wallet pays `plan.deposit` (destination, asset, memo) and you verify the hash. 409 when a hash is reused. |
| `POST /savings/plans/{id}/withdrawals` | `{ amount, signature }` → `SavingsTransactionDto` | Funds go **only** to `ownerWallet`. 403 while a locked plan is before `unlocksAt` (reaching the target doesn't unlock it). 400 above `withdrawable`. |

`SavingsPlanDto`: `id, name, kind, asset, targetAmount, targetDate, balance, withdrawable,
unlocksAt (locked only), progressPercent (0–100), ownerWallet, contractId, deposit (payment
instructions without amount; null = simulated), status, createdAt`. `SavingsTransactionDto`:
`id, planId, kind: "deposit"|"withdrawal", amount, asset, txHash, createdAt`.

**Questions for you:**
1. **Deposits into a Soroban contract.** Is a deposit a classic payment to an account (like group
   contributions, which the app already builds and signs), or a contract invocation the wallet signs?
   If it's an invocation, send us the unsigned transaction XDR (on the DTO, or from a
   `POST …/deposits/intent`) and we'll sign and submit it.
2. **Authorizing a withdrawal.** For now the app signs a message with the owner wallet and sends
   the signature. If the contract needs a signed invocation, use the same XDR pattern. Should
   withdrawals also need the password re-check (`ReauthDto`)? The funds can only go back to the
   owner wallet, so we don't think so.
3. **Activity and statements.** Should deposits and withdrawals appear in `/activity` and
   `/statements` (new `kind`s)? The app shows them on each plan's page for now.
4. **Contract addresses.** The brief asks for the Soroban contract addresses at submission. Is it
   one contract per plan (`contractId`), or one shared contract with a plan id?

---

## Later (not blocking)

| Item | Note |
|---|---|
| Admin: fuller user record, stats endpoint, admin actions (disable, unlock, change role, revoke sessions), admin views of groups / cycles / defaults / escrow, chain-sync and scanner status in `/health` | Order we'd like: **the user record** (name/tag, verified, Google-linked, wallet, group count, last sign-in, locked), then **stats** for the overview. |
| Proposal title and voter list on `ProposalDto` | Titles are built from the type today. |
| Save the payout order before Start | Kept in the app until Start, as you suggested. |
| Change email, delete account | — |
| Governance on Soroban | Product decision, still open. |

---

_How this was checked: the live spec was diffed against the app; live responses were validated
against the spec's schemas; the app was driven in a browser against Railway with real accounts.
Recheck the route list after a spec change with `pnpm --filter web check:api`._
