---
description: Implementation plan for the guardian side of the mobile app (G2 to G7): the endpoints that now exist, the owner decisions to re-confirm, screen-by-screen UI and data rules, reusable components, security, tests and the phase gates.
purpose: One reviewable plan that turns GUARDIAN_V1_PLAN.md into buildable steps against the guardian routes as they are today (ADR-0081 built), so no screen is designed around an assumed contract.
access: Read
---

# Guardian Portal — Implementation Plan

**Status, 2026-10-31.** G0 partly done (test stack, see below). G1 committed (`c93031e`, `e1ef22a`). **G2 to G5 built in the working tree, uncommitted, unit-tested, not device-verified:** child context and switcher, child profile (G2); attendance month view with the school's labels (G3); results list and detail (G4); fee summary (G5). Built only on the live routes, as the owner asked: children, profile, attendance, results and the fee response as it is served today. **Built since (same tree, uncommitted, unit-tested, not device-verified):** G6 (Home notices and the 14-day calendar, the notices list, the calendar, the notification inbox with the header bell) and the marksheet download (a binary method on the one client, the PDF cache, the share sheet; each refusal named in words). **Not built:** G7 phone verification (needs the owner's phone), and the finance notifications (§16: backend changes that need approval). **Owner requirement 2026-10-31 applied in the app:** no invoice rows, receipt numbers or payment history are shown; the Fees screen shows the server's totals and the last payment only.

**Web backend note (2026-10-31, owner decision).** The fee-summary change is reverted; the fee response keeps its current contract, which the app reads. The invoice and receipt route removal stays uncommitted in the web repo; the app does not depend on either route. Still open: the current fee response carries invoice and payment rows, which the owner's read-only requirement does not allow; the app does not show them. ADR-0081 records this as deferred.

Draft, 2026-10-31. The plan extends the guardian V1 scope document.
It extends `GUARDIAN_V1_PLAN.md`, which stays the scope and decision record. Where the two differ, §1 lists the difference and
this plan proposes the change; the owner decides the items in §2 before G2 starts.

**G0 status (2026-10-31): partly done, blocked.** On the owner's test stack (`zn_school_mobile_test`, API `:3411`): migrations
applied to 252 (the database had stopped at 240); a guardian with two children was given portal access and activated (new test
password, not recorded here); mobile login by phone returns 200. Routes **answer correctly on the running API**: children list,
child profile, attendance (dates, enrollments, day kinds), results (empty for this child), fees (zero figures), calendar, notices,
notifications. Routes **do not exist on the running API**: `GET /portal/guardian/advance` (404), the three PDF routes (404
`HTTP_NOT_FOUND`), and attendance `statusLabels` is absent; `GET /settings/tenant` answers 403 `TENANT_AUDIENCE_DENIED` for the
guardian. The cause is the container, not the code: `zn-mobile-test-api` runs image `sha256:7b51…` built 2026-10-23, before
Phase 6 (commit `0b25e1a`, 2026-10-31). The rebuilt image is `sha256:5caf…`. Replacing the container was refused by the
environment's action guard (it would interrupt a running workload), so the Phase 6 routes stay **UNVERIFIED** live until the owner
runs that replacement or approves it.
**Resolved the same day.** The first replacement failed (Git Bash rewrote `--workdir`), which left `:3411` down for a short time.
The owner approved a corrected run without `--workdir`; `zn-mobile-test-api` now runs image `sha256:5caf…` on `zn_school_mobile_test`,
health 200. Live probe after the restart (Reproduced): children, profile, attendance **with `statusLabels`**, calendar, notices,
notifications, **advance** (`[{ guardianId, name, advance: "0.00" }]`), **settings** with `currencyCode: null`, results (none for this
child) and fees (zero figures) all answer 200. The three PDF routes answer **403 for unknown ids** (the same answer for "not yours"
and "missing", as ADR-0081 says). **Still open for G0:** an issued invoice, a payment and a released result on the child, so the
PDF bodies, the fees invoice and payment shapes, and the results shape can be recorded. The env file is in the session scratch folder
(secrets; not in any repo). No fixture invoice or payment exists yet, and no released result is on this child.

**Basis and evidence.** Read on 2026-10-31 (**Static**: no live call was made for this plan): the guardian controller and service
in `zn-school-platform-v1/apps/api/src/portal/`, the notices and notifications controller in `apps/api/src/communication/`,
`docs/api/ENDPOINTS.md` §4, §7e, §7f and §7g, and the mobile app's tokens, shared components, tab layout and feature registry.
Live shapes of the newer routes (calendar, advance, PDFs, `statusLabels`, `currencyCode`) are **UNVERIFIED** until G0 records them
on the owner's test stack.

**Constraints.** The backend owns every number, status and document; the app computes nothing a field already carries. One API
client (`src/api/client.ts`). Tokens from `src/theme/tokens.ts` only. Ionicons only, as the teacher shell uses. No new package
unless the owner approves it after seeing the alternative (`simple-first` rule). No guardian screen calls a staff route. Mobile
docs stay in this repository (the web repository does not mirror them).

---

# 1. What changed since GUARDIAN_V1_PLAN.md

`GUARDIAN_V1_PLAN.md` §2.2 (written 2026-10-22) lists routes as unavailable that the backend now serves. The API registry records
them as built with ADR-0081 (accepted 2026-10-31; file status "Built 2026-10-31"):

| Item | Plan of 2026-10-22 | Now (registry and code) | Effect on the app |
| --- | --- | --- | --- |
| Invoice PDF | not available (GV-D6: wait) | `GET /portal/guardian/invoices/:id/pdf`, issued copy, `portal.fees.read`, pdf bucket 10/min | Downloadable in G5 (GV-D6 re-opened) |
| Payment receipt PDF | not available | `GET /portal/guardian/payments/:id/receipt` | Downloadable in G5 |
| Marksheet PDF | not available | `GET /portal/guardian/results/:id/marksheet`, released results only | Downloadable in G4 |
| Guardian's own advance | not in fees route | `GET /portal/guardian/advance` → `[{ guardianId, name, advance }]`, `[]` when none | Shown once on Fees, never added to a child's figures |
| School currency | not available | `GET /settings/tenant` returns `currencyCode` (`null` until School Setup sets it) | Money display rule (GV-D5 re-opened) |
| Attendance labels | from `/attendance/settings` (staff key) | `statusLabels` on the guardian attendance response: `{ present: { label, shortCode }, … }` | The school's own names, no staff call |
| Calendar | 404 on the older test image, unchecked | `GET /portal/guardian/calendar?from&to` or `?academicYearId`, `portal.calendar.read` | Home "upcoming" and a calendar screen |
| Guardian home route | none | still none | Not needed (§4, Home) |
| Student photo | none | still none | Not in V1 |
| Notice by id | not listed | **none**: `GET /portal/notices` is paged only | Inbox notice links open the list (§12) |

The attendance response's `policy` is removed for guardians (the server strips it; `portal-guardian-phase6` asserts this). The app
must never read thresholds, weights or off-days, and needs none of them.

---

# 2. Owner decisions (accepted 2026-10-31 as recommended)

The owner approved every recommendation in this table on 2026-10-31. GV-D1 to GV-D3 and GV-D7 to GV-D9 stay as recorded.

| # | Question | Recommendation | Reason |
| --- | --- | --- | --- |
| GV-D4r | What does Home show? | **Children cards, upcoming events (14 days), latest 3 notices, the family advance (only when a row exists), unread count.** No per-child attendance or fees summary on Home. *Amended 2026-11-01 to the owner's reference design:* a greeting band; children cards with a placement pill; the school's month grid (the teacher calendar's `MonthGrid`, now shared in `src/features/calendar/`) with the tapped day's events under it, replacing the 14-day list; the latest notice (one); the family advance; the unread count stays on the header bell | A summary per child is one or two requests per child on the first screen (budget in §6). Those summaries live on each child's tab |
| GV-D10 | How are several children selected? | **A child context held in memory** for Attendance, Results, Fees and the child profile. ≤3 children: `SegmentedControl`; 4 or more: `SelectField`; one child: no switcher, the name in the header | Matches the "every request names one child" rule; reuses two shared components |
| GV-D5r | How is money shown? | **The API's decimal string as returned**, with the school's `currencyCode` before it when set; no rounding, no arithmetic, no thousands grouping in V1 | Zero client arithmetic; grouping can come later with a tested formatter |
| GV-D6r | Are PDFs in V1? | **Yes**: invoice, receipt and marksheet, one tap each, saved to the app cache and shared with the phone's share sheet | The routes exist; the owner asked for them in the 2026-10-31 request |
| GV-D9r | Tab set | **Unchanged: Home, Attendance, Results, Fees, Profile.** Notices, the calendar and the inbox are stack screens reached from Home and the header bell | Five tabs is the usable maximum at 44 pt targets; the pasted "More" tab would hide the notice bell |
| GV-D11 | How do PDFs download when the one client is JSON-only? | **Add one binary method to `src/api/client.ts`** (same auth, refresh and retry); no second `fetch` | The rule forbids a second client; `expo-file-system` and `expo-sharing` are already dependencies |
| GV-D12 | What happens to the held `react-native-web` / `react-dom` change? | **Drop it.** No guardian screen needs a web build | Not needed for this plan; a new dependency needs approval |

---

# 3. Information architecture and navigation

```
Tabs (5, GV-D9)         Stack (reached from a tab or Home; header back button)
├ Home                  ├ /guardian/students/[studentId]   child profile (from Home card, or a tab's "Profile" link)
├ Attendance            ├ /guardian/results/[studentId]/[resultId]   result detail (from Results)
├ Results               ├ /guardian/notices                 notices list (from Home "See all", or inbox)
├ Fees                  ├ /guardian/calendar                calendar, account-level (from Home "Upcoming")
└ Profile (shared)      └ /guardian/inbox                   notifications (header bell)
```

- **Header:** `brandHeaderOptions` with `ShellSwitcher` on the right (as now) and a `NotificationBell` (the bell component already
  exists under `src/features/notifications/`). The teacher's header options live under `src/features/teacher/notifications/`; they
  move to a shared module used by both shells (one small refactor, covered by the existing teacher tests).
- **Child context.** `app/guardian/_layout.tsx` provides `GuardianChildProvider`: the selected child id, in memory only, default
  = the primary child (`isPrimary`), otherwise the first by name. It is cleared on sign-out and school switch. If the selected child
  leaves the list (refetch, or a 403 on that child), the context picks the next child or shows the no-link state.
- **Deep links** are out of scope for V1 except the inbox mappings in §4.6.

---

# 4. Screens

Common to every screen: `Screen` (or `ListScreen` for a growing list), a `QueryState` for loading, error and empty, and
`OfflineBanner` when a cached value is shown. A child-scoped screen shows the child switcher in its top row (§3). Dates are
formatted with `src/lib/date.ts` using the school's `calendarPreference` from `GET /settings/tenant`; no screen writes date math.

## 4.1 Home (`app/guardian/index.tsx`)

| Block | Content | Source | Notes |
| --- | --- | --- | --- |
| Greeting | "Hello, {name}" | `/identity/me` `fullName` (session class) | Name only, no school name here (the header shows the school) |
| Your children | one `Card` per child: name (`title`), admission number (`muted`), class and section, status `StatusBadge` (active → success, otherwise neutral) | `GET /portal/guardian/students` | Tap: set the child context and open the child profile. Icon `chevron-forward` |
| Upcoming (14 days) | up to 5 rows: `DateBadge` (reused), title, a colour dot from `type.color`, time-free | `GET /portal/guardian/calendar?from=today&to=today+13` | "See calendar" → §4.9. Holidays use the holiday row shape |
| Notices | latest 3: title, `publishedAt`, "School-wide" or "Class notice" (no class names in the notice shape) | `GET /portal/notices?pageSize=3` | "See all" → §4.8 |
| Family advance | shown only when the advance list has an entry: label, amount (`MoneyText`), one line "Not counted in any child's balance" | `GET /portal/guardian/advance` | Hidden for `[]`; never a child figure |
| Header badge | unread count on the bell | `GET /portal/notifications?pageSize=1` → `unread` | Refreshed on focus |

Empty states: no children → the no-link state (`guardian.home.noChildren`: "No child is linked to your account yet. Ask the school
to link your child."). Error → `QueryState` with retry. Loading → skeleton rows of the same height as the cards.

## 4.2 Child profile (`/guardian/students/[studentId]`)

- Header: full name (`title`), admission number, `StatusBadge` for `student.status`.
- Details card: date of birth and gender as returned (fields as `STUDENT_INFO_PLAN.md` §4 defines for guardians). No photo.
- Enrollments: one row per enrollment: academic year label, class and section, roll number, status, `enrolledAt` and `exitedAt`
  (formatted dates).
- Three quick links (Attendance, Results, Fees), each sets the child context and opens the tab. Icons: `calendar-number-outline`,
  `ribbon-outline`, `wallet-outline`.
- Source: `GET /portal/guardian/students/:studentId` (key `[tenantId, 'guardian', studentId, 'profile']`, daily class).
- Forbidden (403 on this id): the child is removed from the list (§6.4) and the app returns to Home with one message.

## 4.3 Attendance (`app/guardian/attendance.tsx`)

- Month stepper (reuse `Stepper`; the month label from `formatMonth`). Each change requests the new month's `dateFrom`/`dateTo`
  (the first and last day, from `src/lib/date.ts`). One request per child per month.
- **Summary card**: the API's `percentage` (shown as returned; `—` when the API sends `null`), then one count per status with the
  school's `statusLabels[status].label` and `shortCode`, and "Not recorded" with the `notRecorded` count. An enrollment section
  appears for each enrollment in the response (a mid-year transfer has two), with its own counts.
- **Month grid**: 7 columns, one cell per day of the month: day number, a status glyph and the short code. Days with no record show
  "not recorded"; weekly-off and holiday days come from the API's `days[].kind` (the kind values are read from a live response in
  G0, not guessed). Legend below the grid.
- **Day list**: `ListScreen` sections by week, newest first, each row: date, status label, remark if the API returns one.
- States: no records in the month → "No attendance is recorded for this month" (not an error). 403 on the child → §6.4.

Status presentation (one table, used by the grid, the list and the legend; the glyph always carries the meaning, colour never alone):

| Status (API enum) | Glyph (Ionicons, verify in G0) | Tone |
| --- | --- | --- |
| `present` | `checkmark-circle` | success |
| `absent` | `close-circle` | destructive |
| `late` | `time` | warning |
| `half_day` | `contrast` | warning |
| `excused` | `document-text` | neutral |
| not recorded | `ellipse-outline` | neutral |
| weekly off / holiday | `moon` / `sunny` | neutral |

The label text comes from `statusLabels`; the app's own strings are only the fallback when the API omits a label.

## 4.4 Results (`app/guardian/results.tsx`)

- `ListScreen` grouped by `academicYearLabel` then `sessionName`, newest first as the API returns them.
- Row: `examName`, `sessionName`, `totalObtained` / `totalMax`, `percentage`, `grade`, and a `StatusBadge` for `passStatus`
  (pass → success, fail → destructive; the word is always shown).
- Empty: "No released results yet" (the server returns only released results; a withheld exam never appears).
- Source: `GET /portal/guardian/students/:studentId/results`, key with `'results'` (30-minute class).

Result detail (`/guardian/results/[studentId]/[resultId]`):
- Reads the row from the cached list (no extra request). If the cache is empty (cold start), it refetches the list and finds the row;
  if the row is gone, it shows "This result is no longer available" and goes back.
- Components grouped by `subjectName`: `componentName`, `obtainedMarks` / `maxMarks`, `passMarks`. Totals and grade at the top.
- Marksheet button (`DocumentButton`, §7): the PDF. A `404 DOCUMENT_NOT_ISSUED` reads "The marksheet is not ready yet".

Open wording question (before G4): whether `published` and `locked` differ in meaning for a guardian. The API returns both as
released; the app shows no label beyond the API's `status` until the owner says what each means.

## 4.5 Fees (`app/guardian/fees.tsx`)

Money rule (GV-D5r): the API's decimal string, the school's `currencyCode` in front when set. The app never adds, subtracts,
rounds or converts. `MoneyText` is the only place a money string is rendered.

- **Position card** (`position`): receivable, advance (the child's own), net outstanding (the label "Net outstanding"),
  and the totals `invoiced`, `paid`, `refunded`, `openingBalance`. The labels come from `STUDENT_INFO_PLAN`-style keys in `en.ts`
  and `ne.ts`.
- **Invoices** (`position.invoices`): number, issue date, amount, outstanding, status; a `DocumentButton` for the PDF on each row.
  Empty: "No invoices yet".
- **Payments** (`payments`, paged, `ListScreen` with `onEndReached`): `receiptNumber`, `paymentDate`, `amount`, `method`,
  `allocatedAmount`; a `DocumentButton` for the receipt. Pages keep stable keys so a page never duplicates a row.
- **Family advance** (`GET /portal/guardian/advance`): its own card at the top of the screen, labelled "Your advance with the school",
  with the sentence "Not counted in any child's balance". Hidden when the list is empty.
- **Freshness**: a line "Updated {time}" from the time this screen's query last fetched (the API sends no generation time, so this
  is the app's fetch time, and the text says so in the code comment). Stale class `financial` (2 minutes), wiped on sign-out.
- No pay button, no online payment (V1 scope).

## 4.6 Inbox (`/guardian/inbox`)

- `ListScreen` of `GET /portal/notifications`, newest first, with an unread dot and bold title for unread rows. The
  `unread` count in the header matches the screen.
- Tap: `POST /portal/notifications/:id/read` (idempotent), then the mapped destination:
  - `student_absent` → the attendance tab for that student, if the student is linked to this account (otherwise no navigation).
  - `school_event` and `holiday_changed` with a non-null `referenceDate` → the calendar on that day.
  - `notice_published` → the notices list (no notice-by-id route, §12).
  - `results_published`, `leave_submitted`, `leave_decided` → mark read only. A guardian has no leave route; the results notice names an
    exam, not a child, so no deep link is safe in V1.
- No "mark all read": there is no route for it.

## 4.7 Notices (`/guardian/notices`)

- `ListScreen`, paged (`pageSize` 20, `onEndReached`). Row: title, `publishedAt`, scope ("School-wide" or "Class notice").
- Detail is inline: a row opens a `Screen` with `title`, the `body` text and the date. It reads the cached row; on a cold start it
  refetches the page that contains the id (the notice shape has no separate route).
- Empty: "No notices yet".

## 4.8 Calendar (`/guardian/calendar`)

- Range by `SegmentedControl`: this month (default), next month, this academic year (`?academicYearId`, when the current year id is
  known from the calendar response's dates; otherwise month only).
- `ListScreen` sections by day. Each item: `DateBadge`, title, `type.color` dot (the colour is decorative; the type label is printed),
  holiday or event tag. Items that cross days show the real start and end dates (the API never clips them).
- Source: `GET /portal/guardian/calendar`. No internal notes, audience flags or leave appear for a guardian (server rule).
- Empty: "Nothing scheduled in this period".

## 4.9 Profile

The shared `ProfileScreen` (already reused in G1): Switch school, Sign out (asks first), the shell switcher for an account that is
both teacher and guardian. No guardian-specific copy. Change password stays out of V1 (`GUARDIAN_V1_PLAN.md` §4).

---

# 5. Design system (for every guardian screen)

| Topic | Rule | Source of truth |
| --- | --- | --- |
| Spacing | `xs 4, sm 8, md 12, lg 16, xl 24, xxl 32`; screen gutter `lg` (16); card-to-card gap `sm`; section gap `xl` | `src/theme/tokens.ts` |
| Radius | cards and fields `xl` (16); pills `pill`; tiles `lg` (8) | `tokens.ts` |
| Type | `title` (17) for names and screen headings; `bodyLarge` (14) for row text; `body` (13) for secondary; `caption` (11) for labels only | `tokens.ts` typography |
| Colour | only `useTheme().colors`; tones: success, warning, destructive, neutral. Dark mode comes free from the token set | `tokens.ts`, `useTheme` |
| Targets | every tappable row or icon is at least 44 pt tall and has an `accessibilityLabel` | `mobile-frontend.md` §10 |
| Icons | Ionicons only. Tab icons outline when unfocused, filled when focused (the teacher rule). Inline icons `iconSize.md` (18); tab and header icons `iconSize.lg` (22) | teacher `_layout.tsx` |
| Lists | `ListScreen` (SectionList) for anything that can grow; no `ScrollView` + `map` | `ListScreen.tsx` |
| States | loading skeleton, empty, error with retry, forbidden (one message, no detail), offline with cache (banner) | `QueryState`, `MessageScreen`, `OfflineBanner` |
| Text | every string through `t()` with an `en.ts` and an `ne.ts` key; no English-only fallback in a shipped screen | `src/i18n` |
| Numbers | the API's value as returned; `MoneyText` for money, `formatDate` for dates | §4.5, `src/lib/date.ts` |

Tab icons, Ionicons names (to verify against the glyph map in G0 before use):

| Destination | Icon (outline / filled) |
| --- | --- |
| Home | `home-outline` / `home` |
| Attendance | `checkmark-circle-outline` / `checkmark-circle` |
| Results | `ribbon-outline` / `ribbon` |
| Fees | `wallet-outline` / `wallet` |
| Profile | `person-circle-outline` / `person-circle` |
| Notices | `megaphone-outline` |
| Calendar | `calendar-outline` |
| Inbox (bell) | `notifications-outline` |
| Documents | `document-outline`; the share action `share-outline` |
| Child switcher | `chevron-down` |

---

# 6. Data layer

## 6.1 API functions (one file, `src/api/portal.ts`)

**Deferred (decided 2026-10-31, to do later):** a family-wide fees view, `GET /portal/guardian/fees`, with exact totals across every
linked child, the newest payment across them, and one row per child. Not built; the route was created and then removed from the web
repo before commit. Until it exists the Fees tab shows one child at a time through `GET /portal/guardian/students/:studentId/fees`.
The planned design is recorded in `docs/api/ENDPOINTS.md` (guardian section). The app will not add money itself.


| Function | Request | Typed response |
| --- | --- | --- |
| `getGuardianStudents()` (exists) | `GET /portal/guardian/students` | `GuardianStudent[]` (exists) |
| `getGuardianStudent(id)` | `GET /portal/guardian/students/:id` | profile |
| `getGuardianAttendance(id, from, to)` | `GET …/attendance?dateFrom&dateTo` | per-enrollment totals, days, `statusLabels` |
| `getGuardianResults(id)` | `GET …/results` | result list with components |
| `getGuardianFees(id, page, pageSize)` | `GET …/fees` | position and payments page |
| `getGuardianAdvance()` | `GET /portal/guardian/advance` | `[{ guardianId, name, advance }]` |
| `getGuardianCalendar(params)` | `GET /portal/guardian/calendar` | events, holidays, weekly off |
| `getGuardianNotices(page, pageSize)` | `GET /portal/notices` | page |
| `getGuardianNotifications(page, pageSize)` | `GET /portal/notifications` | page with `unread` |
| `markNotificationRead(id)` | `POST /portal/notifications/:id/read` | `{ id, readAt }` |
| `getTenantSettings()` | `GET /settings/tenant` | `{ timezone, calendarPreference, numberFormat, locale, currencyCode }` |
| `downloadGuardianDocument(path)` (GV-D11) | `GET` the three PDF routes, binary | bytes, via the one client |

Each function is a typed call on the one client. Each has a unit test for its URL, query string and body (none has a body; the GET
query is the only input).

## 6.2 Query keys and freshness

Keys follow `[tenantId, …]`; per-user data adds the user key, as the teacher side does.

| Data | Key | Stale class (`STALE_TIME`) |
| --- | --- | --- |
| Children list | `[tenantId, 'guardian', 'students']` | `session` (15 min) |
| Child profile | `[tenantId, 'guardian', studentId, 'profile']` | `daily` (5 min) |
| Attendance | `[tenantId, 'guardian', studentId, 'attendance', from, to]` | `daily` (5 min) |
| Results | `[tenantId, 'guardian', studentId, 'results']` | `results` (30 min) |
| Fees (position and payments page) | `[tenantId, 'guardian', studentId, 'fees', page]` | `financial` (2 min) |
| Advance | `[tenantId, userKey, 'guardian', 'advance']` | `financial` (2 min) |
| Calendar | `[tenantId, 'guardian', 'calendar', from, to]` | `daily` (5 min) |
| Notices | `[tenantId, 'guardian', 'notices', page]` | `daily` (5 min) |
| Notifications and unread | `[tenantId, userKey, 'guardian', 'notifications', page]` | `daily` (5 min), refetch on focus |
| Settings | `[tenantId, 'settings']` | `session` (15 min) |

A new class is not added; the table uses the existing names in `src/api/staleTime.ts`. Financial data is removed on sign-out with
the rest of the tenant keys.

## 6.3 Request budget

| Screen or action | Requests |
| --- | --- |
| Home (cold start) | students 1, settings 1 (session), calendar 1, notices 1, advance 1, notifications 1: **6 once; 0 when fresh** |
| Child profile | profile 1 |
| Attendance, one month | 1 per child |
| Results list / detail | 1 per child / 0 extra (detail reads the list) |
| Fees, one page | 1 per child per page; advance 0 extra when fresh |
| Document download | 1 each; the pdf bucket allows 10 a minute across the three routes |

The read bucket is 120 requests a minute per user (`ENDPOINTS.md` §7e); the budget above stays well inside it.

## 6.4 Forbidden, revoked and removed children

- A 403 on a child's route: remove that child from the list (`removeQueries` for that child's keys, then refetch the list). If it was
  the selected child, the context moves to the next one. Show one line: "You no longer have access to this student."
- A 403 on a non-child route (revoked access): the server refuses at once (`ENDPOINTS.md`, the revocation test). The global
  plain-403 wipe (V-D3 in the teacher plan) is planned, not built; until it is, the guardian shell shows the forbidden state and the
  user signs out. This dependency is recorded, not hidden.

## 6.5 Persistence and sign-out

- The persisted cache follows the existing 7-day rule (`GUARDIAN_V1_PLAN.md` §6, decision SI-D3 stays open).
- Cached PDFs live in `pdfCacheDirectory()` (`src/lib/files.ts`); `clearCachedFiles()` runs on sign-out (already the rule).

---

# 7. Reusable components

| Need | Reuse (existing) | New, and why it is necessary |
| --- | --- | --- |
| Screen shell, cards, text, buttons | `Screen`, `Card`, `Text`, `Button` | none |
| Growing lists | `ListScreen` | none |
| Loading, empty, error | `QueryState`, `MessageScreen` | none |
| Status and tone | `StatusBadge` | none |
| Dated rows | `DateBadge` | none |
| Month and steps | `Stepper` | `AttendanceMonthGrid` (grid of 7 columns with glyph + label): no grid exists in the app; kept in `src/features/guardian/` until a second screen uses it (rule §1: generalize later, not now) |
| Picking a child | `SegmentedControl`, `SelectField` | `ChildSwitcher`: a composition that picks between the two by child count; no new control |
| Child state | none | `GuardianChildProvider`: in-memory context, cleared on sign-out |
| Money text | none (no formatter exists) | `MoneyText`: prints a decimal string with the currency code; never rounds. Needed because the app shows no money today |
| PDF download | `src/lib/files.ts` (`pdfCacheDirectory`, `clearCachedFiles`), `expo-file-system`, `expo-sharing` | `DocumentButton`: one button that downloads through the client, saves to the cache, then opens the share sheet. Shared with three document kinds |
| Header | `brandHeaderOptions`, `ShellSwitcher`, `NotificationBell` | a shared header-options module moved from the teacher features (refactor, §3) |

Each new shared component is recorded in `docs/frontend/UI_SYSTEM.md` (`mobile-frontend.md` §1.4) in the same change that adds it.

---

# 8. Security and isolation

- **One child per request, checked by the server.** The app never sends a child id it did not get from the children list. The server
  answers 403 with the same message for another family's child and for an unknown id; the app does not try to tell them apart.
- **Client allow-list test (G7 and in G2).** The guardian request code may call only `/portal/guardian/*`, `/portal/notices`,
  `/portal/notifications`, `/portal/devices`, `/identity/*` (membership-level), `/tenancy/*` and `/settings/tenant`. A unit test
  greps the guardian modules for other paths.
- **Teacher separation.** Guardian screens import no teacher screen or teacher API module; the teacher tree imports no guardian module.
  A test asserts both directions.
- **Released results only.** The server filters; the app renders the list as returned and never shows a draft.
- **Documents.** The server verifies ownership before it issues a PDF; the app treats any non-200 as "not available" with the
  server's code mapped to a message (`DOCUMENT_NOT_ISSUED`, `DOCUMENT_SOURCE_CHANGED`, 403 as "not available", 429 as "try again in a
  minute").
- **Money.** No arithmetic in the app. A test renders the API's strings and asserts the text is identical (no reformatting of digits).
- **Secrets and personal data.** No token, PDF body, payload or child name in logs or analytics. Cache file names use the document id
  only (`invoice-<id>.pdf`).
- **Sign-out.** Clears tenant keys, child context, PDF cache and the in-memory child selection.

---

# 9. Build sequence and gates

Each step ends with lint, typecheck, Jest and an export; a phone run is a separate, owner-run gate.

| Step | Delivers | Needs | Exit criteria |
| --- | --- | --- | --- |
| **G0 Verify and decide** | Live shapes recorded for calendar, advance, the three PDFs (with one issued invoice, one payment and one released result on the owner's test stack), attendance `statusLabels` and `kind` values, `currencyCode`; GV-D4r to GV-D12 decided; `GUARDIAN_V1_PLAN.md` §2.2 and §9 corrected; Ionicons names checked against the glyph map | owner decisions; test-stack fixtures (owner's stack only, never `zn_school`) | every shape in §4 matches a recorded response, or the plan is changed first |
| **G1 Identity and shell** (built) | login, activation, shell from `portal.student.read`, Home with children, shared Profile | G0 | (existing) on the owner's phone: activation, login, Home, sign-out |
| **G2 Child context and profile** | `GuardianChildProvider`, `ChildSwitcher`, child profile, no-link state, 403-on-child removal, shared header module | G1, GV-D10 | a two-child guardian switches; nothing from child A shows under child B; a removed child leaves the list |
| **G3 Attendance** | month stepper, summary card, `AttendanceMonthGrid`, day list, `statusLabels`, percentage as returned | G2 | counts and percentage equal the response; a month change refetches its own key; a not-recorded day is not counted as absent |
| **G4 Results and documents** | results list, detail, `DocumentButton`, marksheet download | G2; a released result on the stack | a withheld exam never appears; the download saves and opens the share sheet; 404 and 429 show their messages |
| **G5 Fees** | position card, invoices, paged payments, receipts, invoice PDFs, family advance card, `MoneyText` | G2, G4 (download component); an invoice and a payment on the stack | every number is the API's string; advance is never in a child's figures; empty states for no invoices |
| **G6 Home completion, notices, calendar, inbox** | Home blocks (§4.1), notices list and detail, calendar range, inbox with mark read and mapped links, unread badge | G2 (the other parts are independent) | read state survives refresh; a notice opens; an event notification opens its day |
| **G7 Hardening** | allow-list and teacher-separation tests, offline (cached children, profile, fees with banner; PDFs need a connection), font scale 1.3, Nepali review of all strings, request counts measured, screen-reader labels, a low-end Android profile | G1 to G6 | the exit gate of `V1_DELIVERY_PLAN.md` §5; a phone run with a two-child guardian, a one-child guardian and a revoked account |

G3 to G5 can be built in either order after G2; G6 is independent of them.

---

# 10. Tests

| Layer | What | Tooling (existing) |
| --- | --- | --- |
| API functions | URL, query string, method, body for each function in §6.1 | Jest, `configureClient` with a fake `fetch` (as `identity.test.ts`) |
| Models | attendance status mapping, the money string passthrough, child-context selection (primary first, removal, empty), inbox destination mapping | Jest, pure functions |
| Screens | each screen's loading, empty, error, forbidden and populated states; the child switcher at 1, 2, 3 and 4 children; the document button's 404, 429 and success | React Native Testing Library (existing) |
| Isolation | allow-list, teacher separation, child switch drops the previous child's keys, 403 on a child removes it | Jest, static module scan plus query-client assertions |
| Money | rendered text equals the API string; no `+`, `-`, rounding or `toFixed` in the fees modules (a source scan) | Jest |
| Device | the phone run in G7 | owner's device; the mobile test stack (`mobile-phone-test-stack`) |

No new test framework. Every test run is reported with its count; a green run covers only what it asserts.

---

# 11. Dependencies

No new package is needed for this plan. The held `react-native-web` and `react-dom` change in the mobile working tree is not
part of it (GV-D12). `expo-file-system`, `expo-sharing`, `@expo/vector-icons` and the existing query and i18n stack cover the work.

---

# 12. Backend asks (optional; none blocks G0 to G6)

| Ask | Why | Blocks |
| --- | --- | --- |
| `GET /portal/notices/:id` | the inbox's `notice_published` link opens the notice, not the list | nothing (the list fallback works) |
| A child reference on `results_published` notifications (or a guardian results link by exam) | a result notification can open the right child's result | nothing (mark read only in V1) |
| Generation time on the fees response | the "Updated" line shows the app's fetch time today | nothing |
| Attendance `kind` values documented in `ENDPOINTS.md` §7e | the day kinds need an authoritative list | G3 (read from a live response in G0 if not documented) |
| `GET /portal/guardian/home` | not needed: the Home block uses four routes within budget | not needed |

---

# 13. Documentation corrections to make in G0

- `GUARDIAN_V1_PLAN.md` §2.2 (routes listed as unavailable that are now built) and §9 (the GV-D decisions re-opened by §2 here).
- `docs/frontend/UI_SYSTEM.md`: the new shared components in §7, with their rules.
- The web repository's `docs/adr/README.md` row for ADR-0081 says "nothing built yet", while `docs/adr/0081-guardian-portal-gaps.md`
  says "Built 2026-10-31". `docs/adr/` is protected: the mismatch is reported to the owner here, not edited.
- The pasted request names "Define Phase 0.2.txt" as a planning input. It is not in either repository (searched 2026-10-31). If the
  owner has it, it is to be reviewed against this plan.

---

# 14. Risks

1. **Money on screen.** A figure that differs from the web is a financial incident. Mitigation: pass-through strings only and the
   text-equality tests in §10.
2. **Document downloads on a weak connection.** A PDF can take long; the button shows progress and cancel, and a failed download
   leaves no partial file (write to a temporary name, then move).
3. **Child context drift.** A stale child id after a refetch. Mitigation: §3 rules and the 403 path in §6.4.
4. **Revoked access keeps cached data until the plain-403 wipe is built** (V-D3). Mitigation: the children list refetches on focus,
   and the persisted cache lives 7 days (the open SI-D3 decision).
5. **Calendar range size.** A school year is up to 400 days by the API limit; the app requests a month or a year window only.
6. **Phone performance.** Long payment lists and calendars must stay virtualized (`ListScreen`); measured on the low-end profile in G7.

---

# 15. Not verified

Everything on a device; the live shapes of calendar, advance, PDFs, `statusLabels`, `kind` and `currencyCode` (G0); how the
Nepali strings read on a small screen; request counts on a real session; the download and share path on Android and iOS; the
meaning of `published` versus `locked` for a guardian (§4.4).

---

# 16. Finance notifications: required backend changes (approved by the owner 2026-10-31; built in the web repo, uncommitted)

**Status (2026-10-31).** F-1 to F-5 are built in the web repo: `finance/finance-events.contract.ts`, the `InvoicePosted` event in
`InvoicePostingService.post` (manual post and billing-run auto-post), the `PaymentRecorded` event in `PaymentService.create` (never on a
replayed idempotency key), the types `invoice_issued` and `payment_recorded`, and the guardian-only fan-out with `portal.fees.read`. The
mobile app shows both rows in the inbox with the labels and no destination. F-6 tests are written and run by Haiku subagents; the result
is recorded in the handover, not here until the raw log is reviewed. Not deployed to the owner's phone stack yet (the test API image is
older), and no test invoice or payment exists there (needs the owner's approval). Documented in `docs/api/ENDPOINTS.md` §7f and the
event table.

**Owner ask:** a guardian is told when a bill is issued and when a payment is recorded. Both are informational: no document link, no
amount unless the owner approves one, no payment action. The app already lists any notification type and opens none it does not know.

**Existing pattern (read from the code, 2026-10-31).** Attendance and results reach guardians through the communication module's
fan-out (ADR-0069 D3, D4): the business module writes an outbox event in its own transaction; `NotificationFanoutService.on(eventType,
notificationType, recipients)` resolves the recipients from current links at delivery time and inserts one `notifications` row per user;
the unique `(event_id, user_id)` makes a redelivered event a no-op; pushes go out as separate `PushRequested` chunks. `student_absent` is
the model: `ATTENDANCE_EVENT.studentMarkedAbsent` → `NOTIFICATION_TYPE.studentAbsent` → guardians of the student.

**Required changes (each needs its own approval):**

| # | Change | Where | Why it needs approval |
| --- | --- | --- | --- |
| F-1 | Event contract `FINANCE_EVENT` with `invoicePosted` (`{ invoiceId, studentId }`) and `paymentRecorded` (`{ paymentId, studentId }`). **No amounts in the payload**, so the inbox row cannot leak a figure | new `finance/finance-events.contract.ts`, the same shape as `attendance-events.contract.ts` | A new cross-module event (ADR-0069 D6 pattern) |
| F-2 | Emit the events in the posting transaction: invoice posting (`POST /finance/invoices/:id/post`) and recording a payment (`POST /finance/payments`), through the outbox | the invoice and payment services in `finance/` | **Frozen Fees code**: the posting and payment paths are not to be modified without the owner's approval |
| F-3 | Two notification types `invoice_issued` and `payment_recorded` in `NOTIFICATION_TYPE`, with the mobile labels (`notifications.type.*`) | `communication-events.contract.ts`, `notification-fanout.service.ts`, the mobile `notificationsModel.ts` | A new notification type (contract change, additive) |
| F-4 | Fan-out handlers: `this.on(FINANCE_EVENT.invoicePosted, invoiceIssued, guardiansOfStudent)` and the same for payments. Recipients are the guardians linked to the student who hold `portal.fees.read`. No staff are told | `notification-fanout.service.ts` | Recipient rule is new (guardian-only money notices) |
| F-5 | Inbox title text built from the child's name and no amount: "A new bill has been issued for {child}." / "A payment has been recorded for {child}." | fan-out handler | The wording needs the owner's approval |
| F-6 | Tests: the event is written once per posting (replay of the outbox adds no rows); the payment and invoice rows stay unchanged; a guardian of another child is not told; a guardian without `portal.fees.read` is not told; the inbox row carries no amount and no link | `communication` and `finance` e2e specs on `zn_school_test` | Verification before any commit |

**Not part of this:** a receipt or invoice link in the notification (the owner's rule), a notification on a cancelled, reversed or voided
document (not requested; each would need its own type), and a push provider change (existing push path).

**Mobile side once F-1 to F-6 exist:** `notifications.type.invoice_issued` and `payment_recorded` labels (en, ne), the guardian destination
for both is "the inbox" (no screen opens, the row is read), and the Fees tab is not changed.

**Until the events are deployed:** no notification of this kind exists on the test stack. The guardian's Home and inbox show only what the backend sends today.

**Marksheet download (2026-10-31).** "View marksheet" opens a preview modal with the marksheet's figures; the PDF is requested only from
the modal's Download button. A device with no share sheet is now a visible failure, not a silent no-op. The PDF itself is not rendered in
the app: a page-by-page PDF preview needs a native PDF view (a new dependency), which is not added without the owner's approval.

**Fiscal year and currency (2026-10-31).** Currency is read read-only from `GET /settings/tenant` (`currencyCode`, set by an admin in School
Setup; null when unset, shown without a code, never defaulted). The active fiscal year is not pulled: no guardian screen shows it, and the
fiscal-year list is staff-only. Add a narrow read field only if a screen needs it.
