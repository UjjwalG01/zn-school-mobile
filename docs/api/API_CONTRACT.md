---
description: The subset of the ZN School backend API the mobile app uses, how to call it, and which endpoints are still proposed.
purpose: Mobile-side API contract; the backend repo's docs/api/ENDPOINTS.md remains the source of truth.
access: Read
---

# API Contract (mobile)

## Status

Designed. Endpoints marked **Exists** are implemented in the backend today (verified 2026-10-14).
Endpoints marked **Proposed (Bn)** need the backend item in `docs/backend/BACKEND_PREREQUISITES.md`
and must not be called from shipped code until Implemented.

---

# 1. Basics

| Topic | Rule |
|---|---|
| Base URL | `EXPO_PUBLIC_API_URL`. Routes are bare (no `/api`, no version prefix), e.g. `/identity/login`. |
| Auth | `Authorization: Bearer <accessToken>` on every non-public call. No cookies, no CSRF. |
| Tenant | `?tenantId=<uuid>` query param on tenant routes; in the JSON body for create `POST`s. Never in a header. |
| Format | JSON in/out. Success responses are raw JSON (no envelope). Paginated lists: `{ rows, total, page, pageSize }`. |
| Concurrency | Edits that carry `version` return `409 CONCURRENCY_VERSION_CONFLICT` on a stale version. |
| PDFs | `application/pdf`, `inline` disposition. Download to file, open with the OS viewer. |
| Dates | AD `YYYY-MM-DD` strings; timestamps ISO-8601 UTC. |
| Money | As returned by the API (string/decimal) — never compute balances client-side. |

---

# 2. Existing endpoints used

| Method & path | Auth | Use |
|---|---|---|
| `POST /identity/login` | Public | `{ email, password }` → `{ accessToken, refreshToken }`. B1/B2 add `identifier`, `clientType`. |
| `POST /identity/refresh` | Public | `{ refreshToken }` → new pair (rotation). |
| `POST /identity/logout` | Bearer | `{ refreshToken }` → 204. |
| `POST /identity/change-password` | Bearer | `{ currentPassword, newPassword, refreshToken? }` → 204. |
| `GET /identity/me` | Bearer | `{ id, email, fullName, isPlatformAdmin, sessionTimeoutMinutes }`. |
| `GET /tenancy/my-schools` | Bearer | `[{ tenantId, name, status, license{ status, tierName, validUntil, expiringSoon, modules } }]`. |
| `GET /tenancy/my-permissions?tenantId=` | Membership | `{ all, keys[] }` — UX hint only (ADR-0038). |
| `POST /tenancy/memberships/activate` | Public | `{ token, password? }` → `{ status: 'activated' }`. B3 adds `code`. |
| `GET /settings/tenant/mobile-modules?tenantId=` | Membership | mobile module visibility toggles. |

Staff-scoped endpoints that exist but the app **must not** use for guardians (they are school-wide):
`/students/*`, `/guardians/*`, `/finance/*`, `/academic/exam-results*`, `/attendance/records`
(read). Teacher screens may use the staff endpoints below until B7 lands, subject to B5 scoping:

| Method & path | Permission | Note |
|---|---|---|
| `POST /attendance/records` | `attendance.mark` | single student upsert — replace with bulk (B6) before M2 ships |
| `POST /academic/exam-results/entry` | `exam_result.save` | whole-student submission (all subjects) |
| `POST /academic/exam-results/bulk-entry` (+ `/validate`) | `exam_result.save` | batch, whole-student |
| `GET /academic/exam-sessions/:id/routine` | Membership | routine PDF reprint |

---

# 3. Proposed endpoints (do not call until Implemented)

| Method & path | Item |
|---|---|
| `POST /identity/login { identifier, password, clientType }` | B1, B2 |
| `POST /tenancy/memberships/activate { code, password? }` | B3 |
| `GET /portal/teacher/home` | B7 |
| `GET /portal/teacher/assignments` | B5, B7 |
| `GET /portal/teacher/sections/:id/roster?date=` | B7 |
| `GET /portal/teacher/exams/open` | B6 |
| `POST /attendance/records/bulk` | B6 |
| per-subject marks entry (path decided in ADR) | B6 |
| `GET /portal/guardian/home` | B7 |
| `GET /portal/guardian/students` | B4, B7 |
| `GET /portal/guardian/students/:studentId/{profile,attendance,financial-position,invoices,payments,results}` | B7, B8 |
| `GET /portal/guardian/invoices/:id/pdf`, `/payments/:id/receipt`, `/results/:id/marksheet`, `/exam-sessions/:id/routine` | B7 |

Shapes are defined by the backend ADR; record them here (and in the backend `ENDPOINTS.md`) when
implemented.

---

# 4. Error handling

Envelope: `{ statusCode, errorCode, message (string | string[]), error, timestamp, path }`.

| errorCode / status | App behavior |
|---|---|
| `401` (any non-auth route) | single-flight refresh + replay once; then logout |
| `401` on `/identity/refresh` | logout ("session expired") |
| `NETWORK_ERROR` (client-side, status 0) | offline banner; reads from cache; writes blocked |
| `TENANT_MEMBERSHIP_NOT_FOUND` | remove school, refetch my-schools |
| `TENANT_ACCESS_DENIED` | school suspended/archived screen |
| `LICENSE_EXPIRED` / `LICENSE_NOT_FOUND` / `LICENSE_SUSPENDED` / `LICENSE_NOT_YET_VALID` | "service unavailable for this school" screen |
| `ENTITLEMENT_DENIED` | hide feature; refetch my-schools (license modules changed) |
| `403` other | "you don't have access" — refetch my-permissions |
| `CONCURRENCY_VERSION_CONFLICT` (409) | refetch, show the newer data, ask user to re-apply |
| `AUTH_TOO_MANY_ATTEMPTS` (429) | wait message, no auto retry |
| `AUTH_CURRENT_PASSWORD_INCORRECT` (400) | field error, do not logout |
| `DOCUMENT_NOT_ISSUED` (404) | "document not issued yet by the school" |
| `400` validation (`message` array) | map to form fields where possible |
| `5xx` | generic error + retry button; report to crash reporter without payload |

Source of codes: backend `apps/api/src/common/errors/error-codes.ts` (ADR-0017). Branch on
`errorCode`, never on `message`.

---

# 5. Client implementation notes

Port of the web client `apps/web/src/lib/api-client.ts`:

| Web | Mobile |
|---|---|
| `localStorage` tokens/tenant | SecureStore (tokens), AsyncStorage (selected tenant, non-secret) |
| `window.dispatchEvent('zn:unauthorized' …)` | typed event emitter in `src/api/events.ts` |
| `import.meta.env.VITE_API_URL` | `process.env.EXPO_PUBLIC_API_URL` |
| silent refresh timer | refresh-on-demand (no timers while app closed) |
| `apiGetBlob` | `expo-file-system` download with Bearer header |

Request timeout 20 s; GET retry max 2 with backoff on network errors only; never auto-retry a
`POST`.
