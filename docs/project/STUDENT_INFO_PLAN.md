---
description: Plan for the student-information screens of the mobile app: the teacher's student profile and the guardian's child profile, with fields, navigation, states, role-specific visibility, data layer, tests and decisions.
purpose: Agree what each audience may see about a student, and how the screens reuse the existing portal routes, before any code is written.
access: Read
---

# Student Information (teacher and guardian) — Plan

## Status

**Decisions SI-D1 to SI-D6 accepted as recommended by the owner on 2026-10-22. The teacher half (§3) is BUILT and
unit-tested the same day (62 suites / 599 tests, Android bundle exports); it has not run on a phone. The guardian half (§4)
is not built: it waits for Guardian V1 (`GUARDIAN_V1_PLAN.md`, GV-D1).** It is task P2.5 of `V1_DELIVERY_PLAN.md` (teacher)
and the profile part of task P3.5 (guardian).

What was built (all in this repo, nothing in the web/API project): `getTeacherStudent` in `src/api/portal.ts` (keeps only
the fields of §3.2; guardian e-mail and class and section ids are dropped, SI-D2); `src/features/teacher/students/`
(`queries.ts` with `meta: { persist: false }`, `studentModel.ts`, `routes.ts`, `useCanOpenStudent.ts`,
`TeacherStudentScreen.tsx`); `shouldPersistQuery` in `src/lib/queryClient.ts`, used by `QueryProvider` (SI-D3: the
student never reaches the on-device cache); `TEACHER_STUDENT_INFO_ACCESS` in `src/features/teacher/access.ts` (permission
`attendance.mark`, license `academic`, school switch `students`; no feature manifest and no `FEATURE_MODULES.md` change,
SI-D4); an icon button "Student details" on each Attendance roster row (SI-D1: the roster only); route
`app/teacher/attendance/student.tsx` inside the Attendance stack; strings `studentInfo.*` (en, ne drafts). SI-D5 and SI-D6
apply to the guardian half. The dial link is React Native's own `Linking` (`tel:`), no package.

**Evidence.** The live response of `GET /portal/teacher/students/:id` was captured on 2026-10-22 on a test stack (a class
teacher of the student's section, a teacher of another section, an `attendance.mark_any` account, an unlinked account, a
role without permission): 200 with the documented body (`gender` and `bloodGroup` null, the phone as typed, e-mail null);
403 "This student is not in a class or section you teach" for another section, an unlinked account and a missing id;
403 for a role without `attendance.mark` or `exam_result.save`; `mark_any` gets 200 for any student and 404 "Student not
found" for a missing id; a non-uuid id is a 400. Tests: API projection and errors, persistence rule, model, every screen
state (content, dashes, call, no guardian, 403, 404, no id, offline, server error with retry, saved-data banner,
not persisted, school switch) and the roster action (hidden without `attendance.mark`, hidden with the `students` switch
off, pushes the route, changes no draft). Not run: the app, a phone, a screen reader, font scale, the Nepali strings.

Constraints that apply: the backend owns the data and the rules (mobile `CLAUDE.md` §3); no student data is copied or
re-derived in the app; no endpoint is called that `API_CONTRACT.md` does not mark as existing; the web/API project is not
edited (rule D1); no new dependency.

---

# 1. Principles

1. **One source of truth.** The profile shows what the portal route returns. The app has no student table, no second copy
   of a name or class, and computes nothing about a student except presentation (a formatted date).
2. **The backend decides who may see whom.** A teacher sees a student only through an assignment (class or subject
   teacher, today) or `attendance.mark_any`; a guardian only through the `guardians.user_id` → `student_guardians` link,
   re-proved on every request. The app's gating is a hint (ADR-0038); a refused request is shown as a refusal.
3. **Nothing the route does not return.** No billing, documents, other guardians' details for a guardian, photo (the routes
   have none), or fields from other endpoints.
4. **Less is stored on the phone.** Contact details of other people are not kept in the persisted query cache (SI-D3).

---

# 2. Contract (Static)

| Audience | Route | Gate | Body |
| --- | --- | --- | --- |
| Teacher | `GET /portal/teacher/students/:studentId` | staff audience; `attendance.mark` or `exam_result.save`; license `academic` | `{ student: { id, admissionNumber, fullName, dateOfBirth, gender, bloodGroup, status }, guardians: [{ guardianId, fullName, phone, email, relationship, isPrimary }], enrollments: [{ id, academicYearLabel, classId, className, sectionId, sectionName, status, rollNumber }] }`. No billing mode, documents or financial path |
| Teacher scope | same | an active enrollment in a class or section the caller holds an assignment for, today; or `attendance.mark_any` | otherwise **403**, the same answer for an id that does not exist; a `mark_any` holder gets a plain **404** |
| Guardian | `GET /portal/guardian/students` | `@PortalRoute('guardian')`, `portal.student.read` | `[{ studentId, fullName, admissionNumber, status, relationship, isPrimary, classId, className, sectionId, sectionName }]`, placement from the active enrollment (null when none) |
| Guardian | `GET /portal/guardian/students/:studentId` | `portal.student.read`, link proved on every request | `{ student: { id, admissionNumber, fullName, dateOfBirth, gender, status }, enrollments: [{ id, academicYearLabel, className, sectionName, status, rollNumber, enrolledAt, exitedAt }] }`. No other guardian's contact, billing or documents (ADR-0067 D8). Another family's id and a missing id both answer **403** |

Differences from earlier mobile documents (to reconcile when built; neither document is protected):
`GUARDIAN_FEATURES.md` §3 lists `guardian.profile` as "name, photo (if any), class/section, roll, guardians" from
`…/students/:id/profile` and `guardian.home` from `GET /portal/guardian/home`. The built routes have **no photo, no
guardian list and no `/profile` or `/home` route**; the child's profile is `GET /portal/guardian/students/:studentId`.
The app builds what exists.

Errors (`API_CONTRACT.md` §4 applies): 403 plain → "no access to this student"; 404 (teacher with `mark_any`) → "student not
found"; `TENANT_MEMBERSHIP_NOT_FOUND` / `LICENSE_*` → the existing school-level handling; 0 → offline.

---

# 3. Teacher: Student profile

## 3.1 Where it opens from

A student the teacher already sees in a list: the **Attendance roster row** (the only student list in the app that carries a
`studentId`; marks entry rows carry only an enrollment id on purpose). A small "Student details" icon button (≥ 44 pt, with a
screen-reader label) at the end of the row, so it does not collide with the row's status picker. It pushes
`/teacher/attendance/student?studentId=…` inside the Attendance stack (back returns to the roster with the unsaved edits
intact; the roster's leave guard does not fire for a push). Opening from marks entry is a later option (SI-D1).

It is a detail screen of `teacher.attendance`, not a new feature: **no manifest, no new feature id, no change to the
protected `FEATURE_MODULES.md`** unless SI-D4 gives it its own school switch.

## 3.2 What the teacher sees

| Block | Fields | Notes |
| --- | --- | --- |
| Header | full name, admission number, status badge | `status` other than active is shown as returned (word from the API through a label map, not guessed) |
| Placement | class and section, roll number of the current enrollment; earlier years below as a short list | from `enrollments[]`; the active one first |
| Personal | date of birth (school calendar via `src/lib/date.ts`), gender, blood group | shown as returned; a missing value is a dash, not "unknown" |
| Guardians | name, relationship, a "Primary" marker, **phone as a tap-to-call line** | `Linking.openURL('tel:…')` is React Native core: no package. **E-mail is not shown in v1** (SI-D2) |

Not shown: anything the route does not return; no edit action; no share or copy action.

## 3.3 States

| State | Behaviour |
| --- | --- |
| Loading | the shared `QueryState` loader |
| Content | as §3.2; pull to refresh |
| 403 | "You don't have access to this student." (the same for a student outside the teacher's classes and a missing id, so the app cannot tell them apart and says so once) |
| 404 (`mark_any`) | "Student not found." |
| Offline, nothing cached | "You are offline. Student details are not saved on this phone." (because of SI-D3) |
| Offline, cached in this session | the in-memory copy with the shared "saved data" banner |
| Empty guardians | "No guardian on record." |
| Plain error / 5xx | the shared error state with Retry |

## 3.4 Role-specific visibility

| Account | Sees the action | Can open |
| --- | --- | --- |
| Class or subject teacher (`attendance.mark`) | on the roster of a class they teach | only students of their classes (backend 403 otherwise) |
| `attendance.mark_any` | on any roster | any student; a missing id is 404 |
| `exam_result.save` only (no `attendance.mark`) | not offered in v1 (there is no roster for them) | — |
| Guardian-only membership | never (no teacher shell) | refused by the backend with 403 |

---

# 4. Guardian: Child profile

## 4.1 Navigation

The guardian shell (see `GUARDIAN_V1_PLAN.md`) holds a **child switcher** fed by `GET /portal/guardian/students`. With one
child there is no switcher; the child is simply selected. The profile is the child's detail screen reached from the
guardian Home and from the Profile tab; every other guardian screen (attendance, results, fees) reads the same selected
child.

## 4.2 What the guardian sees

| Block | Fields |
| --- | --- |
| Header | child's name, admission number, status, class and section (from the list route), relationship of the signed-in guardian (and "Primary" if so) |
| Details | date of birth (school calendar), gender |
| Enrollments | per year: academic year label, class, section, roll number, status, enrolled and exited dates |

Not shown, because the route does not return it: photo, other guardians, contact details, billing, documents.

## 4.3 States

| State | Behaviour |
| --- | --- |
| No linked students | "No students are linked to your account yet. Ask your school." (also what a guardian-only login with no link sees) |
| One / several children | no switcher / a switcher with the children's names and classes |
| 403 on a child | the child is dropped from the local list, the list is refetched, and the first remaining child is selected; no stale data of that child stays on screen |
| Switching child | every query for the previous child is dropped (keys include the student id); the screen shows loading, never the previous child's data |
| Exited enrollment | shown with its `exitedAt` and status; the header uses the active enrollment, or none |
| Offline | cached copy with the "saved data" banner (persisting the guardian's own child's profile is acceptable, SI-D3) |

---

# 5. Data layer

- Keys, all `[tenantId, …]`: `['teacher','student',studentId]`; `['guardian','students']`; `['guardian','student',studentId]`.
- Stale classes (`src/api/staleTime.ts`): Daily (5 min) for the teacher profile (access can change when assignments change);
  Session (15 min) for the children list; Daily for a child profile. No class is added or changed.
- Query-key and wipe rules are the existing ones: a school switch or sign-out removes every `[tenantId, …]` query.
- **Persistence (SI-D3).** Today every successful query is persisted (`QueryProvider`, 7 days). The teacher profile holds
  other people's phone numbers and health data, so the recommendation is to mark it `meta: { persist: false }` and make
  `shouldDehydrateQuery` honour it (a one-line change in `src/providers/QueryProvider.tsx`). Server-state caching strategy is
  an architecture decision (mobile `CLAUDE.md` §4), so it waits for approval.
- Projection: `src/api/portal.ts` returns only the fields in §3.2 and §4.2 (the lesson of the marks roster, which carried
  guardian names it never used).

# 6. Reuse and new code

Reuse: `QueryState`, `Screen`, `Card`, `StatusBadge`, `OfflineBanner`, `useManualRefresh`, `src/lib/date.ts`, the stale
classes, the error-action mapping, `AccountActions` patterns for confirmation. New: two request functions and types in
`src/api/portal.ts` (not a new client), `TeacherStudentScreen`, a `GuardianChildProfile` screen, two small hooks. No shared
"profile card" component is built until the second user exists (the two audiences show different fields).

# 7. Tests

Teacher: the action appears on a roster row and pushes the route; the 403, 404, offline, empty-guardian and loading states;
phone number opens `tel:`; no e-mail rendered; the query is not persisted (if SI-D3 is approved); a school switch removes
it. Guardian: no children, one child (no switcher), two children (switcher), a switch drops the previous child's queries,
a 403 on a child drops it, nothing from another child remains after a switch, exited enrollment. Both: screen-reader labels,
font scale 1.3, Nepali strings (keys only).

# 8. Decisions (accepted as recommended by the owner, 2026-10-22; the recommendation column is the decision)

| # | Decision | Recommendation |
| --- | --- | --- |
| SI-D1 | Where the teacher can open a profile: (a) the attendance roster only; (b) also marks entry (needs `studentId` kept in the marks roster projection) | **(a)** for v1 |
| SI-D2 | Which guardian details a teacher sees: (a) everything the route returns; (b) name, relationship, primary and phone, **no e-mail**; (c) no guardian block | **(b).** The backend already allows (a); this is the owner's privacy call |
| SI-D3 | Keep the teacher profile out of the persisted cache (`meta: { persist: false }`, a one-line change in `QueryProvider`) | **Yes**, for the teacher profile; the guardian's own child profile may persist |
| SI-D4 | Give the teacher profile its own school switch (`students` mobile module key, a small access constant, no new feature id) or let the Attendance switch govern it | **Own switch** (`students` is an existing key), so a school can hide student details from phones without hiding attendance |
| SI-D5 | Guardian profile: ship exactly what the route returns (no photo, no guardians list); ask the backend for more later | **Yes** |
| SI-D6 | Show the child's date of birth only, or also an age | **Date only**, through the school's calendar setting |

# 9. Build order

1. ~~Call `GET /portal/teacher/students/:id` on the test stack and record the live shape.~~ **Done 2026-10-22.**
2. ~~Types, request functions and tests in `src/api/portal.ts`.~~ **Done.**
3. ~~Teacher screen, roster action, strings (en, ne), tests.~~ **Done** (unit-tested; not seen on a phone).
4. Guardian pieces with Guardian V1 (`GUARDIAN_V1_PLAN.md`), because they need the guardian shell and a guardian test account. **Waiting (GV-D1).**
5. Docs: this file, `project-status.md`, `API_CONTRACT.md`, `TEACHER_FEATURES.md` done for the teacher half; `GUARDIAN_FEATURES.md` with the guardian half.
6. `pnpm verify` and the Android export: **done** (62 suites / 599 tests; export OK). The owner's phone run is next.

# 10. Not verified

The live bodies of the two guardian routes (the teacher route is verified); whether the roster action collides with the
status picker on a small screen (it sits beside the status badge, not on the row; unseen on a phone); the school's
`students` module switch name as the web writes it (`students` is the key the web's customization list uses; not
exercised through the web screen); every student status word beyond the five the backend defines (an unknown value is
shown as returned).
