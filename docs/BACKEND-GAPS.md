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
