---
description: Plan and record for the notification bell and inbox, the "My Attendance This Month" dashboard chart, the marks-entry table, the anchored dropdown, the shared page spacing and the light/dark toggle with the smaller type scale (2026-10-23).
purpose: One place that says what was asked, what the backend already does, what was built and how it was checked, what needs a backend change, and what only the owner's phone or the owner's decision can settle.
access: Read
---

# Header Bell, Dashboard Chart, Marks Table, Dropdown, Spacing, Theme — Plan and Record

## Status

**Built and unit-tested on 2026-10-23; run over HTTP against the mobile test API (27 checks); not run on a phone (decision D10).** The
owner's 2026-10-25 request supersedes the earlier commit hold; this workstream is pending grouped commits after repository checks.
(the owner's earlier work was committed first as `711081a`, with the manual edits). The 2026-10-25 repository checks passed: `pnpm lint` (one
warning in `CurvedHeader.tsx`), `pnpm typecheck`, and `pnpm test` (86 suites / 803 tests). Nothing was changed in the web/API repository;
what it would need is `BACKEND_PREREQUISITES.md` §18 (B18 to B20, proposed).

---

# 1. What was asked, and what it became

| Ask | Built as | Where |
| --- | --- | --- |
| Commit the previous work and accept the manual edits | commit `711081a` with everything in the tree | git |
| Check the horizontal margins | **Found:** the manual edits turned `padding` into `paddingVertical` in `Screen`, `ListScreen` (and its footer), `Banner`, `SegmentedControl`, the sign-in alerts and the school picker rows, so page content touched the screen edges and text touched its box border. The cause is that this React Native version's style types have no `padding` shorthand. Fixed with both axes written out, one shared `gutter` token and a test | `src/theme/tokens.ts`, `Screen`, `ListScreen`, `Banner`, `SegmentedControl`, `login.tsx`, `school-picker.tsx`; `layoutInsets.test.tsx` |
| 2 Notification bell at the top right of the shared header, unread badge, list with title / date / read state, events, holidays, calendar updates and notices, tap opens the destination, reuse the inbox, read state, loading / empty / failure | `NotificationBell` at the end of every teacher page header (`teacherHeaderOptions`), `teacher.notifications` (More hub card and the bell's target), one shared inbox query, read patched from the server's answer | `src/features/notifications/`, `src/features/teacher/notifications/`, `src/api/notifications.ts`, `BrandHeader.shellHeaderOptions` |
| 3 "My Attendance This Month" chart | `MyAttendanceChart` on the Dashboard: the caller's own month by status, one request, shared with My Attendance | `ChartsSection.tsx`, `useMyAttendance(null, enabled)` |
| 4 Marks-entry table: one line per student, roll order, summary header, Theory / Practical columns, practical disabled when it does not apply | `MarksEntryScreen` with a summary card, a sticky column header, `MarksRow` (one line), `MarkCell`; `markColumns` decides the columns | `src/features/teacher/marks/` |
| 5 Dropdown anchored to the field | `SelectField` opens under (or over) the field through `placeDropdown` | `src/components/SelectField.tsx`, `dropdownPlacement.ts` |
| 6 Consistent top-level spacing | `gutter`, applied once by `Screen` and `ListScreen`; the subtab control uses it; no page adds its own edge margin | `UI_SYSTEM.md` §10 |
| 7 Security, tests, documentation | 27 HTTP checks (§6), 795 unit tests, this plan, `API_CONTRACT.md` §2, `BACKEND_PREREQUISITES.md` §18, `UI_SYSTEM.md` §9 to §11, `project-status.md` | |
| Light and dark mode requirements and a toggle in the profile section | requirements T1 to T11 in `UI_SYSTEM.md` §9; `ThemeSwitch` (Auto / Light / Dark) in Profile; remembered on the device | `src/theme/themePreference.ts`, `src/components/ThemeSwitch.tsx` |
| Smaller font sizes for screens, buttons, tabs and icons | type scale 11 / 13 / 14 / 17 / 21, `iconSize` 16 / 18 / 22, 44-high buttons and fields, tab labels in `caption`, tab icons 22; hit areas stay 44 | `tokens.ts`, `Button`, `TextField`, `app/teacher/_layout.tsx` |

---

# 2. Gate and conflicts

**Commit status update (2026-10-25):** the earlier statement that this brief was not committed is a working-tree status note,
not a scope gate. The owner has explicitly authorized grouped commits; no commit is claimed until checks and staging complete.

- **CLAUDE.md §5** lists notices / push (M4) as "do not pull ahead". The owner moved the teacher side of notices and the inbox into M2 on
  2026-10-22 (roadmap M2), and the brief of today asks for the bell. The owner's explicit instruction ranks first (§2 rank 1). **Push is not
  built**: it needs an Expo project, a development build and `POST /portal/devices`, which is the architectural decision CLAUDE.md §4 reserves.
- **The roadmap line** "Notices and the in-app inbox for a teacher … Not started; needs its own plan" is now out of date; the roadmap is
  protected, so the change is only proposed (§8).
- **Backend boundary:** nothing in the web/API repository was touched. Three gaps are requests B18 to B20.
- **Dependencies:** none added. The dropdown uses the core `Modal`; the bell uses Ionicons, already installed.
- **Skills:** `ponytail` governed the code. `ui-ux-pro-max` and `impeccable` were available but their web-specific guidance (CSS, shadcn)
  was translated, not copied: tokens only, no component library. `ponytail-review` and an `impeccable` critique were run on the diff (code only, one context: no sub-agents were
  spawned and the `impeccable` detector binary is not installed, so it was not downloaded); §9 lists what they found.

---

# 3. Contract check

**What the backend already does** (`docs/api/ENDPOINTS.md` §7f, §7g, §7h; code read 2026-10-23):

| Question | Answer |
| --- | --- |
| Is there an inbox the app can read? | Yes: `GET /portal/notifications` (own rows, `unread` count) and `POST /portal/notifications/:id/read`; membership only |
| Which changes create an inbox row? | `SchoolEventPublished` when an event is **created** and its type has `notify` (an edit tells nobody); `NoticePublished`; `LeaveSubmitted`, `LeaveDecided`; guardian-only `StudentMarkedAbsent`, `ResultsPublished` |
| Do holidays? | **No.** `calendar-events.contract.ts` holds only `SchoolEventPublished`; the holiday code appends no event. A holiday shows in `GET /calendar` and notifies nobody (B19) |
| Is visibility on the server? | Yes: the fan-out picks recipients by audience, staff type and class assignment from the payload, and each recipient must hold the key that opens the item. The inbox read is by `user_id` and `tenant_id` (RLS on `notifications`) |
| What does a row carry? | `{ id, type, referenceId, title, readAt, createdAt }`; no date for an event (B20) |
| Does the route that lists components say Theory / Practical? | **No.** The database has `exam_components.component_type`; the route sends `{ id, name, maxMarks }` (B18). Verified on the test API |
| Which read feeds the attendance chart? | `GET /attendance/staff/self` (own records for a month; the server decides who) |

---

# 4. Decisions

| # | Decision | Why |
| --- | --- | --- |
| H-D1 | The bell is part of the shared header: `shellHeaderOptions(trailing)` puts it last on the bar, after a screen's own action; the teacher tab navigator and all three nested stacks spread `teacherHeaderOptions` | one place, no per-screen bell; a nested screen keeps it |
| H-D2 | The inbox is a registered feature `teacher.notifications` (More hub card, no permission, no licence, no school switch) | the registry is the only list of routes (mobile-frontend §8); the endpoint is membership-only |
| H-D3 | One query for the badge and the list, Daily class (5 min), persisted, tenant-prefixed key; refresh on foreground (throttled) or pull | api-and-data §4, §5: no polling; the bell costs one request on first load and none when warm |
| H-D4 | A tap marks the row read first and then navigates; the cache is patched from the answer, a failure leaves it unread with one toast | api-and-data §6 (no refetch after a write); a failed read must not block opening the destination |
| H-D5 | Event and notice rows open the Academic Calendar when this teacher can see it; every other type is only marked read | the app has no leave, absence or result screen for staff; the row carries no date (B20) |
| H-D6 | Newest 30 rows, no paging (`shortcut:` in `queries.ts`) | a teacher's inbox is short; paging is one query parameter away |
| H-D7 | The dashboard chart counts records by status and shows no percentage | a percentage needs a rule (which statuses count as present, how a half day weighs); that rule is the backend's and is not published |
| H-D8 | Chart labels use the school's wording when the attendance settings were already loaded, and the app's own words otherwise, **without loading them** | the brief allows one extra request; `useCachedAttendanceSettings` reads the cache only |
| H-D9 | Marks columns: untyped components are one column each under their own name; typed ones are Theory, Practical, then the rest, with a disabled box for a missing Theory or Practical | the brief forbids inferring applicability from a missing or zero mark, and the name is not a type |
| H-D10 | More than three columns wrap under the name instead of scrolling sideways | a single line stays readable; real subjects have one to three components. `shortcut` noted in `MarkCell.tsx` |
| H-D11 | Dropdown placement is computed by a pure function and drawn in a core `Modal` | no dependency; testable; the web's behaviour (under the field, flips when needed) |
| H-D12 | The theme choice is `Appearance.setColorScheme` plus an AsyncStorage value, not a React context | one call re-renders everything through `useColorScheme` and also changes native dialogs; no provider to forget |
| H-D13 | The light palette's two 4.47:1 pairs are reported, not changed | it mirrors the web palette (UI_SYSTEM §1); the web changes first |

---

# 5. Behaviour

- **Bell.** A 44pt target with an outline bell and a red count badge (99+ past two digits), named "Notifications, N unread". With no school
  selected, on sign-in and on the school picker there is no bell. A failed or forbidden inbox read shows the bell without a badge.
- **Inbox.** Rows newest first: unread rows are bold with a dot and "Unread" in their spoken name; the kind and the time (in the school's
  calendar) under the title. A row with something to do is a button (unread, or a calendar destination); a read row with nowhere to go is
  plain. Empty, loading, offline-with-saved-data, failed (with "Try again") and forbidden states use the shared `QueryState`.
- **Dashboard chart.** Title, month, a stacked bar of the five statuses (Present and Absent always in the legend; Late, Half day and Excused
  once the month has one), and "Days recorded: N". Empty month: "No attendance recorded this month." No staff link (404) or no `attendance.self`
  (403): the card is not drawn. Offline: the saved month.
- **Marks table.** Summary card (exam, class, subject, session), progress and "Unsaved: N", a sticky header (Roll, Student, column titles with
  their maximum), then one line per student. A mark out of range turns its box red and a line under the student names the column and the
  reason; a student with some marks missing says so; conflicts and refusals keep Keep mine / Use theirs and the backend's reason. Boxes
  lock while a save is in flight and when the subject is submitted. Save, Submit, drafts, versions, idempotency keys and the confirm are
  unchanged.
- **Dropdown.** Under the field and as wide as it; over the field when there is not room below; scrolls inside when long; tap outside, Back or
  the spoken "Close" dismisses it.
- **Theme.** Profile → Appearance: Auto (default) / Light / Dark.

---

# 6. Acceptance and evidence

| Area | Completion requirement | Evidence |
| --- | --- | --- |
| Notifications | Header bell, unread count, authorized list and supported targets | 13 unit tests (list, tap, read patch, failure, empty, retry, shared query = 1 request) + 2 manifest + 1 More hub; **phone: not run** |
| Calendar context | Events and holidays reuse the school's data and audience rules | The app lists what the backend put in the inbox. Event and notice rows work; **holidays create no row (B19)** |
| Attendance chart | Right data, one bounded request, nothing unauthorized | 6 Home tests: one `GET /attendance/staff/self` with no month; shared with My Attendance; hidden for 404 / 403 / no key; HTTP checks below |
| Marks entry | One line per student, roll order, Theory / Practical, practical applicability | 8 `markColumns` tests; 6 table tests (roll order, header, unsaved, lock, typed order, disabled box never sent). **Applicability needs B18**; untyped it is one column per component |
| Dropdown | Next to the field when supported | 5 `placeDropdown` tests + the 6 existing `SelectField` tests; **placement on the owner's Android version: not seen** |
| Layout | One top-level inset, no duplicate margins | `layoutInsets.test.tsx` (4); the margin bug fixed in 7 files |
| Security | Backend authorization, tenant isolation and assignment scope hold | HTTP checks below (27/27) |
| Quality | Tests, typecheck, lint, build | `tsc` clean, `eslint` 0 errors (1 older warning in `CurvedHeader.tsx`), 86 suites / 795 tests, `expo export --platform android` OK (exported to a scratch folder) |

**HTTP checks, mobile test API (`zn-mobile-test-api`, database `zn_school_mobile_test`, 2026-10-23; the app not in the loop).** Three
throwaway notification rows were inserted for the run (the table had none) and removed afterwards; nothing else was written. 27 of 27 passed:

| Check | Result |
| --- | --- |
| `my-schools` lists only the caller's school | 200, one school |
| The inbox returns only the caller's rows; another teacher sees only theirs | own row only; `unread` 1 |
| Reading **another person's** notification | 404, and it stayed unread for its owner |
| Reading an unknown id | 404 (the same answer) |
| Reading an own notification; reading it again | 200 `{ id, readAt }`; the second keeps the first time; `unread` 0 |
| Another school's inbox, and reading its row, with no membership | 403 `TENANT_MEMBERSHIP_NOT_FOUND` |
| A row of school B through school A's `tenantId` | 404 |
| No token; a malformed token | 401; 401 |
| `staff/self`: two teachers, two staff records; `staffMemberId` / `userId` in the query | different records; the query does not widen it |
| `staff/self` without `attendance.self`; with another school's `tenantId` | 403; 403 |
| `GET /portal/teacher/exams`: components carry no `componentType` | confirmed (`[{ id, name, maxMarks }]`) → B18 |
| Exam list: no permissions | 403; a class teacher with no subject sees none of the Mathematics components |
| Entering marks for **another teacher's** subject | 403, nothing written |

One expectation of mine was wrong and is recorded rather than hidden: a class teacher **with** `attendance.mark` but no `exam_result.save`
gets 200 on the exam list (the route allows either key; the list is scoped to subjects they teach, so it is empty for them), not 403; and
an account without `attendance.self` gets 403, not 404, on `staff/self` (404 is for a staff-linked-less account that holds the key).

---

# 7. Run sheet for the owner's phone (not run)

1. Header: the bell is at the top right on Dashboard, Attendance (and its roster), Academic (and Marks entry), More and Profile; the
   badge shows the unread count; tapping opens Notifications; the bell is absent on sign-in and the school picker.
2. Notifications: create an event whose type notifies (web), open the app → a row, bold and dotted → tap → the Calendar opens and the row
   is read, the badge drops; pull to refresh; airplane mode shows the saved list.
3. Dashboard: "My Attendance This Month" shows the month; mark present in My Attendance → the Dashboard chart changes without a new request.
4. Marks entry: a class of 30+ students: one line each, in roll order; the header stays while scrolling; type a mark above the maximum →
   red box and a line under the student; Save is disabled; save a valid one; the boxes lock while saving; a three-component subject fits.
5. Dropdowns (Marks entry and Exam attendance filter pages): the list opens under the field, flips over it near the bottom, and sits
   where it should with the status bar and navigation bar (the `measureInWindow` check in `UI_SYSTEM.md` §11).
6. Spacing: every screen has the same 16pt sides; the first card sits the same distance under the header on all of them.
7. Theme: Profile → Appearance → Dark → every screen above in Dark; restart; Auto follows the device.
8. Type: nothing is clipped at the largest system font; every tab, button and icon is easy to hit.

---

# 8. Proposed changes to protected documents (not applied)

- `docs/project/roadmap.md` M2: the notices and inbox line is built for the bell and the list (push not); M4 stays push and the guardian side.
- `docs/architecture/FEATURE_MODULES.md`: a note that a shell's header options (`shellHeaderOptions`) carry the bell and that
  `teacher.notifications` is a `menu` feature with no permission.
- `CLAUDE.md` / `.claude/rules`: none needed.

---

# 9. Not verified / open

- Everything visual: the bell and badge, the dropdown position, the marks table at 360pt and with a large font, Dark on every screen, the
  smaller type on a real screen.
- B18 (component types), B19 (holiday notifications), B20 (a date on event notifications) are the owner's to raise.
- Push notifications, the guardian bell and a "mark all read" action (no route exists for it) are not built.
- The Nepali strings added today (theme, notifications, marks headers, attendance statuses) are drafted by the assistant and need native review.
- **Review findings left open** (`ponytail-review` and `impeccable` critique, code only):
  1. **Marks entry has no keyboard "next" flow** (P1). Each mark is a tap on a 60 to 84pt box; 40 students x 2 marks is 80 taps. Fix: `returnKeyType="next"` and a focus chain across the rows (rows are virtualized, so the chain must scroll to a row that is not mounted). Needs its own small plan.
  2. **Back from the inbox goes to the More hub** (P2), not to the screen the bell was pressed on, because the inbox lives in the More stack. A root-level stack above the tabs would fix it; that is a navigation architecture decision (CLAUDE.md §4), so it is the owner's to take.
  3. **Muted 11pt text on the light page background is 4.47:1** (P2), table headers, hints and notification meta together. The fix is the web token `textMuted` (UI_SYSTEM §9).
  4. **The Dashboard puts three chart cards above the Attendance list** (P2), the teacher's daily action. Reordering is the owner's design call.
  5. Dropdown does not scroll to the chosen row in a long list (P3).
  Fixed from the same review: the inbox chevron now shows only on rows that open something; column titles may take two lines (a Nepali title is wider than a three-column box); the table's column list is memoized (a new array per render would re-render every row per key); the header and settings-not-fetched tests were added.
