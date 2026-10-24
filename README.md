# Saji

Community savings (ajo / esusu) on Stellar Testnet: save in groups, see who's paid, and decide
together — proposals, votes and missed-contribution recovery (MVP 2).

Turborepo + pnpm monorepo:

| Path | What | Dev URL |
|---|---|---|
| `apps/web` | The app: auth, groups, governance, recovery, wallet (app.usesaji.com) | http://localhost:3000 |
| `apps/landing` | Marketing site (usesaji.com) | http://localhost:3002 |
| `apps/admin` | Admin console: users, audit log, health (admin.usesaji.com) | http://localhost:3001 |
| `packages/ui` | `@repo/ui`: design tokens, shared components, logo | — |
| `packages/eslint-config`, `packages/typescript-config` | Shared configs | — |

## Getting started

Requires Node ≥ 22 and pnpm 12 (`corepack enable`, or pnpm ≥ 11 switches itself, from `packageManager`).

```bash
pnpm install
pnpm dev            # all three apps
pnpm --filter web dev
```

The app talks to the **Railway API** (Stellar Testnet) — nothing to configure. Sign up with a real
inbox (the code arrives by email) and link a Testnet wallet (Freighter, xBull, Albedo or LOBSTR).
Contributions are real Testnet USDC: fund the wallet with Friendbot, add the USDC trustline from the
wallet card, and get test USDC from Circle's faucet.

For an offline demo, set `NEXT_PUBLIC_API_SOURCE=mock` in `apps/web/.env.local`: sign in as
`demo@usesaji.com` / `Password1` and use the "Mock data" pill (bottom left) to skip the clock ahead or
reset. The admin console still runs on its own mock: `admin@usesaji.com` / `Password1`.

```bash
pnpm check-types
pnpm lint
pnpm build
pnpm --filter web test:mock   # the MVP 2 journey end to end against the mock
pnpm --filter web check:api   # which API routes the app uses, and which it needs that don't exist
```

Conventions and data flow: [CLAUDE.md](CLAUDE.md). Scope: [docs/PLAN.md](docs/PLAN.md). Before
connecting the backend: [docs/BACKEND-GAPS.md](docs/BACKEND-GAPS.md). API spec: [docs/openapi.json](docs/openapi.json).
