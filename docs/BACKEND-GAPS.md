# What the backend needs to do

**As of October 24, 2026.** API: https://pay.usesaji.com/docs (formerly the Railway URL; same service)
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

## v3: Slot marketplace — done

On the API and wired in the app: the marketplace (search and price filters on the server), "My
listings & requests", eligibility checklists for sellers and buyers, listing with an asking price,
requests, the seller's pick (a `slot_transfer` proposal), the co-signed accept, transfer history with
`paidBySeller` and `payout`, slot purchases and sales in Activity and statements, and the new
notifications and history events. Every question from the earlier proposal was answered by the
updated guide. Nothing open.

## v3: Personal savings — done

On the API since the v3 release and wired in the app (savings dashboard, goals with four locks,
prepare → sign → confirm deposits and withdrawals, Activity and statements, the test USDC faucet).
What's left is small, all spec vs guide (`frontend-integration.md`):

1. ~~Error codes missing from the spec~~ — fixed: the 429s, 503s and prepare 400s are in the spec now.
2. **The faucet's on/off state** can only be learned by calling `POST /faucet/trustline/prepare`
   (404 = off). A read-only signal (a `GET`, or a field on `/wallet`) would be cleaner.

The earlier proposal follows for the record.

## v3: Personal savings (earlier proposal, superseded)

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
