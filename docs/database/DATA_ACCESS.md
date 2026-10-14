---
description: How mobile data is stored and served — no app database, server-side read replica routing, freshness rules, on-device cache.
purpose: Record where mobile reads and writes land so data stays consistent with the single source of truth.
access: Read
---

# Data Access

## Status

Designed. Server-side parts depend on backend B9 (**Proposed**).

---

# 1. The mobile app owns no database

- All data lives in the backend's PostgreSQL (system of record). The app holds only a **cache** of
  API responses.
- No SQLite / WatermelonDB / Realm until M6 (offline writes, backend Phase 10).
- Nothing in the cache is ever sent back as truth — writes always go through API endpoints that
  re-validate everything.

---

# 2. Server side: primary vs read replica (B9)

```text
                     ┌───────────────────────────────┐
  teacher writes ───→│ PRIMARY (APP_DATABASE_URL)     │──── streaming replication ───┐
  read-after-write ─→│ RLS via withTenantContext      │                              │
                     └───────────────────────────────┘                              ▼
                                                    ┌─────────────────────────────────────┐
  guardian portal reads ───────────────────────────→│ REPLICA (APP_READ_DATABASE_URL)      │
  teacher reference reads ─────────────────────────→│ read-only txn, same RLS, lag ≤ ~5 s  │
                                                    └─────────────────────────────────────┘
```

| Endpoint group | Database | Why |
|---|---|---|
| `/identity/*`, `/tenancy/*` | primary | auth/session must be exact |
| All writes (attendance, marks) | primary | writes |
| Teacher roster/marks screens | primary | read-after-write |
| Teacher assignments, routine | replica | reference data, rarely changes |
| `/portal/guardian/*` | replica | high volume, tolerates seconds of lag |

- When `APP_READ_DATABASE_URL` is unset the backend uses the primary for everything — behavior
  identical, just no offload.
- Tenant isolation is unchanged on the replica: the same RLS policies replicate, and
  `withTenantContext` sets `app.tenant_id` transaction-locally.
- Financial values shown to guardians are reads of posted data; replica lag can delay a just-made
  payment by seconds. Guardian fee screens show "updated <time>"; no business decision is made
  from replica data.

---

# 3. Freshness on device

`staleTime` classes are defined in `.claude/rules/api-and-data.md` §5. Summary: reference data
hours, finance minutes, roster minutes, session data 15 min. Pull-to-refresh forces a refetch.

---

# 4. What is cached on device

| Data | Cached | Wiped when |
|---|---|---|
| Tokens | SecureStore | logout, refresh 401 |
| Selected tenant + shell | AsyncStorage | logout |
| Query cache (incl. finance, results) | AsyncStorage persister, keyed by tenant | logout; school switch (that tenant's keys); app version change |
| Downloaded PDFs | app document dir, per tenant | logout; older than 30 days |
| Activation codes, passwords | never | — |

---

# 5. Integrity rules

- Never derive a balance, total, grade or percentage on device — show the API's value.
- Never merge data across tenants in one screen.
- Never show a student to a guardian that was not returned by a guardian-scoped endpoint.
