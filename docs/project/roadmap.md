---
description: Phased roadmap of the ZN School mobile app (teacher + guardian).
purpose: Define phase scope and boundaries so work is not pulled ahead of its backend prerequisites.
access: Read
---

# Mobile Roadmap

## Status

Planned (2026-10-14). Approval of each phase is recorded in `docs/project/project-status.md`.

Phase rule: a phase starts only when every backend prerequisite it lists is **Implemented** in the
backend repo (see `docs/backend/BACKEND_PREREQUISITES.md`, items numbered B1–B10 below).

---

## M0 — Backend prerequisites (in the backend repo)

Not mobile code. Each item ships after its ADR is approved.

- B1 mobile session policy, B2 phone login, B3 activation code (needed by M1)
- B4 guardian audience, B5 teacher assignments (needed by M2/M3)
- B9 `READ_DB` seam (any time; replica itself after the hosting decision)

---

## M1 — App foundation

Depends on: B1, B2, B3.

- Expo project, TypeScript strict, ESLint, Jest, EAS profiles (development / staging / production)
- `src/api/client.ts` — port of the web `api-client.ts` (Bearer, `tenantId`, `ApiError`), with
  SecureStore and an event emitter instead of `localStorage` / `window` events
- Session: activation (code + QR), set password, login (phone|email), single-flight refresh,
  logout, optional biometric unlock
- School picker (`/tenancy/my-schools`), role/shell resolution, permission hint
  (`/tenancy/my-permissions`), license-blocked state
- Feature registry, theme tokens (light/dark), date module (AD/BS), toast, error boundary
- Persisted TanStack Query cache with tenant-prefixed keys

Exit: a teacher and a guardian test account can activate, log in, switch school, stay logged in
across app restarts for days, and log out cleanly — with no feature screens yet.

---

## M2 — Teacher core

Depends on: M1, B5, B6, B7 (teacher part).

- Home (one call: `/portal/teacher/home`)
- My assignments (classes, sections, subjects)
- Section attendance for a date: roster, mark all present, exceptions, one bulk submit
- Marks entry for exams open to entry, per subject, with concurrency conflict handling
- Exam routine PDF

---

## M3 — Guardian core

Depends on: M1, B4, B7 (guardian part), B8.

- Home (one call: `/portal/guardian/home`), child switcher
- Student profile, attendance history
- Fee position, invoices, payments, invoice PDF, receipt PDF
- Published/locked results, marksheet PDF
- Exam routine PDF

---

## M4 — Notices and push notifications

Depends on: backend roadmap Phase 9 decisions, notices module ADR, push-token ADR (B10).

- Notices list/detail, push registration, notification routing into screens

---

## M5 — Extended teacher features

Each is its own feature module plus its own backend ADR. Not scheduled.

- Classroom (class feed)
- Homework / assignment management
- Lesson planning
- Question making from scanned PDF/image

---

## M6 — Offline writes

Depends on backend roadmap Phase 10 (offline architecture). Not started before it.

- Queued attendance/marks writes with conflict handling

Until M6 the app is **online-for-writes, cached-for-reads**.
