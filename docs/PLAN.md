# Plan: MVP 2 — governance, defaults and recovery

Brief: https://docs.google.com/document/d/1PBheqZumL-k_8tWr7DAUegv-nUQmGVJd-r1vpIKis5k (text copy:
`mvp2-brief.txt`). Backend: the Railway API, https://saji-backend-production-0025.up.railway.app/docs
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
