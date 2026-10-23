---
description: Phased roadmap of the ZN School mobile app (teacher + guardian), with backend work packages, gates, task checklists and open decisions.
purpose: Define phase scope and boundaries so work is not pulled ahead of its backend prerequisites.
access: Read
---

# Mobile Roadmap

## Status

Re-planned 2026-10-16 from the 14 Oct mobile plan, reconciled with the web/backend repo as it stands
(`zn-school-platform-v1`, attendance work committed 2026-10-15). Approval of each phase is recorded
in `docs/project/project-status.md`. Copy-paste prompts for every phase are in
`docs/project/PHASE_PROMPTS.md`.

Phase rule: a phase starts only when every backend prerequisite it lists is **Implemented** in the
backend repo (items **B1–B10**, defined in `docs/backend/BACKEND_PREREQUISITES.md`). Reusable UI
prototypes may be prepared early; production API integration respects the gate.

Status vocabulary: Planned · Proposed (needs ADR) · Designed · In Progress · Implemented · Approved.

---

## 1. Phases at a glance

| Phase | What                                 | Status                                                                   | Gate (must be Implemented first)                                     |
| ----- | ------------------------------------ | ------------------------------------------------------------------------ | -------------------------------------------------------------------- |
| M0    | Backend prerequisites (backend repo) | **Built** except B9 (`READ_DB`, not built) — reconciled 2026-10-22, see §2 | —                                                                    |
| M1    | App foundation                       | In progress — scaffolding, email login, session and school context built; activation and phone login not built in the app | B1, B2, B3 (built in the backend; the app side is open)              |
| M2    | Teacher core                         | In progress — shell, Home, My classes, Attendance, My Attendance, Marks entry and Student details are built and unit-tested (2026-10-21/22); none has run on a phone | M1, B5, B6, B7 teacher (built in the backend) |
| M3    | Guardian core                        | Planned — detailed plan `docs/project/GUARDIAN_V1_PLAN.md` (Draft); build waits for the Teacher phone run | M1, B4, B7 guardian, B8 (built in the backend; guardian routes Reproduced 2026-10-22) |
| M4    | Notices and push                     | Planned — the teacher side moved into M2 by the owner (2026-10-22); push needs an Expo project and a development build | Backend Communication module (ADR-0069, **built**, migration 0231), B10 |
| M5    | Extended teacher features            | Future, not scheduled                                                    | One backend ADR per feature                                          |
| M6    | Offline writes                       | Future                                                                   | Backend roadmap Phase 10 (offline architecture)                      |

Until M6 the app is **online-for-writes, cached-for-reads**.

---

## 2. M0 — Backend prerequisites (backend repo, not mobile code)

Each item ships after its ADR is approved (backend `CLAUDE.md` §3–4). ADR numbers are assigned at
proposal time; the last accepted backend ADR is 0063, so new ones start at 0064.

**Reconciled 2026-10-22.** The "Verified state (2026-10-16)" column of the table below is the record of that date and is out
of date. Against the backend repo (`docs/api/ENDPOINTS.md`, read-only) and live checks over HTTP on a test API
(`TEACHER_APP_PLAN.md` E9/E10, `MARKS_PLAN.md` §3.3, `GUARDIAN_V1_PLAN.md` §2.1) the state is: **WP-1** (B1 to B3) built
(ADR-0066, ADR-0067); **WP-2** (marks scoping, per-subject marks, submissions, exams-open) built (ADR-0068, migrations 0229
and 0230); **WP-3** (teacher portal reads) built; **WP-4** (guardian identity and audience) built; **WP-5** (guardian portal
reads, released results only) built, with the PDFs and `home` routes still absent; **WP-6** (B9 `READ_DB`) not built;
**WP-7** (notices, inbox, devices, Expo push) built (ADR-0069, migration 0231), SMS and e-mail not built. The development
database is migrated through 0235, and through 0236 (the default Teacher role, request B12) since 2026-10-22. The checklist
below is left as it was: a phase is ticked only when its exit criteria are verified. New backend requests since: B12 (built),
B13 to B15 in `docs/backend/BACKEND_PREREQUISITES.md`. What the deferred items need to start:
`docs/project/DEFERRED_WORK_REQUIREMENTS.md`.

| Work package                                   | B-items                                                                                       | Unlocks         | Verified state (2026-10-16)                                                                       |
| ---------------------------------------------- | --------------------------------------------------------------------------------------------- | --------------- | ------------------------------------------------------------------------------------------------- |
| **WP-1** Auth and activation                   | B1 mobile session policy, B2 phone/email identifier login, B3 short activation code + QR slip | M1 remainder    | Not built                                                                                         |
| **WP-2** Teacher write contract                | B5 remainder (marks scoping), B6 remainder (per-subject marks entry, exams-open list)         | M2 (with WP-3)  | Bulk attendance and attendance-class scoping already built (ADR-0061/0062); marks parts not built |
| **WP-3** Teacher portal reads                  | B7 teacher: `/portal/teacher/home`, `assignments`, `sections/:id/roster`                      | M2              | Not built                                                                                         |
| **WP-4** Guardian identity and audience        | B4: `guardians.user_id`, `roles.audience`, guardian role                                      | M3 (with WP-5)  | Not built                                                                                         |
| **WP-5** Guardian portal and result visibility | B7 guardian: `/portal/guardian/*`; B8 published/locked results only                           | M3              | Not built                                                                                         |
| **WP-6** `READ_DB` seam                        | B9: **not built** — no routing code or second pool until a real replica exists (backend ADR-0065 D7)          | none (any time) | Not built                                                                                         |
| **WP-7** Notices and push                      | B10: notices, push tokens (SMS/email later)                                                 | M4              | Not built; backend Communication module (ADR-0069, Accepted)                                                                     |

Checklist:

- [ ] Approve and record the required ADRs (per work package).
- [ ] WP-1 B1 · B2 · B3
- [ ] WP-2 B5 remainder · B6 remainder
- [ ] WP-3 B7 teacher
- [ ] WP-4 B4
- [ ] WP-5 B7 guardian · B8
- [ ] WP-6 B9
- [ ] Each endpoint documented in the backend `docs/api/ENDPOINTS.md` and in `docs/api/API_CONTRACT.md` when it lands.

Exit: the prerequisites for the next mobile phase are Implemented and tested.

---

## 3. M1 — App foundation

Depends on: B1, B2, B3 for the activation/phone/long-session part. The rest proceeds in parallel.

**Already built (2026-10-14, see project-status):** Expo SDK 57 scaffold, quality gates, API client and
error mapping, TanStack Query cache, theme tokens, AD/BS dates, feature registry (empty), email login,
SecureStore session with single-flight refresh, logout, school picker / role-shell resolution,
school-unavailable state, en + ne strings, placeholder shells.

**Remaining**

- [ ] Activation (QR + typed code), set password — needs B3.
- [ ] Phone/email identifier login, mobile `clientType` — needs B1, B2.
- [ ] Optional biometric local unlock; change password.
- [ ] Toast, offline banner, error boundary, PDF download/cache.
- [ ] Register the first feature manifests; finish `(auth)`, `(teacher)`, `(guardian)` groups.
- [ ] Review the dark palette and AD/BS behaviour; native review of Nepali strings; in-app language switch if approved.
- [ ] Link EAS; development, staging, production profiles.
- [ ] Development build; test the `znschool://` deep link (Expo Go cannot).
- [ ] Physical-device tests (Android at minimum).
- [ ] Teacher and guardian session acceptance tests (activate, log in, pick school, survive restarts for days, log out).

Exit: a teacher and a guardian test account can activate, log in, switch school, stay logged in
across app restarts for days, and log out cleanly — with no feature screens required.

---

## 4. M2 — Teacher core

Depends on: M1, B5, B6, B7 (teacher). Registered features: `teacher.home`, `teacher.assignments`,
`teacher.attendance`, `teacher.marks`, `teacher.routine`, `teacher.selfAttendance`.

**Release scope (owner decision 2026-10-18):** the first release is attendance, marks, fees, student information and notices.
`teacher.routine`, `guardian.routine` and the exam routine PDF items below are after v1 (owner decision 2026-10-18). `teacher.selfAttendance` is back in v1 (owner decision 2026-10-21), as the My Attendance subtab of the Attendance tab.

- [ ] Home from one aggregated request (`/portal/teacher/home`).
- [ ] My assignments: classes, sections, subjects.
- [ ] Section attendance for a date: roster, mark all present, edit exceptions, validate, one bulk submit (idempotency key, per-row `version`).
- [ ] Teacher self "Mark Present" card and own month history (`attendance.self`; backend already built — decided 2026-10-16) — in v1 again (owner decision 2026-10-21), the My Attendance subtab.
- [ ] Teacher shell: five registry-driven tabs (Dashboard, Attendance, Academic, More, Profile), Profile always visible, school switch remounts the tabs; plus the audit of new-teacher school access. Plan and acceptance table: `docs/project/TEACHER_APP_PLAN.md`. Built and unit-tested 2026-10-21; left unchecked until the device run.
- [ ] Exams open for marks entry; per-subject marks entry and validation; concurrency conflicts refetch and ask to re-apply. Built and unit-tested 2026-10-22 (`docs/project/MARKS_PLAN.md`); the server contract was Reproduced over HTTP with two teacher accounts; left unchecked until the phone run.
- [ ] Student details for a teacher (opened from an Attendance roster row; not kept on the phone). Built and unit-tested 2026-10-22 (`docs/project/STUDENT_INFO_PLAN.md`); left unchecked until the phone run. The guardian profile belongs to M3.
- [ ] Notices and the in-app inbox for a teacher (owner decision 2026-10-22, moved forward from M4): read through `GET /portal/notices` and `GET /portal/notifications`, which are membership-only and shared with guardians. Not started; needs its own plan.
- [ ] Exam routine PDF — after v1 (owner decision 2026-10-18).
- [ ] Tests: unauthorized class access, duplicate submission, `ok:false` batch refusal, holiday/non-school day.

Exit: a teacher can view assigned classes, record attendance, enter permitted marks and view the
exam routine under backend authorization. The gate stays strict: no attendance slice before the
B7 teacher portal (decided 2026-10-16), because the assignment scope on reads arrives with B7.

---

## 5. M3 — Guardian core

Depends on: M1, B4, B7 (guardian), B8. Registered features: `guardian.home`, `guardian.profile`,
`guardian.attendance`, `guardian.fees`, `guardian.results`, `guardian.routine`.

- [ ] Home (one call) and child switcher.
- [ ] Student profile and attendance history.
- [ ] Fee position, invoice list and payment history (group-aware, guardian advance pool shown as its own figure — see GUARDIAN_FEATURES §3).
- [ ] Invoice PDF and receipt PDF.
- [ ] Published/locked results and marksheet PDF (draft watermark for published).
- [ ] Exam routine PDF — after v1 (owner decision 2026-10-18).
- [ ] Multiple children, loading, empty and network-error states.
- [ ] Data-isolation tests: no other guardian's students, invoices, payments or unpublished results.

Detailed plan, screens, build order (G0 to G7) and decisions GV-D1 to GV-D9 (accepted 2026-10-22): `docs/project/GUARDIAN_V1_PLAN.md`.
The built guardian routes differ from the list above (no `home` route, one `…/fees` route, no guardian PDFs yet); the plan
§2.3 lists the differences. Build starts after the Teacher phone run passes (GV-D1).

Exit: a guardian can switch between linked children and see only information authorized for each.

---

## 6. M4 — Notices and push notifications

Depends on: the backend Communication module (ADR-0069, Accepted; **built 2026-10-21**, migration 0231), B10.

- [x] Notice and push-token architecture approved: backend ADR-0069 (Accepted 2026-10-18); push provider = Expo push (A8).
- [ ] Notices list and detail.
- [ ] Register device push tokens securely; token lifecycle.
- [ ] Route a notification tap to the correct school and screen.
- [ ] Tests: expired session, disabled module, invalid link.

---

## 7. M5 — Extended teacher features (future, not scheduled)

One feature at a time, each with its own backend contract and ADR: Classroom feed · Homework and
assignments · Lesson planning · Question creation from scanned PDFs/images. Each enters through the
feature registry and the module-visibility model, with backend authorization, screens, tests and
documentation complete before the next starts.

---

## 8. M6 — Offline writes (future)

Depends on backend roadmap Phase 10.

- [ ] Approve offline architecture and conflict rules (includes the SQLite decision A5).
- [ ] Durable queued attendance and marks writes; retry and sync.
- [ ] Stale-record and version-conflict handling; pending / synchronized / failed states.
- [ ] Restart, duplicate-delivery, expired-session and reconnect handling; no silent data loss or duplicates.

Do not queue offline mutations earlier.

---

## 9. Priority and parallel work

1. **Priority 1:** WP-1 (B1–B3), then finish M1.
2. **Priority 2:** WP-2 and WP-3, then M2.
3. **Priority 3:** WP-4 and WP-5, then M3.
4. **Priority 4:** M4 after the backend notice/push decisions are approved and built.
5. **Priority 5:** plan M5 feature by feature; M6 only after backend Phase 10.

Backend work packages and mobile scaffold improvements can run in parallel. WP-6 is never a blocker.

---

## 10. Cross-phase requirements

| Workstream      | Required work                                                                                                                            |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Security        | Secure token storage, refresh rotation and reuse detection, logout, throttling, tenant isolation, backend-enforced role and scope checks |
| API integration | Typed request functions, centralized errors, timeout/retry policy, tenant ID only from `my-schools`                                      |
| Performance     | Persisted query cache, stale-time classes, aggregated home calls, bulk attendance, cached PDFs                                           |
| UX              | Loading, empty, error, offline, expired-session, suspended-school, license-expired and non-school-day states                             |
| Feature access  | Role shell, permission hint, license entitlement and mobile-module visibility                                                            |
| Quality         | Unit, screen, API integration, authorization and physical-device tests                                                                   |
| Delivery        | Development/staging/production builds, signing, release setup, crash-reporting decision                                                  |
| Documentation   | Update API contract, project status, ADR references and phase exit criteria after each verified milestone                                |

---

## 11. Technical boundaries

- One app, two role experiences; no separate mobile backend or BFF.
- No guardian access through staff-wide APIs; guardian screens use `/portal/guardian/*` only.
- No proposed endpoint in shipped code; mocks only behind an explicit `MOCK_API` flag, never shipped.
- No client-side business rules: fees, balances, marks, grades and results are backend-owned.
- No offline writes before M6; no SQLite before M6.
- The read replica is not an M1 blocker; the `READ_DB` seam and the replica are separate steps.
- Do not mark a phase complete because screens exist; completion needs its exit criteria verified.

---

## 12. Open decisions (must be explicit before anything depends on them)

| #   | Decision                                                                             | Needed by         |
| --- | ------------------------------------------------------------------------------------ | ----------------- |
| A5  | No local database until M6 (Proposed)                                                | M6                |
| A6  | Hand-written API types vs shared types / OpenAPI (Proposed, backend call)            | M2                |
| A7  | Crash-reporting provider                                                             | M1                |
| A8  | Push provider: **decided 2026-10-18 — Expo push** (backend ADR-0069)                  | M4                |
| A9  | Minimum OS versions and store identifiers (bundle id, package name)                  | M1 release setup  |
| A10 | Whether guardian-only memberships count as licence seats                             | WP-4 ADR          |
| A11 | Optional per-exam "hide from guardians" switch                                       | WP-5 ADR          |
| A12 | Production hosting and read-replica go-ahead                                         | WP-6 replica step |
| A13 | Marks-entry rule when not every subject is entered yet (when the result is computed) | WP-2 ADR          |
| A14 | Plain-403 cache wipe: wipe on every plain 403 (owner answer V-D3) or only when a permission re-check shows a revocation (recommended, matches ADR-0065 D8) | before Guardian G1 |
| A15 | Row-level security on roles (backend ADR amending ADR-0033 D8; request B13) | none (backend)    |
| A16 | One-step teacher onboarding (backend request B11; ADR and scope decisions B11-1 to B11-6) | none (backend and web) |

What each of A14 to A16 needs before it can start: `docs/project/DEFERRED_WORK_REQUIREMENTS.md`.
