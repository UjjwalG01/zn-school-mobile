---
description: Backend (main repo) changes the mobile app depends on, each with the problem, recommended option, affected code and the ADR it needs.
purpose: Single list of mobile-driven backend work so the backend repo can approve and implement it before the mobile app relies on it.
access: Read
---

# Backend Prerequisites for the Mobile App

## Status

**Proposed.** Every item below is a recommendation awaiting an ADR and explicit user approval in the
backend repo (`zn-school-platform-v1`, governed by its `CLAUDE.md` §3–4). Nothing here is
implemented. ADR numbers are candidates (the backend's last ADR at writing is ADR-0060).

All paths are relative to `apps/api/src/` in the backend repo unless stated. Section *N* below is
referred to as **B*N*** in the roadmap and status docs.

---

# 0. Current backend facts (verified 2026-10-14)

| Area | Today |
|---|---|
| Tokens | JWT access 15 min, refresh 30 days absolute, rotated, sha256-hashed in `refresh_tokens` (`identity/identity.service.ts`). Returned in the JSON body — mobile-compatible. |
| Inactivity | Checked at refresh against `refresh_tokens.last_activity_at`; limit = strictest `tenant_settings.session_timeout_minutes` across the user's memberships (5–480, default 30) — ADR-0022. |
| Mobile timeout | `tenant_settings.mobile_session_timeout_minutes` exists (`database/schema/settings.ts`, DTO `tenancy/dto/update-tenant-configuration.dto.ts` `@Max(480)`), **read by no auth code**. |
| Login | `POST /identity/login {email,password}` only. No throttling. No refresh-token reuse detection. |
| Tenant | `?tenantId=` on every call; `tenancy/tenant-context.guard.ts`; `GET /tenancy/my-schools`, `GET /tenancy/my-permissions`. |
| Invite | `POST /tenancy/memberships/invite` → UUID token (hashed, 7 days); `POST /tenancy/memberships/activate {token,password?}` (public). No email/SMS sent. |
| Reads | `@RequireTenantMembership()` — **any active member can read all students, results, attendance**. Finance reads need `finance.read` (school-wide). |
| Teacher | No staff table, no class/subject teacher assignment (`database/schema/attendance.ts`, `database/schema/curriculum.ts` comments). |
| Attendance | `POST /attendance/records` = one student upsert; `GET /attendance/records`. Permission `attendance.mark`. |
| Marks | `POST /academic/exam-results/entry` and `/bulk-entry` require **every required subject's components per student** (ACADEMIC_ARCHITECTURE §4.2). Permission `exam_result.save`. |
| Guardian | `guardians` has no `user_id` (`database/schema/student.ts`); no portal; no self-scoped endpoints. |
| Database | One `pg` Pool (`database/database.module.ts`, `APP_DATABASE_URL`); no read replica. |
| Mobile UI toggle | `tenant_mobile_module_visibility` + `GET/PATCH /settings/tenant/mobile-modules` (display only). |

---

# 1. Mobile session policy — ADR candidate "Mobile client sessions"

**Problem.** A 30-minute inactivity limit forces repeated logins on phones (D7).

**Recommended.**

1. `POST /identity/login` accepts optional `clientType: 'web' | 'mobile'` (default `web`).
   Store it on `refresh_tokens.client_type`; rotation copies it.
2. At refresh, mobile tokens use `mobile_session_timeout_minutes` (strictest across memberships,
   same rule as ADR-0022), default **10080 (7 days)**. Raise the DTO max from 480 to **14400
   (10 days)** — the column is `smallint`, so it fits.
3. Keep the 15-minute access token (refresh is one cheap indexed row; a short access token limits
   damage from a leaked token).
4. **Refresh-token reuse detection**: presenting an already-rotated token revokes the whole chain
   (add `family_id` to `refresh_tokens`). Mandatory once tokens live for days.
5. **Login throttling** (per identifier + per IP, e.g. 10 / 15 min) using the same audit-count
   approach as change-password (`identity.service.ts`), returning `429 AUTH_TOO_MANY_ATTEMPTS`.
6. Suspending a membership or user, or changing the password, must still end mobile sessions
   (already true: `JwtAuthGuard` re-checks user status; change-password revokes other tokens).

**Touches.** `identity/identity.service.ts`, `identity/dto/*`, `database/schema/identity.ts`,
`tenancy/dto/update-tenant-configuration.dto.ts`, migration. Supersedes part of ADR-0022.

---

# 2. Phone as login identifier — ADR candidate "Login identifiers"

**Problem.** Many guardians have no email (D3).

**Recommended.**

1. `users.phone` — normalized E.164 (`+977…`), unique where not null.
2. `POST /identity/login` accepts `{ identifier, password }` where identifier is email or phone;
   keep accepting `{ email, password }` for the web client (backward compatible).
3. Invite/direct-create accept `phone` as an alternative to `email`; at least one is required.
4. Guardians: `guardians.phone` stays the Student-domain contact field; `users.phone` is the login
   identity. Do not sync them automatically (SSOT: different facts).

**Open question for the ADR.** Phone-number reuse/transfer (numbers get recycled) — require admin
re-verification on change.

---

# 3. Short activation code + QR — ADR candidate "Human-friendly activation codes"

**Problem.** The invite token is a UUID — impractical to type on a phone (D4).

**Recommended.**

1. Invite also issues an **8-character code** (Crockford base32, no ambiguous characters),
   stored hashed, same 7-day expiry, **max 5 failed attempts** per code then invalid.
2. `POST /tenancy/memberships/activate` accepts `{ code, password }` as well as `{ token, password }`.
3. The web admin screen prints an **activation slip**: school name, person name, code, and a QR
   containing `znschool://activate?code=XXXXXXXX` (no tenant id, no personal data in the QR).
4. Delivery stays manual (printed slip / read aloud) until backend roadmap Phase 9 adds SMS/email.
5. Re-issuing a code invalidates the previous one.

**Touches.** `tenancy/tenancy.service.ts` (invite/activate); `database/schema/tenancy.ts`
(`memberships.activation_token_hash` / `activation_token_expires_at` live there today — add the code
hash + failed-attempt counter beside them); the memberships RLS activation policy (ADR-0014, keyed
on `app.activation_token_hash`) must accept the code hash too; web invite screen.

---

# 4. Guardian identity and the staff/guardian audience — ADR candidate "Guardian portal access"

**Problem.** A guardian needs a login, but any membership today can read the whole school
(`@RequireTenantMembership()`).

**Recommended.**

1. `roles.audience` — `'staff' | 'guardian'`, default `'staff'`. Seed one system role
   `guardian` (audience `guardian`, no staff permissions).
2. **One central change** in `tenancy/tenant-authorization.service.ts`: the membership-only check
   used by `@RequireTenantMembership()` requires at least one **staff-audience** role. Existing
   users are unaffected (all their roles are staff). This closes the "guardian reads the whole
   school" hole without touching every controller. A few membership-only routes the app needs for
   *every* audience must opt out explicitly (e.g. a `@RequireTenantMembership({ anyAudience: true })`
   variant): `GET /tenancy/my-permissions`, `GET /settings/tenant/mobile-modules`, and the tenant
   display settings (calendar, currency, locale). The ADR lists the exact set.
3. `guardians.user_id` — nullable FK to `users`, unique per `(tenant_id, user_id)`, `ON DELETE
   RESTRICT`. This is the only link from a login to students; students are resolved
   `guardians.user_id → student_guardians → students`.
4. Guardian invite = existing invite flow with role `guardian` + set `guardians.user_id` in the same
   transaction (one membership per user per school, as today).
5. A teacher who is also a parent at the same school holds **both** roles on the same membership;
   the app shows both shells.
6. Portal endpoints (item 7) require a guardian-audience role **and** derive data only from the link
   — never from a client-supplied student id without checking the link.

Consistent with `.claude/CLAUDE.md` Rules 5–6 (identity → membership → role → permission). Seat
counting (`tenant_settings.max_users`) — the ADR must decide whether guardian-only memberships count
as seats (recommend: no, separate guardian limit if licensing needs one).

---

# 5. Teacher assignments and scoping — ADR candidate "Teacher assignments" (Academic)

**Problem.** D5 requires teachers to act only on their assigned classes/subjects; no such model
exists.

**Recommended.**

1. Table `teacher_assignments`:

   ```text
   id, tenant_id, academic_year_id, membership_id,
   kind              'class_teacher' | 'subject_teacher'
   class_id          not null
   section_id        nullable (class without sections — ADR-0054)
   subject_offering_id  required when kind = subject_teacher, null otherwise
   active BOOLEAN NOT NULL DEFAULT TRUE      (rules/database.md §5a)
   ```

   References `membership_id` (no staff table needed; Staff/HR stays a separate future domain).
2. Enforcement in the backend services (not guards on the client):
   - `attendance.mark` → requires an active `class_teacher` assignment for that class/section,
     unless the caller holds `attendance.mark_any`.
   - `exam_result.save` → requires a `subject_teacher` assignment for each subject written, unless
     the caller holds `exam_result.save_any`.
3. Migration grants `*_any` to every existing role that has `attendance.mark` / `exam_result.save`,
   so current web users keep working unchanged.
4. Web admin UI to manage assignments (list page per the web `ListPageLayout` convention).

---

# 6. Teacher write endpoints

1. **Bulk section attendance** — `POST /attendance/records/bulk`
   `{ tenantId, date, classId, sectionId?, records: [{ studentId, status, remarks? }] }`: one
   transaction, idempotent upsert on `(student_id, attendance_date)`, one audit entry per changed
   row, validates enrollment in that class/section and the assignment (item 5).
2. **Per-subject marks entry** — ADR candidate (Academic): a subject-scoped submission mode
   (`examId, examSubjectId, entries: [{ enrollmentId, components: [...] }]`) that relaxes the
   whole-student rule of ACADEMIC_ARCHITECTURE §4.2, with optimistic concurrency (`version`) so two
   teachers cannot silently overwrite each other. The result is computed when all required subjects
   are present (exact rule decided in the ADR).
3. **Exams open for entry** — `GET /portal/teacher/exams/open` derived from the existing marks gate
   (`exams.status ≠ draft`, `exams.result_status = pending`, `exam_configs.allow_modify = true`),
   filtered to the teacher's subject assignments.

---

# 7. Self-scoped portal read endpoints — ADR candidate "Portal read API"

Guardian (all require guardian audience; every `:studentId` is checked against the link):

| Endpoint | Returns |
|---|---|
| `GET /portal/guardian/home` | children summary: name, class/section, today's attendance, net outstanding, latest published result — **one call** |
| `GET /portal/guardian/students` | linked students |
| `GET /portal/guardian/students/:studentId/profile` | profile subset safe for guardians |
| `GET /portal/guardian/students/:studentId/attendance?from&to` | attendance records |
| `GET /portal/guardian/students/:studentId/financial-position` | same shape as `finance/students/:id/financial-position`, no `finance.read` |
| `GET /portal/guardian/students/:studentId/invoices` / `payments` | paginated |
| `GET /portal/guardian/invoices/:id/pdf`, `payments/:id/receipt` | reprint PDFs (only if linked) |
| `GET /portal/guardian/students/:studentId/results` | results with `result_status in (published, locked)` only |
| `GET /portal/guardian/results/:id/marksheet` | marksheet reprint (published = watermarked draft, locked = official — ADR-0037 D7) |
| `GET /portal/guardian/exam-sessions/:id/routine` | routine reprint |

Teacher (staff audience; filtered to assignments):

| Endpoint | Returns |
|---|---|
| `GET /portal/teacher/home` | today's assignments, attendance done/pending per section, exams open for entry — **one call** |
| `GET /portal/teacher/assignments` | assignments for the active academic year |
| `GET /portal/teacher/sections/:id/roster?date=` | enrolled students + that day's attendance status |

Implementation reuses existing services (StudentFinancialPositionService, DocumentEngine reprint,
attendance/exam-result queries) behind a scope check — no duplicate business logic.

---

# 8. Guardian result visibility

Guardians see only `exam_results.status in ('published','locked')`. No new flag: the existing
publish/lock lifecycle already means "released". An additional per-exam "hide from guardians"
switch is **optional** and decided in the item-7 ADR.

---

# 9. Read-replica routing — ADR candidate "Read replica for portal reads"

**Problem.** D8: portal reads should not load the primary.

**Recommended.**

1. A second Drizzle provider `READ_DB` on `APP_READ_DATABASE_URL`. **When unset it reuses the
   primary pool** — so the code ships now and the replica is pure infrastructure later.
2. Only `/portal/guardian/*` GETs and teacher **reference** reads (assignments, routine) use
   `READ_DB`. Every write, and every read that must reflect a just-made write (teacher roster after
   saving attendance, marks entry screens), stays on the primary.
3. RLS keeps working: `withTenantContext` uses `set_config(..., true)`, which is allowed in
   read-only transactions on a hot standby. Use `BEGIN READ ONLY` for replica transactions.
4. Postgres streaming replication; acceptable lag target ≤ 5 s; the app shows data "as of" the
   response time and guardians never need sub-second freshness.
5. Monitoring: replica lag metric; if lag exceeds threshold, `READ_DB` falls back to primary.

**Blocked by.** The production hosting decision (no ADR yet). The provider seam (step 1) is not
blocked.

---

# 10. Later (not needed for M1–M3)

| Item | Depends on |
|---|---|
| Notices/announcements module | new Academic/communication domain ADR |
| Push tokens (`user_devices`) + Expo push sending (via outbox) | backend roadmap Phase 9, ADR-0013 outbox completion |
| SMS/email delivery of activation codes | Phase 9 |
| Class timetable | Academic ADR (ADR-0037 made per-class routine a non-goal) |
| Per-student ledger statement | Finance; `finance/student-ledger` has only reconciliation today |
| Attendance in student profile | `student-profile.service.ts` note |

---

# 11. Order and dependencies

```text
1 Mobile sessions ─┐
2 Phone login     ─┼─→ M1 (app foundation)
3 Activation code ─┘
4 Guardian audience ─→ 7 guardian portal reads ─→ 8 visibility ─→ M3
5 Teacher assignments ─→ 6 bulk attendance + per-subject marks ─→ 7 teacher reads ─→ M2
9 READ_DB seam (anytime; replica itself after hosting decision)
```

Also required with the ADRs: backend `docs/project/roadmap.md` (mobile track),
`docs/security/authentication.md`, `docs/api/ENDPOINTS.md` updates — protected files, user approval.
