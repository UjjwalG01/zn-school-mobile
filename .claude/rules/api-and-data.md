# API and Data Rules

## 1. Contract Source

The backend repo's `docs/api/ENDPOINTS.md` is the endpoint source of truth. This repo's
`docs/api/API_CONTRACT.md` lists only what the app uses. If they disagree, the backend doc wins —
report the drift.

---

## 2. Tenant Context

- Every tenant-scoped call carries `tenantId` (query string; body for create `POST`s), exactly as
  the web client does. There is no tenant header and no tenant claim in the token.
- `tenantId` comes only from `GET /tenancy/my-schools`.

---

## 3. Errors

Parse the backend envelope `{statusCode, errorCode, message, error, timestamp, path}` into one
`ApiError` type. Branch on `errorCode`, never on `message` text. Required handling is listed in
`docs/api/API_CONTRACT.md` §4.

---

## 4. Request Budget (keep the server light)

1. Prefer one aggregated call (`/portal/*/home`) over several on a screen's first load.
2. Prefer bulk writes over N single writes (attendance for a whole section = one request).
3. No polling. No timers that fetch. Refresh = app foreground (throttled) or pull-to-refresh.
4. Paginate every list that can grow (payments, invoices, attendance history).
5. Do not refetch on every focus; respect `staleTime`.
6. Download PDFs only from **reprint** (`GET`) endpoints and cache them on device.

---

## 5. staleTime Classes

| Class | Examples | staleTime | Persist to disk |
|---|---|---|---|
| Reference | classes, sections, subjects, exam list, routine | 6 h | yes |
| Daily | roster, today's attendance, assignments | 5 min | yes |
| Financial | financial position, invoices, payments | 2 min | yes (wiped on logout) |
| Results | published results | 30 min | yes |
| Session | `/identity/me`, my-schools, my-permissions | 15 min | yes |

Changing a class's value is a reviewed change, not a per-screen tweak.

---

## 6. Writes

- Writes are online-only until roadmap M6.
- Disable the submit button while in flight; send an idempotency-safe payload (bulk upserts).
- Send `version` where the endpoint uses optimistic concurrency; on `CONCURRENCY_VERSION_CONFLICT`
  refetch and show the conflict — never auto-overwrite.
- After a successful write, invalidate only the affected query keys.

---

## 7. Read-after-write

Teacher screens that show data just written must read from endpoints served by the **primary**
database (see `docs/database/DATA_ACCESS.md`), or use the write response, never a replica-served
endpoint.
