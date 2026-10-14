---
description: Hand-off notes for starting the ZN School mobile app (teacher + guardian) in a separate repository.
purpose: Explain how to use this starter kit, what is already decided, what is still pending, and in what order to read it.
access: Read
---

# Mobile App Starter Kit — Hand-off

## Status

Planned. Nothing in this kit is implemented. Prepared 2026-10-14 from the main repository
`zn-school-platform-v1` (the "backend repo").

---

# 1. What this folder is

`docs/mobile-app/` is a **portable documentation kit**. Its layout mirrors the root of the future
mobile repository, so it can be copied wholesale:

```text
docs/mobile-app/                      →  <new-mobile-repo>/
  CLAUDE.md                           →    CLAUDE.md
  README.md                           →    README.md
  .claude/rules/*.md                  →    .claude/rules/*.md
  docs/**                             →    docs/**
  HANDOFF.md                          →    (keep as docs/HANDOFF.md or delete after first session)
```

PowerShell (from the backend repo root, target folder must already exist):

```powershell
Copy-Item -Path .\docs\mobile-app\* -Destination ..\zn-school-mobile -Recurse
Copy-Item -Path .\docs\mobile-app\.claude -Destination ..\zn-school-mobile -Recurse
```

(`Copy-Item *` does not pick up dot-folders on every PowerShell version, hence the second line.)

---

# 2. Decided (user, 2026-10-14)

| # | Decision |
|---|---|
| D1 | One app for **teachers and guardians**; the visible shell depends on the user's roles in the selected school. |
| D2 | Same backend, same database, same users — no separate mobile backend, no data copies (SSOT). |
| D3 | Guardian (and any user) logs in with **phone or email** + password. |
| D4 | First-time linking uses a **short activation code + QR** built on the existing invite/activate flow. |
| D5 | Teacher access to attendance/marks is **restricted to assigned classes/subjects by the backend** (web and mobile alike). |
| D6 | Stack: **Expo (dev builds) + expo-router + TanStack Query (persisted) + expo-secure-store + TypeScript**. |
| D7 | Long mobile sessions (target 7–10 days of inactivity) to avoid repeated logins. |
| D8 | Guardian/teacher **reads** should be served from a Postgres **read replica** when one exists. |

---

# 3. Pending — must be approved in the backend repo first

D3, D4, D5, D7 and D8 each require **backend changes and an ADR in the backend repo**. They are
listed with recommended options in `docs/backend/BACKEND_PREREQUISITES.md`. Under the backend
repo's `CLAUDE.md` §3–4 none of them may be implemented until the user approves the ADR.

The mobile repo must **not** build a feature against a backend endpoint that is still "Proposed".
Use mocks only behind an explicit `MOCK_API` flag, and never ship them.

---

# 4. Reading order for the first mobile session

1. `CLAUDE.md`
2. `docs/project/project-status.md`
3. `docs/project/roadmap.md`
4. `docs/backend/BACKEND_PREREQUISITES.md` (what is not available yet)
5. `docs/architecture/ARCHITECTURE.md`
6. `docs/architecture/AUTH_AND_SESSION.md`
7. `docs/api/API_CONTRACT.md`
8. Only then the feature doc for the current phase (`docs/domain/TEACHER_FEATURES.md` or
   `docs/domain/GUARDIAN_FEATURES.md`).

---

# 5. Backend repo documents this kit depends on

Read from the backend repo when a task touches them (do not copy — they evolve there):

| Topic | Backend repo path |
|---|---|
| Endpoints | `docs/api/ENDPOINTS.md` |
| Auth | `docs/adr/0003-authentication-strategy.md`, `docs/adr/0022-session-inactivity-timeout.md`, `docs/security/authentication.md` |
| Tenancy | `docs/architecture/multi-tenancy.md`, `docs/adr/0004-tenant-isolation-phase-1-scope.md` |
| Permission hint | `docs/adr/0038-client-side-permission-hint.md` |
| Licensing | `docs/adr/0008-tenant-entitlements.md`, `docs/adr/0035-tenant-license-and-tier-management.md` |
| Errors | `docs/adr/0017-backend-error-code-taxonomy.md`, `apps/api/src/common/errors/error-codes.ts` |
| Academic | `docs/domain/academic/ACADEMIC_ARCHITECTURE.md`, `docs/adr/0037-academic-marksheet-routine-and-platform-exam-override.md` |
| Guardian | `docs/domain/student/GUARDIAN_ARCHITECTURE.md`, ADR-0025/0026/0027/0059 |
| Dates | `docs/frontend/date-system.md` |
| Documents/PDF | `docs/adr/0036-document-engine.md`, `docs/adr/0044-document-reprint-identity-and-copy-numbering.md` |
| Web API client (to port) | `apps/web/src/lib/api-client.ts`, `apps/web/src/lib/auth.tsx` |
