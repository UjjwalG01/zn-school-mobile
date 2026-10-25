---
description: The subset of the ZN School backend API the mobile app uses, how to call it, and which endpoints are still proposed.
purpose: Mobile-side API contract; the backend repo's docs/api/ENDPOINTS.md remains the source of truth.
access: Read
---

# API Contract (mobile)

## Status

Designed. Endpoints marked **Exists** are implemented in the backend today (identity/tenancy verified
2026-10-14; attendance endpoints verified 2026-10-16 against backend `docs/api/ENDPOINTS.md` §7–7b).
Update 2026-10-18: identifier login, `clientType`, session families, `logout-all` and the lockout (backend ADR-0066)
are built in the backend and applied to the test and the dev databases (ADR-0066 Implemented, except the admin reset code, which comes with guardian activation).
Update 2026-10-18 (backend Phase 3, ADR-0067): `POST /identity/activate` (guardian activation code, an existing
member gaining guardian access, and the admin-issued password reset), the `audience` on `GET /tenancy/my-schools`, and
the guardian audience guard are built and applied to the test database. A guardian-only login can call **only** the
routes marked for it (today `GET /tenancy/my-schools`, `GET /tenancy/my-permissions`, `/identity/*`); every other
tenant route answers `403 TENANT_AUDIENCE_DENIED`.
Update 2026-10-19 (backend Phase 5, **built on the backend test database; the dev database is not migrated yet**, so call it only
against the parallel test stack): the teacher portal reads, the guardian portal reads, per-subject marks entry with `version` and
`idempotencyKey`, and marks submissions. Shapes are in backend `docs/api/ENDPOINTS.md` §6a (marks, submissions) and §7e (portal);
the table in §3 lists what exists now and what is still later.
Update 2026-10-21 (backend Phase 6, **built; migration 0231 is applied to the backend test and development databases**, so a backend
running the latest code serves it): school notices, the notification inbox, push device registration, and the events that fill the inbox
(a student marked absent, results published, a notice published). Shapes are in backend `docs/api/ENDPOINTS.md` §7f; the table in §3 lists
the app routes. A student marked absent notifies the guardians only when the mark is for today; a correction to an earlier day tells no one. Push uses Expo behind a backend port; the backend needs an Expo project before pushes reach a real device.
Update 2026-10-22: marks entry is built and uses the routes in §2 ("Marks entry" below). The marks calls, the attendance and
self-attendance calls, the license-block codes, the roles/permissions behaviour and the guardian routes were checked **over
HTTP against a test API on its own database** (evidence: `docs/project/MARKS_PLAN.md` §3.3, `TEACHER_APP_PLAN.md` E9 and E10,
`GUARDIAN_V1_PLAN.md` §2.1). The app was not in the loop; nothing has run on a phone.
Update 2026-10-23: the Academic Calendar (with notices) and Exam Attendance are built and use the routes in §2 ("Academic Calendar and notices", "Exam attendance"), with backend migration `0239` and the new `GET /portal/teacher/exam-attendance` (request B16 in `docs/backend/BACKEND_PREREQUISITES.md` §17). Checked **over HTTP against the phone-test stack**, not on a phone (`docs/project/CALENDAR_AND_EXAM_ATTENDANCE_PLAN.md` §3).
Endpoints marked **Proposed (Bn)** need the backend item in `docs/backend/BACKEND_PREREQUISITES.md`
(work package WP-n in `docs/project/roadmap.md`) and must not be called from shipped code until
Implemented.

---

# 1. Basics

| Topic       | Rule                                                                                                           |
| ----------- | -------------------------------------------------------------------------------------------------------------- |
| Base URL    | `EXPO_PUBLIC_API_URL`. Routes are bare (no `/api`, no version prefix), e.g. `/identity/login`.                 |
| Auth        | `Authorization: Bearer <accessToken>` on every non-public call. No cookies, no CSRF.                           |
| Tenant      | `?tenantId=<uuid>` query param on tenant routes; in the JSON body for create `POST`s. Never in a header.       |
| Format      | JSON in/out. Success responses are raw JSON (no envelope). Paginated lists: `{ rows, total, page, pageSize }`. |
| Concurrency | Edits that carry `version` return `409 CONCURRENCY_VERSION_CONFLICT` on a stale version.                       |
| PDFs        | `application/pdf`, `inline` disposition. Download to file, open with the OS viewer.                            |
| Dates       | AD `YYYY-MM-DD` strings; timestamps ISO-8601 UTC.                                                              |
| Money       | As returned by the API (string/decimal) — never compute balances client-side.                                  |

---

# 2. Existing endpoints used

| Method & path                                   | Auth       | Use                                                                                             |
| ----------------------------------------------- | ---------- | ----------------------------------------------------------------------------------------------- |
| `POST /identity/login`                          | Public     | `{ identifier, password, clientType? }` or legacy `{ email, password }` → `{ accessToken, refreshToken }`. `identifier` = email or phone; `clientType: 'mobile'` selects the 7-day idle limit. Every failure is the same `401`; `429 AUTH_TOO_MANY_ATTEMPTS` after 5 wrong passwords. **Built** in the backend (ADR-0066, migrations 0225–0226, applied to dev). |
| `POST /identity/refresh`                        | Public     | `{ refreshToken }` → new pair (rotation, same session family and client type). Reusing an already-rotated token revokes the whole family → `401`. |
| `POST /identity/logout`                         | Public     | `{ refreshToken }` → 204. Ends the whole session family. Safe to call with no Bearer. |
| `POST /identity/logout-all`                     | Bearer     | → 204. Ends every session of the caller on every device. **Built** (ADR-0066). |
| `POST /identity/change-password`                | Bearer     | `{ currentPassword, newPassword, refreshToken? }` → 204.                                        |
| `GET /identity/me`                              | Bearer     | `{ id, email, phone, fullName, isPlatformAdmin, sessionTimeoutMinutes }`. `phone` is E.164 or `null`. |
| `GET /tenancy/my-schools`                       | Bearer     | `[{ tenantId, name, status, audience, license{ status, tierName, validUntil, expiringSoon, modules } }]`. `audience` is `guardian` when every role the caller holds in that school is guardian-audience, else `staff`: **pick the shell from it**, not from a constant (replaces `GUARDIAN_ROLE_AVAILABLE`). **Built** (ADR-0067 D10). |
| `GET /tenancy/my-permissions?tenantId=`         | Membership | `{ all, keys[] }` — UX hint only (ADR-0038). Allowed for a guardian-only login (a portal route); a guardian holds only the six `portal.*` keys (five from migration 0227, `portal.calendar.read` from 0235; Reproduced 2026-10-22). Default and custom roles reach the app only as these keys. |
| `POST /identity/activate`                       | Public     | `{ code, identifier, password? }` → `{ status: 'activated' \| 'guardian_added' \| 'password_reset' }`. `code` = the 8 characters a school hands over (case, spaces, hyphens ignored; the printed QR is `https://<school web origin>/activate?code=…` and the in-app deep link is `znschool://activate?code=…`; read `code` from either); `identifier` = the phone or email on record. `password` = the one to choose (new guardian), the account's **current** password (an existing account gaining guardian access: send it, or you get `ACTIVATION_PASSWORD_REQUIRED`), or the new password (a reset). Does not sign in: call `login` next. Every wrong answer is one `400 ACTIVATION_CODE_INVALID`; `429` after 5 wrong for the account. **Built** (ADR-0067 D6, ADR-0066 D9). |
| `POST /tenancy/memberships/activate`            | Public     | `{ token, password? }` → `{ status: 'activated' }`. B3 adds `code`.                             |
| `GET /settings/tenant/mobile-modules?tenantId=` | Membership | mobile module visibility toggles: `[{ moduleKey, visible }]`, a missing row = visible.          |
| `GET /settings/tenant?tenantId=`                | Membership | `{ calendarPreference, … }`; the app reads only `calendarPreference` (`gregorian` \| `nepali`) for date display (Teacher Home). |

Staff-scoped endpoints that exist but the app **must not** use for guardians (they are school-wide):
`/students/*`, `/guardians/*`, `/finance/*`, `/academic/exam-results*`, `/attendance/records`
(read). Teacher endpoints that exist today. Per the M2 gate (roadmap §4) the app calls them in
production only after the B7 teacher portal lands, because reads are not assignment-scoped:

| Method & path                                            | Permission         | Note                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| -------------------------------------------------------- | ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /attendance/my-classes?date=`                       | `attendance.mark`  | `{ restricted, classes:[{ classId, className, sectionId, sectionName }] }`; `restricted:false` = may mark any class (`attendance.mark_any`)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| `GET /attendance/roster?date=&classId=&sectionId?`       | `attendance.read`  | `{ date, dayInfo:{ schoolDay, reason, holidayName }, rows:[{ enrollmentId, studentId, fullName, admissionNumber, rollNumber, record:{ id, status, remarks, version } \| null }] }`; omitting `sectionId` on a class with sections returns every section (each row names its section)                                                                                                                                                                                                                                                                                                                                            |
| `GET /attendance/settings`                               | `attendance.read`  | school status labels / short codes / active flags (`statuses`), `backdateWindowDays`; render statuses from this, not a hardcoded list                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| `POST /attendance/records/bulk?tenantId=`                | `attendance.mark`  | `{ idempotencyKey (uuid), attendanceDate, classId, sectionId?, reason?, records:[{ studentId, status, remarks?, version? }] }`, 1–200 rows. `status`: `present \| absent \| late \| half_day \| excused`. **All-or-nothing.** 201 `{ ok:true, replayed, results:[{ studentId, id, version, outcome }] }`; a refused batch is a **2xx** `{ ok:false, failures:[{ identifier:{ studentId, row }, error }] }` with nothing written — handle it in the mutation, it is not an HTTP error. Same key + same body replays; same key + different body is 409. Reuse the key to retry an identical payload, use a new key after any edit |
| `POST /attendance/records`                               | `attendance.mark`  | single student; not used by the app (bulk covers it)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `POST /attendance/staff/self`                            | `attendance.self`  | teacher "Mark Present", no body, server clock. 200 `{ outcome: created \| unchanged, record, day }`; 404 not linked to a staff member; 409 inactive staff or an admin already recorded another status; 400 holiday / weekly off                                                                                                                                                                                                                                                                                                                                                                                                 |
| `GET /attendance/staff/self?month=YYYY-MM`               | `attendance.self`  | `{ staff, today, todayDay, month, records }` for the caller only                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| `POST /academic/exam-results/entry`                      | `exam_result.save` | whole-student submission (all subjects) — not used by the app (bulk covers it)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `POST /academic/exam-results/bulk-entry` (+ `/validate`) | `exam_result.save` | **used by marks entry** (`postBulkMarks`; `/validate` is not called). Body `{ examId, idempotencyKey, items:[{ enrollmentId, components:[{ examComponentId, obtainedMarks (number, ≤ 2 decimals) }], version }] }`, 1–500 items (the app sends ≤ 200); `version` is the student's result version (`0` = none), not per subject. 201 `{ ok:true, replayed, results }` or a 2xx `{ ok:false, failures:[{ identifier:{ enrollmentId }, error }] }` with nothing written. 409 `CONCURRENCY_VERSION_CONFLICT` for a stale version, 409 `EXAM_MARKS_SUBMITTED`, plain 403 for a student outside the teacher's section |
| `GET /academic/exam-sessions/:id/routine`                | Membership         | routine PDF reprint                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |

My Attendance (`teacher.selfAttendance`, built 2026-10-21, `docs/project/TEACHER_APP_PLAN.md` §5; `src/api/attendance.ts`) calls
the two `attendance/staff/self` rows above and nothing else. `POST` sends no body (the server decides who and
when; a second tap answers `unchanged`). A 404 means the account is not linked to a staff member; a 409
(`ATTENDANCE_ALREADY_RECORDED`, or an inactive staff member) maps to `conflict` in `errorAction`; a 400 is a
holiday, a weekly off or `present` switched off. `GET` returns `records` for the month, `today` and `todayDay`
(the school's own date and its day type). Confirmed on a live response 2026-10-22: a record is `{ id, attendanceDate,
status, remarks (null), source ('self'), markedAt, version, … }` (plus ids the app ignores); `POST` answers **200**.
`GET` with `month=garbage` is a 400; `attendance.self` without a staff link is a 404 "No staff member is linked to your
account — ask an administrator".

What the Attendance slice reads and sends (`src/api/attendance.ts`, verified against backend
`attendance.service.ts` 2026-10-21): the roster fields above plus `dayInfo`; from settings only
`backdateWindowDays` and `statuses[{ status, label, shortCode, sortOrder, active }]`; the bulk body
carries `idempotencyKey, attendanceDate, classId, sectionId?, records[{ studentId, status, remarks?, version }]`
and **no `tenantId` in the body** (query only; the DTO has no such field). `version` is `0` for a student
with no saved record. Only changed rows are sent. `reason` is not sent (past-window corrections stay on
the web, decision D4).

Attendance write rules the app must respect (all enforced by the backend, shown here for UX): a real
date not in the future; a school day (no weekly off or holiday); older than the backdate window needs
`attendance.correct` and a `reason`; the caller must hold `attendance.mark_any` or be the active
class teacher of that class/section on that date (403 otherwise); `GET /teacher-assignments` needs
`staff.read` and is **not** available to teachers — the portal endpoint (B7) replaces it.

**Marks entry** (`teacher.marks`, built 2026-10-22, `docs/project/MARKS_PLAN.md`; `src/api/academic.ts`) calls, besides
`GET /portal/teacher/exams` (which carries the subjects' components and submission state):

| Method & path | Permission | Use |
| --- | --- | --- |
| `GET /academic/students?examId=&sectionId=&page=&pageSize=` | Membership | the exam's students; the app reads every page of 200 and keeps `enrollmentId`, `fullName`, `admissionNumber`, `rollNumber`. A `pageSize` above 200 is answered as 200. **Not scoped to the teacher's assignment**: an unlinked account read it (Reproduced; backend ask B) |
| `GET /academic/exam-results?examId=` | `exam_result.read` or `exam_result.save` | a plain array of every subject's results; the app keeps `id`, `enrollmentId`, `version` and `examComponentId` + `obtainedMarks` (decimal strings). A student with no result is absent |
| `POST /academic/exam-results/bulk-entry` | `exam_result.save` | see the row above |
| `POST /academic/exams/:examId/submissions/:examSubjectId/submit` | `exam_result.save` | `{ sectionId?, version }` → 200 the submission row; `version` is the submission version last read (`0` = none). A stale version is 409 `CONCURRENCY_VERSION_CONFLICT`; missing marks are 400 `EXAM_MARKS_INCOMPLETE`; already submitted answers the same row |

**Student details** (`teacher` shell, built 2026-10-22, `docs/project/STUDENT_INFO_PLAN.md`; `getTeacherStudent` in
`src/api/portal.ts`) calls `GET /portal/teacher/students/:studentId` (`attendance.mark` or `exam_result.save`, licence
`academic`). Live shape confirmed: `{ student: { id, admissionNumber, fullName, dateOfBirth, gender (null), bloodGroup
(null), status }, guardians: [{ guardianId, fullName, phone (as typed), email (null), relationship, isPrimary }],
enrollments: [{ id, academicYearLabel, classId, className, sectionId, sectionName, status, rollNumber }] }`. 403 "This
student is not in a class or section you teach" for another section, an unlinked account and a missing id alike; 404 only
for an `attendance.mark_any` holder and a missing id; 400 for a non-uuid. The app keeps neither the guardians' e-mail nor the
class and section ids, and the query is not persisted to the device (`meta.persist = false`).

`return` (`exam_result.publish`) is a staff action and is never called by the app. Marks come back as decimal strings;
the save takes numbers.

**Academic Calendar and notices** (`teacher.calendar`, a card in the More hub, built 2026-10-23, `docs/project/CALENDAR_AND_EXAM_ATTENDANCE_PLAN.md`; `src/api/calendar.ts`):

| Method & path | Permission | Use |
| --- | --- | --- |
| `GET /calendar?from=&to=` | `calendar.read` (licence `academic`) | `from`/`to` are AD `YYYY-MM-DD`, at most 400 days apart (else 400). `{ from, to, events, holidays, leave, weeklyOff }`: items that overlap the window with their **real** dates. The server filters for the reader (audience, staff type, class assignment); an `event.manage` holder also gets `internalNotes` and `audience`, and a leave item names the staff member, so the app keeps only `kind, id, title (event title / holiday name / "staff: leave type"), typeLabel, color, startDate, endDate, description` and drops the rest before it can reach the cache. `weeklyOff` lists switched-off weekdays (0 = Sunday). A plain 403 is "no access", not an empty calendar. The app asks for one month window (the month of the school's own calendar, converted to AD) and one "upcoming" window (today + 60 days) |
| `GET /portal/notices?page=1&pageSize=5` | membership | published, active notices this person may read, newest first: `{ rows: [{ id, title, body, audience, classId, sectionId, publishedAt }], total, page, pageSize }`. Staff see `staff` and `all` notices; a scoped notice reaches only staff assigned there today. The app keeps `id, title, body, publishedAt` and filters nothing |

**Notification inbox and the header bell** (`teacher.notifications`, a card in the More hub and the bell at the end of every teacher page header, built 2026-10-23; `src/api/notifications.ts`; plan `docs/project/HEADER_BELL_AND_UX_PLAN.md`):

| Method & path | Permission | Use |
| --- | --- | --- |
| `GET /portal/notifications?page=1&pageSize=30` | membership only (no licence key yet) | the caller's own inbox, newest first: `{ rows: [{ id, type, referenceId, title, readAt, createdAt }], total, unread, page, pageSize }`. `unread` counts every unread row, whatever the page: it is the badge. One query for the bell and the list (Daily class, persisted, wiped with the school's cache). The app lists the newest 30 and says "Showing the newest 30 of N" past that |
| `POST /portal/notifications/:id/read` | membership only | `{ id, readAt }`, idempotent (a second call keeps the first time). Another person's id, another school's id and a missing id are all 404. The app patches the cached page from the answer and does not refetch; a failure leaves the row unread and shows one toast |

Who is told what is the backend's (ENDPOINTS.md §7f): `SchoolEventPublished` (on **create** of an event whose type has `notify`; an edit
tells nobody), `NoticePublished`, `LeaveSubmitted` / `LeaveDecided`, and the guardian-only `StudentMarkedAbsent` / `ResultsPublished`.
**Holiday changes raise no event**, so no holiday notification exists (request B19). A tap opens the Academic Calendar for
`school_event` and `notice_published` when the calendar is visible to this teacher; the row carries no date, so no day is selected
(request B20); every other type is only marked read. The app never sends a push token (push needs an Expo project and a development
build; M4). Push registration `POST /portal/devices` is not called.

**Dashboard "My Attendance This Month"** reads `GET /attendance/staff/self` (no `month`: the school's current month) once, with the
same cache entry as My Attendance. It counts the caller's own records by status; nothing is computed beyond counts. 404 (no staff
link) and 403 (no `attendance.self`) hide the card.

**Marks components.** `GET /portal/teacher/exams` returns each component as `{ id, name, maxMarks }`; the database knows
`component_type` (theory, practical, cas, internal, project, viva, other) but the route does not send it (verified on the test API
2026-10-23). The app reads an optional `componentType` if it is ever sent (request B18) and never infers it from `name`, a missing
mark or a zero.

**Exam attendance** (`teacher.exam-attendance`, a card in the Academic hub, built 2026-10-23; `src/api/examAttendance.ts`; the same filter step as marks entry):

| Method & path | Permission | Use |
| --- | --- | --- |
| `GET /portal/teacher/exam-attendance` | `exam_attendance.mark` (licence `academic`) | the published exams, with their active papers, the caller may record: `[{ examId, name, sessionName, classId, className, sectionId, sectionName, sections: [{ sectionId, sectionName }], papers: [{ examSubjectId, subjectName, examDate, recordable, taught }] }]`. Without `exam_attendance.mark_any` only exams whose class and section overlap the caller's assignments (either kind) are listed; no staff link is 403. `recordable` is false for a paper dated after the school's today. **Added to the backend 2026-10-23** (this request: B16) |
| `GET /academic/exams/:examId/attendance?examSubjectId=&sectionId=` | `exam_attendance.mark` | `{ exam, examSubject, editable, rows: [{ enrollmentId, studentId, fullName, admissionNumber, rollNumber, className, sectionName, dailyStatus, record: { id, status, remarks, version } \| null }] }`. `status` is `present`, `absent` or `excused`. `sectionId` is optional and **only narrows** (the caller's class scope still applies; a section outside the exam is 400). `editable` is false for a draft or locked exam. The app keeps names, roll numbers and the record (status, remark, version); `dailyStatus` and ids are dropped |
| `PUT /academic/exams/:examId/attendance` | `exam_attendance.mark` | `{ examSubjectId, idempotencyKey (uuid), records: [{ enrollmentId, status, remarks?, version? }] }`, 1–500 rows, `tenantId` in the query only. All-or-nothing: 200 `{ ok: true, replayed, results }`, or a 2xx `{ ok: false, failures }` with nothing written. One student outside the caller's classes makes the whole request **403**. 400 for a draft or locked exam and for a paper dated in the future (`ATTENDANCE_INVALID_DATE`); the app shows the backend's sentence |

The app sends `version` for every changed row (`0` = no record yet), only changed rows, and the same idempotency key for the same payload (a retry
after a lost response is a replay). It never sends `exam_attendance.mark_any` anything: it does not read that key, and the lists it is given are
already the right ones. Exam attendance never changes marks, grades or daily attendance.

---

# 3. Proposed endpoints (do not call until Implemented)

| Method & path                                                                                                            | Item   | Work package |
| ------------------------------------------------------------------------------------------------------------------------ | ------ | ------------ |
| `POST /identity/login { identifier, password, clientType }`                                                              | B1, B2 — **built**, see §2 | WP-1         |
| `GET /portal/teacher/home`                                                                                               | B7     | later (not in backend Phase 5; compose from `my-classes` and `exams`) |
| `GET /portal/teacher/my-classes?date=` — **built (backend P5), used by Teacher Home**: `{ restricted, classes:[{ classId, className, sectionId, sectionName }], subjects:[{ …same, subjectOfferingId, subjectName }] }`. `restricted:false` = every active section (`attendance.mark_any`); a class with no sections has a null section; `date` must be `YYYY-MM-DD` (else 400); permission `attendance.mark` or `exam_result.save`, licence `academic`; no staff link → empty `subjects` | B5, B7 | WP-3         |
| `GET /portal/teacher/exams` — **built (backend P5), used by Teacher Home**, replaces the proposed `/exams/open`: `[{ examId, name, sessionName, className, sectionId, sectionName, subjects:[{ examSubjectId, subjectName, sectionId, sectionName, submission:{ status: draft \| submitted \| returned, version, returnedReason, submittedAt } \| null }] }]` (the app reads only these fields; `null` = nothing saved yet). Same permission and licence; **403** for an account with no staff link and no `exam_result.save_any` — the app hides the Marks block | B6     | WP-2         |
| `GET /portal/teacher/students/:studentId` — **built (backend P5)**: assigned class or section only; no billing, no documents   | B7     | WP-3         |
| roster: use the existing `GET /attendance/roster` (no `/portal/teacher/sections/:id/roster`)                                | B7     | WP-3         |
| per-subject marks entry — **built (backend P5)** on the existing `POST /academic/exam-results/entry` and `/bulk-entry`: send only your subject's components, `version` (`0` = none yet) per result, `idempotencyKey` per bulk batch; a stale version is 409 `CONCURRENCY_VERSION_CONFLICT`; the result is graded only when every subject is in. **Used by `teacher.marks` (2026-10-22); contract Reproduced over HTTP, `MARKS_PLAN.md` §3.3** | B6     | WP-2         |
| `POST /academic/exams/:examId/submissions/:examSubjectId/submit` — **built (backend P5)**; staff `…/return` with a reason; submitted marks are 409 `EXAM_MARKS_SUBMITTED` until returned | B6     | WP-2         |
| `GET /portal/guardian/home`                                                                                              | B7     | later (not in backend Phase 5; compose from `students`) |
| `GET /portal/guardian/students` — **built (backend P5)**                                                                  | B4, B7 | WP-4, WP-5   |
| `GET /portal/guardian/students/:studentId` (profile), `/attendance?dateFrom&dateTo`, `/results` (released only), `/fees` (financial position plus payments) — **built (backend P5)**; they replace the proposed `/profile`, `/financial-position`, `/invoices`, `/payments`. **Reproduced over HTTP 2026-10-22 for the students, profile, attendance and fees routes and for the refusal of another family's child (`GUARDIAN_V1_PLAN.md` §2.1); results only with no data** | B7, B8 | WP-5         |
| `GET /portal/notifications?page&pageSize&unreadOnly` — **built (backend P6); the inbox and bell use it since 2026-10-23, see §2**: the caller's own inbox, `{ rows: [{ id, type, referenceId, title, readAt, createdAt }], total, unread, page, pageSize }`. `type` says what `referenceId` is: `student_absent` → the student, `results_published` → the exam, `notice_published` → the notice. Membership only, for staff and guardians alike | B10 | WP-7 |
| `POST /portal/notifications/:id/read` — **built (backend P6); used since 2026-10-23, see §2**: idempotent, own rows only (another person's id is a 404) | B10 | WP-7 |
| `GET /portal/notices?page&pageSize` — **built (backend P6)**: published notices for the caller's audience and class scope; a guardian needs `portal.notices.read` (else 403) | B10 | WP-7 |
| `POST /portal/devices { token, platform }` and `DELETE /portal/devices { token }` — **built (backend P6)**: register or remove the Expo push token of the signed-in person (no `tenantId`; a token moves to whoever registers it last, so call `DELETE` on logout). A push carries only a generic title and `data { type, referenceId, notificationId }`: open the screen from `data`; never show names, marks or amounts on the lock screen | B10 | WP-7 |
| `GET /portal/guardian/invoices/:id/pdf`, `/payments/:id/receipt`, `/results/:id/marksheet`, `/exam-sessions/:id/routine` | B7     | later (not built) |

`POST /attendance/records/bulk` left this table on 2026-10-16: it is implemented (see §2).

Shapes are defined by the backend ADR; record them here (and in the backend `ENDPOINTS.md`) when
implemented.

---

# 4. Error handling

Envelope: `{ statusCode, errorCode, message (string | string[]), error, timestamp, path }`.

| errorCode / status                                                                                                       | App behavior                                                                                      |
| ------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------- |
| `401` (any non-auth route)                                                                                               | single-flight refresh + replay once; then logout                                                  |
| `401` on `/identity/refresh`                                                                                             | logout ("session expired")                                                                        |
| `NETWORK_ERROR` (client-side, status 0)                                                                                  | offline banner; reads from cache; writes blocked                                                  |
| `TENANT_MEMBERSHIP_NOT_FOUND`                                                                                            | remove school, refetch my-schools                                                                 |
| `TENANT_ACCESS_DENIED`                                                                                                   | school suspended/archived screen                                                                  |
| `LICENSE_EXPIRED` / `LICENSE_NOT_FOUND` / `LICENSE_SUSPENDED` / `LICENSE_NOT_YET_VALID`                                  | "service unavailable for this school" screen                                                      |
| `ENTITLEMENT_DENIED`                                                                                                     | hide feature; refetch my-schools (license modules changed)                                        |
| `403` other                                                                                                              | "you don't have access" — refetch my-permissions                                                  |
| `CONCURRENCY_VERSION_CONFLICT` (409), and **any other 409** (e.g. `ATTENDANCE_ALREADY_RECORDED`, an idempotency key reused with a different body — these carry no `CONCURRENCY_*` code) | refetch, show the newer data, ask user to re-apply (`errorAction` → `conflict`)                   |
| `AUTH_TOO_MANY_ATTEMPTS` (429)                                                                                           | wait message, no auto retry                                                                       |
| `ACTIVATION_CODE_INVALID` (400)                                                                                          | one message for every wrong answer ("code or phone/email not recognised, or expired"); never say which |
| `ACTIVATION_PASSWORD_REQUIRED` (400)                                                                                     | the code was right; ask for the account's existing password (or a new one) and resend; nothing was spent |
| `ACTIVATION_NOT_CONFIGURED` (503)                                                                                        | "activation is not available yet, contact the school"                                             |
| `PASSWORD_RESET_NOT_PERMITTED` (403) on `activate`                                                                       | "this reset is no longer allowed, ask the school to issue a new one"                              |
| `TENANT_AUDIENCE_DENIED` (403)                                                                                           | a guardian login reached a staff route: a client bug; show "not available", do not retry          |
| `AUTH_CURRENT_PASSWORD_INCORRECT` (400)                                                                                  | field error, do not logout                                                                        |
| `DOCUMENT_NOT_ISSUED` (404)                                                                                              | "document not issued yet by the school"                                                           |
| `ATTENDANCE_INVALID_DATE` (400)                                                                                          | show the date rule (future date or invalid date); do not retry                                    |
| 2xx body `{ ok:false, failures[] }` on bulk attendance (and any later bulk endpoint whose backend contract documents it) | nothing was saved; show the per-student reasons, keep the draft, let the teacher fix and resubmit. `failures[].error` is an English sentence **with no `errorCode`**: show it verbatim, never branch on it. A stale `version` also arrives this way (not as a 409), so the app detects conflicts by comparing record versions |
| `400` validation (`message` array)                                                                                       | map to form fields where possible                                                                 |
| `5xx`                                                                                                                    | generic error + retry button; report to crash reporter without payload                            |

Source of codes: backend `apps/api/src/common/errors/error-codes.ts` (ADR-0017). Branch on
`errorCode`, never on `message`.

---

# 5. Client implementation notes

Port of the web client `apps/web/src/lib/api-client.ts`:

| Web                                         | Mobile                                                           |
| ------------------------------------------- | ---------------------------------------------------------------- |
| `localStorage` tokens/tenant                | SecureStore (tokens), AsyncStorage (selected tenant, non-secret) |
| `window.dispatchEvent('zn:unauthorized' …)` | typed event emitter in `src/api/events.ts`                       |
| `import.meta.env.VITE_API_URL`              | `process.env.EXPO_PUBLIC_API_URL`                                |
| silent refresh timer                        | refresh-on-demand (no timers while app closed)                   |
| `apiGetBlob`                                | `expo-file-system` download with Bearer header                   |

Request timeout 20 s; GET retry max 2 with backoff on network errors only; never auto-retry a
`POST`.
