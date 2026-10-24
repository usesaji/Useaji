# Backend answers for the frontend

Date: 2026-10-23. This answers the frontend's list item by item and tells you what to change in the app.

**Not covered:** your list arrived without item 1 (it started part-way through item 2). Send item 1 again and we will answer it.

Every path below is under `/v1` except `/health`.

---

## A. Blocking

### 2. Admin filters as query parameters: done

You can use these now. The OpenAPI spec lists them.

| Route | Parameter | Behaviour |
|---|---|---|
| `GET /users` | `search` | A full user id matches that user only. Any other text matches part of the email and ignores case. `%` and `_` are plain characters. Spaces at either end are removed, and an empty value is ignored. |
| `GET /users` | `role` | `user` or `admin`. Any other value returns 400. |
| `GET /audit-logs` | `action` | Exact match, for example `auth.login`. |
| `GET /audit-logs` | `actorId` | UUID of the user who acted. |

All of these work together with `page` and `limit` (at most 100).

**Frontend:** show the search box and the filters again. Stop building views from the newest 100 records.

### 3. Typed audit log entries: done

`GET /audit-logs` now returns `AuditLogDto` items:

```ts
interface AuditLogDto {
  id: number;                    // increasing integer, not a UUID
  action: string;                // see the list below
  actorId: string | null;        // null for anonymous events, e.g. a failed login
  actorEmail: string | null;     // null when anonymous or the user no longer exists
  resourceType: string | null;   // 'user' | 'group' | 'refresh_token_family' | ...
  resourceId: string | null;
  ip: string | null;
  requestId: string | null;
  traceId: string | null;
  metadata: Record<string, unknown>; // shape depends on the action
  createdAt: string;             // ISO date
}
```

Your guessed shape differs from this one:
- `targetType` and `targetId` are named `resourceType` and `resourceId`.
- There is no `userAgent`. The API does not store it.
- `requestId` and `traceId` are added. Show them on the detail view, because support uses them to find the request in the server logs.

These are the `action` values the API writes today. More may be added later, so show an unknown action as raw text.

```
auth.register  auth.login  auth.login_failed  auth.logout  auth.refresh
auth.refresh_reuse_detected  auth.google_linked  auth.password_set
auth.password_changed  auth.password_reset
security.settings_updated  profile.update
wallet.linked  wallet.disconnected  wallet.destination_added
wallet.destination_primary  wallet.destination_removed
group.created  group.updated  group.cover_updated  group.invite_rotated
group.join_requested  group.join_approved  group.join_rejected  group.joined
group.left  group.member_removed  group.ban_lifted  group.governance_updated
group.started
```

Useful `metadata` keys:
- `auth.login` from Google: `{ method: 'google' }`.
- `auth.login_failed`: `{ email }`.
- `group.updated`: `{ fields: string[] }`.
- `security.settings_updated`: the new settings.

### 4. Testing a real contribution: needs the backend team, no code change

The code has no blocker. The missing piece is test money. Pick one of these options:

1. **Backend sends Testnet USDC:** send us a test wallet address. The wallet must already have a USDC trustline to issuer `GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5`. The backend team will fund it.
2. **Staging on XLM:** we deploy a staging API with `STELLAR_ASSET_CODE=XLM`. Friendbot (`https://friendbot.stellar.org?addr=G...`) then funds any test wallet with no captcha.

For option 2, keep in mind:
- The group still shows `asset: "USDC"`, because that field is only a label.
- `payment.assetCode` in `CycleDto` and `DefaultDto` is the asset to send. Always build the payment from `payment` (`destination`, `assetCode`, `assetIssuer`, `amount`, `memo`). Never hard-code USDC.

The flow is the same for both routes:
1. Pay `payment.amount` of `payment.assetCode` to `payment.destination`, with `payment.memo` as the text memo. Pay from the wallet that is linked to the account.
2. Send the transaction hash: `POST /groups/{id}/contributions` with body `{ txHash }`, or `POST /groups/{id}/defaults/{defaultId}/settle` with body `{ txHash }`.

### 5. Google sign-in: configuration, no code change

`POST /auth/google` accepts ID tokens for every client id listed in the `GOOGLE_CLIENT_IDS` environment variable (comma-separated). The backend `.env` already contains `95180940354-38d093do0k4p2ah8a4u8vt4osf9pbckh.apps.googleusercontent.com`. The backend team will check that every deployed environment has it too.

The API also rejects a token with 401 when the Google account's `email_verified` is not true.

The owner of the Google Cloud project still has to add `http://localhost:3000` to the authorised JavaScript origins.

---

## B. Spec fixes: done

### 6. Error codes
All of these are now in the spec:

| Route | Codes added |
|---|---|
| `POST /auth/login` | 400 |
| `POST /wallet/link` | 400 (also when the password is missing), 401 |
| `POST /wallet/destinations` | 400 |
| `PUT /wallet/destinations/{id}/primary` | 400 |
| `DELETE /wallet` | 400, 401 |
| `PATCH /groups/{id}` | 404 |

### 7. Reset link description
The spec now says `/reset-password#email=...&token=...`. Both values are URL-encoded.

**Frontend:** parse the fragment with `new URLSearchParams(location.hash.slice(1))`. Then send `email`, `token` and the new password to `POST /auth/password/reset`. Before you load any third-party script, remove the fragment from the address bar with `history.replaceState(null, '', location.pathname)`.

### 8. `/health`
On 200, `data` is a `HealthDto`:

```json
{ "status": "ok",
  "info":    { "database": { "status": "up" }, "redis": { "status": "up" } },
  "error":   {},
  "details": { "database": { "status": "up" }, "redis": { "status": "up" } } }
```

On 503, the body is the standard error body. Its `message` names the dependencies that failed, for example `"Unavailable: redis"`.

---

## C. Behaviour fixes

### 9. Clearing a late fee: done
`PATCH /groups/{id}` now accepts `lateFeeFixed: "0"`, and `lateFeePercent: "0"` still works. Either one removes the fee, and the response has `lateFee: null`.

### 10. Permission before validation on `PATCH /groups/{id}`: done
The API now checks the caller's role before it reads the body:

| Caller | Status | Notes |
|---|---|---|
| Not a member | 404 | Body is not checked |
| Member, not admin | 403 | Body is not checked |
| Admin | 400 | Only when the body is invalid |
| Admin | 409 | After the cycle has started |

### 11. Sender address: needs the backend team, no code change
The sender comes from the `MAIL_FROM` environment variable, which is now `no-reply@usestellance.com`. To switch to a Saji address:
1. Verify `usesaji.com` (or a subdomain such as `mail.usesaji.com`) in Resend.
2. Add the SPF and DKIM DNS records that Resend gives.
3. Set `MAIL_FROM="SAJI <no-reply@usesaji.com>"`.

If we switch before the domain is verified, every email fails. Some disposable inboxes, mail.tm among them, block mail from any domain they do not trust. Test with Gmail or Outlook instead.

---

## D. Answers

### 12. Is the late fee in `myAmountDue` and `DefaultDto.amount`?
Yes, in both, but only after the deadline:
- `CycleDto.myAmountDue`: the contribution alone up to `deadline`. Between `deadline` and `graceEndsAt`, the contribution plus the late fee. After `graceEndsAt` it is null, because the miss is now a default.
- `DefaultDto.amount`: the amount owed when the grace period ended. It includes the late fee.
- Exception: groups with `missedGracePolicy: "start_recovery"` have no grace window. Their misses become defaults at the deadline itself, so `DefaultDto.amount` is the contribution with no late fee.
- A percentage fee is `contribution × percent / 100`, cut (not rounded) to 7 decimals.

Always show the API value. Do not calculate it in the app.

### 13. Does this round's recipient pay into their own round?
Yes. Every member on the schedule owes every round, the recipient included. `CycleDto.contributions` lists the recipient too, so the mock is wrong to leave them out. The payout is the sum of all contributions paid that round, the recipient's own included.

### 14. What happens when `graceUntil` passes and the member still has not paid?
Nothing happens automatically:
- The default stays open, and the group stays in recovery. Payouts stay blocked.
- `availableActions` lists all three actions again: `grace_extension`, `write_off`, `remove_member`. While a grace period runs, it lists only `grace_extension`, and the new date must be later than the current one.
- The member can still settle at any time while the default is open, during the grace period or after it. `DefaultDto.payment` shows how.

**Frontend:** when `graceUntil` is in the past, show the recovery actions again. Use `availableActions`, not the clock.

### 15. Does a write-off pay the round out short?
Yes. The payout is the sum of the contributions actually paid, so the recipient gets less by the written-off amount. If the written-off member has not received their own payout yet, they move to the last slot of the schedule. They still owe every later round.

### 16. Are a removed member's past contributions refunded?
No. Their past contributions stay in the pool and go out with the normal payouts.
- If they had not been paid out yet, their slot is deleted and everyone after them moves up one round. `totalRounds` goes down by one.
- If they had already been paid out, their slot stays as history.
- Their open defaults are closed as `member_removed`.
- On open proposals where they have not voted yet, they leave the electorate, and the number of votes needed shrinks to match. Votes they already cast still count.

### 17. Does `approved` last only when execution failed?
Yes:
1. A proposal runs as soon as the vote approves it.
2. It stays `approved` only when that first run failed.
3. The scanner then retries it, and any member can retry with `POST /groups/{id}/proposals/{proposalId}/execute`.
4. If it has not run by `executeBy` (the group's `executionWindowHours` after approval), it becomes `expired`.
5. If group state changes so that the proposal can never run, for example the default it targets was settled, it expires at once.

**Frontend:** show a "Retry" button only when `status === 'approved'` and `executeBy` is in the future.

---

## Notifications: plain HTTP, no SSE or WebSocket

The existing endpoints are enough, and nothing new is needed:

| Call | Use |
|---|---|
| `GET /notifications/unread-count` | Cheap badge poll; returns `{ unread }` |
| `GET /notifications?page=1&limit=20` | The list (`&unreadOnly=true` for the Unread tab) |
| `POST /notifications/{id}/read` | Mark one read when it is opened |
| `POST /notifications/read-all` | "Mark all as read" |

Recommended flow:
1. Poll `unread-count` every 30 seconds while the tab is visible. Stop polling when `document.visibilityState === 'hidden'`. Poll once immediately when the tab becomes visible again.
2. Fetch the list only when the bell opens, or when the count has gone up since the last poll.
3. After a user action that creates notifications (vote, contribute, join), call `unread-count` once instead of waiting for the next poll.
4. Deep links come from `data`. Every kind has `groupId`. Some kinds also have `round`, `proposalId` or `userId` (see `NotificationDto.data` in the spec).
5. On 401, refresh the session as for any other call. Do not retry in a tight loop.

---

## E. Later: not built yet

| Item | Status |
|---|---|
| Fuller admin user record, stats, admin actions, admin views of groups / cycles / defaults / escrow, chain-sync and scanner status in `/health` | Not started. Tell us which screen comes first. |
| Notification push channel | Not planned. Use HTTP polling as described above. |
| Proposal title and voter list on `ProposalDto` | Not started. |
| Saving the payout order before Start | Not started. Today it is sent only in `POST /groups/{id}/start` as `schedule` (user ids, first recipient first). It is needed for `manual` and `custom` orders, and ignored for `random` and `vote`. Keep it in client state until Start. |
| Change email, delete account | Not started. |
| Governance on Soroban | Product decision, still open. Today proposals and votes live in the database. Each event is anchored by a Stellar transaction (`txHash`), and money moves as plain payments to an escrow account. |

---

## Changes to make in the app now

1. Admin console: turn on user search, the role filter, and the audit `action` / `actorId` filters. Map audit rows with `AuditLogDto`: use `resourceType` / `resourceId`, drop `userAgent`.
2. Reset page: read `email` and `token` from the fragment, clear the fragment, then post both values with the new password.
3. Group settings: send `lateFeeFixed: "0"` or `lateFeePercent: "0"` to remove the late fee.
4. Group settings: on `PATCH /groups/{id}`, expect 403 or 404 for non-admins, whatever the body contains.
5. Cycle screen: include the recipient in the contributors list. Take amounts and payment details from `myAmountDue`, `DefaultDto.amount` and `payment`.
6. Recovery: drive the actions from `availableActions`. Show "Retry" for `approved` proposals until `executeBy`.
7. Notifications: poll `unread-count` every 30 seconds while the tab is visible, and fetch the list on demand.
8. Health widget: read `info` and `error` from `data`. On 503, show the error `message`.
