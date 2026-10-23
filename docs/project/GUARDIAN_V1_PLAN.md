---
description: Plan for Guardian V1 of the mobile app: contract verified against a test stack, identity and shell design, screens, data and security rules, build sequence with gates and exit criteria, tests, risks and the decisions the owner must make.
purpose: Give the owner one reviewable plan for the guardian half of the app, grounded in what the backend really does today, so Guardian V1 can start the moment Teacher V1 is verified and nothing is built on an assumed contract.
access: Read
---

# Guardian V1 — Plan

## Status

**Draft, written 2026-10-22. Not approved. Nothing is built.** It details Phase 3 of `V1_DELIVERY_PLAN.md` (the task list
there stays the master list) and belongs to roadmap M1 part B and M3, with the guardian side of M4.

**Gate (owner's recommendation, `V1_DELIVERY_PLAN.md` §5): do not start building before Phase 2 (Teacher V1) is verified on
the owner's phone.** Planning, the contract check and the owner's decisions (§9) can proceed now.

**Evidence.** The server side of everything in §2 was **Reproduced over HTTP on 2026-10-22** against a test API on its own
database (E-G1, §11): the school issued an activation code, the guardian activated, logged in by phone as a mobile client,
read every guardian route and was refused every staff route. The app side is **Static**: the code was read, no guardian screen
exists, and the app has not been run on a phone. Where this plan and an older mobile document disagree, §2.3 lists it.

**Constraints that apply.** The backend owns all data and rules (mobile `CLAUDE.md` §3); no code in the web/API project
(D1); no endpoint is called that `API_CONTRACT.md` does not mark as existing; no new dependency or native module without the
owner's approval after seeing the alternative (the `simple-first` rule); protected files change only on approval with a shown
diff (`roadmap.md`, `FEATURE_MODULES.md`, `ARCHITECTURE.md`, `BACKEND_PREREQUISITES.md`); nothing is committed.

---

# 1. Scope

**In Guardian V1 (read-only for the guardian):** secure activation and login (phone or e-mail); access only to the
guardian's linked children; child switcher; student information (`STUDENT_INFO_PLAN.md` §4); attendance history; released
results; fees and payment history exactly as the API returns them; notices and the in-app inbox; profile, school switching,
sign-out.

**Not in V1:** online payment; PDFs (invoice, receipt, marksheet) until the backend has guardian routes; the guardian's own
advance pool until a route lists it; the exam routine (after v1, owner decision 2026-10-18); a ledger statement; messaging;
student self-login; offline writes; push delivery (needs an Expo project and a development build, §7, GV-D7).

**Principles.** One app, same backend and users as the teacher shell; the shell follows the account's role in the selected
school. The app computes nothing a backend field already carries (percentages, outstanding amounts, grades). Every request
names one child; a switch of child can never show the previous child's data.

---

# 2. What the backend does today (contract)

## 2.1 Verified live (Reproduced, 2026-10-22, E-G1; 32 requests, 32 as expected)

| Step | Route | Result |
| --- | --- | --- |
| School issues access | `POST /guardians/:id/portal-access` (needs `guardian.portal_manage`) | 201 `{ membershipId, code (8 characters), qrPayload (znschool://activate?code=…), expiresAt, reissued, guardianId, identifiers: { phone (E.164), email } }`; the list shows the guardian `pending`. Refused with 409 `GUARDIAN_PORTAL_ACCESS_REFUSED` for several reasons (ENDPOINTS §8) |
| Activate | `POST /identity/activate { code, identifier, password }` (public) | 200 `{ status: 'activated' }`. A wrong code → 400 `ACTIVATION_CODE_INVALID` ("The code is invalid or has expired"); the same code again → the same 400 (single use) |
| Log in by phone | `POST /identity/login { identifier, password, clientType: 'mobile' }` | 200 `{ accessToken, refreshToken }`, with the national number `98…` and with a leading `0` |
| Identity | `GET /identity/me` | `{ id, email, phone (E.164), fullName, isPlatformAdmin, sessionTimeoutMinutes }`. **`sessionTimeoutMinutes` was 30: it is the web idle limit.** The mobile limit (default 7 days) is applied by the server at refresh for `clientType: 'mobile'`; the app must not use this field for its own timeout |
| Shell hint | `GET /tenancy/my-schools` | `audience: 'guardian'` for a guardian-only membership, with the license block |
| Permissions | `GET /tenancy/my-permissions` | `{ all: false, keys: [portal.attendance.read, portal.calendar.read, portal.fees.read, portal.notices.read, portal.results.read, portal.student.read] }` (the global `guardian` role: five keys from migration 0227 plus `portal.calendar.read` from 0235) |
| Children | `GET /portal/guardian/students` | `[{ studentId, fullName, admissionNumber, status, relationship, isPrimary, classId, className, sectionId, sectionName }]`, two children for one guardian |
| Child profile | `GET /portal/guardian/students/:id` | `{ student: { id, admissionNumber, fullName, dateOfBirth, gender, status }, enrollments: [{ id, academicYearLabel, className, sectionName, status, rollNumber, enrolledAt (a timestamp), exitedAt }] }` |
| Attendance | `GET …/attendance?dateFrom&dateTo` | `{ student, enrollments: [{ enrollmentId, academicYearId, classId, sectionId, schoolDays, counts: { present, absent, late, half_day, excused }, notRecorded, offDayRecords, denominator, attendedUnits, percentage, days: [{ date, status, kind }] }], policy: { from, to, lowAttendanceThresholdPercent, weights, weeklyOffDays, holidays } }`; a missing range → 400 "dateFrom must be a real YYYY-MM-DD date". The absence recorded that day appeared in `counts` |
| Results | `GET …/results` | `[]` when nothing is released (the shape with data is in ENDPOINTS §7e; not seen live: no released result existed for the new child) |
| Fees | `GET …/fees` | `{ position: { studentId, receivable, advance, netOutstanding, totals: { invoiced, paid, refunded, openingBalance }, invoices: [] }, payments: { rows, total, page, pageSize } }`, amounts as decimal strings |
| Notices, inbox | `GET /portal/notices`, `GET /portal/notifications` | `{ rows, total, page, pageSize }`, the inbox also `unread`; membership only, shared with staff |
| Isolation | another family's student, and an id that does not exist | **the same 403** "You are not a guardian of this student" for profile, attendance and fees |
| Staff routes | `/portal/teacher/exams`, `/students`, `/attendance/roster`, `/academic/students`, `/communication/notices` with a guardian token | all 403 (`TENANT_AUDIENCE_DENIED` on some, `HTTP_FORBIDDEN` on others; the app maps both to "forbidden") |
| Session | refresh; logout | refresh 200 with a new pair; logout 204 |
| Revocation | `DELETE /guardians/:id/portal-access` | `{ outcome: 'suspended' }`; **the same access token then got 403** ("You do not have permission (portal.student.read)") at once |

## 2.2 Not available (the backend decides; the app waits)

Guardian PDFs (invoice, receipt, marksheet); the guardian's own advance pool (not in the fees route); an aggregated
`GET /portal/guardian/home`; a student photo; a currency field in `GET /settings/tenant` (it returns `timezone,
calendarPreference, numberFormat, locale`); school-defined attendance status labels for a guardian (they come from
`GET /attendance/settings`, which needs `attendance.read`, a staff key). `GET /portal/guardian/calendar` is in
ENDPOINTS §7g but answered 404 on the older test image used here (built before the calendar), so it was **not** checked.

## 2.3 Where older mobile documents differ from the built routes

| Document | Says | Built route |
| --- | --- | --- |
| `GUARDIAN_FEATURES.md` §3, `API_CONTRACT.md` §3 | `GET /portal/guardian/home` | none; compose the screens from the routes above |
| same | `…/students/:id/profile` with photo and guardians | `…/students/:id` without photo or guardian list |
| same | attendance `?from&to` | `?dateFrom&dateTo` |
| same | `…/financial-position`, `…/invoices`, `…/payments` | one `…/fees` (position with invoices, and payments) |
| `AUTH_AND_SESSION.md` §2 | `POST /tenancy/memberships/activate { code, password }` | `POST /identity/activate { code, identifier, password }` |
| `project-status.md`, `roadmap.md` M0 | B1 to B4, B8, B10 "not built" | built per the backend repo; reconcile as task P4.7 / P3.1 (roadmap is protected) |

These are reconciled when each piece is built; `GUARDIAN_FEATURES.md` gets a status note now.

---

# 3. Identity and shell

1. **Login.** One field "Phone or e-mail" (sent as typed, trimmed; the server normalises: a national number gets +977), a
   password, and `clientType: 'mobile'` on every login so the 7-day idle limit applies (without it the server applies the web
   30 minutes). A 429 `AUTH_TOO_MANY_ATTEMPTS` shows a wait message and never retries. Unknown identifier, inactive account and
   wrong password are the same 401, so the message does not say which.
2. **Activation.** Screen: code (8 characters; the server ignores case, spaces and hyphens and reads `O` as `0`, `I` and `L` as
   `1`, so the field does not police the characters), the phone or e-mail on record, a new password (min 8) with a confirmation.
   `POST /identity/activate` → on `activated` go to login with the identifier filled in. The code is never logged, never
   stored, and the input is cleared on success (`security.md` §6). Handled errors: invalid or expired or used code
   (`ACTIVATION_CODE_INVALID`), the throttle, a weak password (400). Other outcomes of the same endpoint (an existing staff
   account gaining guardian access; an admin-issued password reset) need the account's own password or set a new one; V1
   handles them on the same screen with the right label, after the live check in §5, G1.
3. **Shell resolution.** Today `GUARDIAN_ROLE_AVAILABLE = false` in `src/auth/useSessionContext.ts` and `resolveShells` only
   knows the teacher rule. Proposed (GV-D2): the guardian shell is available when `my-permissions` holds `portal.student.read`
   (works for an account that is also a teacher), and `my-schools.audience === 'guardian'` is used to skip the teacher shell for
   a pure guardian. The flag is removed. An account with both rules gets both shells and a switcher in Profile (GV-D8).
4. **Forbidden, revoked, suspended.** Revocation by the school gives 403 immediately; the existing mapping drops or
   re-resolves the school (`forbidden` refreshes permissions; `TENANT_MEMBERSHIP_NOT_FOUND` drops the school), ending on
   "Use the web app" or "No school access". Wiping the school's cached data on a plain 403 (V-D3, decided 2026-10-22) is
   built once for the whole app, with a loop guard; for a guardian it also means a 403 on a **child id** removes that child
   from the local list.
5. **Shell isolation.** Guardian code lives under `app/guardian/` and `src/features/guardian/`; no teacher screen is
   reachable; shared components are reused, never copied (`mobile-frontend.md` §1).

---

# 4. Screens (Proposed)

Tabs (GV-D9): **Home, Attendance, Results, Fees, Profile.** A child switcher sits in the header of every tab when the
guardian has more than one child (none with one child). The selected child is kept in memory for the session, never persisted
across sign-out. Every list screen has loading, empty, error, forbidden, offline-with-cache and pull-to-refresh states, the
shared components and the `[tenantId, …]` keys.

| Screen | Content (all as returned) | Requests | Notes |
| --- | --- | --- | --- |
| Home | the children as cards (name, class and section), the latest notices, an unread count | children list + notices page 1 (cached) | **No per-child extra requests** (GV-D4): the backend has no home route, and three requests per child on the first screen breaks the request budget |
| Attendance | month stepper; counts line; a compact list of days with status and kind (school day, weekly off, holiday); the percentage from the API | one request per child and month | month = `dateFrom`/`dateTo`; status words from the app's own strings for the fixed enum (the school's custom labels are not available to guardians, §2.2) |
| Results | released results newest first (exam, session, percentage, grade, pass status); a result opens a detail with subject and component marks | one list request per child | `published` is shown as provisional if the API says so; no PDF in V1 |
| Fees | position (receivable, advance, net outstanding, totals), invoices with status and outstanding, payments (paged) | one request per child, pages on demand | "updated <time>" from the query's own timestamp; **no arithmetic, no currency symbol until a source exists** (GV-D5); no pay button |
| Profile | child profile (`STUDENT_INFO_PLAN.md` §4); the guardian's own name and phone or e-mail; Switch school; Sign out (asks first); shell switcher for a dual account | children list, child profile | change password stays out of V1 unless pulled in (backend route exists: `POST /identity/change-password`) |
| Notices and inbox | notices list and detail, notifications with "mark read" | `/portal/notices`, `/portal/notifications`, `…/read` | the same screens as the teacher side (`shared.notices`, P2.6): build once; push registration later (GV-D7) |

---

# 5. Build sequence (dependency order; each step ends with `pnpm verify` and the export)

| Step | Delivers | Needs | Exit criteria |
| --- | --- | --- | --- |
| G0 Prerequisites | owner answers §9; record B1 to B4, B8, B10 in `project-status.md` after checking ENDPOINTS (P3.1); a guardian test account on the test stack (the probe already creates one); reconcile `GUARDIAN_FEATURES.md`, `API_CONTRACT.md` §3 | owner | decisions recorded; docs match the built routes |
| G1 Identity | phone or e-mail login with `clientType`, activation screen, shell resolution without the flag, guardian shell skeleton with Profile (Sign out, Switch school), revoked / forbidden / no-school states; the **live check of the other two activation outcomes** (existing staff account; reset) | G0 | on the owner's phone: a school-issued code activates, the guardian logs in by phone, lands on the guardian shell, signs out; teacher login unchanged |
| G2 Children and profile | children list, switcher, child profile, no-link state | G1 | two-child guardian switches; nothing of child A shows under child B |
| G3 Attendance | month view, counts, empty and holiday states | G2 | numbers equal the API's; month change refetches |
| G4 Results | list and detail, released-only wording | G2; a released result on the stack to see the live shape | a withheld exam never appears |
| G5 Fees | position, invoices, payments, "updated" time | G2; an invoice and a payment on the stack for the live shape | no client arithmetic; empty state for a child with no invoice |
| G6 Notices and inbox | list, detail, mark read, unread count | G2; reuse P2.6 | read state survives refresh |
| G7 Hardening | isolation sweep, revocation, offline, font scale, Nepali review, request counts, phone run with a two-child guardian | G1 to G6 | the exit gate of `V1_DELIVERY_PLAN.md` §5 |

G3 to G6 are independent once G2 exists and can be built in any order the owner prefers.

---

# 6. Data and security rules

- Query keys: `[tenantId, 'guardian', 'students']`, `[tenantId, 'guardian', studentId, 'profile' | 'attendance' | 'results' | 'fees', …]`.
  A school switch or sign-out removes everything under the tenant; a child switch changes the key, so the previous child's
  data is never read for the new one.
- Stale classes (no new class): children list Session (15 min); profile and attendance Daily (5 min); results Results (30 min);
  fees Financial (2 min). Financial data is wiped on logout like the rest.
- Request budget: Home 0 extra requests; every other screen one request per child and view, paged where the route pages.
- **Route allow-list.** A unit test asserts that the guardian request module only calls `/portal/guardian/*`, `/portal/notices`,
  `/portal/notifications`, `/portal/devices` and the membership-level `/identity/*`, `/tenancy/*`, `/settings/tenant*`
  routes, so a guardian screen can never call a staff route by accident (`security.md` §5). The backend refuses them anyway
  (§2.1); this is the second lock.
- Tokens only in SecureStore; the activation code and passwords never in logs, the query cache or navigation params.
- The server's refusal of another family's child is a 403 with the same message as a missing id; the app does not try to
  tell them apart.
- Persisted cache: the children's profile and fees follow the existing 7-day persisted cache and the wipe rules; a stricter
  rule is decision SI-D3.

---

# 7. Push and deep links

Push needs an Expo project and a development build (carry-over from M1 part A, decision A8 = Expo push). Guardian V1 ships the
**in-app inbox only** (GV-D7); push registration (`POST /portal/devices`) comes with the development build. The printed QR
encodes the web activation URL (`<web origin>/activate?code=…`), so a camera app opens the web page; in-app QR scanning
needs a camera module and a development build for the `znschool://` link, which is a package and architecture decision
(GV-D3).

---

# 8. Tests

Identity: login by phone and by e-mail sends `clientType: 'mobile'`; 401 keeps the same message for all causes; 429 shows the
wait and does not retry; activation success, invalid and used code, weak password, the code is not logged or kept; shell
resolution (guardian only, teacher only, both, neither); revoked access ends on the right screen.
Isolation: switching child drops the previous child's data; a 403 on a child removes it; the route allow-list test; no
teacher screen is reachable from the guardian shell and the reverse.
Screens: each tab's loading, empty, error, forbidden and offline states; attendance counts and percentage equal the
response; fees show decimal strings untouched; results never show a withheld exam (server contract, one fixture).
Quality: font scale 1.3, Nepali keys, screen-reader labels, 44 pt targets.
Stack and phone: the probe in E-G1 is the API-side regression; the owner's phone run uses a guardian with two children.

---

# 9. Decisions (accepted as recommended by the owner, 2026-10-22; the recommendation column is the decision)

By accepting GV-D1 the owner chose to **plan and decide now and build later**: G0 and G1 start after the marks phone run
passes, the rest after Phase 2 is verified. So the Guardian build has not started. The plan above stays Draft until that
gate opens.

| # | Decision | Recommendation |
| --- | --- | --- |
| GV-D1 | When Guardian V1 starts | Plan and decide now; build G0 and G1 after the marks phone run passes; the rest after Phase 2 is verified |
| GV-D2 | Shell rule: guardian when `portal.student.read` is held (supports a teacher who is also a parent), or only when `my-schools.audience` is `guardian` | **The key**, with the audience as a shortcut for pure guardians |
| GV-D3 | Activation UI: typed code only, or also an in-app QR scanner and `znschool://` deep link (a camera module and a development build) | **Typed code in V1**; the phone's camera app already opens the web activation page; scanner later if wanted |
| GV-D4 | Home: light (children, notices) with no per-child requests, or ask the backend for an aggregated home route | **Light home**; ask for the route only if the tabs prove slow |
| GV-D5 | Money display: as returned with no symbol until a currency source exists, or a fixed NPR | **As returned**; hard-coding currency breaks the no-hardcoded-configuration rule. A backend ask for the school's currency |
| GV-D6 | PDFs (invoice, receipt, marksheet) | **Wait** for guardian routes in the backend; never route a guardian to a staff reprint endpoint |
| GV-D7 | Push in V1 | **In-app inbox only**; push with the development build and an Expo project |
| GV-D8 | A teacher who is also a parent | **One login, both shells**, switch in Profile (what GUARDIAN_FEATURES already says) |
| GV-D9 | Tab set | **Home, Attendance, Results, Fees, Profile** |

New backend asks for the owner to raise when wanted (none blocks G0 to G3): guardian PDF routes; the guardian advance pool in
the fees route; a currency field in the settings route; guardian-readable attendance status labels; optionally a
`GET /portal/guardian/home`; a photo.

---

# 10. Risks

1. Building Guardian before the teacher flow is verified on a phone doubles the unverified surface (hence GV-D1).
2. The activation endpoint has three outcomes; V1 verified only the first live (a new guardian). The staff-gains-guardian and
   reset outcomes are checked in G1 before their UI is built.
3. Money is the highest-risk screen: a shown figure that differs from the web is a financial incident. No client arithmetic,
   no rounding, the "updated" time, and a test against the API's own fields.
4. A revoked guardian keeps cached data on screen until a 403 wipes it (V-D3 applies); the persisted cache lives 7 days.
5. The test image used here predates the calendar; the guardian calendar route is unverified.
6. The roles table has no row-level security (accepted decision, `ROLES_ACCESS_CHECK.md`); the guardian role is global and
   cannot be changed by a school, so this does not affect the guardian shell.

---

# 11. Evidence and not verified

**E-G1 (Reproduced, 2026-10-22).** A throwaway script (outside both repos) ran 32 requests against a test API container on
`zn_school_mobile_test`: one new guardian with two children in two sections, an administrator, a second family's student, and
the staff routes listed in §2.1. All 32 behaved as §2.1 states. Setup note: the shared e2e fixture truncates `roles`, which
removed the migration-seeded `guardian` role (the first run failed with 503 `ACTIVATION_NOT_CONFIGURED` for that reason); the role
was restored with its six keys (verified against migrations 0227 and 0235) and the run repeated. Not covered: the app; released
results with data; invoices and payments with data; the other two activation outcomes; the 429 throttle; refresh reuse;
a guardian who is also staff; the calendar route; multiple schools for one guardian; push.

**Not verified:** anything on a phone; the live shape of results, invoices and payments with data; how `status`, `kind` and
`percentage` read on a small screen; Nepali strings; request counts per screen.
