---
description: Teacher features of the mobile app — v1 scope, screens, backend dependencies, rules, and the future feature list.
purpose: Define exactly what a teacher can do in the app and which backend contracts each feature relies on.
access: Read
---

# Teacher Features

## Status

Planned (M2). Blocked by backend B5 (assignments), B6 (bulk attendance, per-subject marks,
open-exams list), B7 (teacher portal reads).

---

# 1. Who is a teacher

A user whose membership in the selected school holds a staff role with teacher capabilities. There
is no separate teacher account and no staff table — the same user logs into web and mobile. What a
teacher may touch is defined by **teacher assignments** (B5):

| Assignment | Grants (backend-enforced) |
|---|---|
| Class teacher of class/section | mark attendance for that class/section |
| Subject teacher of a subject offering | enter marks for that subject |

Admins with `attendance.mark_any` / `exam_result.save_any` are not limited by assignments; the app
treats them as teachers of everything they can see.

---

# 2. v1 features

## 2.1 Home — `teacher.home`

One request (`GET /portal/teacher/home`): today's sections and whether attendance is done, exams
open for entry with progress, academic year label.

## 2.2 My classes — `teacher.assignments`

List of assignments for the active academic year (class, section or "no sections", subject).

## 2.3 Attendance — `teacher.attendance`

1. Pick section (from assignments) and date (default today; past dates allowed only as far as the
   backend allows).
2. Roster from `GET /portal/teacher/sections/:id/roster?date=` (primary DB), showing existing
   statuses if already marked.
3. "Mark all present", then tap exceptions: `present | absent | late | half_day`, optional remark.
4. Submit once → `POST /attendance/records/bulk`. Re-submitting the same day updates (upsert).
5. Online only; if offline, keep the draft in memory and show "connect to submit".

Rules: classes without sections work end-to-end without a section (ADR-0054 / capability pattern).
The app never decides eligibility — the roster is what the backend returns.

## 2.4 Marks entry — `teacher.marks`

1. Exams open for entry (`GET /portal/teacher/exams/open`) — backend derives "open" from
   `exams.status ≠ draft`, `result_status = pending`, `allow_modify = true`.
2. Pick exam → subject (only assigned subjects) → student list with component fields (theory /
   practical / etc. as returned) and max marks.
3. Client-side checks only for UX (number, 0..max); the backend validates again.
4. Save per subject (per-subject mode, B6) with `version`; on `CONCURRENCY_VERSION_CONFLICT` show
   the other value and let the teacher choose to re-apply.
5. Locked/published exams are read-only.

## 2.5 Exam routine — `teacher.routine`

Routine PDF via reprint endpoint; cached on device.

---

# 3. Not in v1

Class timetable (no backend model), teacher's own attendance, leave requests, editing student
data, publishing/locking results (stays on web), any finance.

---

# 4. Future features (M5 — each needs its own backend ADR first)

| Feature | Notes |
|---|---|
| Classroom | class feed/posts per section; needs a new backend module + storage decision (ADR-0012 is local disk, single node) |
| Homework / assignments | create, due date, attachments, submission status |
| Lesson planning | per subject/term plans, approval by coordinator |
| Question making by scan | camera/PDF capture → question bank; OCR provider is an integration decision (backend Phase 9) |

Each is added as a feature module (`docs/architecture/FEATURE_MODULES.md`) with its own permission
key and `mobileModuleKey`.
