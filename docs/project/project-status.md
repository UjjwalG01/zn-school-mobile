---
description: Current implementation status of the ZN School mobile app and its backend prerequisites.
purpose: Single place to check what exists, what is approved, and what blocks the next phase.
access: Read
---

# Mobile Project Status

## Status

Last updated: 2026-10-14. Current phase: **M0** (backend prerequisites, in the backend repo).
M1 scaffolding, email login and the session + school context slice are built (2026-10-14). Only
endpoints marked *Exists* in API_CONTRACT are called. Checks so far: `pnpm verify` passes (121
tests), the Android bundle exports; running on a physical phone via Expo Go is the user's check.
**Known until backend B1 ships:** the backend applies the web 30-minute inactivity limit to mobile,
so a session idle for 30 min ends at the next refresh (expected, not an app bug).

## Implemented scaffolding (not features)

| Area | Where | State |
|---|---|---|
| Expo SDK 57, expo-router entry, `app.config.ts`, `eas.json` | root | Implemented (EAS project not linked yet — `eas init`) |
| Quality gates | `pnpm verify` (ESLint 9, `tsc`, Jest) | Implemented, passing |
| API client, error mapping, events | `src/api/` | Implemented; auth adapter attached in `src/bootstrap.ts`. A refresh that fails with an unknown outcome (offline/5xx) now rejects the request instead of ending the session; new `school-suspended` event |
| Query cache (staleTime classes, tenant-prefixed keys, persisted) | `src/api/`, `src/lib/queryClient.ts`, `src/providers/` | Implemented |
| Theme tokens (light/dark) | `src/theme/` | Implemented; dark palette is mobile-only, needs review |
| AD/BS date module | `src/lib/date.ts` | Implemented |
| Feature registry + visibility rule | `src/features/` | Implemented, registry empty |
| Login screen (email only) + activation placeholder | `app/(auth)/login.tsx`, `activate.tsx`, `src/auth/loginForm.ts` | Implemented (2026-10-14). Calls only the existing `POST /identity/login { email, password }`; phone input shows "coming soon" and sends nothing |
| Token storage (SecureStore, access token also in memory) | `src/auth/tokenStore.ts` | Implemented |
| Session store, cold-start restore, route guards | `src/auth/session.ts`, `guards.ts`, `tenantStore.ts` | Implemented. Selected school + shell persisted in AsyncStorage (non-secret) |
| Refresh (single-flight, persist-before-use, proactive at < 60 s via `exp`) | `src/auth/authAdapter.ts`, `jwt.ts` | Implemented; no timers |
| Logout (`POST /identity/logout`, wipe SecureStore + context + query cache + `pdf-cache`) and forced logout on `unauthorized` | `src/auth/logout.ts`, `SessionEvents.tsx`, `src/lib/files.ts` | Implemented |
| Context resolution: `/identity/me`, `/tenancy/my-schools` → none / auto / picker, `/tenancy/my-permissions` → shell | `src/auth/useSessionContext.ts`, `resolveShell.ts`, `queries.ts`, `app/(context)/*` | Implemented. `me` is fetched alongside but does not gate navigation. **Guardian shell is unreachable** until backend B4 (`GUARDIAN_ROLE_AVAILABLE = false`) |
| School errors: `TENANT_MEMBERSHIP_NOT_FOUND` (drop school, refetch), `TENANT_ACCESS_DENIED` / `LICENSE_*` ("school unavailable") | `src/auth/SessionEvents.tsx`, `schoolActions.ts`, `app/(context)/school-unavailable.tsx` | Implemented |
| Placeholder shells (one tab each, header switcher when both) | `app/teacher/`, `app/guardian/` | Placeholder — tabs will come from the feature registry (M2/M3). Real path segments `/teacher`, `/guardian` (a group `index` would collide with `/`) |
| i18n (en + ne, local helper, no library) | `src/i18n/` | Implemented; Nepali strings drafted by the assistant, **need native review**; no in-app language switch yet |
| Shared components `Screen`, `Text`, `TextField`, `PasswordField`, `Button`, `MessageScreen`, `ShellSwitcher`, `ShellPlaceholder` | `src/components/` | Implemented |
| Activation (QR / code) and phone login | `app/(auth)` | **Not started** — blocked by B3 / B2 |
| Biometric local unlock, change password | — | Not started |
| Toast, offline banner, PDF download | — | Not started |

Expo Go is fine for the current empty shell. It cannot handle the `znschool://` scheme, the dev
client, or later native config, so the activation QR/deep link work (M1 session) needs a dev build.

Status vocabulary: Planned · Proposed (needs ADR) · Designed · In Progress · Implemented · Approved.

---

## Phases

| Phase | Status | Notes |
|---|---|---|
| M0 Backend prerequisites | Planned | see table below |
| M1 App foundation | Planned | blocked by B1–B3 |
| M2 Teacher core | Planned | blocked by B5–B7 |
| M3 Guardian core | Planned | blocked by B4, B7, B8 |
| M4 Notices + push | Planned | blocked by backend Phase 9 |
| M5 Extended teacher features | Future | not scheduled |
| M6 Offline writes | Future | blocked by backend Phase 10 |

---

## Backend prerequisites (backend repo)

| # | Item | Status | Backend ADR |
|---|---|---|---|
| B1 | Mobile session policy (client type, 7–10 day inactivity, reuse detection, login throttling) | Proposed | — |
| B2 | Phone as login identifier | Proposed | — |
| B3 | Short activation code + QR slip | Proposed | — |
| B4 | Guardian identity (`guardians.user_id`, role audience) | Proposed | — |
| B5 | Teacher assignments + backend scoping | Proposed | — |
| B6 | Bulk attendance, per-subject marks entry, open-exams list | Proposed | — |
| B7 | Portal read endpoints (`/portal/guardian/*`, `/portal/teacher/*`) | Proposed | — |
| B8 | Guardian result visibility (published/locked only) | Proposed | — |
| B9 | `READ_DB` provider + read replica | Proposed (replica blocked by hosting decision) | — |
| B10 | Notices, push tokens, SMS/email, timetable, ledger statement | Future | — |

Update the ADR column with the backend ADR number once accepted.

---

## Already available in the backend (usable without changes)

- `POST /identity/login|refresh|logout|change-password`, `GET /identity/me`
- `GET /tenancy/my-schools`, `GET /tenancy/my-permissions`, `POST /tenancy/memberships/activate`
- `GET /settings/tenant/mobile-modules`
- Document reprint `GET` endpoints (receipt, invoice PDF, marksheet, exam routine) — staff-scoped
  today; guardian access needs B7

---

## Decisions log

| Date | Decision | By |
|---|---|---|
| 2026-10-14 | D1–D8 in `HANDOFF.md` §2 (one app, same backend, phone/email login, code+QR activation, backend-enforced teacher scope, Expo stack, long sessions, read replica) | User |
