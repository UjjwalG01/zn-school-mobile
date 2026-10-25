---
description: Current implementation status of the ZN School mobile app and its backend prerequisites.
purpose: Single place to check what exists, what is approved, and what blocks the next phase.
access: Read
---

# Mobile Project Status

## Status

Last updated: 2026-10-25 (deferred-work audit, backend-status reconciliation, repository checks and grouped commits; implementation evidence is not advanced beyond the individually dated records below). Earlier milestones: 2026-10-23 UX and teacher-feature work; 2026-10-22 marks entry, student information and Guardian V1 planning; 2026-10-21 M2 teacher gate. See each feature section for verification date and scope. Current mobile work is **M1/M2 completion and verification**: teacher screens are built, but the required owner-run Android walkthrough against the test stack has not been recorded. The backend prerequisites table below reflects backend documentation reviewed on 2026-10-25; it is not fresh verification of target environments. Only endpoints marked _Exists_ in `API_CONTRACT.md` are called. Per-phase prompts: `docs/project/PHASE_PROMPTS.md`.

**Session caveat:** backend B1 is reported built, but the mobile login still uses the email-only request and does not yet send `clientType: 'mobile'` (see `src/api/identity.ts` and `V1_DELIVERY_PLAN.md` §2). Do not claim the seven-day mobile session policy is active in this app until M1 part B is implemented and verified; the backend's earlier web default does not establish the mobile client's effective timeout.

Implemented screens are broader than the original 2026-10-14 snapshot: teacher Home, My classes, student and self attendance, marks entry, student details, Academic Calendar, Exam Attendance, notifications/inbox, Profile and the supporting dashboard/UX work are recorded below as built and unit-tested. They remain unverified on the owner's phone unless a section explicitly records otherwise. No Guardian V1 screen, mobile activation/phone login, PDF download UI, or push registration is recorded as built; the app is not release-ready. Device verification is the owner's own Android phone, no emulator (D10).

**Teacher shell (2026-10-21):** the five-tab teacher shell (Dashboard, Attendance with My Attendance, Academic,
More, Profile) and the audit of why a new teacher sees "service not available for this school" are in
`docs/project/TEACHER_APP_PLAN.md` (decisions D1–D9, acceptance table §9, evidence §10). Phases 0 to 3 are built and
unit-tested in this repo (`pnpm verify` green: 424 tests; the Android bundle exports). **Not run on a device or the
test stack as of the dated evidence; current device status is tracked in the delivery plan.** `ponytail-review` and `impeccable critique` were run on the UI (code-only) and their findings built (plan
§11.6; the month stepper's lower bound is the one note left). The "new teacher can reach their
school" criterion is pending the owner: **the owner names the role as the cause (2026-10-22)**. A teacher whose role grants
neither `attendance.mark` nor `exam_result.save` sees "Use the web app", and the platform seeds no teacher role (only
`tenant_admin` and `guardian`). A default Teacher role was initially requested for the web/API project (B12, drafted in
`docs/project/ROLES_ACCESS_CHECK.md`) next to the onboarding request B11; the license hypothesis H1 (plan §3.6 SQL) stays open but optional. **Update (same day, owner accepted the recommendations):** the default
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
the foundation, complete Teacher V1, implement Guardian V1, release readiness) with pending tasks, owners and gates.
Backend rows below were reconciled against the backend repository's recorded prerequisites/status on 2026-10-25; this is
not fresh verification of current target environments. Protected `roadmap.md` has not been changed and remains a follow-up
for explicit approval.

## Deferred-work audit and next implementation (2026-10-25)

Detailed prerequisites and sequence: `docs/project/DEFERRED_WORK_REQUIREMENTS.md`. This is a static audit of the mobile code and project plans; it does not claim a new live API or device test.

| Deferred item | What is already in place | What remains |
| --- | --- | --- |
| Plain-403 cache handling (S-9 client half) | Central API error classification (`forbidden`), tenant-prefixed query keys and `removeTenantQueries`, existing school-switch/logout cache clearing, and selected write-hook invalidations | No app-wide reaction to a plain tenant-route 403; persisted cached data can remain visible. Implement the owner-selected V-D3 behavior: wipe the selected school's cache on a plain 403, with a strict loop guard and persisted-cache rewrite. Keep special membership, license, suspension and entitlement errors on their existing paths. |
| Role row-level security | Backend request/design captured in `DEFERRED_WORK_REQUIREMENTS.md` §2; mobile consumes permission keys from the API, not role tables | Backend-only, no mobile implementation. Requires an owner-requested and accepted ADR amending ADR-0033 D8, then backend migration, raw-role read/test-helper fixes and full e2e verification. |
| B11 staff onboarding | `default_teacher` role (B12) was built and applied to the development database as recorded above; current web flow has separate staff, membership/login and link steps | Backend/web-only, not implemented as a single atomic flow. Requires the owner's B11-1…B11-6 scope decisions and accepted ADR before backend code; no mobile endpoint is needed. |

**Decision reconciled:** `V1_DELIVERY_PLAN.md` §11, V-D3 already answers the §1.2 choice in `DEFERRED_WORK_REQUIREMENTS.md`: wipe on every plain 403 (option a), with a loop guard. The requirements plan is updated to reflect that existing owner decision; this is not a new decision.

**Next implementation from the deferred-work plan:** implement the plain-403 school-cache wipe in the mobile client (item 1) before Guardian V1 G1. Scope: emit/handle only eligible plain tenant-route 403s; remove the selected tenant's cached queries without affecting another tenant or signed-in user data; prevent repeated forbidden refetch/wipe loops; ensure the persisted cache cannot restore wiped tenant data; test unchanged cache after non-403 failures, special error paths, repeated 403s, school switching and logout. Do not start items 2 or 3 in the mobile repo.

**Next overall project gate:** the owner still needs to run the Android walkthrough against the test stack (V1 delivery plan P1.1–P1.3; no emulator, per D10). This is independent of item 1 and remains the next device-verification step before marking the teacher slices or beginning Guardian V1. Capture evidence only after the run. The owner has authorized grouped commits before that run; these feature changes remain uncommitted until documentation reconciliation and required repository checks are complete.

## Header bell, dashboard chart, marks table, dropdown, spacing, theme (2026-10-23; built and unit-tested; API checks run; not run on a phone; grouped commits pending)

**Brief.** After committing the earlier work (`711081a`, with the owner's manual edits), the owner asked for: a notification bell in the shared header,
"My Attendance This Month" on the Dashboard, a one-line-per-student marks table with Theory and Practical columns, a dropdown anchored to its field,
one shared page spacing, the horizontal margins checked, light and dark requirements with a toggle in Profile, and smaller type, buttons, tabs and
icons. Plan, decisions, evidence and run sheet: `docs/project/HEADER_BELL_AND_UX_PLAN.md`. Treat that plan as the detailed source for this workstream; this section summarizes delivered scope, outstanding items and the next actions.

| Area | Where | State |
| --- | --- | --- |
| Horizontal margins | `gutter` in `tokens.ts`; `Screen`, `ListScreen`, `Banner`, `SegmentedControl`, `login.tsx`, `school-picker.tsx` | **bug fixed**: the manual edits had split `padding` into vertical-only values (this React Native version has no `padding` shorthand in its types), so pages touched the screen edges; `layoutInsets.test.tsx` guards it |
| Notification bell + inbox (`teacher.notifications`) | `src/features/notifications/`, `src/features/teacher/notifications/`, `src/api/notifications.ts`, `shellHeaderOptions` in `BrandHeader.tsx`, `app/teacher/more/notifications.tsx` | built; one shared query for badge and list; read patched from the answer; events and notices open the Calendar. **Holidays raise no notification (backend B19); push is not built** |
| My Attendance This Month | `MyAttendanceChart` in `ChartsSection.tsx`, `useMyAttendance(null, enabled)` | built; one extra request (`GET /attendance/staff/self`, shared with My Attendance); counts only |
| Marks-entry table | `src/features/teacher/marks/` (`MarksRow`, `MarkCell`, `MarksTableHeader`, `markColumns`) | built; save, submit, drafts and versions unchanged. **Theory / Practical columns and the disabled Practical box need the backend to send `componentType` (B18)**; until then one column per component under its own name |
| Anchored dropdown | `SelectField`, `dropdownPlacement.ts` | built; core `Modal`, no dependency; placement on the owner's Android is a device check |
| Light / dark toggle | `themePreference.ts`, `ThemeSwitch`, Profile; requirements in `UI_SYSTEM.md` §9 | built; Auto / Light / Dark, remembered, applied at once. Light palette has two 4.47:1 pairs inherited from the web palette |
| Smaller type, buttons, tabs, icons | `typography`, `iconSize` in `tokens.ts`, `Button`, `TextField`, tab bar | built; hit areas stay 44pt |

**Checks.** The 2026-10-23 baseline was 86 suites / 795 tests; on 2026-10-25 `pnpm lint` passed with one warning in `CurvedHeader.tsx`, `pnpm typecheck` passed, and `pnpm test` passed 86 suites / 803 tests after updating stale UI/i18n test expectations. Android phone verification remains pending.
Server behaviour (inbox isolation, another person's and another school's rows, `staff/self` scope, marks permission and subject scope, no
`componentType` on the components) was **Reproduced over HTTP, 27 of 27, on the mobile test API** with the app not in the loop (plan §6).
`expo export --platform android` OK. `ponytail-review` and an `impeccable` critique were run (code only); their open findings are in plan §9 (no keyboard "next" flow in the
marks table, back from the inbox lands on the More hub, light-mode muted text at 4.47:1, Dashboard order). **Not run on a phone** (decision D10): the bell,
the dropdown position, the table at 360pt, Dark on every screen and the smaller type are the owner's checks (plan §7).

**Pending / next steps (plan §7–§9).** The feature work is built and unit-tested, but the plan is not phone-verified or committed. Follow this order:

1. **Owner's Android run (test backend only):** execute the plan §7 run sheet for header bell/inbox, dashboard chart after marking attendance, marks table (including 30+ students, validation and saving), dropdown placement, consistent margins, light/dark appearance, and larger system fonts. Record actual results; do not claim device verification until it is run. This is the next project action because the owner tests on their own phone (decision D10).
2. **Resolve review/design follow-ups:** decide whether to plan/fix the marks keyboard-next flow (P1); decide whether inbox Back should return to the originating tab (P2, requires navigation-architecture approval); ask the web owner to address the light-mode muted-text contrast token (P2); decide whether to reorder Dashboard summaries below the teacher's daily actions (P2). The long-dropdown selected-row scrolling (P3) can be handled as a follow-up. These are not silently included in the completed scope.
3. **Backend owner follow-up:** raise B18 (exam component type), B19 (holiday notifications), and B20 (event notification date) from `BACKEND_PREREQUISITES.md` §18 if those behaviors are required. Until B18 is delivered, marks display one column per component by its API name; holidays do not produce inbox notifications; event rows lack a date.
4. **Housekeeping:** get native review of the new Nepali strings; apply the proposed roadmap and `FEATURE_MODULES.md` updates only with the required explicit approval (plan §8); then commit this workstream when the owner authorizes it. The plan currently records it as uncommitted.
5. **Continue the wider phase plan:** the immediate M1/M2 work remains the test-stack/device verification of Teacher Home, My classes, Attendance and the teacher slices, followed by completing the M1 release-foundation items (EAS link/dev build, PDF cache, biometric/change password as approved) and their acceptance checks. Keep Guardian V1 gated on its plan's prerequisite, the successful Teacher phone run; do not treat this UX plan as completing M1 or M2.

**Not included / not built.** Push notifications, guardian inbox/bell, and mark-all-read are out of scope for this workstream; push also needs the approved Expo project and development build. The work has unit/API evidence but no phone evidence. See `docs/project/HEADER_BELL_AND_UX_PLAN.md` §§7–9 for the complete acceptance run sheet and open findings.

## Dashboard order: calendar, events, notices, then summaries (2026-10-23; built; Home tests only; not run on a phone)

**Brief.** Put the Academic Calendar on the Dashboard just below the cards, the events and notices just below it, and keep the other details as
summaries that open their own pages. Order now: header, tiles, calendar (title, "Open calendar", month, tapped day), upcoming events, notices,
My Attendance chart, Marks entry progress chart, Subjects by class chart.

| Area | Where | State |
| --- | --- | --- |
| Calendar blocks shared by the Calendar screen and the Dashboard | `calendar/{useCalendarBoard.ts,CalendarSections.tsx}`; `CalendarScreen` now only composes them; `useNotices(enabled)` | built; shown on the Dashboard only with `calendar.read` (a plain 403 hides the whole block); no new request kind: the Calendar screen's month, 60-day window and notices, same cache keys |
| Summaries open their pages | tiles and the three charts take `onOpen`; targets come from the visible features (`teacher.assignments`, `teacher.marks`), `ATTENDANCE_TAB_HREF`, new `SELF_ATTENDANCE_TAB_HREF` | built; a target the school hides leaves that card plain |
| Removed from the Dashboard | the Attendance class cards, the Marks exam cards and the My subjects list (all on their pages); `AttendanceSection.tsx` deleted, `Section`'s unused `hint` prop and the strings `home.attendance`, `home.attendanceHint` removed | `SubjectsSection` and `MarksSection` stay: the Academic hub uses them |

**Cost.** With `calendar.read` the Dashboard's first load adds three GETs (`/calendar` twice, notices once), then none for 5 minutes (Daily class) and none when the
Calendar screen is opened afterwards. There is no aggregated endpoint for them.

**Checks (2026-10-23), on request only the updated part.** `HomeScreen.test.tsx` 34 of 34 (rewritten: order, request count, 403, retry, links);
`CalendarScreen.test.tsx` passed after the refactor; `tsc` and ESLint clean on the touched folders. The full `pnpm test` / `pnpm verify` and the Android
export were **not** re-run. `ponytail-review` ran on the diff (one accessibility fix and dead code removed); `impeccable` was **not** run. Not run on a phone.

**For the owner.** The Home header was edited by hand (school name or "Orbis Education" in place of the greeting); its `name` prop and the
`home.greeting` string are now unused, and I did not touch it. New Nepali string `dashboard.openCalendar` needs native review.

## Calendar, exam attendance, filter step, language switch (2026-10-23; built and unit-tested; not run on a phone)

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

The Orbis layout (next section) restyled the screens of this section's features (header, event rows, buttons) without changing what they do.

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

## Orbis layout, branding and dashboard charts (2026-10-23; built and unit-tested; not run on a phone)

**Brief.** The owner asked for the sign-in screen and the inside pages to follow the Stellar UI kit references (Sign-In, Calendar), the
layouts reusable for every future page, the app named **Orbis** with a placeholder logo and educational motifs in the header, the web
palette, and simple charts on the teacher dashboard. Design rules and how to add a page: `docs/frontend/UI_SYSTEM.md` §8.

| Area | Where | State |
| --- | --- | --- |
| Sign-in and Activate layout (banner with logo, name, title; form on the sheet) | `src/components/AuthScreen.tsx`, `app/(auth)/{login,activate}.tsx` | built; logic of both screens unchanged |
| Page header for every screen (back arrow, title, action; curved brand header with motifs) | `src/components/{CurvedHeader,BrandHeader,HeaderBackdrop}.tsx`, `brandHeaderOptions` spread by `app/teacher/**/_layout.tsx` and `app/guardian/_layout.tsx` | built; `useHeaderOptions` was removed (the navigation header is now this one) |
| Full-screen states and the school picker | `src/components/MessageScreen.tsx`, `app/(context)/school-picker.tsx` | built; the title moved into the header |
| Brand name and placeholder logo | `auth.brand` = Orbis (en, ne), `name` in `app.config.ts`, `assets/brand/logo.png`, `BrandLogo` | built; the logo is a generated placeholder to replace |
| Pill button, rounder cards and fields, tinted cards, date badge | `Button`, `Card` (`tint`), `TextField`, `DateBadge`, `radius.xl/sheet`, `withAlpha` in `src/theme/tokens.ts` | built |
| Calendar event rows (date badge + tinted card) | `CalendarScreen`, `formatDayMonth` in `src/lib/date.ts` | built |
| Dashboard charts: marks entry progress, subjects by class | `src/components/{StackedBar,BarChart}.tsx`, `src/features/teacher/home/sections/ChartsSection.tsx`, `progressTotals`, `subjectsPerClass` | built; drawn from the two reads Home already makes (no extra request), no new dependency |

**Checks (2026-10-23).** `pnpm verify` green: lint and typecheck clean, 79 suites / 731 tests; `expo export --platform android` OK (the logo
asset is in the bundle). **Not run on a phone** (decision D10), so nobody has seen the curves, the motifs, the status-bar icon colour, the
sign-in layout with the keyboard open, large fonts or dark mode on a real screen: those are the owner's checks. Two things only a device
shows: whether the header's top-right/bottom-left curves look as the references do, and whether the faint motifs are visible enough.

**Decisions the owner may want to revisit.**
- `app.config.ts` is protected; only its display `name` changed ("ZN School" to "Orbis"), on the owner's explicit instruction. The slug,
  scheme and bundle identifiers are unchanged. The app icon and splash image are still the Expo template ones (the brief named the logo only).
- Charts are plain `View`s. A chart library or `react-native-svg` would be a new dependency (CLAUDE.md §4) and was not added.
- This earlier note is superseded: the "My Attendance This Month" chart was built on 2026-10-23 using
  `GET /attendance/staff/self`, shared with My Attendance. It still needs phone verification.
- The `ui-ux-pro-max` and `ponytail` plugins were installed for this project on 2026-10-23 (project scope; `impeccable` is enabled in
  `.claude/settings.json` but not installed for this repository yet). They load only after `/reload-plugins` or a new session, so this
  work followed their rules from the installed files; `impeccable` and `ponytail-review` were **not** run on the result.

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
| Login screen (email only) + activation placeholder                                                                               | `app/(auth)/login.tsx`, `activate.tsx`, `src/auth/loginForm.ts`                          | Implemented (2026-10-14). Calls only the existing mobile-client implementation `POST /identity/login { email, password }`; phone input shows "coming soon" and sends nothing. Backend B1/B2 are reported built, but M1 part B is not implemented here |
| Token storage (SecureStore, access token also in memory)                                                                         | `src/auth/tokenStore.ts`                                                                 | Implemented                                                                                                                                                                                              |
| Session store, cold-start restore, route guards                                                                                  | `src/auth/session.ts`, `guards.ts`, `tenantStore.ts`                                     | Implemented. Selected school + shell persisted in AsyncStorage (non-secret)                                                                                                                              |
| Refresh (single-flight, persist-before-use, proactive at < 60 s via `exp`)                                                       | `src/auth/authAdapter.ts`, `jwt.ts`                                                      | Implemented; no timers                                                                                                                                                                                   |
| Logout (`POST /identity/logout`, wipe SecureStore + context + query cache + `pdf-cache`) and forced logout on `unauthorized`     | `src/auth/logout.ts`, `SessionEvents.tsx`, `src/lib/files.ts`                            | Implemented                                                                                                                                                                                              |
| Context resolution: `/identity/me`, `/tenancy/my-schools` → none / auto / picker, `/tenancy/my-permissions` → shell              | `src/auth/useSessionContext.ts`, `resolveShell.ts`, `queries.ts`, `app/(context)/*`      | Implemented. `me` is fetched alongside but does not gate navigation. **Guardian shell is intentionally unreachable in the mobile app** (`GUARDIAN_ROLE_AVAILABLE = false`); backend B4 is reported built, but M1 part B and Guardian V1 remain gated |
| School errors: `TENANT_MEMBERSHIP_NOT_FOUND` (drop school, refetch), `TENANT_ACCESS_DENIED` / `LICENSE_*` ("school unavailable") | `src/auth/SessionEvents.tsx`, `schoolActions.ts`, `app/(context)/school-unavailable.tsx` | Implemented                                                                                                                                                                                              |
| Placeholder shells (one tab each, header switcher when both)                                                                     | `app/teacher/`, `app/guardian/`                                                          | Teacher: tabs now come from the registry (Home, My classes; tab bar hidden while there is one tab; "no features" message if `my_dashboard` is off). Guardian: placeholder until M3. Real path segments `/teacher`, `/guardian` (a group `index` would collide with `/`)                                                      |
| i18n (en + ne, local helper, no library)                                                                                         | `src/i18n/`                                                                              | Implemented; Nepali strings drafted by the assistant, **need native review**; the in-app language switch is implemented and device behavior still needs verification                                                                                              |
| Shared components `Screen`, `Text`, `TextField`, `PasswordField`, `Button`, `MessageScreen`, `ShellSwitcher`, `ShellPlaceholder` | `src/components/`                                                                        | Implemented                                                                                                                                                                                              |
| Teacher Home, `teacher.home` (plan: `TEACHER_HOME_PLAN.md`, steps 1–6) | `src/api/{portal,settings}.ts`, `src/features/{queries,useVisibleFeatures}.ts`, `src/features/teacher/{queries.ts,home/homeModel.ts}`, `src/components/{Card,StatusBadge,Banner,QueryState,AccountActions}.tsx`, `Screen` pull-to-refresh, `formatTimestamp`, `src/features/teacher/home/` (HomeScreen, sections, manifest), `app/teacher/{_layout,index}.tsx` | Implemented and unit-tested (2026-10-21, `pnpm verify` green: 187 tests). **Historical evidence has no current device/test-stack run recorded**, so it is not marked done. Calls `my-classes`, `exams`, tenant settings and mobile-modules; Sign out / Switch school moved to the Home footer |
| My classes, `teacher.assignments` (M2) | `src/features/teacher/assignments/`, `app/teacher/academic/assignments.tsx` (moved under the Academic tab 2026-10-21), `src/components/ListScreen.tsx`, `src/features/{featureDenied,useManualRefresh}.ts`, `src/features/teacher/placement.ts` | Implemented and unit-tested (2026-10-21, `pnpm verify` green: 202 tests; Android bundle exports). **Historical evidence has no current test-stack or device run recorded.** Same cached `my-classes` response as Home (no extra request when warm); full list in a virtualized `SectionList`; Home's "+N more" links to it. Mobile module key `my_classes` is new: until the backend web list has it a school cannot switch it off |
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

| Phase                        | Status                     | Gate / notes                                                                                                                                                                                            |
| ---------------------------- | -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| M0 Backend prerequisites     | In progress (backend repo) | Current backend records report B1–B8 and B10 built; B9 and later requests remain open. Backend environment/application status still requires owner confirmation for each gate.                              |
| M1 App foundation            | In progress                | Email login, session and school context exist; mobile phone login and activation are not built. Backend B1–B3 are reported built, but M1 part B and its device verification remain open.                    |
| M2 Teacher core              | In progress                | Teacher workflows, including marks, Calendar, Exam Attendance and notifications/inbox, are built and unit-tested. The owner-run Android walkthrough against the test stack is still pending (D10).         |
| M3 Guardian core             | Planned                    | Backend B4, B7 guardian and B8 are reported built; mobile M1 part B, Teacher V1 verification and owner recording of the backend gate remain prerequisites.                                                 |
| M4 Notices + push            | In progress                | Teacher inbox/notices work is built as recorded above; guardian reuse and push registration/device verification remain open.                                                                               |
| M5 Extended teacher features | Future                     | not scheduled; one ADR per feature                                                                                                                                                                       |
| M6 Offline writes            | Future                     | blocked by backend Phase 10                                                                                                                                                                              |

---

## Backend prerequisites (backend repo)

Reconciled against the backend repository's `docs/backend/BACKEND_PREREQUISITES.md` and project status as recorded 2026-10-25; this is not a fresh backend or environment verification. The backend status details and caveats are tracked in the table below. Backend-built does not imply that the mobile client flow is implemented or that a particular target database has been verified.

| #   | Item                                                                                        | WP                          | Status                                                                                                                                                                                                                                       | Backend ADR                |
| --- | ------------------------------------------------------------------------------------------- | --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------- |
| B1  | Mobile session policy (client type, 7–10 day inactivity, reuse detection, login throttling) | WP-1                        | Backend built (ADR-0066, per backend prerequisites/status reconciled 2026-10-25); mobile client support and device verification remain pending                                                                                                                                                            | —                          |
| B2  | Phone as login identifier                                                                   | WP-1                        | Backend built (ADR-0066, per backend prerequisites/status reconciled 2026-10-25); mobile login still sends email only                                                                                                                                                                                                  | —                          |
| B3  | Short activation code + QR slip                                                             | WP-1                        | Backend built (ADR-0067, per backend prerequisites/status reconciled 2026-10-25); mobile activation flow is not built                                                                                                                                                                                                | —                          |
| B4  | Guardian identity (`guardians.user_id`, role audience)                                      | WP-4                        | Backend built (ADR-0067, per backend prerequisites/status reconciled 2026-10-25); guardian mobile gate also requires B7/B8 and M1 part B                                                                                                       | —                          |
| B5  | Teacher assignments + backend scoping                                                       | WP-2                        | **Implemented** (recorded by the owner 2026-10-21): `staff_members`, `teacher_assignments`, attendance scoped by `attendance.mark_any` / class teacher, `GET /attendance/my-classes` (migrations 0216–0219), marks scoping (`exam_result.save_any`, subject teacher). Environment/application status must be confirmed for the target run | ADR-0062 (attendance part) |
| B6  | Bulk attendance, per-subject marks entry, open-exams list                                   | WP-2                        | **Implemented** (recorded by the owner 2026-10-21): `POST /attendance/records/bulk`, roster, settings, holidays (0212–0215), per-subject marks entry, `GET /portal/teacher/exams`. Environment/application status must be confirmed for the target run                                                                                                | ADR-0061 (attendance part) |
| B7  | Portal read endpoints (`/portal/guardian/*`, `/portal/teacher/*`)                           | WP-3 teacher, WP-5 guardian | Backend built (backend prerequisites/status reconciled 2026-10-25): teacher and guardian portal reads exist; cited HTTP evidence did not exercise guardian results/fees with data. Mobile teacher routes are used; guardian routes are not yet in the app. `/portal/teacher/home`, `/assignments` and `/sections/:id/roster` were left out on purpose                                                                                                                                                                              | —                          |
| B8  | Guardian result visibility (published/locked only)                                          | WP-5                        | Backend built (backend prerequisites/status reconciled 2026-10-25): released results only; not exercised with data in cited evidence. Guardian mobile gate remains closed pending other prerequisites                                                                          | —                          |
| B9  | `READ_DB` provider + read replica                                                           | WP-6                        | Proposed — not built (replica blocked by hosting decision)                                                                                                                                                                                   | —                          |
| B10 | Notices, push tokens, SMS/email, timetable, ledger statement                                | WP-7                        | Backend built in part (ADR-0069, Phase 6, migration 0231 per backend prerequisites/status reconciled 2026-10-25): notices, inbox and devices/push; SMS/email and other listed channels remain unbuilt. Mobile teacher inbox is implemented; push registration is not | —                          |

Update the ADR column with the backend ADR number once accepted.

### Web features the mobile app can already reuse (originally checked 2026-10-16; retain as historic notes, not a current availability check)

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

1. Project-document reconciliation and repository checks are complete for this pass: lint passed with one warning in `CurvedHeader.tsx`, typecheck passed, and tests passed (86 suites / 803 tests).
2. The reviewed current changes were committed in logical groups on 2026-10-25; the working tree is clean. Device verification remains separate and is not implied by those commits.
3. Owner-run Android walkthrough on the test stack (D10, no emulator): verify the teacher shell, attendance, self-attendance, marks/conflict handling, Calendar, Exam Attendance, notifications/inbox, language/theme, school switching, logout/cache clearing, session expiry, type scale, low-end scrolling and Nepali strings. Record only observed evidence in the feature plans.
4. Implement the plain-403 selected-school cache wipe with a loop guard, including memory and persisted-cache behavior; add tests for selected-tenant isolation, special error paths, repeat 403s, school switching and logout. This is the next mobile implementation before Guardian V1 G1.
5. Continue M1 completion (phone login/activation, development build, PDF cache, approved biometric/change-password work) and Teacher V1 follow-ups; do not enable Guardian V1 until the Phase 2 and backend gates are confirmed.
6. Backend-only follow-ups remain separate: role-RLS ADR and B11 onboarding ADR/decisions. Do not implement backend work from this repository.

---

## Decisions log

| Date       | Decision                                                                                                                                                         | By   |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---- |
| 2026-10-14 | D1–D8 in `HANDOFF.md` §2 (one app, same backend, phone/email login, code+QR activation, backend-enforced teacher scope, Expo stack, long sessions, read replica) | User |
| 2026-10-16 | Teacher self "Mark Present" is added to M2 as `teacher.selfAttendance` (backend already built)                                                                   | User |
| 2026-10-16 | The M2 gate stays strict: no teacher attendance slice before the B7 teacher portal                                                                               | User |
| 2026-10-21 | B5, B6 and the teacher part of B7 recorded as Implemented (backend test database); the M2 gate is open for the teacher Home slice. Calls go to the test stack only | User |
| 2026-10-25 | Grouped commits authorized for the current project work before the Android walkthrough; this supersedes the earlier Q9 wait-for-phone-run decision. Device verification remains pending | User |
| 2026-10-21 | Attendance D1–D5 approved: nested stack (class list → roster); dependency-free UUID generator in `src/lib/uuid.ts` (no `expo-crypto`); "today" is device-local; past dates stop at the backdate window; holiday / weekly off is read-only with a banner. Also approved: the `stack` field in `docs/architecture/FEATURE_MODULES.md` | User |
| 2026-10-21 | Teacher shell (`TEACHER_APP_PLAN.md`): five tabs in the owner's order; no code in the web/API repo (a need there becomes backend request B11); Phase 1 database checks on `zn_school_test` only; tab icons from `@expo/vector-icons` (one declared dependency); Academic tab = hub of what exists plus "Coming soon" rows, marks entry stays a later run | User |
| 2026-10-21 | `teacher.selfAttendance` (My Attendance, subtab of Attendance) moves into v1, reversing the 2026-10-18 "after v1" note | User |
| 2026-10-22 | The app is tested on the owner's own Android phone; no emulator is used. The owner names the role (no default Teacher role; "Use the web app") as the cause of the original "new teacher cannot access the app"; a default Teacher role is requested for the web/API project, not built from this repo | User |
| 2026-10-22 | `MARKS_PLAN.md` approved; M-D1 send the result `version` on every save; M-D2 to M-D6 as recommended (unsaved edits in memory only, Submit on the entry screen with a confirm, module key `exams`, no `/validate` dry run, backend asks A, B, C raised by the owner). Teachers do not need a fees route. Teachers need notices (moves the teacher side of M4 into Phase 2; needs its own plan first). On a plain 403 the school's cached data is wiped (S-9 client half; design with a loop guard first) | User |
