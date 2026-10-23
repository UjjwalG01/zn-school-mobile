---
description: Teacher features of the mobile app — v1 scope, screens, backend dependencies, rules, and the future feature list.
purpose: Define exactly what a teacher can do in the app and which backend contracts each feature relies on.
access: Read
---

# Teacher Features

## Status

M2 (2026-10-22): Home, My classes, Attendance, My Attendance, the Academic hub, Profile and **Marks entry** are built and
unit-tested in the app; none has run on a phone (the owner tests on their own phone, no emulator). The backend pieces
(marks scoping, per-subject marks, open exams, teacher portal reads, bulk attendance, staff and assignments, self attendance)
are built there; the marks, attendance and self-attendance contracts were Reproduced over HTTP on 2026-10-22. Student
information is planned (`docs/project/STUDENT_INFO_PLAN.md`); notices are planned (V1_DELIVERY_PLAN P2.6).
**A teacher needs a role holding `attendance.mark` or `exam_result.save`** (plus `attendance.read`, `attendance.self` for
the roster and My Attendance, and a staff link and assignments). Until 2026-10-22 the platform had no default Teacher role,
which is why a new teacher saw "Use the web app"; the platform role **`default_teacher`** (those five permissions plus
`exam_result.read`) was added that day, verified on the test databases and applied to the development database
(`docs/project/ROLES_ACCESS_CHECK.md`, request B12). **On 2026-10-23** the web/API project added `calendar.read` and
`exam_attendance.mark` to the same role (migration `0239`, on the owner's instruction); exam attendance is limited to the classes the
teacher is assigned to. The app has no calendar or exam-attendance screen (§3), so it shows nothing new for these keys.

---

# 1. Who is a teacher

A user whose membership in the selected school is linked to an active **staff member**
(`staff_members.membership_id`, ADR-0062) or holds the teacher permissions. There is no separate
teacher account — the same user logs into web and mobile; the staff record is the school's teacher
profile and is optional on a login. What a teacher may touch is defined by **teacher assignments**
(effective-dated, never deleted):

| Assignment                            | Grants (backend-enforced)                      |
| ------------------------------------- | ---------------------------------------------- |
| Class teacher of class/section        | mark attendance for that class/section (built) |
| Subject teacher of a subject offering | enter marks for that subject (WP-2, not built) |

Admins with `attendance.mark_any` / `exam_result.save_any` are not limited by assignments; the app
treats them as teachers of everything they can see. `attendance.mark_any` exists; `exam_result.save_any`
arrives with WP-2.

---

# 2. v1 features

## 2.1 Home — `teacher.home`

Composed from two reads (there is no `GET /portal/teacher/home`; the backend left it out on purpose):
`GET /portal/teacher/my-classes?date=` (the classes the teacher can mark today, the subject
assignments, `restricted`) and `GET /portal/teacher/exams` (exams open for marks entry with the
caller's subjects and their submission state), plus the cached `me`, `my-schools` and tenant settings
for the greeting, school and date line. Shown only for what the user may see: Attendance, Marks
entry, My subjects. No academic-year label (no endpoint carries it), no per-section "attendance
done" and no holiday banner (those need the roster), and the teacher's own attendance status
(§2.6) is not on Home v1. Built 2026-10-21; plan in `docs/project/TEACHER_HOME_PLAN.md`.

## 2.2 My classes — `teacher.assignments`

Every class/section the teacher can mark and every subject assignment (class, section or "no
sections", subject), from `GET /portal/teacher/my-classes` (the response Home already caches; there is
no `/portal/teacher/assignments`). Backend order, not re-sorted; `restricted: false` shows a "you can
mark any class" note. No academic-year label (no endpoint carries it). Read-only; built 2026-10-21.

## 2.3 Attendance — `teacher.attendance`

1. Pick section (from assignments) and date (default today; past dates allowed only as far as the
   backend allows).
2. Roster from the existing `GET /attendance/roster?date=&classId=&sectionId?` (primary DB; the backend
   has no `/portal/teacher/sections/:id/roster`), showing existing
   statuses if already marked and a banner when the day is a holiday or weekly off (`dayInfo`).
3. "Mark all present", then tap exceptions: `present | absent | late | half_day | excused`, optional
   remark. Status labels and which statuses are active come from `GET /attendance/settings` (the
   school can rename or switch statuses off) — never a hardcoded list.
4. Submit once → `POST /attendance/records/bulk` (idempotency key, per-row `version`). Re-submitting
   the same day updates. The backend refuses the whole batch in a 2xx `{ ok:false, failures }`;
   the app shows the per-student reasons and keeps the draft.
5. Online only; if offline, keep the draft in memory and show "connect to submit".

Rules: classes without sections work end-to-end without a section (ADR-0054 / capability pattern).
The app never decides eligibility — the roster is what the backend returns.

Built 2026-10-21 (plan: `docs/project/ATTENDANCE_PLAN.md`; owner decisions D1–D5 approved the same day):

- Navigation (D1): the Attendance tab is a nested stack, class list then roster; a teacher with exactly
  one class skips the list. Home's Attendance cards open that roster.
- Idempotency key (D2): `src/lib/uuid.ts`, no new dependency. The key follows the payload: an identical
  retry (after offline or a 5xx) keeps it, any edit gets a new one; an answered request spends it.
- "Today" (D3) is the device's local date, as on Home. If the phone is ahead of the school around
  midnight the backend refuses (`ATTENDANCE_INVALID_DATE`), nothing is written, and the teacher steps back a day.
- Past dates (D4): the date stepper stops at `today − backdateWindowDays` (from settings; a hint). Correcting
  older dates stays on the web.
- Non-school day (D5): when `dayInfo.schoolDay` is false the roster is read-only with a banner; the app reads
  `dayInfo`, it keeps no calendar.
- **A stale `version` inside a bulk save is not a 409.** It comes back as a 2xx `ok:false` failure whose
  `error` is an English sentence with no code. The app shows that sentence under the student and detects
  conflicts from data: each draft entry remembers the `version` of the record the teacher saw
  (`baseVersion`); when the roster's version moves, the row is flagged and Save is blocked until the
  teacher chooses "Keep mine" (rebase) or "Use theirs" (drop the edit). Nothing is overwritten silently.
- Save sends only changed rows in one request, then patches the cached roster from the response (no refetch).
- The draft lives in memory only and a back gesture or date change with unsaved edits asks first.

## 2.4 Marks entry — `teacher.marks`

1. Exams open for entry (`GET /portal/teacher/exams`, built; it replaced the proposed `/exams/open`) — backend derives "open" from
   `exams.status ≠ draft`, `result_status = pending`, `allow_modify = true`.
2. Pick exam → subject (only assigned subjects) → student list with component fields (theory /
   practical / etc. as returned) and max marks.
3. Client-side checks only for UX (number, 0..max); the backend validates again.
4. Save per subject (per-subject mode, B6) with `version`; on `CONCURRENCY_VERSION_CONFLICT` show
   the other value and let the teacher choose to re-apply.
5. Locked/published exams are read-only.

Built 2026-10-22 (plan and evidence: `docs/project/MARKS_PLAN.md`; unit-tested, not run on a phone):

- Entry **filters** (changed 2026-10-23, owner request, §2.9: exam session → class → section → subject, each subject showing none / draft /
  submitted / returned, and the school's reason once a returned subject is chosen; this replaced the old list of exam cards) and an entry screen: one numeric field per component, labelled with its maximum, a
  "12 of 30 students complete" line, **Save** (changed, complete students only, one all-or-nothing request) and **Submit
  to school** (asks first). Unsaved edits live in memory only and the leave guard asks first.
- The result `version` of each student is sent with every save (M-D1). It is per student, not per subject, so another
  subject teacher's save can make yours a 409; the screen then keeps the typed values, marks the student, and asks "Keep
  mine" or "Use theirs" (never overwrites silently). A stale submit has its own message.
- The idempotency key follows the payload (kept for an identical retry after offline or a 5xx, new after any edit, spent
  once the server answered). A refused batch shows the backend's reason under each student and loses nothing typed. A
  `submitted` subject is read-only; a `returned` one shows the school's reason and is editable.
- Only the fields the screens read are kept from the roster and results (the persisted cache must not hold guardian names or
  grades). Backend asks A, B, C are in the plan (B is a Reproduced exposure: any member can read every student's marks of an exam).

## 2.5 Exam routine — `teacher.routine`

> After v1 (owner decision 2026-10-18): the first release is attendance, marks, fees, student information and notices.

Routine PDF via reprint endpoint; cached on device.

## 2.6 My attendance — `teacher.selfAttendance` (added 2026-10-16)

> In v1 (owner decision 2026-10-21, reversing the 2026-10-18 "after v1" note): it is the **My Attendance**
> subtab of the Attendance tab. Plan: `docs/project/TEACHER_APP_PLAN.md`.

A "Mark Present" card on the teacher home and a month view of the teacher's own attendance. Uses the
existing `POST /attendance/staff/self` (no body — the server decides who and when) and
`GET /attendance/staff/self?month=`; permission `attendance.self`. A second tap is a no-op
(`unchanged`). Handle: 404 (account not linked to a staff member — show "ask your school to link
your staff record"), 409 (inactive staff, or an administrator already recorded another status
today), 400 (holiday or weekly off, or `present` switched off). Presence only; no check-in/out
times. The app never marks anyone but the caller.

## 2.7 Tab layout (built 2026-10-21, `docs/project/TEACHER_APP_PLAN.md`)

Five tabs from the feature registry: **Dashboard** (`teacher.home`), **Attendance** (Student Attendance and My
Attendance subtabs), **Academic** (a hub: My classes, My subjects, Open exams, **Marks entry** (built 2026-10-22), and a
"Coming soon" row for Exam routine), **More** (placeholder) and **Profile** (identity, school switching, sign-out).
Profile and More are always visible. Status: Implemented and unit-tested; not yet run on a device. The Dashboard
carries summary tiles (classes, subjects, open exams) and no shortcut row (the tab bar leads to each tab); Sign out
and Switch school live on Profile.
The sections above describe what each feature does.

## 2.8 Student information (built 2026-10-22, unit-tested, not run on a phone; `docs/project/STUDENT_INFO_PLAN.md`)

A detail screen opened from an "i" button beside the status badge on each Attendance roster row, from
`GET /portal/teacher/students/:studentId` (a class or subject teacher of the student, or `attendance.mark_any`; any
other student is a 403, the same answer for an unlinked account and a missing id). Shows name, admission number, status,
class, section and roll with earlier years, date of birth in the school's calendar, gender, blood group and the guardians
(name, relationship, a Primary marker, a tap-to-call phone; **no e-mail**). Decisions SI-D1 to SI-D4 as accepted: opened
from the roster only; the guardian e-mail and class ids are dropped when the response is read; the student is kept out of
the on-device cache (`meta: { persist: false }`); it has its own school switch (`students`) and follows `attendance.mark`
and the academic licence; it is a detail screen of Attendance, not a registry feature.

---

## 2.9 Hubs, cards and the filter step (owner request 2026-10-23)

Related work is grouped on one page of **cards**, and a card opens the work. The tabs stay separate by kind of work: **Attendance** (Student
Attendance, My Attendance), **Academic** (a hub: My classes, Marks entry, Exam attendance, plus read-only subjects and open exams), **More** (a hub:
Academic Calendar) and **Profile**. A hub lists the visible `menu` features that name it in `tab`; a card appears only for a teacher who
holds its permission, and the school can switch it off per module (`my_classes`, `exams`, `calendar`).

Marks entry and Exam attendance open on a **filter page**, the phone counterpart of the web's filter row (`SelectField`, a labelled field that
opens a sheet of choices): **Exam session → Class → Section (when there is one to choose) → Subject** (marks) or **Paper** (exam attendance), then
one button. A lone session or class is chosen for the teacher. A whole-class exam offers an optional section that narrows the list (a subject taught
to every section is listed once per section until one is chosen); a class with a separate exam per section requires one; a class with no sections
and a section exam show no section filter. The server decides which exams appear; the filters only narrow its list, and every id they produce is
checked again by the endpoint that receives it. The pure model is `src/features/teacher/examFilters/examFilterModel.ts` (`resolve`, `choose`);
`ExamFilterForm` draws it. Marks entry's old list of exam cards was replaced by this page; its entry screen, drafts, versions and submit are unchanged.

## 2.10 Exam attendance — `teacher.exam-attendance` (built 2026-10-23, unit-tested, not run on a phone; `docs/project/CALENDAR_AND_EXAM_ATTENDANCE_PLAN.md`)

Academic hub card → the filters (§2.9) → the paper's sheet: one row per student the server returns, three statuses (Present, Absent, Excused; a remark
once a status is set), "Mark remaining present", and one **Save**. Which students appear is the server's answer (the teacher's classes, or every class
with `exam_attendance.mark_any`); an unassigned teacher sees an empty list. The save is all-or-nothing with `version` per row and an idempotency key
that follows the payload: a refused batch lists the reasons per student and keeps the edits, a lost connection keeps them and replays on the next
Save, a student someone else changed shows "Keep mine / Use theirs", a 403 (one student outside the teacher's classes) refuses the whole save and
refreshes the lists, and a draft or locked exam, or a paper not yet held, shows the backend's own sentence. Exam attendance never changes marks,
grades or daily attendance. The daily status the web shows beside each student is not shown or stored on the phone.

## 2.11 Academic Calendar — `teacher.calendar` (built 2026-10-23, unit-tested, not run on a phone)

More hub card → a month in the **school's own calendar** (Gregorian or Bikram Sambat from the tenant setting; the API is asked in AD). Days with an
event, a holiday or the teacher's own approved leave carry up to three marks (and a count in their spoken name); a tapped day lists its items;
below the month are the **upcoming events and holidays** (the next 60 days) and the **latest school notices**. Weekly off-days are muted and named.
The server filters everything for this person (audience, staff type, class assignment; notices by audience and scope). Loading, empty, offline
("Showing saved data from …"), failed (retry) and no-access (403) states are the shared ones; a refused notices read hides only that section. The
app keeps no `internalNotes` or audience flags. Notices were scheduled for M4 (`CLAUDE.md` §5); the owner's explicit brief of 2026-10-23 asked for them here.
Known limit: "today" is the device's date (as everywhere in the app), not the school's timezone.

## 2.12 Language — `Profile` (built 2026-10-23, unit-tested, not run on a phone)

Profile has a **Language** control (English, नेपाली). The choice is remembered on the device (`AsyncStorage`, key `zn-locale`; a device preference,
kept through sign-out) and read before the first screen, so the app never opens in one language and flips. A change re-mounts the screens under the
root layout so every string is read again (some are kept in memo); the query cache, the session and the navigation state are outside it. Because
that drops drafts held only in memory, the switch asks first when any screen has unsaved edits (`src/features/unsavedWork.ts`, fed by
`useUnsavedGuard`). Month names and the Bikram Sambat month names stay in English; the Nepali strings are drafted and need a fluent reviewer.

# 3. Not in v1

Class timetable (no backend model), leave requests, editing student data, publishing/locking
results (stays on web), any finance, attendance reports and exam attendance (they exist on web; since
2026-10-23 the default Teacher role holds exam attendance, limited to the teacher's assigned classes, and the calendar), marking other
staff. A calendar and an exam-attendance screen would be a separate go-ahead (they need a feature manifest, FEATURE_MODULES §2).

---

# 4. Future features (M5 — each needs its own backend ADR first)

| Feature                 | Notes                                                                                                             |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Classroom               | class feed/posts per section; needs a new backend module + storage decision (ADR-0012 is local disk, single node) |
| Homework / assignments  | create, due date, attachments, submission status                                                                  |
| Lesson planning         | per subject/term plans, approval by coordinator                                                                   |
| Question making by scan | camera/PDF capture → question bank; OCR provider is an integration decision (backend Phase 9)                     |

Each is added as a feature module (`docs/architecture/FEATURE_MODULES.md`) with its own permission
key and `mobileModuleKey`.
