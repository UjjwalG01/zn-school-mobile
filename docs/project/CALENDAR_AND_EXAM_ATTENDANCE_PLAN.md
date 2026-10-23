---
description: Plan and record for the mobile Academic Calendar, Exam Attendance, the shared exam filter step and the Profile language switch: scope, contract check, decisions, acceptance, evidence, the phone run sheet and what is not verified.
purpose: One place that says what was asked on 2026-10-23, what was built, how it was checked, and what only the owner's phone or the owner's decision can settle.
access: Read
---

# Calendar, Exam Attendance, Filter Step, Language — Plan and Record

## Status

**Built and unit-tested on 2026-10-23; not run on a phone; nothing committed.** Asked by the owner on 2026-10-23 in one brief (calendar, exam
attendance, migration `0239`, RBAC, security review, both repositories) and two mid-run additions: cards that open **filter pages** like the web
(marks entry first) and a **language switch in Profile**. The backend half (the exam list route, the roster's `sectionId`, the effective-permissions
endpoint, the security review and its findings) is in the web repository's `docs/project/project-status.md`, last section.

---

# 1. What was asked, and what it became

| Ask | Built as | Where |
| --- | --- | --- |
| Academic Calendar inside **More**: month grid, month navigation, dates with events marked, a tapped date lists its items, notices and upcoming events below | `teacher.calendar`, a card in the More hub | `src/features/teacher/calendar/` |
| Reuse the existing calendar, event and notice APIs; no mobile-owned records; school timezone, calendar preference, tenant, visibility; loading/empty/error/offline; `calendar.read`; notices by their own audience rules | `GET /calendar`, `GET /portal/notices`; AD/BS through `lib/date.ts`; the shared `QueryState`/`OfflineBanner`; a refused notices read hides that section only | §3, §5 |
| Exam Attendance on the existing API, active eligible exams, the papers relevant to the teacher, optional section, sectionless class, statuses, all-or-nothing/idempotency/versioning, `exam_attendance.mark` (never `mark_any` to make the UI work) | `teacher.exam-attendance`, a card in the Academic hub; filters then a paper sheet | `src/features/teacher/examAttendance/` |
| "Active exam" — reuse the canonical rule | exam `published` and paper `active`, the rule the save already enforces (it is **not** the marks rule: out of draft, results pending, `allow_modify`) | §4 |
| If the API cannot filter safely, document the gap and make the smallest compatible backend change | `GET /portal/teacher/exam-attendance` and an optional `sectionId` on the roster (backend B16c, B16d) | §3 |
| Cards that open filters (exam, class, subject) like the web | `SelectField` + the shared exam filter step; Marks entry and Exam attendance open on it | §5 |
| Language switch in Profile | `LanguageSwitch`, remembered on the device | §5 |
| Update the API contract, backend prerequisites, permission docs and notes | `API_CONTRACT.md` §2, `BACKEND_PREREQUISITES.md` §17, `TEACHER_FEATURES.md` §2.9–2.12, `UI_SYSTEM.md`, `project-status.md` | this commit's docs |

"Frontend … profile tabs" in the language request was read as **this app's Profile tab** (the web app has no Profile tab and no i18n layer). If the
web app was meant, say so; it would be a separate piece of work (a language preference and translations for the web).

---

# 2. Gate and dependencies

Needs backend migration `0239` (`default_teacher` holds `calendar.read` and `exam_attendance.mark`; exam attendance limited to assigned classes)
and the backend code of 2026-10-23 (the exam list route and `sectionId`). Both are on the backend test, phone-test and development databases and
in the rebuilt development API container (2026-10-23). A backend older than that answers 404 for the exam list; the screen then shows its "could not
load" state.

---

# 3. Contract check (Reproduced over HTTP, 2026-10-23, phone-test stack, the app not in the loop)

Stack: container `zn-mobile-test-api` (new backend image) on `:3411`, database `zn_school_mobile_test` (migrated 0236 → 0239 first). Accounts from
`TEACHER_APP_PLAN.md` §6.2.

| Check | Result |
| --- | --- |
| `phone.default@` (role `default_teacher`) `GET /tenancy/my-permissions` | exactly `attendance.mark, attendance.read, attendance.self, calendar.read, exam_attendance.mark, exam_result.read, exam_result.save, leave.apply`; no `mark_any` |
| same account: `GET /calendar`, `GET /portal/notices`, `GET /portal/teacher/exam-attendance` | 200, 200, 200 with two exams (each paper `recordable`, one `taught`) |
| same account: roster of the first paper; the same with an unknown `sectionId` | 200 with 7 rows `editable: true`; 400 |
| `phone.teacher@` (custom role, no exam-attendance key), `phone.attendance@`, `pt-plain@` (no role), `pt-unlinked@` (marking keys, no staff link) | `GET /calendar` 403; `GET /portal/teacher/exam-attendance` 403 ("You do not have permission (exam_attendance.mark)"); `GET /portal/notices` 200 for all |

The backend's own e2e suites cover what an HTTP probe on a fixture cannot (a teacher outside their class, a smuggled student in a batch, a sectionless
class, another school, stale sessions): backend `apps/api/test/exam-attendance.e2e-spec.ts` (32), `default-teacher-access.e2e-spec.ts` (20),
`effective-permissions.e2e-spec.ts` (12).

---

# 4. Decisions

| # | Decision | Why |
| --- | --- | --- |
| CE-D1 | **Active exam = the exam attendance rule**: exam `published`, paper `active`; the list shows a paper dated after the school's today but not openable ("Opens on …") | the save enforces exactly this; the marks list uses another rule and would offer exams a save refuses |
| CE-D2 | The exam list is a **backend** route (`GET /portal/teacher/exam-attendance`), not client-side filtering of the exam and paper lists | the web exam and paper lists are membership-only and unscoped; filtering them in the app would put a scope rule in the client and leak other classes' exam names; one request instead of N+1 |
| CE-D3 | **Class-wide, not subject-limited**: a teacher may record any paper of an exam for a class they are assigned to; `taught` lists their own subject first and limits nothing | the owner asked for "their class"; limiting by subject is DN-EXAMATT-001 in the backend's proposed ADR-0075 |
| CE-D4 | Section is **optional**: "All my sections" is the default; a chosen section narrows the roster through the server's `sectionId` (never a client filter); a section exam's section is fixed; a class with no sections shows no section filter and sends none | the brief's optional-section and sectionless-class cases |
| CE-D5 | Exam attendance has its **own small model** (`examAttendanceModel.ts`) instead of generalising `attendanceModel.ts`; the idempotency bookkeeping and `StatusPicker` are shared | attendance's model is keyed by student, reads the school's status list and day-off info; generalising tested code was not worth the risk. The draft rules are the same shape on purpose |
| CE-D6 | The roster's daily-attendance reference is **dropped** at the API edge | it is student attendance data the screen does not show, and query data persists on the device for days |
| CE-D7 | The calendar keeps only `kind, id, title, typeLabel, color, startDate, endDate, description`; `internalNotes`, audience flags and ids are dropped at the API edge | an `event.manage` holder's response is wider; nothing the screen does not read should reach the cache |
| CE-D8 | The calendar draws the school's own month (BS months are 29–32 days) and asks the API in AD; a Nepali school whose date the converter cannot place falls back to the Gregorian month | `lib/date.ts` is the one date module; the converter does not throw outside BS 2000–2090 |
| CE-D9 | New school switches: `calendar` for the calendar; exam attendance shares `exams` with marks | a missing row means visible (as `my_classes` began); the backend stores module keys as opaque strings |
| CE-D10 | The filter step is **one pure model and one form** for Marks entry and Exam attendance; Marks entry's old list of exam cards was replaced by it | the owner's request; one behaviour for both. Home and the Academic hub's read-only exam cards remain and are unchanged |
| CE-D11 | The **language change re-mounts the screens** under the root layout; a registry of unsaved edits makes the switch ask first | some translated strings live in `useMemo`; a re-mount is the only way every string is read again. Cost: in-memory drafts are dropped, hence the question. Not verified on a device: that navigation state survives the re-mount |
| CE-D12 | The language is a **device preference** (`AsyncStorage` `zn-locale`), kept through sign-out, read before the first screen | not an account or school fact; the sign-in screen should be in the chosen language |

---

# 5. Behaviour

**Hubs and cards.** Attendance, Academic, More and Profile stay separate tabs. Academic lists My classes, Marks entry, Exam attendance; More lists the
Academic Calendar. A card shows only for a teacher who holds its permission (calendar: `calendar.read`; exam attendance: `exam_attendance.mark`) with
the academic licence and the module on; `exam_attendance.mark_any` is never read. Registry order: Dashboard, Attendance, My Attendance, Academic, My
classes, Marks entry, Exam attendance, More, Calendar, Profile.

**Filters** (`ExamFilterForm`): Exam session, Class, Section (when there is one), Subject or Paper, then "Open marks entry" or "Open attendance".
Choosing a higher filter clears those below; a lone session or class is chosen for the teacher; a paper not yet held keeps the button off and says
when it opens; a returned subject shows the school's reason once chosen.

**Calendar.** Month stepper (bounded by what the date converter can draw), "Go to today", a grid of seven columns with a ring on today and a fill on the
selected day, up to three marks per day (colour tokens mapped to theme colours; the text always names the type), the selected day's items, upcoming
(60 days), notices (5, expandable). Pull to refresh refreshes all three queries.

**Exam attendance sheet.** Three statuses, a remark once a status is set, "Mark remaining present", Save with a count; conflicts, refusals,
offline, 403, closed exam and unsaved-edit guard as in §2.10 of `TEACHER_FEATURES.md`.

**Language.** Profile → Language → English / नेपाली.

---

# 6. Acceptance and evidence

| Criterion | State | Evidence |
| --- | --- | --- |
| Calendar month, navigation, marks, selected day, upcoming, notices, AD and BS | Built, unit-tested | `CalendarScreen.test.tsx` 12, `calendarModel.test.ts` 11 |
| Calendar loading, empty, error, offline, 403, notices-only 403 | Built, unit-tested | same |
| Exam attendance filters (session, class, section optional, sectionless, section exam, blocked paper) | Built, unit-tested | `ExamAttendanceListScreen.test.tsx` 8, `examFilterModel.test.ts` |
| Exam attendance sheet: statuses, versions, idempotency, refusal, offline replay, 403, closed exam, conflicts, guard | Built, unit-tested | `ExamAttendanceSheetScreen.test.tsx` 17, `examAttendanceModel.test.ts` |
| Cards: More and Academic hubs, permission and module gating, `mark_any` not read | Built, unit-tested | `MoreScreen.test.tsx`, `AcademicHubScreen.test.tsx`, both `manifest.test.ts`, `teacher-layout.test.tsx` |
| Marks entry through the filter step | Built, unit-tested | `MarksListScreen.test.tsx` 11 (entry screen tests unchanged, green) |
| Language switch, persistence, root re-mount, unsaved-edit warning | Built, unit-tested | `LanguageSwitch.test.tsx`, `i18n.test.ts`, `root-layout.test.tsx`, `unsavedWork.test.tsx`, `SelectField.test.tsx` |
| Server contract | **Reproduced** over HTTP | §3 |
| Whole suite | `pnpm typecheck` clean, `pnpm lint` clean, `pnpm test` 75 suites / 710 tests, Android export OK | 2026-10-23 |
| On a phone | **Not run** | §7 |

---

# 7. Run sheet for the owner's phone (not run)

Point the app at the phone-test stack (`EXPO_PUBLIC_API_URL=http://192.168.1.65:3411`, restart Metro with a cleared cache). Sign in as
`phone.default@example.com` / `TenantUserPass123`.

1. **More** → the Academic Calendar card → this month with marked days; tap a marked day; step to next month and back; "Go to today". Switch the
   school's calendar to Nepali in the web settings and reopen: the month name and day numbers change.
2. **Academic** → Exam attendance → Class → Paper → Open → mark a few students, Save; reopen and see them saved. Turn on flight mode, change one
   student, Save: the "kept" note appears; turn it off, Save again: saved once.
3. **Academic** → Marks entry → the same filter page; open a subject and enter marks as before.
4. **Profile** → Language → नेपाली: the screens reload in Nepali. Check that you are still on the same tab afterwards (the one thing only a device
   shows). Repeat with unsaved edits on the exam attendance sheet: the question appears first.
5. Sign in as `phone.teacher@` (no calendar or exam-attendance key): neither card appears in the hubs.

---

# 8. Proposed changes to protected documents (not applied)

- `docs/architecture/FEATURE_MODULES.md`: the More tab is a hub (`stack: true`) like Academic; manifests `teacher.calendar` (menu, tab `teacher.more`,
  `calendar.read`, `academic`, module `calendar`) and `teacher.exam-attendance` (menu, tab `teacher.academic`, `exam_attendance.mark`, `academic`,
  module `exams`); access constants `TEACHER_CALENDAR_ACCESS` and `TEACHER_EXAM_ATTENDANCE_ACCESS` in `src/features/teacher/access.ts`.
- `docs/project/roadmap.md`: notices and the school calendar moved from M4/M5 into the teacher shell; the language switch is no longer "later".
- `CLAUDE.md` §5: the "do not pull ahead" list names notices; the owner's brief of 2026-10-23 overrode it for the calendar screen. No edit proposed
  unless the owner wants the list to reflect that.

---

# 9. Not verified / open

- Nothing ran on a phone; the Nepali strings are drafted and need a fluent reviewer; the Nepali calendar's month names stay in English.
- Whether the language re-mount keeps the navigation state on a device; whether the `SelectField` sheet behaves on the owner's Android version.
- "Today" in the calendar and in "recordable" comes from the device for the upcoming window and from the server for `recordable`; a phone in another
  timezone than the school can show a different "today" in the calendar than the server uses. Same limit as the rest of the app.
- DN-EXAMATT-001 (class-wide versus subject-limited exam attendance) is the owner's decision (backend proposed ADR-0075).
- Backend request B17 (scope `exam-results` and attendance reports reads to the teacher's classes) is open; `GET /academic/exam-results` is still
  readable for any class by a teacher who calls it directly (the marks screen calls it only for the exam it opened).
- `ui-ux-pro-max` and `impeccable` (the design skills this repository's rules name) were not run on the new screens in this session: the first was not
  available, and an `impeccable` critique needs a rendered screen. Recommended before release.
