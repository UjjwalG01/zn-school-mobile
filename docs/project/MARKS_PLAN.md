---
description: Plan for teacher marks entry (`teacher.marks`): contract check of the backend calls, what the check found, screen behaviour, validation, error handling, tests, acceptance criteria and the decisions the owner must make before any code.
purpose: Approve marks entry before it is built, so the screen follows the real backend contract and never bypasses its authorization, version or submission rules.
access: Read
---

# Marks Entry (`teacher.marks`) — Plan

## Status

**Approved by the owner on 2026-10-22, with the answers in §11 (M-D1: send the result version on every save). Build
started the same day; the progress is in §12 and the evidence log.** The plan was drafted first as written below; where
the build differs, §7 and §12 say so. Marks entry is implemented and is no longer the next unstarted teacher feature;
its remaining gate is the owner's test-stack/Android walkthrough. Owner decision D5 of `TEACHER_APP_PLAN.md` made it a
separate run, and this file records that run.

**Evidence level of the contract check (§3): Static when drafted, Reproduced on the test stack on 2026-10-22 (§3.3,
E-M2).** The draft was read from the backend repo's code and `docs/api/ENDPOINTS.md`. The live run found two small
corrections and one data-exposure finding (the persisted cache held more fields than the screens use); all three are fixed
in the app and recorded in §3.3.

**Build state (2026-10-22): built and unit-tested.** Entry list, entry screen, model, both write hooks, queries, manifest
and the Academic hub row exist; `pnpm verify` passes (58 suites, 556 tests) and the Android bundle exports (E-M1). **Not
yet run on a phone:** the owner will test on their own Android phone and will not use an emulator (owner statement
2026-10-22); the assistant started no emulator. The test stack for that run is described in
`TEACHER_APP_PLAN.md` §6.2.

**Owner constraints that apply:** no code in the web/API repo (a need there is a backend ask, §9); the 2026-10-25 grouped-commit request supersedes the earlier wait-for-phone-run commit hold, but commits still require repository checks and review; no ADR is accepted by this work. The decisions in §11 are recorded as answered by the owner. This plan does not publish or lock results, and it adds no dependency.

**Changed 2026-10-23 (owner request):** the first screen of Marks entry is now a **filter page** (exam session → class → section → subject, then
Open), shared with Exam attendance (`CALENDAR_AND_EXAM_ATTENDANCE_PLAN.md` §5, decision CE-D10), instead of a list of exam cards. §5 below still
describes the entry screen, which is unchanged; the list it describes is now the subject filter's choices, with each subject's progress shown beside it.

---

# 1. Goal and scope

A teacher enters, saves and submits the marks of **one subject in one section of one open exam**, on the phone, under
the backend's own authorization. The backend decides who may enter, what is valid and what is locked; the app only
collects numbers and shows what the backend says.

In scope:

1. List the exams open for entry and the teacher's subjects in them (already served by `GET /portal/teacher/exams`).
2. For one subject and section: the students, the components with their maximum marks, and the marks already saved.
3. Enter marks, save the changed students (one all-or-nothing bulk save), see per-student refusals.
4. Submit the subject to the school (`draft` → `submitted`); read the reason when staff return it (`returned`).
5. Version conflicts, retries and the offline state, handled as attendance already does.

Out of scope (separate work, mostly staff-only on the backend): publishing and locking results, returning a submitted
subject (staff action), marksheet PDFs, the exam routine PDF (after v1, owner decision 2026-10-18), guardian results
(Phase 3), editing exam subjects or components, offline writes (M6), any change in the web/API repo.

---

# 2. Gate and dependencies

| Need | State (source) |
| --- | --- |
| B5 marks scoping, B6 per-subject marks entry, B7 teacher portal reads | Implemented on the backend **test database** (owner's word, 2026-10-21; mobile `project-status.md`). The backend repo records the dev database migrated through 0230 (the submissions table) on 2026-10-21; the stack for the device run must be named before testing |
| The Academic tab, the `teacher.academic` hub and the Marks entry "Coming soon" row | Built (`TEACHER_APP_PLAN.md`); the row is shown only to a teacher who holds `exam_result.save` |
| `TEACHER_MARKS_ACCESS` (`exam_result.save`, licence `academic`, mobile module key `exams`) | Exists in `src/features/teacher/access.ts`; the manifest is not registered yet |
| Draft / idempotency-key / conflict pattern | Built for attendance (`useAttendanceDraft`, `useSubmitAttendance`, `attendanceModel.ts`); reused, see §8 |
| A device or the test stack run of the shell | **Not done** (Phase 1 of `V1_DELIVERY_PLAN.md`). Building can start after approval; the marks feature is not "done" until it has run against the test stack |

---

# 3. Contract check (Static)

Backend references: `docs/api/ENDPOINTS.md` §6a (exam results, submissions), §7e (portal), and the controllers and DTOs
named below, read 2026-10-22.

| # | Call | Permission | Used for | Mobile today |
| --- | --- | --- | --- | --- |
| C1 | `GET /portal/teacher/exams` | staff audience; `attendance.mark` or `exam_result.save`; licence `academic` | The open exams, the teacher's subjects, each subject's components and its submission state | `getTeacherExams` exists; the type `TeacherExam` leaves out `classId`, `subjectOfferingId` and `components` (the file says so) |
| C2 | `GET /academic/students?examId=&sectionId=&page=&pageSize=` | membership only (`@RequireTenantMembership`) | The students who need a result for this exam (the exam population, decision D-1) | Not typed, not called |
| C3 | `GET /academic/exam-results?examId=` | `exam_result.read` or `exam_result.save` | Marks already saved and each student's result `version` | Not typed, not called |
| C4 | `POST /academic/exam-results/bulk-entry` | `exam_result.save` | The save | Not typed, not called |
| C5 | `POST /academic/exam-results/bulk-entry/validate` | `exam_result.save` | Optional dry run (same checks, writes nothing) | Not used by the plan, see §11 M-D5 |
| C6 | `POST /academic/exams/:examId/submissions/:examSubjectId/submit` | `exam_result.save` | Hand the subject in | Not typed, not called |
| — | `POST …/submissions/:examSubjectId/return` | `exam_result.publish` | Staff send marks back | **Never called by the app** (staff action) |
| — | `GET /academic/exam-subjects/:id/components` | membership | Component list | **Not needed**: C1 already carries the components |

## 3.1 Shapes the screen depends on

- **C1** (`ENDPOINTS.md` §7e; `OpenExam` / `OpenExamSubject` in `exam-result.service.ts`):
  `[{ examId, name, sessionName, classId, className, sectionId|null, sectionName|null, subjects: [{ examSubjectId,
  subjectOfferingId, subjectName, sectionId|null, sectionName|null, components: [{ id, name, maxMarks }], submission:
  { status: draft|submitted|returned, version, returnedReason|null, submittedAt|null } | null }] }]`. `maxMarks` is a
  **decimal string** (a numeric column), like every marks figure the backend returns. A subject taught to every section of
  a class with sections is listed **once per active section**; with `exam_result.save_any` every subject is listed. An
  account with no staff link and no `save_any` gets 403.
- **C2**: a page `{ rows, total, page, pageSize, academicYearId }`; a row has `enrollmentId`, `studentId`, `fullName`,
  `admissionNumber`, `rollNumber|null`, `studentStatus`, `guardianName|null`, `classId`, `className`, `sectionId|null`,
  `sectionName|null`, `enrollmentStatus`, `customFields`. Default page size 25, **maximum 200**; the web reads pages of 200
  until `total` is reached. The order is not specified; the web sorts roll numbers numerically (2 before 10), a missing
  roll last. The screen needs `enrollmentId`, `fullName`, `rollNumber` and nothing else.
- **C3**: a plain array (no pagination) of results, each `{ id, examId, enrollmentId, status, version, totalObtained,
  totalMax, percentage|null, grade|null, … , components: [{ examComponentId, obtainedMarks (decimal string) … }] }`.
  `version` is the result's version (`exam_results.version`, bumped by every marks save). A student with no result row is
  simply absent from the array; the app sends `0` for them ("I saw no result").
- **C4 request**: `{ examId, items: [{ enrollmentId, components: [{ examComponentId, obtainedMarks: number }], version? }],
  idempotencyKey? }`. `items` 1 to 500; `obtainedMarks` a number with **at most 2 decimals**, 0 to 9999.99; `version`
  optional integer ≥ 0 (omitted = last write wins; `0` = "I saw no result"); the key is a UUID, optional on the backend and
  **sent on every mobile call** (ENDPOINTS note). **Response**: `{ ok: true, results, replayed? }` or, as an HTTP 2xx,
  `{ ok: false, failures: [{ identifier: { enrollmentId }, error }] }` (nothing written). The whole batch is
  all-or-nothing: one failing student refuses everyone. A replay (same key and body) answers `{ ok: true, replayed: true,
  results }` from the first save; the same key with another body is 409.
- **C6 request**: `{ sectionId?, version? }` (`version` = the submission version last read; `0` = none yet).
  **Response** 200: `{ id, examSubjectId, sectionId, status, submittedBy, submittedAt, returnedReason, version }`. Already
  `submitted` answers the same row (a retry is harmless).

## 3.2 Errors the screen must handle

| Where | Status and code | Meaning | App behaviour |
| --- | --- | --- | --- |
| C4, C6 | 409 `CONCURRENCY_VERSION_CONFLICT` | A result (C4, any item) or the submission (C6) changed since it was read | `conflict`: refetch C3 / C1, mark the affected students, ask the teacher; never overwrite silently |
| C4 | 409 (idempotency key reused with a different body) | The key was spent on other content | Treated as `conflict` by the existing `errorActionOf` (any 409); new key after the refetch |
| C4 | 409 `EXAM_MARKS_SUBMITTED` | The subject is `submitted`; a scoped teacher cannot edit it | Read-only view with a banner; refetch C1. Check this code **before** the generic mapping: `errorActionOf` turns every 409 into `conflict` |
| C4 | 2xx `ok:false`, `EXAM_STUDENT_NOT_ELIGIBLE` or free text | Row refused: not eligible, duplicate, unknown or out-of-range component, subject incomplete, cannot be graded | Per-student message from `failures`; every typed value kept; nothing was written |
| C4, C6 | 403 (plain, `HTTP_FORBIDDEN`) | Not the subject teacher of this section today, or no staff link | `forbidden`: invalidate permissions and `my-classes`/`exams`; message |
| C4, C6 | 403 with a module or licence code | Module or licence switched off | `feature-denied`: invalidate `my-schools` (existing behaviour, `API_CONTRACT.md` §4) |
| C4 | 400 without a code | The marks gate is closed (exam still in draft, results not pending, `allow_modify` off) or another plain validation sentence | Show the sentence; invalidate C1 (the exam may have dropped off the open list) |
| C6 | 400 `EXAM_MARKS_INCOMPLETE` | A student of the section lacks marks for a required component | Message; refetch C3; highlight incomplete students (the screen pre-checks, so this is a race) |
| C6 | 404 / 403 | Nothing saved yet, or not this teacher's subject | Message; refetch |
| any | offline / 5xx | Network or server | `offline` / `server`: keep the idempotency key, keep every edit, retry is the teacher pressing Save again (no automatic retry) |
| any | 401 | Session over | Existing local logout |

## 3.3 Live confirmation (Reproduced, 2026-10-22; E-M2)

Run with plain HTTP against a test API container (the API image built 2026-10-21) on its own database
`zn_school_mobile_test`: a Mathematics teacher, a Science teacher, a `save_any` account, an unlinked account and an
administrator. 31 requests, 29 behaved as §3 says. What differs, and what the app does about it:

| Item | §3 said | Live | App |
| --- | --- | --- | --- |
| C2 `pageSize` above 200 | refused | `201` is accepted and answered with `pageSize: 200` | none needed (the app asks for 200) |
| C4 an enrollment outside the teacher's section | per-student refusal | plain 403 `HTTP_FORBIDDEN` ("You are not assigned as the subject teacher of … for this class/section"), the whole batch refused | shown as `forbidden` (already handled) |
| C4 same key, another body | 409 | 409 `HTTP_CONFLICT` (no `CONCURRENCY_*` code) | `conflict` by status; unreachable in normal use because the key follows the payload |
| C6 stale submission version | not stated | 409 `CONCURRENCY_VERSION_CONFLICT` | **fixed:** its own message (`marks.submitConflict`); the save-conflict text talked about highlighted students |
| Save while `returned` | not stated | allowed; the submission stays `returned` (version unchanged) until the teacher submits again | already how the screen behaves |
| Row contents | "only the fields the screens use" | C2 rows also carry the student id, status, **guardian name and id**, custom fields; results carry grades, totals, `tenantId`; result components carry max and pass marks | **fixed:** `src/api/academic.ts` keeps four roster fields and the id, enrollment, version and two fields per component of a result, because query data is persisted on the phone |

Confirmed as designed: marks come back as decimal strings (`"70.00"`), the save takes JSON numbers; `rollNumber` is a
string; a student with no result is absent from C3; `version: 0` creates; the first save opens a `draft` submission
(version 1); a replay with the same key and body answers `replayed: true`; the whole batch is all-or-nothing; per-student
refusals are English sentences (`obtainedMarks for "Mathematics - Theory" must be between 0 and 80`, `Marks are missing for
1 component(s) required by this exam`); more than two decimals is a DTO 400 whose `message` is an array; an empty batch is
a 400; `EXAM_MARKS_INCOMPLETE` (400, code present) and `EXAM_MARKS_SUBMITTED` (409, code present) arrive as `errorCode`; a
staff `return` shows `returned` with the reason in `GET /portal/teacher/exams`; an unlinked account is 403.

---

# 4. What the contract check found (design inputs)

1. **The version belongs to the student's result, not to a subject.** One `exam_results.version` counts every save of that
   student, so a second subject teacher saving *another* subject of the same student makes this teacher's next save a 409.
   The backend merges per subject (a scoped save sends only its own components and the stored result keeps the others), so
   re-applying the teacher's own values after a refetch is safe. The screen therefore sends the version it read and, on
   409, refetches C3, keeps the teacher's typed values, and asks before saving again (same flow as attendance
   `conflictIds` / `keepMine`). Decision M-D1. **Reproduced 2026-10-22 (E-M2):** the Science teacher saved a student
   (version 1 → 2); the Mathematics teacher's save with version 1 was a 409 `CONCURRENCY_VERSION_CONFLICT`; after reading
   version 2 the re-apply succeeded and the Science marks (`30.00`, `50.00`) were still there.
2. **"Draft" is two things.** Server side, the first scoped save opens a `draft` submission row; the saved marks are the
   draft, and `submitted` locks the teacher out until staff return it. On the phone, *unsaved* edits are held in memory
   until Save. Nothing is queued offline (A5, M6). Whether unsaved edits survive the app being killed is decision M-D2.
3. **Submit needs every eligible student complete** (`EXAM_MARKS_INCOMPLETE`), except an optional subject. The
   portal exams response does **not** carry `isOptional` or `includeInResults`, so the app cannot tell whether a subject
   may be left blank; it must treat every subject as required for the Submit check and let a refused save explain an
   optional-subject case. Backend ask A (§9).
4. **A saved row must be whole.** Within the subject a student's save has to carry all of the subject's components (or none,
   for an optional subject). The app therefore saves only students whose components are all filled; a partly filled student
   stays unsaved and is shown as incomplete, not sent.
5. **Reads are not scoped to the teacher's assignment.** C2 is membership-only and C3 returns every subject's components
   for every student of the exam. The attendance roster had the same gap and was closed on the backend (S-1). The app shows
   only this subject's components and each student's name and roll number, and nothing else from those responses. Backend
   ask B (§9). **Reproduced 2026-10-22 (E-M2):** an account with no staff link, holding `pt_teacher`, read the exam's
   roster (5 students, with guardian names) and every result (with both subjects' components).
6. **Numbers.** The app sends JSON numbers (max 2 decimals) and receives decimal strings. The real range is each
   component's `maxMarks` (and 0); the DTO's 9999.99 is only the outer cap. The app's range check is a UX hint, the
   backend's refusal is authoritative.
7. **Failures have no stable codes.** Per-student refusals are English sentences, like attendance; the gate 400s are plain
   messages. The app shows them as received (no string matching), the same stance as `ATTENDANCE_PLAN.md`. Backend ask C.
8. **Batch size.** The backend takes 500 items; the app sends at most 200 per request (the attendance cap, the roster page
   size). A section with more than 200 changed students needs more than one request; each is all-or-nothing, so the screen
   reports per request which students are saved. Rare for one class.
9. **Idempotency.** Same rule as attendance: the key follows the payload; an identical payload after an unknown outcome
   (offline, 5xx) reuses the key (the server replays instead of writing twice), any edit gets a new key, an answered
   request (saved or refused) spends the key.
10. **The exam list is already filtered by the gate** (out of draft, results `pending`, `allow_modify` on), so the gate 400
    appears only as a race (someone closes the exam while the screen is open).

---

# 5. Screens and behaviour (Proposed, not built)

Reuses the Academic hub: the "Marks entry" row becomes a tappable card (with the chevron) when the feature is registered.

1. **Marks entry list** (`app/teacher/academic/marks/index`): the open exams from C1, one `Card` per exam with its subjects
   as rows (subject, section when there is one, a `StatusBadge` for none / draft / submitted / returned). A returned subject
   shows its reason. Pull to refresh; the offline "saved data" banner; empty state "No exams are open for marks entry".
2. **Entry screen** (`…/marks/entry`, params `examId`, `examSubjectId`, `sectionId`): header with exam, subject and
   section; a summary line ("12 of 30 students complete"); a `ListScreen` of students (roll number, name) with **one
   numeric field per component**, labelled with the component name and "/ max". Footer actions: **Save** (the changed,
   complete students; shows the count) and **Submit**.
3. **States.** `none` / `draft` / `returned`: editable (returned shows the reason in a `Banner`). `submitted`: read-only
   fields with a banner ("Submitted to the school; the school can return it for changes"). Exam gone from the open list:
   a message and back to the list.
4. **Save.** One bulk POST of the changed, complete students; the cache is patched from the response (no refetch). On
   `ok:false` every student's message is shown on its row and no typed value is lost. On a conflict: refetch, flag the
   students, "Keep mine / Use theirs" per student.
5. **Submit.** Enabled only when no unsaved edits exist and every student is complete; asks first (native `Alert`, as
   Sign out does); after success the screen turns read-only and the exams cache refreshes.
6. **Leaving with unsaved edits** asks first (`useUnsavedGuard`).
7. **Online only for writes.** Offline: a clear toast, edits kept, no queue.
8. **Accessibility and inputs.** Touch targets ≥ 44 pt; numeric keypad; ASCII digits only (Nepali numerals are not accepted
   by the backend, so a non-numeric entry gets a field message); labels on every field; layout survives 1.3× font scale;
   strings in en and ne (keys only).

Dashboard and Academic hub already show read-only exam cards (`buildExamCards`, `MarksSection`); they stay, and their
rows link into the entry list once it exists.

## 5.1 UX-only validation (the backend is authoritative)

| Rule | Where it is shown |
| --- | --- |
| Empty = not entered; a student with some but not all components is "incomplete" and not sent | row hint |
| Not a number, more than 2 decimals, below 0 or above the component's `maxMarks` | field message, blocks Save for that student |
| Save is offered only when something changed | footer count |
| Submit is offered only when nothing is unsaved and every student is complete | footer |
| Anything else (eligibility, grading, optional subject, scope) | the backend's sentence, shown as received |

---

# 6. Data layer

- Keys, all `[tenantId, …]`: `['teacher','exams']` (exists), `['teacher','marks','roster',examId,sectionId]`,
  `['teacher','marks','results',examId]`.
- Stale classes (`src/api/staleTime.ts`): the exam list is already `daily` (`src/features/teacher/queries.ts`: it carries
  live submission state, and "marks slices invalidate this key after a save or submit"); the roster is `daily`; results,
  which another teacher can change, are `daily` too and are also refetched on screen focus and after a conflict. No class
  changes (a stale-time change is a reviewed change, `api-and-data.md` §5).
- A save patches `['teacher','marks','results',examId]` from the response (the new versions and values); a submit patches
  the one submission in `['teacher','exams']`. No other key is invalidated.
- Cache clearing on logout and school switch is the existing behaviour (`removeTenantQueries`, the persisted cache wipe).

---

# 7. Reuse (checked 2026-10-22)

| Existing | Use |
| --- | --- |
| `getTeacherExams`, `useTeacherExams`, `TeacherExam`, `buildExamCards`, `subjectProgress`, `MarksSection` | The list; extend the type with `classId`, `subjectOfferingId`, `components` |
| `attendanceModel.ts` ideas: draft record, `payloadSignature`, `attemptFor`, `keepKeyAfter`, `failuresByStudent`, `conflictIds`, `keepMine` | Same shapes, **not shared yet**: marks has different row content (several numeric fields per student). The first build copies the small pure functions it needs into `marksModel.ts`; extract a shared module only when it is clear which parts are really common (ponytail, and CLAUDE.md "reuse first": the reason is recorded here) |
| `useSubmitAttendance` (single-flight, key follows payload, outcome union, error-action handling), `errorActionOf`, `newUuid` | Pattern for `useSubmitMarks` |
| `useUnsavedGuard`, `ListScreen` (footer), `Banner`, `StatusBadge`, `Card`, `Screen`, `OfflineBanner`, `QueryState`, `showToast`, native `Alert` | Unchanged |
| `TEACHER_MARKS_ACCESS`, the registry and `menuHref` | The manifest hosted by `teacher.academic` |

New code, and why reuse is not enough: `src/api/exams.ts` plus types (new endpoints), `marksModel.ts`, `useMarksDraft` /
`useSubmitMarks`, the two screens and the numeric `MarkField`. A generic "grid input" component is not built; the second
user (a guardian view has no entry) does not exist.

---

# 8. Tests (Jest, mocked API)

Visibility (hidden without `exam_result.save`, hidden when module key `exams` is off); list states; the model (parse and
range checks, incomplete detection, changed rows, payload signature, key reuse and renewal, conflict marking); save
(`ok:true`, `replayed`, `ok:false` per student, 409 conflict then re-apply, 409 `EXAM_MARKS_SUBMITTED`, 403, offline keeps
key and edits, double tap sends one request); submit (enabled rule, 400 incomplete, retry on a `submitted` row); read-only
state; unsaved-changes guard; a school switch drops every marks query; a plain 403 invalidates permissions. `pnpm verify`
and the Android export, as for the rest of the app.

---

# 9. Backend asks (to raise by the owner; none blocks the first build)

| | Ask | Why |
| --- | --- | --- |
| A | Add `isOptional` and `includeInResults` to each subject of `GET /portal/teacher/exams` | The app cannot know when a blank subject is legal |
| B | Scope `GET /academic/students?examId=` and `GET /academic/exam-results?examId=` by assignment for a caller without `exam_result.save_any` (the S-1 analogue) | Today any member can read every student and every subject's marks of an exam by id |
| C | A stable `code` on each bulk failure and on the 400 marks-gate responses | Lets the app map causes without parsing sentences |

---

# 10. Build order (after approval; one step per session or sitting)

1. Types and request functions for C1 (extended), C2, C3, C4, C6, with API tests; **confirm the live shapes on the test
   stack** (decimal strings, `rollNumber` null, `version` on a student with no row, `submission` null) and record them in
   the evidence log below.
2. `marksModel.ts` with its tests.
3. Hooks: roster and results queries, `useMarksDraft`, `useSubmitMarks`.
4. Screens: the list, then the entry screen; strings in en and ne.
5. Registry: the `teacher.marks` manifest (`menu`, hosted by `teacher.academic`), routes, the hub row goes live, Dashboard
   links.
6. Docs: this file's status, `project-status.md`, `API_CONTRACT.md` (the calls are Exists on the backend; record the
   call sites), `TEACHER_FEATURES.md`, `FEATURE_MODULES.md` (protected: show the diff first), `PHASE_PROMPTS.md`.
7. `pnpm verify`, the Android export, then a run on the test stack and a device with a subject teacher account and a second
   account for the conflict case.

---

# 11. Decisions (answered by the owner, 2026-10-22)

The owner approved the plan and answered: **M-D1 yes, send the version on every save** (stated explicitly). For M-D2 to
M-D6 the owner approved the plan with the recommendations as written (read as accepted; the owner can correct any of them).

| # | Decision | Answer |
| --- | --- | --- |
| M-D1 | Send the result `version` on every save (a stale one is a 409 the teacher resolves), or omit it (last write wins) | **Send it.** A scoped merge makes re-applying own values safe, and silent overwrite of a second device is worse than one extra tap |
| M-D2 | Unsaved edits live in memory only, or are also kept on the device across an app kill | **Memory only**, with the leave guard. Persisting them is a local store (A5) and a privacy question for student marks |
| M-D3 | Submit is a button on the entry screen with a confirm, or a separate step | **On the entry screen, with the confirm** |
| M-D4 | The mobile module key for marks stays `exams` (as in `TEACHER_MARKS_ACCESS`) | **Keep it**; confirm it is in the backend's mobile-module list (a key the list lacks cannot be switched off by the school, as `my_classes` was) |
| M-D5 | Use the `/validate` dry run before Save | **No.** Save already refuses all-or-nothing and shows per-student reasons; a dry run doubles the requests |
| M-D6 | Backend asks A, B, C: raise now, or after the first build | **Raise now** (the owner raises them in the web/API repo); none blocks the build |

---

# 12. Acceptance criteria and status

A row changes only with evidence. Status vocabulary as in `project-status.md`.

| # | Criterion | Status |
| --- | --- | --- |
| 1 | The owner approves this plan and answers §11 | Done 2026-10-22 |
| 2 | Live shapes of C1 to C4 and C6 confirmed on the test stack and recorded | **Done 2026-10-22** (E-M2, §3.3). Reproduced over HTTP; the app was not in the loop |
| 3 | A teacher without `exam_result.save`, or with the module off, sees no marks entry | Unit-tested (`marks/__tests__/manifest.test.ts`: permission, licence, module key, guardian shell; the hub row uses the same rule). Not seen on a phone |
| 4 | A teacher can enter, save and submit one subject of one section, and cannot edit it while `submitted` | Unit-tested (`MarksEntryScreen.test.tsx`: save, submit with confirm, read-only, returned, incomplete). Server side Reproduced (E-M2). Not run in the app |
| 5 | A refused batch shows per-student reasons and loses no typed value | Unit-tested; the refusal texts are the live ones (E-M2). Not run in the app |
| 6 | A stale version asks the teacher and never overwrites silently | Unit-tested for a save (keep mine / use theirs, rebased version) and a submit (own message, both lists refetched). Server side Reproduced with two accounts (E-M2). Not run in the app |
| 7 | A double tap and an offline retry write once (key reuse) | Unit-tested at screen and hook level (`useSubmitMarks.test.tsx`: key kept after offline and 5xx, new after an edit or any answer). Server replay Reproduced (`replayed: true`, E-M2). Not run with airplane mode |
| 8 | A teacher cannot enter another teacher's subject (the backend refuses; the app shows it) | Server side Reproduced (403 for the other subject's components and for a student outside the section); app message unit-tested. Not run in the app |
| 9 | `pnpm verify` green, Android export OK | **Done 2026-10-22** (E-M1): 58 suites, 556 tests; export OK |
| 10 | Run on the test stack and on a device, with a conflict between two accounts | **Pending the owner's phone run** (no emulator by the owner's decision). Stack and a one-command conflict trigger are ready: `TEACHER_APP_PLAN.md` §6.2 |

## Evidence log

**E-M1 (Reproduced, 2026-10-22).** `pnpm verify` in this repo: ESLint and `tsc --noEmit` clean, Jest 58 suites / 556
tests passed (the 484 before this session plus 72 new). `pnpm exec expo export --platform android --output-dir <scratch>`:
exit 0, one Hermes bundle of 3.2 MB. The asset list now shows a Material Symbols font that comes in through
`expo-symbols` (a dependency of `expo-router`), not through our code; the earlier record said "Ionicons font only", and
the reason for the change was not investigated. Not covered: any run on a phone.

**E-M2 (Reproduced, 2026-10-22).** A throwaway script (outside both repositories) called the test API over HTTP: 31
requests, 29 as §3 states, two corrections (page size, wrong-section 403; §3.3). Covered: C1 to C4 and C6, replay and key
reuse, the per-student version moved by another subject's save and the 409, re-apply keeping the other subject's marks,
range, missing component, three decimals, empty batch, an unlinked account reading the roster and results, incomplete
submit (400 with code), stale submit (409), submit, repeat submit, save after submit (409 `EXAM_MARKS_SUBMITTED`), staff
return with a reason, save after return, 403 for an unlinked account, `save_any` seeing both subjects. Not covered: the app,
more than 200 students, a slow network, the exam's gate closing mid-entry (the exam list already hides it). The output was
captured at the time; the data was removed when another session truncated the shared test database, and the run was
rebuilt on an isolated database for the phone run.

**E-M3 (Reproduced, 2026-10-22).** Roles check: `docs/project/ROLES_ACCESS_CHECK.md`.

---

# 13. Not verified

The server behaviour in §3 is now Reproduced (§3.3). Still unverified: everything the app shows on a real phone (layout of
the numeric fields, keyboard behaviour, 1.3× font scale, Nepali strings), the order of C2 rows (the app sorts them
itself), the size and speed of C3 for a large exam on a low-end phone, a section of more than 200 students, and the exam
gate closing while a teacher is typing.
