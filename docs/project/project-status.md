---
description: Current implementation status of the ZN School mobile app and its backend prerequisites.
purpose: Single place to check what exists, what is approved, and what blocks the next phase.
access: Read
---

# Mobile Project Status

## Status

Last updated: 2026-10-22 (marks entry built and its server contract verified live, roles check, student-information and Guardian V1 plans written; V1 delivery plan drafted; 2026-10-21: B5–B7 gate recorded; backend facts re-verified 2026-10-16; the app rows
below are as of 2026-10-14 unless dated). Current phase: **M0** (backend prerequisites, in the backend repo) with **M1 in
progress** in the mobile repo. M1 scaffolding, email login and the session + school context slice
are built (2026-10-14). Only endpoints marked _Exists_ in API_CONTRACT are called. Checks so far:
`pnpm verify` passes (365 tests, 2026-10-21), the Android bundle exported on 2026-10-21; running on
a physical phone via Expo Go is the user's check. Per-phase prompts: `docs/project/PHASE_PROMPTS.md`.
**M2 gate (2026-10-21):** the owner recorded B5, B6 and the teacher part of B7 as Implemented on the
backend test database, so the Teacher Home slice is being built; run it only against the test stack.
**Known until backend B1 ships:** the backend applies the web 30-minute inactivity limit to mobile,
so a session idle for 30 min ends at the next refresh (expected, not an app bug).
Implemented scaffolding is not a feature-complete or release-ready app: the only feature screens are
the teacher Home, My classes and Attendance (built 2026-10-21, unit-tested, not yet run against the test stack or on a device),
no guardian screen exists, and nothing has run on a physical device yet.
**Teacher shell (2026-10-21):** the five-tab teacher shell (Dashboard, Attendance with My Attendance, Academic,
More, Profile) and the audit of why a new teacher sees "service not available for this school" are in
`docs/project/TEACHER_APP_PLAN.md` (decisions D1–D9, acceptance table §9, evidence §10). Phases 0 to 3 are built and
unit-tested in this repo (`pnpm verify` green: 424 tests; the Android bundle exports). **Not run on a device or the
test stack.** `ponytail-review` and `impeccable critique` were run on the UI (code-only) and their findings built (plan
§11.6; the month stepper's lower bound is the one note left). The "new teacher can reach their
school" criterion is pending the owner: **the owner names the role as the cause (2026-10-22)**. A teacher whose role grants
neither `attendance.mark` nor `exam_result.save` sees "Use the web app", and the platform seeds no teacher role (only
`tenant_admin` and `guardian`). A default Teacher role is requested for the web/API project (B12, drafted in
`docs/project/ROLES_ACCESS_CHECK.md`, not yet approved or built) next to the onboarding request B11; the license
hypothesis H1 (plan §3.6 SQL) stays open but optional. **Update (same day, owner accepted the recommendations):** the default
Teacher role was **built** in the web/API project as the platform role `default_teacher` (migration `0236`, an owner-authorised
exception to the no-web-code rule, decision D12); verified on a fresh database and through the API, applied to the test
databases and, on 2026-10-22 at the owner's request, **to the development database** (only up to 0236: two unfinished
migrations of another session stayed pending), not committed. Nothing else in that project changed **until 2026-10-23**, when
`calendar.read` and `exam_attendance.mark` (limited to the teacher's assigned classes) were added to the same role by migration
`0239`, on the web test database only (applied to the development database on 2026-10-23), and the web app began hiding pages by the same permission keys (ADR-0074); the app got a Calendar and an Exam Attendance screen for those keys on 2026-10-23 (see the section below). The marks phone run
had **not started** as of 2026-10-22 07:05 UTC (no phone session on the test stack, app still pointed at the dev API); what the
deferred items need to start: `docs/project/DEFERRED_WORK_REQUIREMENTS.md`.
**Marks entry (`teacher.marks`, 2026-10-22):** approved and **built and unit-tested** (`docs/project/MARKS_PLAN.md`;
`pnpm verify` green: 58 suites, 556 tests; the Android bundle exports). Its server contract was **Reproduced over HTTP
against a test stack** with two teacher accounts (MARKS_PLAN §3.3), which found and fixed two issues in the app (the
persisted cache kept guardian names and grades; a stale submit showed the save-conflict text). **Not run in the app:** the
owner will test on their own Android phone and will not use an emulator (decision D10); the phone stack and accounts are
in `TEACHER_APP_PLAN.md` §6.2. **Student details (teacher half) is built and unit-tested** (`STUDENT_INFO_PLAN.md`, see the
table below). Guardian V1 is planned, not built, on purpose (`GUARDIAN_V1_PLAN.md`, GV-D1: it waits for the marks phone
run). `pnpm verify`: 62 suites, 599 tests; the Android bundle exports; the Jest `testTimeout` is now 20000.
**Delivery order (2026-10-22, Draft, not approved):** `docs/project/V1_DELIVERY_PLAN.md` lays out four phases (finalize
the foundation, complete Teacher V1, implement Guardian V1, release readiness) with every pending task, owner and gate.
It also lists the B-rows below that are out of date against the backend's own status (B1 to B4, B8, B10); they are not
edited yet (task P4.7).

## Calendar, exam attendance, filter step, language switch (2026-10-23; built and unit-tested; not run on a phone; nothing committed)

**Brief and scope.** The owner asked for the mobile Academic Calendar (More hub, month grid, selected-day items, upcoming events and notices
below), mobile Exam Attendance, the pending RBAC work and migration `0239` on the development database, in both repositories, then (mid-run) for
cards that open **filter pages** like the web's for marks entry and the other exam work, and a **language switch in Profile**. Plan, decisions,
evidence and acceptance table: `docs/project/CALENDAR_AND_EXAM_ATTENDANCE_PLAN.md`. Backend side and security findings: the web repository's
`docs/project/project-status.md`, last section.

| Area | Where | State |
| --- | --- | --- |
| Academic Calendar (`teacher.calendar`, More hub card) | `src/features/teacher/calendar/`, `src/api/calendar.ts`, `app/teacher/more/` | built; month in the school's own calendar (AD or BS), day marks, selected-day items, upcoming (60 days), notices (5), offline/empty/error/403 states; 23 tests |
| Exam Attendance (`teacher.exam-attendance`, Academic hub card) | `src/features/teacher/examAttendance/`, `src/api/examAttendance.ts` | built; filters then the paper sheet; version, idempotency, all-or-nothing, conflicts; 37 tests (model, filters, sheet) |
| Filter step (session → class → section → subject/paper) | `src/features/teacher/examFilters/`, `src/components/SelectField.tsx` | built; used by Marks entry (its card list was replaced; entry, drafts and submit unchanged) and Exam attendance |
| More tab becomes a hub (`stack: true`) | `app/teacher/more/`, `src/features/teacher/more/` | built; the Academic hub lists Exam attendance with no code change (registry-driven) |
| Language switch (Profile) | `src/i18n/index.ts`, `src/components/LanguageSwitch.tsx`, `app/_layout.tsx`, `src/features/unsavedWork.ts` | built; remembered on the device, read before the first screen, asks before re-mounting over unsaved edits |

**Checks (2026-10-23).** `pnpm typecheck` clean, `pnpm lint` clean, `pnpm test` 75 suites / 710 tests, `expo export --platform android` OK. The
server contract (the permissions the default teacher receives, the calendar, the exam list, rosters, `sectionId`, 403 for the other roles) was
**Reproduced over HTTP against the phone-test stack** (`zn_school_mobile_test`, container `zn-mobile-test-api` recreated from the new backend image);
the app was not in the loop. **Not run on a phone** (decision D10): the owner's run sheet is in the plan §6. Two things that only a device can
show: that the navigation state survives the language switch's re-mount, and that the `Modal` sheet of `SelectField` behaves on the owner's
Android version.

**Conflicts with this repository's rules, resolved by the owner's explicit instruction (CLAUDE.md §2, rank 1).** `CLAUDE.md` §5 lists notices
(M4) and future teacher features (M5) as "do not pull ahead"; the brief asked for both. The roadmap (protected) was not edited: a proposed
change is in the plan §8.

**Protected documents.** `docs/backend/BACKEND_PREREQUISITES.md` §17 was added because the brief named backend prerequisites explicitly. Not
edited, proposed in the plan §8: `docs/architecture/FEATURE_MODULES.md` (the More hub, the new manifests and access constants),
`docs/project/roadmap.md` (notices and calendar are no longer "future").

## Implemented scaffolding (not features)

| Area                                                                                                                             | Where                                                                                    | State                                                                                                                                                                                                    |
| -------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Expo SDK 57, expo-router entry, `app.config.ts`, `eas.json`                                                                      | root                                                                                     | Implemented (EAS project not linked yet — `eas init`)                                                                                                                                                    |
| Quality gates                                                                                                                    | `pnpm verify` (ESLint 9, `tsc`, Jest)                                                    | Implemented, passing                                                                                                                                                                                     |
| API client, error mapping, events                                                                                                | `src/api/`                                                                               | Implemented; auth adapter attached in `src/bootstrap.ts`. A refresh that fails with an unknown outcome (offline/5xx) now rejects the request instead of ending the session; new `school-suspended` event |
| Query cache (staleTime classes, tenant-prefixed keys, persisted)                                                                 | `src/api/`, `src/lib/queryClient.ts`, `src/providers/`                                   | Implemented                                                                                                                                                                                              |
| Theme tokens (light/dark)                                                                                                        | `src/theme/`                                                                             | Implemented; dark palette is mobile-only, needs review                                                                                                                                                   |
| AD/BS date module                                                                                                                | `src/lib/date.ts`                                                                        | Implemented                                                                                                                                                                                              |
| Feature registry + visibility rule                                                                                               | `src/features/`                                                                          | Implemented; registry holds the five teacher tabs (`teacher.home`, `.attendance`, `.academic`, `.more`, `.profile`) and the `menu` features `teacher.selfAttendance` and `teacher.assignments`; `visibleTabs` shows a tab when it or a feature it hosts is visible                                                                                                                                                                           |
| Login screen (email only) + activation placeholder                                                                               | `app/(auth)/login.tsx`, `activate.tsx`, `src/auth/loginForm.ts`                          | Implemented (2026-10-14). Calls only the existing `POST /identity/login { email, password }`; phone input shows "coming soon" and sends nothing                                                          |
| Token storage (SecureStore, access token also in memory)                                                                         | `src/auth/tokenStore.ts`                                                                 | Implemented                                                                                                                                                                                              |
| Session store, cold-start restore, route guards                                                                                  | `src/auth/session.ts`, `guards.ts`, `tenantStore.ts`                                     | Implemented. Selected school + shell persisted in AsyncStorage (non-secret)                                                                                                                              |
| Refresh (single-flight, persist-before-use, proactive at < 60 s via `exp`)                                                       | `src/auth/authAdapter.ts`, `jwt.ts`                                                      | Implemented; no timers                                                                                                                                                                                   |
| Logout (`POST /identity/logout`, wipe SecureStore + context + query cache + `pdf-cache`) and forced logout on `unauthorized`     | `src/auth/logout.ts`, `SessionEvents.tsx`, `src/lib/files.ts`                            | Implemented                                                                                                                                                                                              |
| Context resolution: `/identity/me`, `/tenancy/my-schools` → none / auto / picker, `/tenancy/my-permissions` → shell              | `src/auth/useSessionContext.ts`, `resolveShell.ts`, `queries.ts`, `app/(context)/*`      | Implemented. `me` is fetched alongside but does not gate navigation. **Guardian shell is unreachable** until backend B4 (`GUARDIAN_ROLE_AVAILABLE = false`)                                              |
| School errors: `TENANT_MEMBERSHIP_NOT_FOUND` (drop school, refetch), `TENANT_ACCESS_DENIED` / `LICENSE_*` ("school unavailable") | `src/auth/SessionEvents.tsx`, `schoolActions.ts`, `app/(context)/school-unavailable.tsx` | Implemented                                                                                                                                                                                              |
| Placeholder shells (one tab each, header switcher when both)                                                                     | `app/teacher/`, `app/guardian/`                                                          | Teacher: tabs now come from the registry (Home, My classes; tab bar hidden while there is one tab; "no features" message if `my_dashboard` is off). Guardian: placeholder until M3. Real path segments `/teacher`, `/guardian` (a group `index` would collide with `/`)                                                      |
| i18n (en + ne, local helper, no library)                                                                                         | `src/i18n/`                                                                              | Implemented; Nepali strings drafted by the assistant, **need native review**; no in-app language switch yet                                                                                              |
| Shared components `Screen`, `Text`, `TextField`, `PasswordField`, `Button`, `MessageScreen`, `ShellSwitcher`, `ShellPlaceholder` | `src/components/`                                                                        | Implemented                                                                                                                                                                                              |
| Teacher Home, `teacher.home` (plan: `TEACHER_HOME_PLAN.md`, steps 1–6) | `src/api/{portal,settings}.ts`, `src/features/{queries,useVisibleFeatures}.ts`, `src/features/teacher/{queries.ts,home/homeModel.ts}`, `src/components/{Card,StatusBadge,Banner,QueryState,AccountActions}.tsx`, `Screen` pull-to-refresh, `formatTimestamp`, `src/features/teacher/home/` (HomeScreen, sections, manifest), `app/teacher/{_layout,index}.tsx` | Implemented and unit-tested (2026-10-21, `pnpm verify` green: 187 tests). **Not yet run against the test stack or on a device** (plan §9), so it is not marked done. Calls `my-classes`, `exams`, tenant settings and mobile-modules; Sign out / Switch school moved to the Home footer |
| My classes, `teacher.assignments` (M2) | `src/features/teacher/assignments/`, `app/teacher/academic/assignments.tsx` (moved under the Academic tab 2026-10-21), `src/components/ListScreen.tsx`, `src/features/{featureDenied,useManualRefresh}.ts`, `src/features/teacher/placement.ts` | Implemented and unit-tested (2026-10-21, `pnpm verify` green: 202 tests; Android bundle exports). Not yet run against the test stack or on a device. Same cached `my-classes` response as Home (no extra request when warm); full list in a virtualized `SectionList`; Home's "+N more" links to it. Mobile module key `my_classes` is new: until the backend web list has it a school cannot switch it off |
| Student attendance, `teacher.attendance` (M2; plan: `ATTENDANCE_PLAN.md`) | `src/api/{attendance.ts,types/attendance.ts}`, `src/lib/uuid.ts`, `shiftIsoDate` in `src/lib/date.ts`, `src/components/DateStepper.tsx`, `ListScreen` footer, `src/features/teacher/attendance/` (model, queries, draft, submit, ClassListScreen, RosterScreen, StatusPicker, AttendanceRow, manifest), `app/teacher/attendance/{_layout,index,roster}.tsx`, `stack` manifest flag, Home cards open the roster | Implemented and unit-tested (2026-10-21, `pnpm verify` green: 365 tests; Android bundle exports). **Not yet run against the test stack or on a device**, so it is not marked done. Nested stack: class list then roster (a single-class teacher skips the list). Reads roster + settings (2 GETs cold, 0 warm); one bulk POST, cache patched from the response. Idempotency key follows the payload. A stale `version` is a per-row `ok:false` failure (not a 409): conflicts are detected from record versions; any 409 maps to `conflict`. Non-school day = read-only; dates stop at the backdate window. **Still to check on a device (plan §9):** `crypto.randomUUID` presence (the fallback is untested on a phone) and that the key passes the backend `@IsUUID()`, `rollNumber` type/null and `remarks` null vs `""` on a live response, double-tap Save, airplane-mode retry (`replayed`), two-device conflict, low-end Android scroll, font scale, Nepali strings |
| Activation (QR / code) and phone login                                                                                           | `app/(auth)`                                                                             | **Not started** — blocked by B3 / B2                                                                                                                                                                     |
| Biometric local unlock, change password                                                                                          | —                                                                                        | Not started                                                                                                                                                                                              |
| Toast, offline banner, error boundary (M1 part A, item 1) | `src/lib/toast.ts`, `src/components/{ToastHost,OfflineBanner,ErrorFallback}.tsx`, mounted in `app/_layout.tsx` | Implemented and unit-tested (2026-10-21, `pnpm verify` green: 225 tests; Android bundle exports). **Not yet run on a device.** `showToast(message, tone)` is the one toast API; the Attendance save is its first caller. `OfflineBanner` is the old Home saved-data banner made shared: Home and My classes use it. The error boundary is expo-router's root-layout `ErrorBoundary` export; the fallback screen is tested, but the actual catch of a render error has not been exercised |
| Teacher shell: five tabs, My Attendance, Academic hub, Profile (plan: `TEACHER_APP_PLAN.md`) | `app/teacher/{_layout,more,profile}.tsx`, `app/teacher/{academic,attendance}/`, `src/features/teacher/{academic,selfAttendance,more,profile}/`, `AttendanceTabScreen`, `src/components/{SegmentedControl,StatTile,Stepper}.tsx`, `src/features/{visibility,routes,registry}.ts`, `src/api/attendance.ts` (self routes), `src/auth/schoolBlock.ts` | Implemented and unit-tested (2026-10-21, `pnpm verify` green: 424 tests; Android bundle exports, Ionicons font only). **Not run on a device or the test stack.** `ponytail-review` and `impeccable critique` ran (code-only, one context; plan §11.6) and the owner's "top fixes" were built: Dashboard shortcut row removed, a tappable `Card` ends in a chevron, the "Coming soon" rows are flat, the active tab icon is filled, headers follow the dark scheme, "Classes today" is now "Classes"; then the rest (compact month list with counts, no repeated titles, chevron stepper icons, the Attendance subtab control pinned above the scrolling area, no per-school `key` on the tabs, `StatTile` local to Home). Open: the month stepper's lower bound. Dashboard has summary tiles (visual redesign later); Academic lists My classes, My subjects, Open exams (read-only) and "Coming soon" rows for Marks entry and Exam routine; More is a placeholder; Profile shows identity, school, Switch school and Sign out (moved off Home; Sign out asks first, no license dates). My Attendance calls `GET/POST /attendance/staff/self`: the live record shape was confirmed over HTTP on 2026-10-22 (plan E9). The blocked screen now names the license reason. New dependency `@expo/vector-icons` |
| Student details, teacher half (M2; plan: `STUDENT_INFO_PLAN.md`) | `getTeacherStudent` in `src/api/portal.ts` (+ types), `src/features/teacher/students/` (`queries`, `studentModel`, `routes`, `useCanOpenStudent`, `TeacherStudentScreen`), `shouldPersistQuery` in `src/lib/queryClient.ts` (used by `QueryProvider`), `TEACHER_STUDENT_INFO_ACCESS` in `teacher/access.ts`, the "Student details" icon button in `AttendanceRow`/`RosterScreen`, `app/teacher/attendance/student.tsx`, strings `studentInfo.*` (en, ne) | Implemented and unit-tested (2026-10-22, 62 suites / 599 tests; Android bundle exports). Live response captured over HTTP. Not shown on a phone. Decisions SI-D1 to SI-D6 accepted as recommended. The student is kept out of the persisted cache; the guardian's e-mail is dropped; own `students` school switch. The guardian profile waits for Guardian V1 |
| Marks entry, `teacher.marks` (M2; plan: `MARKS_PLAN.md`) | `src/api/{academic.ts,types/academic.ts}`, `src/features/teacher/marks/` (`marksModel`, `queries`, `useMarksDraft`, `useSubmitMarks` with `useSaveMarks` and `useSubmitSubject`, `MarksListScreen`, `MarksEntryScreen`, `components/MarksRow`, `manifest`, `routes`), `app/teacher/academic/{marks,marks-entry}.tsx`, strings `marks.*` (en, ne) | Implemented and unit-tested (2026-10-22, `pnpm verify` green: 58 suites, 556 tests; Android bundle exports). Server contract **Reproduced over HTTP** with two teacher accounts, an unlinked account and an administrator (31 requests; MARKS_PLAN §3.3, E-M2). The result `version` is sent on every save (M-D1) and is per student, not per subject (a second subject's save causes a 409, then the re-apply keeps the other subject's marks). The key follows the payload. Only the fields the screens read are kept from the roster and results (persisted-cache minimisation). **Not run in the app or on a phone.** Backend asks A, B (Reproduced: any member reads the roster with guardian names and every subject's marks) and C are the owner's to raise |
| PDF download + cache button                                                                                                      | —                                                                                        | Not started                                                                                                                                                                                              |

Expo Go is fine for the current empty shell. It cannot handle the `znschool://` scheme, the dev
client, or later native config, so the activation QR/deep link work (M1 session) needs a dev build.

Status vocabulary: Planned · Proposed (needs ADR) · Designed · In Progress · Implemented · Approved.

---

## Phases

| Phase                        | Status                     | Gate / notes                                                                                                               |
| ---------------------------- | -------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| M0 Backend prerequisites     | In progress (backend repo) | work packages WP-1…WP-7, see below; nothing mobile-blocking is finished yet                                                |
| M1 App foundation            | In progress                | scaffolding, email login, session, school context built; activation, phone login and long sessions blocked by B1–B3 (WP-1) |
| M2 Teacher core              | In progress                | gate open 2026-10-21 (B5, B6, B7-teacher recorded Implemented, test database); starts with Teacher Home. Teacher shell (five tabs, My Attendance, school-access audit): built and unit-tested 2026-10-21 (`TEACHER_APP_PLAN.md`), not yet run on a device |
| M3 Guardian core             | Planned                    | blocked by B4 (WP-4), B7 guardian + B8 (WP-5)                                                                              |
| M4 Notices + push            | Planned                    | blocked by backend Phase 9, WP-7                                                                                           |
| M5 Extended teacher features | Future                     | not scheduled; one ADR per feature                                                                                         |
| M6 Offline writes            | Future                     | blocked by backend Phase 10                                                                                                |

---

## Backend prerequisites (backend repo)

Verified against the backend repo on 2026-10-16 (code grep, `docs/api/ENDPOINTS.md` §7–7d,
`docs/project/project-status.md`). The last accepted backend ADR is 0063, so new ones start at 0064.
"Built" means present in the backend repo and verified on its test database; it becomes
_Implemented_ for the mobile gate when the owner records it so.

| #   | Item                                                                                        | WP                          | Status                                                                                                                                                                                                                                       | Backend ADR                |
| --- | ------------------------------------------------------------------------------------------- | --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------- |
| B1  | Mobile session policy (client type, 7–10 day inactivity, reuse detection, login throttling) | WP-1                        | Proposed — not built (the mobile timeout column exists but no auth code reads it)                                                                                                                                                            | —                          |
| B2  | Phone as login identifier                                                                   | WP-1                        | Proposed — not built (`users` has no phone)                                                                                                                                                                                                  | —                          |
| B3  | Short activation code + QR slip                                                             | WP-1                        | Proposed — not built (UUID invite token only)                                                                                                                                                                                                | —                          |
| B4  | Guardian identity (`guardians.user_id`, role audience)                                      | WP-4                        | Proposed — not built                                                                                                                                                                                                                         | —                          |
| B5  | Teacher assignments + backend scoping                                                       | WP-2                        | **Implemented** (recorded by the owner 2026-10-21): `staff_members`, `teacher_assignments`, attendance scoped by `attendance.mark_any` / class teacher, `GET /attendance/my-classes` (migrations 0216–0219), marks scoping (`exam_result.save_any`, subject teacher). Backend test database only; the dev database is not migrated | ADR-0062 (attendance part) |
| B6  | Bulk attendance, per-subject marks entry, open-exams list                                   | WP-2                        | **Implemented** (recorded by the owner 2026-10-21): `POST /attendance/records/bulk`, roster, settings, holidays (0212–0215), per-subject marks entry, `GET /portal/teacher/exams`. Backend test database only; the dev database is not migrated                                                                                                | ADR-0061 (attendance part) |
| B7  | Portal read endpoints (`/portal/guardian/*`, `/portal/teacher/*`)                           | WP-3 teacher, WP-5 guardian | **Teacher part Implemented** (recorded by the owner 2026-10-21): `GET /portal/teacher/my-classes`, `/portal/teacher/exams`, `/portal/teacher/students/:id`; backend test database only. `/portal/teacher/home`, `/assignments` and `/sections/:id/roster` were left out on purpose. **Guardian part (`/portal/guardian/*`) is not recorded as Implemented** — M3 gate (B4, B8, WP-5) is separate                                                                                                                                                                                                                         | —                          |
| B8  | Guardian result visibility (published/locked only)                                          | WP-5                        | Proposed — not built                                                                                                                                                                                                                         | —                          |
| B9  | `READ_DB` provider + read replica                                                           | WP-6                        | Proposed — not built (replica blocked by hosting decision)                                                                                                                                                                                   | —                          |
| B10 | Notices, push tokens, SMS/email, timetable, ledger statement                                | WP-7                        | Future                                                                                                                                                                                                                                       | —                          |

Update the ADR column with the backend ADR number once accepted.

### Web features the mobile app can already reuse (verified 2026-10-16, no backend change needed)

- Student attendance: `GET /attendance/roster`, `POST /attendance/records/bulk`, `GET /attendance/settings`,
  `GET /attendance/my-classes`. A refused batch is a 2xx `{ ok:false, failures }`.
- Teacher self attendance: `POST /attendance/staff/self`, `GET /attendance/staff/self` (`attendance.self`).
- Not mobile v1 (exists on web): attendance reports, exam attendance (`exam_attendance.mark`; since 2026-10-23 the default Teacher role holds it, limited to assigned classes).
- Read scope gap: `attendance.read` is school-wide, so the assignment scope on reads arrives only with B7.

---

## Already available in the backend (usable without changes)

- `POST /identity/login|refresh|logout|change-password`, `GET /identity/me`
- `GET /tenancy/my-schools`, `GET /tenancy/my-permissions`, `POST /tenancy/memberships/activate`
- `GET /settings/tenant/mobile-modules`
- Document reprint `GET` endpoints (receipt, invoice PDF, marksheet, exam routine) — staff-scoped
  today; guardian access needs B7

---

## Immediate next actions

1. Finalize the B1–B3 decisions and run the WP-1 prompt in the backend repo (`PHASE_PROMPTS.md`).
2. Finish M1 part A in the mobile repo (PDF download + cache, biometric, change password, EAS link,
   dev build) — no backend dependency. Toast, offline banner and error boundary are built (2026-10-21).
3. Verify Teacher Home and My classes against the backend **test stack** (plan §9: cold/warm request
   count, offline, school switch, logout wipe, light/dark, font scale, Nepali) and record only what ran.
   Also confirm on a live response whether `sectionName` / `sessionName` can be null and how `classes`
   is ordered (the types assume null for a class with no sections; the order is shown as received).
4. `teacher.attendance` is built and unit-tested (2026-10-21; plan `docs/project/ATTENDANCE_PLAN.md`, decisions
   D1–D5 approved). Verify it on the **test stack** and a device (plan §9) and record only what ran. Next M2
   slice: `teacher.marks` (reuses the draft / `baseVersion` / idempotency-key pattern; plan `docs/project/MARKS_PLAN.md`,
   Draft, awaiting approval).
   Backend requests to file when wanted (plan §8, none block): stable `code` on bulk failure items; scope
   `GET /attendance/roster` by assignment (a restricted teacher can read any section by id).
   Backend asks to raise: add `my_classes` to the web mobile-module list; Phase 5 is not on the dev DB.
5. WP-1 (backend) unblocks activation and phone login; WP-4 and WP-5 gate the guardian shell (M3).
   Do not start M3 production integration before its gate; update this file after each verified milestone.
6. Test activation, school selection, role resolution, tenant isolation, session renewal and logout
   with teacher and guardian test accounts once WP-1 and WP-4 exist.

---

## Decisions log

| Date       | Decision                                                                                                                                                         | By   |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---- |
| 2026-10-14 | D1–D8 in `HANDOFF.md` §2 (one app, same backend, phone/email login, code+QR activation, backend-enforced teacher scope, Expo stack, long sessions, read replica) | User |
| 2026-10-16 | Teacher self "Mark Present" is added to M2 as `teacher.selfAttendance` (backend already built)                                                                   | User |
| 2026-10-16 | The M2 gate stays strict: no teacher attendance slice before the B7 teacher portal                                                                               | User |
| 2026-10-21 | B5, B6 and the teacher part of B7 recorded as Implemented (backend test database); the M2 gate is open for the teacher Home slice. Calls go to the test stack only | User |
| 2026-10-21 | Attendance D1–D5 approved: nested stack (class list → roster); dependency-free UUID generator in `src/lib/uuid.ts` (no `expo-crypto`); "today" is device-local; past dates stop at the backdate window; holiday / weekly off is read-only with a banner. Also approved: the `stack` field in `docs/architecture/FEATURE_MODULES.md` | User |
| 2026-10-21 | Teacher shell (`TEACHER_APP_PLAN.md`): five tabs in the owner's order; no code in the web/API repo (a need there becomes backend request B11); Phase 1 database checks on `zn_school_test` only; tab icons from `@expo/vector-icons` (one declared dependency); Academic tab = hub of what exists plus "Coming soon" rows, marks entry stays a later run | User |
| 2026-10-21 | `teacher.selfAttendance` (My Attendance, subtab of Attendance) moves into v1, reversing the 2026-10-18 "after v1" note | User |
| 2026-10-22 | The app is tested on the owner's own Android phone; no emulator is used. The owner names the role (no default Teacher role; "Use the web app") as the cause of the original "new teacher cannot access the app"; a default Teacher role is requested for the web/API project, not built from this repo | User |
| 2026-10-22 | `MARKS_PLAN.md` approved; M-D1 send the result `version` on every save; M-D2 to M-D6 as recommended (unsaved edits in memory only, Submit on the entry screen with a confirm, module key `exams`, no `/validate` dry run, backend asks A, B, C raised by the owner). Teachers do not need a fees route. Teachers need notices (moves the teacher side of M4 into Phase 2; needs its own plan first). On a plain 403 the school's cached data is wiped (S-9 client half; design with a loop guard first) | User |
