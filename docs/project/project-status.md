---
description: Current implementation status of the ZN School mobile app and its backend prerequisites.
purpose: Single place to check what exists, what is approved, and what blocks the next phase.
access: Read
---

# Mobile Project Status

## Status

Last updated: 2026-10-14. Current phase: **M0** (backend prerequisites, in the backend repo).
**M1 scaffolding only** is in place (user-approved 2026-10-14): no screens, no login/activation, no
session storage, no call to any *Proposed* endpoint. Device check so far: bundle exports for
Android and `expo-doctor` passes; running on a physical phone via Expo Go is the user's check.

## Implemented scaffolding (not features)

| Area | Where | State |
|---|---|---|
| Expo SDK 57, expo-router entry, `app.config.ts`, `eas.json` | root | Implemented (EAS project not linked yet — `eas init`) |
| Quality gates | `pnpm verify` (ESLint 9, `tsc`, Jest) | Implemented, passing |
| API client, error mapping, events | `src/api/` | Implemented; auth adapter not attached (no session yet) |
| Query cache (staleTime classes, tenant-prefixed keys, persisted) | `src/api/`, `src/lib/queryClient.ts`, `src/providers/` | Implemented |
| Theme tokens (light/dark) | `src/theme/` | Implemented; dark palette is mobile-only, needs review |
| AD/BS date module | `src/lib/date.ts` | Implemented |
| Feature registry + visibility rule | `src/features/` | Implemented, registry empty |
| Session/SecureStore, activation, login, school picker | `src/auth/`, `app/(auth)` | **Not started** — blocked by B1–B3 |
| i18n, toast, shared components, offline banner, PDF download | — | Not started — libraries not approved yet |

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
