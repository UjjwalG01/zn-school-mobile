---
description: Copy-paste prompts for every phase of the ZN School mobile roadmap (backend work packages WP-1…WP-7 and mobile phases M1…M6), each with summarized tasks, gates and exit criteria.
purpose: Keep every new Claude session on the approved direction without re-deriving it; each prompt is self-contained and states where it runs.
access: Read
---

# Phase Prompts

## Status

Written 2026-10-16 against `docs/project/roadmap.md` (same date). A prompt is guidance, not approval:
backend prompts still stop at the ADR gate, and no prompt authorizes pulling work from a later
phase. If the roadmap or a gate changes, change the prompt in the same edit. The order of the remaining work for the
first release (four delivery phases, pending tasks, owners) is `docs/project/V1_DELIVERY_PLAN.md` (Draft 2026-10-22).

---

# 1. How to use

1. Pick the next phase from the table. Check its **Gate** in `docs/project/project-status.md`
   (the B-item must read _Implemented_, not "built on a branch").
2. Open a session in the repo named under **Run in**, paste the prompt (the text block only).
3. Backend prompts stop after drafting ADRs. Approve, amend or reject; then tell the session to
   continue. The session must not write to `docs/adr/` before that.
4. At the end of a phase the session updates the status docs; copy changed kit files
   (`docs/mobile-app/…` here ↔ `docs/…` in the mobile repo) so the two copies stay identical.

| Order | Phase                                            | Run in  | Gate                        | Unlocks        |
| ----- | ------------------------------------------------ | ------- | --------------------------- | -------------- |
| 1     | WP-1 Auth and activation (B1–B3)                 | backend | none                        | M1 remainder   |
| 1′    | M1 part A (no backend dependency)                | mobile  | none                        | —              |
| 2     | M1 part B                                        | mobile  | WP-1 Implemented            | M2/M3 start    |
| 3     | WP-2 Teacher write contract (B5/B6 remainder)    | backend | none                        | M2 (with WP-3) |
| 4     | WP-3 Teacher portal reads (B7 teacher)           | backend | WP-2 ADR accepted           | M2             |
| 5     | M2 Teacher core                                  | mobile  | M1 exit, WP-2, WP-3         | —              |
| 5′    | M2 Teacher shell (five tabs, school access audit) | mobile  | M2 Home, Attendance, My classes built | —    |
| 6     | WP-4 Guardian identity (B4)                      | backend | WP-1 (activation)           | M3 (with WP-5) |
| 7     | WP-5 Guardian portal + results (B7 guardian, B8) | backend | WP-3 conventions, WP-4      | M3             |
| 8     | M3 Guardian core                                 | mobile  | M1 exit, WP-4, WP-5         | —              |
| any   | WP-6 `READ_DB` seam (B9)                         | backend | none                        | —              |
| 9     | WP-7 Notices and push planning (B10)             | backend | owner opens backend Phase 9 | M4             |
| 10    | M4 Notices and push                              | mobile  | WP-7 Implemented            | —              |
| 11    | M5 Extended teacher feature (one per run)        | both    | one ADR per feature         | —              |
| 12    | M6 Offline writes                                | both    | backend Phase 10            | —              |

Backend WPs and mobile part A may run in parallel. WP-1, WP-2 and WP-4 touch the same auth/role
code; run them one after another, not at the same time.

---

# 2. Backend prompts (run in `zn-school-platform-v1`)

**Common rules for every backend prompt** (they are repeated in each prompt's first lines so a
pasted prompt stays self-contained):

- Read `CLAUDE.md`, `.claude/CLAUDE.md` and the applicable `.claude/rules/*.md` before any code.
- Gate: draft the ADR(s) as **Proposed** in the reply — options, recommendation, consequences — then
  STOP. Write to `docs/adr/` only after the owner says so. Protected docs (roadmap, `docs/security/`,
  `docs/database/`, RLS registry, ADR status lines) are listed for approval, never edited silently.
- Reuse first: search the matching attendance/staff/finance code before writing new services.
- Database: migrations and e2e on `zn_school_test` only; the dev database `zn_school` only on the
  owner's word, after a dump; export `DATABASE_URL` in the same command as the migrate.
- Another session may be editing: ask before implementing, keep subagents read-only.
- Verify: API lint, typecheck, build, the relevant e2e specs, `rls.e2e-spec.ts` when a table is
  added. Report failures with output. Update `docs/api/ENDPOINTS.md` and the web
  `docs/project/project-status.md`; update the kit (`docs/mobile-app/…` B-item status and
  `API_CONTRACT.md`) when an endpoint lands.

---

## WP-1 — Auth and activation (B1, B2, B3)

**Run in:** backend · **Gate:** none · **Unlocks:** M1 part B

```text
You are in the ZN School backend repo. Implement WP-1 of the mobile roadmap
(docs/mobile-app/docs/project/roadmap.md §2): B1 mobile session policy, B2 phone/email identifier
login, B3 short activation code + QR slip.

Read first: CLAUDE.md, .claude/CLAUDE.md, .claude/rules/security.md and database.md;
docs/mobile-app/docs/backend/BACKEND_PREREQUISITES.md §0 and §1–3;
docs/mobile-app/docs/architecture/AUTH_AND_SESSION.md; docs/adr/0003, 0014, 0022;
docs/security/authentication.md; apps/api/src/identity/identity.service.ts;
apps/api/src/tenancy/tenancy.service.ts (invite and activate).

STEP 0 - ADR GATE (stop here until I answer): draft three ADRs as Proposed in your reply: Mobile
client sessions, Login identifiers, Human-friendly activation codes. Include options, a
recommendation, consequences, and the open questions: phone-number reuse/transfer, code attempt
limit, login-throttle key (identifier + IP). Do not write to docs/adr/ yet.

After approval, implement:
B1 - login accepts clientType 'web'|'mobile' (default web), stored on refresh_tokens and copied on
  rotation; mobile inactivity uses tenant_settings.mobile_session_timeout_minutes (strictest across
  memberships, default 10080, raise the DTO max from 480 to 14400); keep the 15-minute access
  token; refresh-token reuse detection with family_id (reuse revokes the chain); login throttling
  per identifier and per IP returning 429 AUTH_TOO_MANY_ATTEMPTS (reuse the change-password audit-
  count approach); suspension and password change still end mobile sessions.
B2 - users.phone in E.164, unique where not null; POST /identity/login accepts
  { identifier, password } and still { email, password }; invite/direct-create accept phone, at
  least one of email/phone; do not sync with guardians.phone; admin re-verification on phone change.
B3 - invite also issues an 8-character Crockford base32 code, stored hashed, 7-day expiry, max 5
  failed attempts, re-issue invalidates the old one; POST /tenancy/memberships/activate accepts
  { code, password? } as well as { token, password? }; the memberships activation RLS policy
  (ADR-0014) must accept the code hash; the web invite screen prints an activation slip (school,
  person, code, QR znschool://activate?code=XXXXXXXX with no tenant id or personal data).
For all: migration, audit rows, e2e tests (throttle, reuse detection, mobile vs web timeout,
  phone/email login, code attempts, expired/reused code, RLS), ENDPOINTS.md entries.

Out of scope: SMS/email delivery (backend Phase 9), password reset, guardian roles (WP-4), any
mobile code, changing the web 30-minute behaviour.
Exit: B1-B3 Implemented and tested on zn_school_test; list the protected-doc edits you need
(docs/security/authentication.md, ADR-0022 supersession note, RLS registry) for my approval; then
update the kit status as in the common rules.
```

---

## WP-2 — Teacher write contract (B5 remainder, B6 remainder)

**Run in:** backend · **Gate:** none (ADR first) · **Unlocks:** M2 (with WP-3)

```text
You are in the ZN School backend repo. Implement WP-2 of the mobile roadmap: finish B5 (teacher
scoping for marks) and B6 (per-subject marks entry, exams open for entry). Already built, do not
redo: bulk attendance, roster, settings (ADR-0061); staff_members, teacher_assignments,
attendance.mark_any and GET /attendance/my-classes (ADR-0062).

Read first: CLAUDE.md, .claude/CLAUDE.md, .claude/rules/security.md; BACKEND_PREREQUISITES.md §5–6;
docs/adr/0062-staff-domain-and-teacher-assignments.md; docs/domain/academic/ACADEMIC_ARCHITECTURE.md
§4.2; docs/adr/0037; the attendance assigned-class code in apps/api/src/attendance/attendance.service.ts
and apps/api/src/authorization/permission-registry.ts (this is the pattern to reuse, not copy);
apps/api/src/academic exam-result services.

STEP 0 - ADR GATE (stop until I answer): draft one Academic ADR as Proposed covering: (a)
exam_result.save_any plus subject-teacher enforcement mirroring attendance.mark_any, with a
migration copying the new key to every role that holds exam_result.save; (b) a subject-scoped
marks submission { examId, examSubjectId, entries:[{ enrollmentId, components }] } that relaxes the
whole-student rule, with per-row version and an idempotency key; (c) when the result is computed
when not every subject is in (open decision A13); (d) GET /portal/teacher/exams/open rules. Show
options and a recommendation.

After approval implement: permission key + migration; enforcement in the exam-result service
(a subject_teacher assignment on the date for each subject written, unless exam_result.save_any;
unlinked or non-active staff refused); the per-subject endpoint; the exams-open endpoint
(exams.status != draft, result_status = pending, exam_configs.allow_modify = true, limited to the
teacher's subject assignments, all for admins); audit rows; ENDPOINTS.md.
Tests: subject teacher writes only assigned subjects; mark_any bypasses; unlinked staff 403;
version conflict 409; idempotent replay; published/locked exam refused; existing whole-student
entry still works.

Out of scope: publishing or locking results, grading changes, guardian access, mobile code.
Exit: B5 and B6 fully Implemented on zn_school_test; list protected-doc edits for approval; update
kit status.
```

---

## WP-3 — Teacher portal reads (B7 teacher)

**Run in:** backend · **Gate:** WP-2 ADR accepted · **Unlocks:** M2 (with WP-2)

```text
You are in the ZN School backend repo. Implement WP-3 of the mobile roadmap: the teacher half of B7
(portal read API). This run also fixes the portal conventions that WP-5 (guardian half) will reuse.

Read first: CLAUDE.md, .claude/CLAUDE.md; BACKEND_PREREQUISITES.md §7 and §9;
docs/mobile-app/docs/domain/TEACHER_FEATURES.md; docs/api/ENDPOINTS.md §7, §7a, §7b;
apps/api/src/staff/teacher-assignment.service.ts; the attendance roster code in
apps/api/src/attendance/attendance.service.ts.

STEP 0 - ADR GATE (stop until I answer): draft the "Portal read API" ADR as Proposed: /portal/*
prefix, audience guard, teacher identity (membership -> active staff member), response conventions,
which reads may use READ_DB later, and the exact list of endpoints. Keep the guardian half as a
stub that WP-5 will complete. Show options and a recommendation.

After approval implement, reusing existing services (no duplicate business logic):
1. GET /portal/teacher/home - today's assignments, attendance done/pending per section, exams open
   for entry, academic year label, own attendance status today - ONE call.
2. GET /portal/teacher/assignments - the caller's assignments for the active academic year
   (GET /teacher-assignments needs staff.read, which teachers do not hold).
3. GET /portal/teacher/sections/:id/roster?date= - enrolled students plus that day's attendance,
   scoped to the caller's assignments (attendance.mark_any sees all), served from the primary DB,
   with dayInfo (holiday / weekly off); classes without sections work (ADR-0054).
Reads need no new permission keys beyond the existing ones; unlinked or non-active staff get a
typed error, not an empty success. ENDPOINTS.md section for /portal/teacher/*.
Tests: teacher A cannot read teacher B's section; mark_any sees all; class with no sections; holiday;
other-school ids 404; response is one request for home.

Out of scope: guardian endpoints, writes, READ_DB wiring, mobile code.
Exit: endpoints Implemented and tested on zn_school_test; protected-doc list for approval; update kit.
```

---

## WP-4 — Guardian identity and audience (B4)

**Run in:** backend · **Gate:** WP-1 Implemented (activation) · **Unlocks:** M3 (with WP-5)

```text
You are in the ZN School backend repo. Implement WP-4 of the mobile roadmap: B4 guardian identity
and the staff/guardian role audience.

Read first: CLAUDE.md, .claude/CLAUDE.md, .claude/rules/security.md and database.md;
BACKEND_PREREQUISITES.md §4; docs/domain/student/GUARDIAN_ARCHITECTURE.md; docs/adr/0025, 0038;
apps/api/src/tenancy/tenant-authorization.service.ts and tenant-context.decorators.ts;
apps/api/src/database/schema (guardians, roles).

STEP 0 - ADR GATE (stop until I answer): draft "Guardian portal access" as Proposed. Cover
roles.audience ('staff'|'guardian', default staff) with a seeded system role 'guardian';
guardians.user_id (nullable FK to users, unique per (tenant_id, user_id), ON DELETE RESTRICT); the
single central change making @RequireTenantMembership() require a staff-audience role, plus the
exact list of routes that opt out with an any-audience variant (my-permissions, mobile-modules,
tenant display settings); guardian invite = existing invite with role guardian + user_id set in
one transaction; a teacher who is also a parent holds both roles on one membership; seat counting
(open decision A10: recommend guardian-only memberships do not use staff seats).

After approval implement: migration (+ RLS registry entry for any new table/column ownership);
the central authorization change; the opt-out variant and its routes; guardian create-account /
invite action (web Guardians page: "Invite to app", reusing the WP-1 activation slip); audit rows.
Tests: every existing user unaffected; a guardian-only member gets 403 on /students, /finance/*,
/academic/*; any-audience routes still work; user_id uniqueness; cross-tenant isolation; invite sets
the link atomically.

Out of scope: portal endpoints (WP-5), result visibility, payments, mobile code.
Exit: B4 Implemented and tested on zn_school_test; protected-doc list for approval; update kit.
```

---

## WP-5 — Guardian portal and result visibility (B7 guardian, B8)

**Run in:** backend · **Gate:** WP-4 Implemented; WP-3 conventions accepted · **Unlocks:** M3

```text
You are in the ZN School backend repo. Implement WP-5 of the mobile roadmap: the guardian half of
B7 and B8 (guardians see only published or locked results).

Read first: CLAUDE.md, .claude/CLAUDE.md, .claude/rules/finance.md and security.md;
BACKEND_PREREQUISITES.md §7–8; docs/mobile-app/docs/domain/GUARDIAN_FEATURES.md; docs/adr/0025, 0026,
0027, 0037 (D7), 0044, 0059, 0060; the WP-3 portal conventions; the existing services:
StudentFinancialPositionService, the Document Engine reprint endpoints, attendance and
exam-result queries.

STEP 0 - ADR GATE (stop until I answer): complete the "Portal read API" ADR (guardian part) as
Proposed. Decide: the guardian-level fees contract under ADR-0025/26/27/59 (invoices grouped by
invoice group; guardian advance pool shown separately from student advance, never merged; posted
documents only; how voided/cancelled documents appear; payments with purpose); whether to offer a
per-exam "hide from guardians" switch (A11); reprint copy numbering for guardian downloads
(ADR-0044).

After approval implement, every :studentId re-checked against guardians.user_id ->
student_guardians, derived from the login, never trusted from the client:
GET /portal/guardian/home (one call), /students, /students/:studentId/profile (guardian-safe subset),
/attendance?from&to, /financial-position, /invoices, /payments (paginated),
/results (status in published|locked only), /invoices/:id/pdf, /payments/:id/receipt,
/results/:id/marksheet (published = watermarked draft, locked = official),
/exam-sessions/:id/routine. Entitlements (fees, academic) still enforced. DOCUMENT_NOT_ISSUED when a
document has not been issued. ENDPOINTS.md section.
Tests: guardian A cannot read guardian B's child, invoice, payment or result; unpublished results and
draft invoices hidden; two children in two classes; one child with two guardians; other-tenant ids;
amounts equal the staff endpoint's values for the same student.

Out of scope: online payment, notices, ledger statement, any write, mobile code.
Exit: B7 guardian and B8 Implemented on zn_school_test; protected-doc list for approval; update kit.
```

---

## WP-6 — `READ_DB` seam (B9)

**Run in:** backend · **Gate:** none (any time) · **Unlocks:** nothing (never a blocker)

```text
You are in the ZN School backend repo. Implement WP-6 of the mobile roadmap: the READ_DB provider
seam (B9). The replica itself is not part of this run; it waits for the hosting decision (A12).

Read first: CLAUDE.md, .claude/CLAUDE.md; BACKEND_PREREQUISITES.md §9; docs/mobile-app/docs/database/
DATA_ACCESS.md; apps/api/src/database/database.module.ts; withTenantContext.

STEP 0 - ADR GATE (stop until I answer): draft "Read replica for portal reads" as Proposed: second
Drizzle provider READ_DB on APP_READ_DATABASE_URL that falls back to the primary pool when unset;
BEGIN READ ONLY for replica transactions; which reads may use it; lag/fallback policy.

After approval implement: the provider and config validation; use it only in /portal/guardian/* GETs
and teacher reference reads (assignments, routine), never for read-after-write; RLS must still apply
(tenant context set with set_config(..., true)).
Tests: unset -> same pool and identical behaviour; set (point it at the test database) -> read-only
enforced, tenant isolation unchanged. No infrastructure changes.

Out of scope: provisioning a replica, changing writes, any mobile code.
Exit: B9 Implemented on zn_school_test; update kit DATA_ACCESS status.
```

---

## WP-7 — Notices and push (B10), planning only

**Run in:** backend · **Gate:** the owner opens backend roadmap Phase 9 · **Unlocks:** M4 prompt

```text
You are in the ZN School backend repo. This is a PLANNING run for WP-7 of the mobile roadmap (B10):
produce decisions, not code.

Read first: CLAUDE.md, .claude/CLAUDE.md; BACKEND_PREREQUISITES.md §10; docs/project/roadmap.md
Phase 9; docs/adr/0012 (file storage) and 0013 (outbox); the mobile roadmap §6.

Deliver in your reply, then STOP: (1) a notices module design - audiences (school, class, section,
guardian, teacher), attachments, who may publish, read receipts or not; (2) push tokens
(user_devices) and the provider choice (A8: Expo push vs FCM direct) with consequences; (3) how
sending uses the outbox; (4) SMS/email delivery of activation codes; (5) permission keys and audit;
(6) the ADR list in the order to build, as Proposed drafts. Do not implement or write to docs/adr/.
Exit: the owner picks decisions; implementation becomes a later run per accepted ADR.
```

---

# 3. Mobile prompts (run in the mobile repo)

**Common rules for every mobile prompt:**

- Read `CLAUDE.md`, `docs/project/project-status.md`, `docs/project/roadmap.md` and the relevant
  `.claude/rules/*`. Never change the backend; write a backend request and stop.
- Call only endpoints marked _Exists_ in `docs/api/API_CONTRACT.md` and confirmed in the backend's
  `docs/api/ENDPOINTS.md`.
- No business rules in the app. Query keys start with `[tenantId, …]`; use the staleTime classes.
- Verify with `pnpm verify`; run on a dev build (Android at minimum) against a **test** backend.
- Update `docs/project/project-status.md` after each verified step; never record a feature as done
  because its screen exists. Commands you give me must be PowerShell-valid.

---

## M1 part A — Foundation work with no backend dependency

**Run in:** mobile · **Gate:** none

```text
You are in the ZN School mobile repo. Continue M1 (docs/project/roadmap.md §3). Read CLAUDE.md,
docs/project/project-status.md, docs/architecture/ARCHITECTURE.md, UI_SYSTEM.md. Do not redo what
project-status marks Implemented (API client, query cache, theme, dates, email login, session,
refresh, logout, school/shell resolution, school-unavailable state, i18n en + ne).

Do now (no new backend endpoint needed):
1. Shared components still missing: Toast (one API app-wide), error boundary, offline banner with
   an "as of" time - BUILT 2026-10-21 (see UI_SYSTEM §2); PDF download + cache button (files are
   wiped on logout already) - still to do.
2. Optional biometric / device-PIN local unlock (expo-local-authentication): local gate only, after
   5 minutes in background, default on for the teacher shell, off for guardian, user-changeable.
3. Change password using the existing POST /identity/change-password (pass the refresh token to keep
   this device signed in; AUTH_CURRENT_PASSWORD_INCORRECT is a field error, not a logout).
4. Register the first feature manifests so the shells' tabs come from the registry.
5. Review the dark palette against the web tokens; list the Nepali strings that need native review
   for me; ask before adding an in-app language switch.
6. Release setup: link EAS (eas init), development / staging / production profiles; I run eas login
   myself - tell me the exact PowerShell commands. Ask me the open decisions A7 (crash reporting)
   and A9 (minimum OS, bundle id / package name) before choosing.
7. Build a development build; test it on a physical Android device (Expo Go cannot test the
   znschool:// scheme).

Out of scope: activation and phone login (need WP-1), any feature screen, push, offline queue.
Exit: pnpm verify green; items 1-5 working on a dev build; project-status updated.
```

---

## M1 part B — Activation, phone login, long sessions

**Run in:** mobile · **Gate:** WP-1 (B1, B2, B3) Implemented in the backend

```text
You are in the ZN School mobile repo. Finish M1 (docs/project/roadmap.md §3). First confirm the
gate: project-status shows B1, B2 and B3 as Implemented, and the backend ENDPOINTS.md documents
login { identifier, password, clientType } and activate { code, password? }. If not, STOP and tell me.

Read: CLAUDE.md, project-status.md, docs/architecture/AUTH_AND_SESSION.md, .claude/rules/security.md.

Tasks:
1. Login accepts phone or email (E.164, Nepal default +977), sends clientType 'mobile'; remove the
   "coming soon" phone stub; show a wait message on 429 AUTH_TOO_MANY_ATTEMPTS, no auto retry.
2. Activation screen: scan the QR (expo-camera) or type the 8-character code; set the password
   (hidden when the backend says none is needed); never log or persist the code; handle expired and
   attempt-limited codes.
3. Handle refresh-token reuse revocation as "session expired" (full local logout).
4. Remove the "30-minute limit until B1" caveat from project-status once verified.
5. Deep link znschool://activate?code=... on a development build.
6. Acceptance on physical devices with a teacher test account (and a guardian account once WP-4
   exists; the guardian shell stays unreachable until then): activate, log in, pick school, restart
   the app over several days, log out.

Out of scope: any feature screen, guardian shell content, push.
Exit: the M1 exit criteria in the roadmap; pnpm verify green; project-status updated.
```

---

## M2 — Teacher core

**Run in:** mobile · **Gate:** M1 exit; WP-2 and WP-3 Implemented

```text
You are in the ZN School mobile repo. Implement M2 (docs/project/roadmap.md §4). Confirm the gate in
project-status (M1 exit met; B5, B6, B7 teacher Implemented) and that /portal/teacher/* and the
subject-scoped marks endpoint are documented in the backend ENDPOINTS.md; otherwise STOP.

Read: CLAUDE.md, project-status.md, docs/domain/TEACHER_FEATURES.md, docs/architecture/
FEATURE_MODULES.md, docs/api/API_CONTRACT.md, .claude/rules/api-and-data.md.

Tasks (each is a registered feature; add its manifest first):
1. teacher.home - BUILT 2026-10-21 (docs/project/TEACHER_HOME_PLAN.md). Composed from
   GET /portal/teacher/my-classes and GET /portal/teacher/exams; the backend has no
   /portal/teacher/home, /portal/teacher/assignments or /portal/teacher/sections/:id/roster.
2. teacher.assignments - classes, sections or "no sections", subjects, from the same my-classes
   response (the roster for attendance is the existing GET /attendance/roster).
3. teacher.attendance - roster for section + date; school statuses and labels from
   GET /attendance/settings (including excused); mark all present, edit exceptions, optional remark;
   non-school-day banner (dayInfo); one bulk submit with an idempotency key (reuse the same key to
   retry an identical payload, a new key after any edit) and per-row version; treat the 2xx
   { ok:false, failures } body as a refusal and show it per student; 409 -> refetch and ask to
   re-apply; online only. A stale per-row version is NOT a 409: it is a per-row failure with an
   English sentence and no errorCode, so detect conflicts by comparing record versions (plan:
   docs/project/ATTENDANCE_PLAN.md; BUILT 2026-10-21, not yet run on a device).
4. teacher.selfAttendance - "Mark Present" card (POST /attendance/staff/self, no body) and own month
   (GET /attendance/staff/self); handle 404 not linked, 409, 400 holiday/weekly off.
5. teacher.marks - exams open for entry -> subject -> students with component fields and maximums;
   UX-only number checks; per-subject save with version; conflict -> refetch and ask to re-apply;
   locked/published read-only. Plan: docs/project/MARKS_PLAN.md (approved 2026-10-22; BUILT and unit-tested
   the same day, server contract Reproduced over HTTP; not yet run on a phone, the owner tests on their own
   phone and uses no emulator). Send the result version on every save (M-D1); the version is per student,
   not per subject. The student-information screen is planned in docs/project/STUDENT_INFO_PLAN.md and
   Guardian V1 in docs/project/GUARDIAN_V1_PLAN.md; neither is built.
6. teacher.routine - exam routine PDF via the cached download button.
7. Tests: visibility rule per feature, unauthorized class, duplicate submission, ok:false batch,
   conflict handling, holiday.

Out of scope: guardian content, notices/push, offline queue, class timetable, leave requests,
publishing or locking results.
Exit: the M2 exit criteria; pnpm verify green; dev-build run on a test school with a teacher account;
project-status updated.
```

---

## M2 shell — Teacher tabs and school access (four phases)

**Run in:** mobile · **Gate:** M2 Home, My classes and Attendance built · **Plan:**
`docs/project/TEACHER_APP_PLAN.md` (decisions, SQL, acceptance table, device checklist)

```text
You are in the ZN School mobile repo. Do the four phases of docs/project/TEACHER_APP_PLAN.md in order.
Read CLAUDE.md, project-status.md, TEACHER_APP_PLAN.md, FEATURE_MODULES.md, UI_SYSTEM.md and
.claude/rules/mobile-frontend.md first. Never change the backend or web repo (read-only); a need there
becomes a backend request in BACKEND_PREREQUISITES.md and you stop at that boundary. Another session may be
editing this repo: read each file before editing, make small edits, never commit, never revert.

Phase 1 - audit why a newly created teacher sees "service not available for this school": trace teacher
creation (Staff page, Team invite / direct-create, staff link) through membership, role and the
license/tenant check; rank the causes; run the read-only SQL on zn_school_test only and hand the dev SQL to
me; add the license reason to the blocked screen; test blocked school, unauthorized school and school
switching; write the onboarding request (B11). Do not mark "new teachers can access their school" done
without evidence.
Phase 2 - five tabs from the feature registry: Dashboard, Attendance (subtabs Student Attendance and My
Attendance), Academic, More, Profile. Role-aware, Profile always visible, tabs remount on school switch.
Phase 3 - build each tab from existing screens and APIs: Dashboard summary tiles (a shortcut row was built,
then removed on review, plan §11.6); Attendance
with self attendance (GET/POST /attendance/staff/self); Academic hub with "Coming soon" rows; More
placeholder; Profile with school switching and sign-out.
Phase 4 - tests (visibility, layout, self attendance, profile, school switch, session expiry, offline retry,
tenant isolation), pnpm verify, Android bundle export, update the docs listed in the plan, and give me the
device checklist. Mark a phase complete only after its acceptance rows in the plan have evidence.

Out of scope: marks entry, exam routine, notices/push, offline writes, activation/phone login, the visual
redesign of the Dashboard, anything in the web repo.
Exit: pnpm verify green; acceptance table updated; pending owner items listed.
```

---

## M3 — Guardian core

**Run in:** mobile · **Gate:** M1 exit; WP-4 and WP-5 Implemented

```text
You are in the ZN School mobile repo. Implement M3 (docs/project/roadmap.md §5). Confirm the gate in
project-status (M1 exit met; B4, B7 guardian, B8 Implemented) and that /portal/guardian/* is documented
in the backend ENDPOINTS.md; otherwise STOP. Set GUARDIAN_ROLE_AVAILABLE accordingly.

Read: CLAUDE.md, project-status.md, docs/domain/GUARDIAN_FEATURES.md, FEATURE_MODULES.md,
docs/api/API_CONTRACT.md, .claude/rules/security.md (guardian data boundary).

Tasks:
1. guardian.home + child switcher from /portal/guardian/home and /students.
2. guardian.profile and guardian.attendance (month calendar + list, counts as returned).
3. guardian.fees - financial position, invoices (with invoice-group context), payments, the guardian
   advance pool as its own figure, "updated <time>"; amounts exactly as returned, no client math;
   invoice and receipt PDFs.
4. guardian.results - published/locked results as returned; marksheet PDF with the draft label for
   published.
5. guardian.routine - exam routine PDF.
6. Multiple children, loading, empty and network-error states; DOCUMENT_NOT_ISSUED message.
7. Isolation tests: another guardian's child, invoice, payment or unpublished result is never shown;
   switching child or school never shows stale data from another.
Guardian screens call /portal/guardian/* only.

Out of scope: online payment, notices/push, ledger statement, messaging, student self-login.
Exit: the M3 exit criteria; pnpm verify green; dev-build run with a guardian who has two children;
project-status updated.
```

---

## M4 — Notices and push notifications

**Run in:** mobile (after WP-7 Implemented) · **Gate:** WP-7 and backend Phase 9

```text
You are in the ZN School mobile repo. Implement M4 (docs/project/roadmap.md §6). Confirm the gate:
notices endpoints, push-token registration and the provider decision (A8) are Implemented/decided and
documented in the backend ENDPOINTS.md; otherwise STOP.

Tasks: 1. Notices list and detail (feature shared.notices, module key notices). 2. Ask permission
and register the device push token securely; refresh and remove it on logout. 3. Route a
notification tap to the right school and screen (switch school first if needed); invalid or
disabled-module links land on a safe screen. 4. Handle denied permission and token rotation.
5. Tests: expired session, disabled module, invalid link, school switch.
Out of scope: M5 features, offline queue, new native modules without my approval.
Exit: the M4 exit criteria; pnpm verify green; project-status updated.
```

---

## M5 — Extended teacher feature (one per run)

**Run in:** backend, then mobile · **Gate:** an accepted ADR for that feature

```text
Feature: <classroom | homework | lesson-plan | question-scan>. Stage 1 runs in the backend repo, stage 2
in the mobile repo. Do one stage per session.

Stage 1 (backend): read CLAUDE.md and docs/mobile-app/docs/domain/TEACHER_FEATURES.md §4. Draft the
feature's ADR as Proposed (domain model, permission key, audience, storage - ADR-0012 is single-node
local disk, OCR provider if scanning) and STOP for my approval. After approval implement endpoints,
permission, audit, tests, ENDPOINTS.md. Add the new mobile module key to the web MOBILE_MODULES list.
Stage 2 (mobile): confirm the endpoints are Implemented; add src/features/<id>/ with its manifest,
routes, hooks and screens; register it; add it to FEATURE_MODULES.md and TEACHER_FEATURES.md; tests
for visibility and main flows; pnpm verify; update project-status.
Out of scope: any other M5 feature, offline queue. Each feature ends complete before the next starts.
```

---

## M6 — Offline writes

**Run in:** backend, then mobile · **Gate:** backend roadmap Phase 10

```text
Stage 1 (planning, both repos, no code): read docs/mobile-app/docs/database/DATA_ACCESS.md, the backend
roadmap Phase 10 and the idempotency/version rules in docs/api/ENDPOINTS.md. Propose the offline
architecture as Proposed ADR text: on-device store (the SQLite decision A5), the queue record shape,
idempotency keys, version-conflict resolution per write type (attendance, marks), retry/backoff,
expired sessions, and what the UI shows (pending / synchronized / failed). Then STOP.
Stage 2 (after approval): implement durable queued attendance and marks writes, sync, conflict and
stale-record handling, and visible states. Tests must prove no silent data loss and no duplicates
across restart, duplicate delivery, session expiry and reconnect.
Out of scope: queuing any other write; do not queue offline mutations before the ADR is accepted.
Exit: the M6 exit criteria; pnpm verify green; project-status updated.
```
