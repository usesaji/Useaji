@AGENTS.md

# Saji

Community savings (ajo / esusu) on Stellar Testnet. MVP 2: group governance —
proposals, votes, approval thresholds, executed decisions — and missed-contribution recovery. Now
v3 (`docs/v3-brief.txt`): slot marketplace / takeover and personal savings plans.
**Scope and screen map: `docs/PLAN.md` (MVP 2, then v3). What the backend still needs: `docs/BACKEND-GAPS.md`.**
Structure mirrors `../blockstag-v2`; when in doubt about a convention, check how it did it.

## Monorepo

Turborepo + pnpm 12 (`packageManager`), Node ≥ 22.

```
apps/web/       (:3000) app.usesaji.com — auth /auth, dashboard /overview, groups, governance, wallet
apps/landing/   (:3002) usesaji.com — the public site
apps/admin/     (:3001) admin.usesaji.com — the admin console (users, audit log, health)
packages/ui/    @repo/ui — design tokens, shared components, logo (fonts load in each app)
packages/eslint-config, packages/typescript-config
docs/           brief, OpenAPI spec copy, plan, backend gaps
```

`pnpm dev` (all three) · `pnpm build` · `pnpm check-types` · `pnpm lint` (UI package: `--max-warnings 0`)
· `pnpm format` (prettier: tabs, width 130). Web only: `pnpm --filter web test:mock` (the MVP 2 journey
and v3 (slots, personal savings, the faucet) through the real client and the mock, 129 checks) · `check:api` (app calls vs `docs/openapi.json`) ·
`api:types` (regenerate `src/lib/api/schema.d.ts` from the spec).

## Deployment (Vercel Services)

One Vercel project, three services, routed by host in root `vercel.json`: `app.usesaji.com` → `web`,
`admin.usesaji.com` → `admin`, `usesaji.com` → `landing`. Previews have one host, so there `web` sits at
`/app` and `admin` at `/admin` (basePath set by each `next.config.ts` when `VERCEL_ENV=preview`, exposed
as `NEXT_PUBLIC_BASE_PATH`). Links
between apps are plain `<a>`: landing → `APP_LINKS` (`apps/landing/src/lib/site.ts`), web →
`LANDING_URL` (`apps/web/src/lib/site.ts`).

## Stack

Next.js 16 (App Router, React Compiler, Turbopack), React 19, Tailwind v4, TanStack Query, zustand,
react-hook-form + zod 4, axios (`apps/web/src/lib/api/client.ts`), react-icons + lucide, sonner
toasts (Saji-styled, `@repo/ui/sonner`), Base UI / Radix primitives, `@creit.tech/stellar-wallets-kit`
+ `@stellar/stellar-sdk` (wallets, payments), openapi-typescript (DTO types).

## Data

- **Backend:** the Saji API at `https://pay.usesaji.com` (`docs/openapi.json`; refresh from `<api>/docs-json`, then
  `pnpm --filter web api:types`). Routes under `/v1`. Success `{ statusCode, message, data }`; lists
  put `{ results, paginationMeta }` in `data` (`?page&limit`, limit at most 100); errors
  `{ statusCode, code, message, details?, requestId }` → `ApiError` (a "Validation failed" shows its
  first `details` message).
- **The web app is live on the API** (`lib/api/source.ts`). The browser calls `/api/v1/*` on its own
  origin, rewritten in `apps/web/next.config.ts` to the API (`API_PROXY_TARGET`). Wallets follow the
  API: real ones (Stellar Wallets Kit, Testnet) live. `NEXT_PUBLIC_API_SOURCE=mock` switches to the
  mock (offline demos, `test:mock`) with its simulated wallet. The admin console works the same way
  (live by default, `/api/health` proxied to the API's root). The backend URL is `API_PROXY_TARGET`
  (with `/v1`) in each app's `.env.local`; it defaults to `https://pay.usesaji.com/v1`, so Vercel needs nothing.
- **The API rejects undeclared query parameters** (400 "property x should not exist"): send only
  what the spec declares for a route (`pnpm --filter web check:api` checks routes, not parameters).
- **Everyone pays every round, the round's recipient included**; the payout is the sum paid that round.
  Amounts (late fee included) come from the API (`myAmountDue`, `DefaultDto.amount`), never computed.
- **Payouts go straight to `WalletSummaryDto.payoutAddress`** (the primary withdraw destination, else
  the linked wallet). Groups hold no balance for you: no group withdraw flow, only "Paid out to you" and
  where payouts go (`/profile/withdraw-info`, "Payout Addresses").
- **Personal savings (v3, `features/savings`, `/savings/*`)** are the exception: each goal holds a
  balance in the shared savings contract (`SAVINGS_CONTRACT`). In the API (`PlanDto`; guide:
  `docs/frontend-integration.md` §4–5). Deposits come from the plan's `ownerAddress`; withdrawals are
  signed by it and only ever go back to it. `lock` is `flexible`, `until_date`, `until_target` or
  `until_date_or_target` (copy in `features/savings/copy.ts`); `canWithdraw` decides the button.
  Money moves as **prepare → the wallet signs the API's XDR (`kit.signTransaction`) → confirm**;
  a confirm 503 is retried with the same signed transaction (safe, recorded once); then the plan is
  re-read (the contract has the balance). `ownerAddress: null` = the API's simulated mode
  (`{ amount }` only). The mock prepares its own readable "XDR" (`mocks/xdr.ts`) that the simulated
  wallet signs. The dashboard total is `GET /savings/overview` ("contributed & saved").
- **Test USDC (testnet):** Saji issues its own (`USDC_ISSUER`). The wallet card's setup button
  (`useGetTestUsdc`): Friendbot if the account isn't on Testnet, the faucet's trustline transaction
  (the wallet signs *and submits* it), then `POST /faucet/usdc` (1000, once an hour). The faucet
  answers 404 when off (`useFaucetAvailable`), and then the UI hides it.
- **Slot marketplace (v3, `features/slots`, `/groups/marketplace` (`?mine=1`), `/groups/marketplace/[listingId]`,
  `/groups/[id]/{slot/list,transfers}`)**, on the API (`ListingDto` & co.; guide §6). A slot is one round
  of `cycle.schedule` (`position` is 0-based: show `position + 1`). Flow: a member of an active, public
  group lists it with an `askingPrice` ("0" gives it away) → outsiders request it → the seller picks one
  (`…/select`), which opens a **`slot_transfer` proposal** (every member but the seller votes; the
  ordinary proposal screens show it, `ProposalDto.slotTransfer`) → once executed, the buyer accepts
  before `transfer.approval.expiresAt`: prepare (co-signed by Saji for ~2 minutes) → sign → accept.
  The buyer joins at the seller's position, the seller leaves; records stay with whoever paid them
  (`coveredByPreviousHolder`). Checklists come from the API (`GET /groups/{id}/slots/eligibility`,
  `listing.buyerEligibility`; `checkLabel` words passing checks). The listing page serves every role
  (seller, chosen buyer, member, outsider); the circle page shows `SlotPanel`. Mock rules: `mocks/slots.ts`
  (votes run through the engine's proposals). Signing shared with savings: `features/wallet/transactions.ts`
  (a confirm 503 is retried with the transaction's hash; 400 "prepare and sign it again" = a lapsed signature).
- **Screens read the API's DTOs directly** (`lib/api/dto.ts`, names from the generated
  `schema.d.ts`) — no app-side mapping. A backend change shows up as type errors.
- **Each feature's `api.ts` is the only seam**: typed functions, one per endpoint, calling
  `apiGet/apiPost/…`. In mock mode `lib/api/client.ts` installs the mock adapter
  (`src/mocks/adapter.ts`), which answers every route in the browser with the API's envelopes, status
  codes and error bodies. So the feature code is the same in both modes.
- **The mock** (`src/mocks`): one JSON document in localStorage (`saji-mock-db`; `db.ts`), a route
  table per domain (`handlers/*.ts`, `route("GET", "/groups/:id/cycle", …)`; a route the API lacks is
  marked `notInApi` with the reason), DTO builders (`dto.ts`) and the rules engine (`engine.ts`):
  rounds, late fees, payouts, default detection after grace, recovery, proposals, thresholds,
  execution, pause/resume. Before each request the engine catches up to "now", and **simulated
  members** pay, vote and ask to join on their own (they stop one vote short so a person decides).
  The seed replays history through the engine (`seed.ts`). The **mock clock** (`clock.ts`,
  `saji-mock-clock`) is real time plus the dev panel's "skip ahead", which `lib/use-now.ts` follows.
- **Dev panel (mock mode only):** the "Mock data" pill (bottom left): demo login, skip ahead +1h / +1d / +3d / +1w,
  reset. Demo account `demo@usesaji.com` / `Password1` (Ada); sign-up codes: any 4 digits but 0000;
  "Continue with Google" without a client id signs into a mock Google account (live, it's hidden).
- **Live test accounts:** sign up with any inbox that accepts mail from `no-reply@usestellance.com`
  (codes arrive in seconds; mail.tm addresses never get them).
- **Session:** `features/auth/session.ts` (zustand, persisted as `saji-session`, synced across tabs):
  access + single-use refresh token, rotated one at a time across tabs (Web Lock); only a 401 ends
  the session. `RequireSession` gates the dashboard and sends a profile-less account to Create Profile.
- **Wallet** (`features/wallet`): `kit.ts` is what screens call. Live: Stellar Wallets Kit
  (`stellarKit.ts`): the kit's picker, SEP-53 `signMessage` to link (`/wallet/challenge` → sign →
  confirm it's you → `/wallet/link`), payments built client-side from `CycleDto.payment` (or
  `DefaultDto.payment` to settle a missed one: escrow, amount, memo), signed by the wallet and
  submitted to Horizon; the hash goes to the API. Mock mode: a simulated wallet (500 test USDC).
- **Re-authentication:** changes to where money goes (link / unlink a wallet, add a destination, make
  one primary) carry `currentPassword` or `googleIdToken` (`ReauthDto`). Call them through
  `withIdentity(reason, run)` (`features/auth/reauth.tsx`), which opens the "Confirm it's you"
  dialog; send them with `{ credentialCheck: true }` so a wrong password (401) doesn't sign out.
- **Names:** `features/groups/use-names.ts` — the name on the `MemberPreviewDto`, else the member
  list, else the @tag.

## Domain rules

- Non-custodial: never store keys or seed phrases. The wallet signs; Horizon / the API submit.
- A group is `forming` (members join, admin sets approval rules, then Start) → `active` → `completed`.
  Paused and in-recovery are cycle states (`CycleDto.paused`, `inRecovery`), not group statuses.
- Proposal status is the API's: `active` → `approved` (only if execution failed; retry until
  `executeBy`) → `executed`, or `rejected` / `expired`. Pills and copy come from one mapping
  (`features/governance/copy.ts`), never decided in components.
- Mutations never auto-retry (`retry: false` in `ReactQueryProvider`): a retried contribution could pay twice.
- Keep blockchain detail secondary in copy ("Contribution sent"), with the transaction link available.

## Design system (`packages/ui`)

Saji's palette in `src/styles/globals.css`: primary `#4100F5` (scale `primary-*`), secondary
`#76E8FF`, accent `#FF0084` (missed payments, recovery), neutral `#181D25`, success / error / warning
scales. Role tokens: `ink`, `ink-muted`, `line`, `line-soft`, `surface`, `panel` (`#F8F8F8` cards).
Light only — the designs have no dark mode. Font: DM Sans, loaded by each app's root layout into
`--font-dm-sans`. Motion (all off for reduced motion), tuned per app: landing is expressive
(`animate-word` headline, `data-reveal` scroll reveals via `RevealObserver`, `animate-float`,
`AnimatedNumber startOnView`); web is purposeful (`animate-rise` lists staggered by `--i`,
`animate-grow` progress bars, `AnimatedNumber` money, `animate-pop` successes, `animate-drop` alerts,
`animate-ping-soft` for what needs you); admin is quiet (`animate-fade` pages and rows, counting stat
tiles, a live health dot). Import as
`@repo/ui/<file>`; `Button` takes `asChild` for links (`LinkButton` in each app wraps it).

## Conventions

- Feature folders: `src/features/<domain>/{api.ts, hooks.ts, components/, …}`. `src/app/**` pages
  stay thin-ish; layout pieces live in `src/components/layouts`.
- Named exports for components; route files (`page.tsx`, `layout.tsx`) keep default exports.
- Every `<form>` using `form.handleSubmit` needs `noValidate`.
- A hand-rolled modal (`fixed inset-0` backdrop) renders inside `<BodyPortal lockScroll>` (`@repo/ui/body-portal`):
  the page wrapper animates, which traps `fixed` children in its box and under the header and nav.
- Never `setState` synchronously in `useEffect`, never read the clock or storage during render — use
  `useNow()` / `useSyncExternalStore` (React Compiler lint).
- A component using `useSearchParams` needs a `<Suspense>` boundary above it (`(dashboard)/loading.tsx`
  covers dashboard pages).

## Landmines (from blockstag)

1. pnpm strict linking: a package imported in a file must be a dependency of _that_ workspace package.
   `next/*` imports stay in the apps, never in `@repo/ui`.
2. Restart the dev server after `pnpm install`.
3. A new dependency with build scripts → list it under `allowBuilds` in `pnpm-workspace.yaml`
   (pnpm 12 fails the install otherwise).
4. Never run `next build` into `.next` while `pnpm dev` runs: `NEXT_DIST_DIR=.next-verify npx next build`.
5. Next 16 error boundaries get `retry()` (not `reset()`). Route params are Promises in server
   components (`PageProps<"/route">`).

## Admin console (`apps/admin`)

Same stack and seam as web, its own session (`saji-admin-session`). On the live API by default;
`NEXT_PUBLIC_API_SOURCE=mock` uses its own mock (`saji-admin-mock-db`; `src/mocks/adapter.ts`, demo
`admin@usesaji.com` / `Password1`). Sign-in is the app's login, refused unless `role: admin`. Pages:
overview, users (search, role), a user and their audit trail, audit log (`?action=`, live), health.
`AuditLogDto` and `HealthDto` come from the spec; a down dependency is a 503 whose message names it
("Unavailable: redis", kept as `ApiError.serverMessage`). What admin still needs: BACKEND-GAPS, "Later". Shared pieces: `components/Console.tsx` (PageTitle, StatTile, DataTable,
FilterPills); tones and pills from `@repo/ui/panel`.
