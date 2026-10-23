---
description: Backend (main repo) changes the mobile app depends on, each with the problem, recommended option, affected code and the ADR it needs.
purpose: Single list of mobile-driven backend work so the backend repo can approve and implement it before the mobile app relies on it.
access: Read
---

# Backend Prerequisites for the Mobile App

## Status

**Proposed**, except the attendance parts of B5 and B6, which were built by the backend's Attendance
upgrade (ADR-0061, ADR-0062, 2026-10-15). Every other item below is a recommendation awaiting an ADR
and explicit user approval in the backend repo (`zn-school-platform-v1`, governed by its `CLAUDE.md`
§3–4). ADR numbers are candidates: the backend's last accepted ADR is **ADR-0063**, so the first new
one is ADR-0064 (assigned at proposal time).

**Reconciled 2026-10-22** with the backend repo's `docs/api/ENDPOINTS.md` and its project status (read-only), and with live
checks over HTTP against a test API (`docs/project/MARKS_PLAN.md` §3.3, `TEACHER_APP_PLAN.md` E9/E10,
`docs/project/GUARDIAN_V1_PLAN.md` §2.1). B1 to B8 and B10 are **built** in the backend; B9 is not. The rows of the table below
carry the current state; sections 1 to 10 keep their original wording as the record of the request. New requests found
since: B12 (built), B13 to B15 (open), sections 13 to 16. ADR numbers in the text above predate the backend's ADR-0064 to
ADR-0073.

All paths are relative to `apps/api/src/` in the backend repo unless stated. Section _N_ below is
referred to as **B*N*** in the roadmap and status docs. Work is grouped into packages **WP-1…WP-7**
(`docs/project/roadmap.md` §2); copy-paste prompts are in `docs/project/PHASE_PROMPTS.md`.

| Item                                       | WP                          | State (2026-10-18)                                                      |
| ------------------------------------------ | --------------------------- | ----------------------------------------------------------------------- |
| B1 mobile sessions                         | WP-1                        | Built (backend ADR-0066, Phase 2)                                       |
| B2 phone login                             | WP-1                        | Built (backend ADR-0066, Phase 2)                                       |
| B3 activation code + QR                    | WP-1                        | Built (backend ADR-0067, Phase 3): `POST /identity/activate`, issued by the school; the web page shows and prints the code with its QR (payload `znschool://activate?code=<code>`; a reset code has no QR). The guardian still types the phone or email with the code. A web page to redeem a code is built (`/activate` in the backend repo's web app, task 7.9; it is not the app's activate screen) |
| B4 guardian audience + `guardians.user_id` | WP-4                        | Built (backend ADR-0067, Phase 3): audience guard on every staff route, `audience` on `my-schools`; portal reads (B7) still open |
| B5 teacher assignments and scoping         | WP-2                        | Built: attendance (ADR-0062) and marks scoping (`exam_result.save_any`, subject teacher; ADR-0068, migration 0229). Reproduced 2026-10-22: a teacher is refused another section and an unassigned subject |
| B6 teacher writes                          | WP-2                        | Built: bulk attendance (ADR-0061); per-subject marks entry with `version` and `idempotencyKey`, submissions (migration 0230), `GET /portal/teacher/exams` (ADR-0068). Reproduced 2026-10-22 |
| B7 portal reads                            | WP-3 teacher, WP-5 guardian | Built (backend Phase 5, ADR-0067 D8, ADR-0068 D6 to D8): `/portal/teacher/*`, `/portal/guardian/*`. Reproduced 2026-10-22, except guardian results and fees with data. Not built: guardian PDFs, `home` routes (B15) |
| B8 guardian result visibility              | WP-5                        | Built: released results only (`/portal/guardian/students/:id/results`); not exercised with data |
| B9 `READ_DB` seam                          | WP-6                        | Not built                                                               |
| B10 notices, push, SMS/email               | WP-7                        | Notices, inbox, devices and Expo push built on the backend (ADR-0069, Phase 6; migration 0231 on the test and development databases); SMS/email not built |
| B11 teacher onboarding                     | —                           | Requested 2026-10-21 (Proposed, no ADR). Section 12. Found by the teacher-access audit in `docs/project/TEACHER_APP_PLAN.md`. The role part is solved by B12; what remains is one atomic flow. What it needs to start: `docs/project/DEFERRED_WORK_REQUIREMENTS.md` §3 |
| B12 default Teacher role                   | —                           | **Built 2026-10-22** as the platform role `default_teacher` (backend migration 0236). Section 13 |
| B13 row-level security on roles            | —                           | Requested 2026-10-22 (Proposed, needs a new ADR amending ADR-0033 D8). Section 14. What it needs: `DEFERRED_WORK_REQUIREMENTS.md` §2 |
| B14 marks portal asks A, B, C              | —                           | Requested 2026-10-22 (Proposed). Section 15; ask B is a Reproduced exposure |
| B15 guardian portal gaps                   | —                           | Requested 2026-10-22 (Proposed, none blocks Guardian V1 steps G0 to G3). Section 16 |

---

# 0. Current backend facts (verified 2026-10-14, re-verified 2026-10-16)

| Area                    | Today                                                                                                                                                                                                                                                                                                                                                         |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Tokens                  | JWT access 15 min, refresh 30 days absolute, rotated, sha256-hashed in `refresh_tokens` (`identity/identity.service.ts`). Returned in the JSON body — mobile-compatible.                                                                                                                                                                                      |
| Inactivity              | Checked at refresh against `refresh_tokens.last_activity_at`; limit = strictest `tenant_settings.session_timeout_minutes` across the user's memberships (5–480, default 30) — ADR-0022.                                                                                                                                                                       |
| Mobile timeout          | `tenant_settings.mobile_session_timeout_minutes` exists (`database/schema/settings.ts`, DTO `tenancy/dto/update-tenant-configuration.dto.ts` `@Max(480)`), **read by no auth code**.                                                                                                                                                                          |
| Login                   | `POST /identity/login {email,password}` only. No throttling. No refresh-token reuse detection.                                                                                                                                                                                                                                                                |
| Tenant                  | `?tenantId=` on every call; `tenancy/tenant-context.guard.ts`; `GET /tenancy/my-schools`, `GET /tenancy/my-permissions`.                                                                                                                                                                                                                                      |
| Invite                  | `POST /tenancy/memberships/invite` → UUID token (hashed, 7 days); `POST /tenancy/memberships/activate {token,password?}` (public). No email/SMS sent.                                                                                                                                                                                                         |
| Reads                   | `@RequireTenantMembership()` — **any active member can read all students and results**; attendance reads need `attendance.read` since 2026-10-15 (ADR-0061). Finance reads need `finance.read` (school-wide).                                                                                                                                                 |
| Teacher                 | Since 2026-10-15 (ADR-0062): `staff_members` and `teacher_assignments`, keyed by `staff_member_id`, with `GET /teacher-assignments?date=`. The assigned-class restriction on **attendance** is enforced since 2026-10-15 (`attendance.mark_any`, ADR-0062 D4); on marks (`exam_result.save_any`) it is not.                                                   |
| Attendance              | Since 2026-10-15 (ADR-0061): `POST /attendance/records` (one student, optional `version`), `POST /attendance/records/bulk` (one class and date, all-or-nothing, idempotency key, per-row `version`), `GET /attendance/roster`, `GET /attendance/records`. Marking needs `attendance.mark` (still school-wide), reading `attendance.read`.                     |
| Marks                   | `POST /academic/exam-results/entry` and `/bulk-entry` require **every required subject's components per student** (ACADEMIC_ARCHITECTURE §4.2). Permission `exam_result.save`.                                                                                                                                                                                |
| Guardian                | `guardians` has no `user_id` (`database/schema/student.ts`); no portal; no self-scoped endpoints.                                                                                                                                                                                                                                                             |
| Database                | One `pg` Pool (`database/database.module.ts`, `APP_DATABASE_URL`); no read replica.                                                                                                                                                                                                                                                                           |
| Mobile UI toggle        | `tenant_mobile_module_visibility` + `GET/PATCH /settings/tenant/mobile-modules` (display only).                                                                                                                                                                                                                                                               |
| Teacher identity        | A teacher is a `staff_members` row linked to a membership (`membership_id`, optional, unique). `GET /teacher-assignments` needs `staff.read` (tenant admin only by default), so a teacher cannot list their own assignments today — hence the self-scoped portal endpoint in item 7. `GET /attendance/my-classes` already answers "which classes may I mark". |
| Teacher self attendance | `POST /attendance/staff/self` (no body), `GET /attendance/staff/self?month=` with `attendance.self` (copied to every role holding `attendance.mark`). Built; reused by the app as is (decided 2026-10-16).                                                                                                                                                    |
| Not mobile v1           | Attendance reports (`/attendance/reports/*`) and exam attendance (`/academic/exams/:examId/attendance`, `exam_attendance.mark`; limited to the caller's assigned classes unless `exam_attendance.mark_any`, since 2026-10-23) exist on web.                                                                                                                                                                                              |
| Guardian money          | Consolidated invoice groups per billing run (ADR-0026), guardian payer context (ADR-0027), **guardian-owned advance pool** reported separately from student advance (ADR-0059 D5), `payments.purpose` invoice/advance (ADR-0060). `GET /guardians` is membership-only; `/finance/guardians/*` needs `finance.read`.                                           |

---

# 1. Mobile session policy — ADR candidate "Mobile client sessions"

**Problem.** A 30-minute inactivity limit forces repeated logins on phones (D7).

**Recommended.**

1. `POST /identity/login` accepts optional `clientType: 'web' | 'mobile'` (default `web`).
   Store it on `refresh_tokens.client_type`; rotation copies it.
2. At refresh, mobile tokens use `mobile_session_timeout_minutes` (strictest across memberships,
   same rule as ADR-0022), default **10080 (7 days)**, also when the school has no settings row. Raise the DTO max
   from 480 to **10080 (7 days)**; the column is `smallint`, so it fits. There is **no absolute cap** on a session
   (backend ADR-0066, Accepted 2026-10-18).
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
   stored as an HMAC with a server secret, **24-hour** expiry for the guardian code (the staff invite stays 7 days),
   single use. Failed attempts are counted **per account** (5 within 15 minutes, then 429), because a wrong guess
   matches no code (backend ADR-0067).
2. Public `POST /identity/activate` takes `{ code, identifier, password }`, where `identifier` is the phone or email the
   school has on record (backend ADR-0067 D6). `POST /tenancy/memberships/activate {token,password?}` keeps working for
   staff invites.
3. The web admin screen prints an **activation slip**: school name, person name, code, and a QR
   containing `znschool://activate?code=XXXXXXXX` (no tenant id, no personal data in the QR).
4. Delivery stays manual (printed slip / read aloud). Email and SMS wait for a provider decision (backend ADR-0069);
   the school admin hands the code over until then.
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
   _every_ audience must opt out explicitly (e.g. a `@RequireTenantMembership({ anyAudience: true })`
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

> **Amended 2026-10-15 (ADR-0062, built):** assignments are keyed by a staff member (`staff_member_id` →
> `staff_members`, which has an optional `membership_id`), not by `membership_id`; there is no `active` column — an
> assignment is ended with `effective_to` and never deleted. Items 2–4 below (enforcement, `*_any` grants) are
> partly built: attendance enforcement and `attendance.mark_any` (2026-10-15, plan Phase 3); `exam_result.save_any` and subject-teacher scoping of marks are decided (backend ADR-0068, Accepted 2026-10-18) and not built.
>
> **Still to do (WP-2/WP-3):** (a) marks scoping — `exam_result.save_any` plus a `subject_teacher` check,
> reusing the attendance pattern in `attendance/attendance.service.ts` and `authorization/permission-registry.ts`;
> (b) a self-scoped teacher assignments read, because `GET /teacher-assignments` needs `staff.read`;
> (c) the ADR confirms the teacher-shell rule used by the app: a membership linked to an active staff member
> (or holding the teacher permissions) gets the teacher shell. Reuse `attendance/my-classes` and the
> existing roster service rather than writing new ones.

1. Table `teacher_assignments` (as first proposed; superseded by the note above):

   ```text
   id, tenant_id, academic_year_id, membership_id,
   kind              'class_teacher' | 'subject_teacher'
   class_id          not null
   section_id        nullable (class without sections — ADR-0054)
   subject_offering_id  required when kind = subject_teacher, null otherwise
   active BOOLEAN NOT NULL DEFAULT TRUE      (rules/database.md §5a)
   ```

   References `membership_id` (no staff table needed; Staff/HR stays a separate future domain) — superseded: see the note above.

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

1. **Bulk section attendance** — **Built (ADR-0061, 2026-10-15).** `POST /attendance/records/bulk`
   `{ idempotencyKey, attendanceDate, classId, sectionId?, reason?, records: [{ studentId, status,
remarks?, version? }] }` (1–200 rows, `tenantId` in the query): one transaction, all-or-nothing,
   same key + body replays the stored result, a refusal is a **2xx** `{ ok:false, failures }`,
   per-row `version`, one audit row per changed row, enrollment and assigned-class checks. Contract:
   backend `docs/api/ENDPOINTS.md` §7. The first draft of the shape (`{ date, … }`, no key) is superseded.
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

| Endpoint                                                         | Returns                                                                                                            |
| ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `GET /portal/guardian/home`                                      | children summary: name, class/section, today's attendance, net outstanding, latest published result — **one call** |
| `GET /portal/guardian/students`                                  | linked students                                                                                                    |
| `GET /portal/guardian/students/:studentId/profile`               | profile subset safe for guardians                                                                                  |
| `GET /portal/guardian/students/:studentId/attendance?from&to`    | attendance records                                                                                                 |
| `GET /portal/guardian/students/:studentId/financial-position`    | same shape as `finance/students/:id/financial-position`, no `finance.read`                                         |
| `GET /portal/guardian/students/:studentId/invoices` / `payments` | paginated                                                                                                          |
| `GET /portal/guardian/invoices/:id/pdf`, `payments/:id/receipt`  | reprint PDFs (only if linked)                                                                                      |
| `GET /portal/guardian/students/:studentId/results`               | results with `result_status in (published, locked)` only                                                           |
| `GET /portal/guardian/results/:id/marksheet`                     | marksheet reprint (published = watermarked draft, locked = official — ADR-0037 D7)                                 |
| `GET /portal/guardian/exam-sessions/:id/routine`                 | routine reprint                                                                                                    |

Teacher (staff audience; filtered to assignments):

| Endpoint                                        | Returns                                                                                       |
| ----------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `GET /portal/teacher/home`                      | today's assignments, attendance done/pending per section, exams open for entry — **one call** |
| `GET /portal/teacher/assignments`               | assignments for the active academic year                                                      |
| `GET /portal/teacher/sections/:id/roster?date=` | enrolled students + that day's attendance status                                              |

Implementation reuses existing services (StudentFinancialPositionService, DocumentEngine reprint,
attendance/exam-result queries) behind a scope check — no duplicate business logic.

**Added 2026-10-16 — decisions the ADR must make because of the web's guardian billing model:**

1. _Invoices:_ a consolidated invoice group (ADR-0026) spans siblings; the portal lists invoices per
   student but carries the group id so the app can group them. Posted documents only — no drafts;
   the ADR decides how voided or cancelled documents appear.
2. _Advance:_ ADR-0059 D5 reports the student advance and the guardian-owned pool separately and never
   merges them. The guardian financial endpoint returns both; the app shows both, adds nothing.
3. _Payments:_ rows carry `purpose` (`invoice` | `advance`); an advance payment has no invoice.
4. _Reprints:_ guardian downloads use the same numbered-copy rules as staff (ADR-0044);
   `DOCUMENT_NOT_ISSUED` when none has been issued.
5. _Teacher part:_ `/portal/teacher/home` also returns the caller's own attendance status for today
   (the `attendance.self` card), and the roster response carries `dayInfo` (holiday / weekly off).
6. _Seats:_ guardian-only memberships and licence seats (A10) — recommended: do not use staff seats.

---

# 8. Guardian result visibility

Guardians see only `exam_results.status in ('published','locked')`. No new flag: the existing
publish/lock lifecycle already means "released". An additional per-exam "hide from guardians"
switch is **optional** and decided in the item-7 ADR.

---

# 9. Read-replica routing — ADR candidate "Read replica for portal reads"

> **Decided 2026-10-18 (backend ADR-0065 D7, Accepted):** the backend builds **no routing code and no second pool** until a real
> replica exists. Phase 8 writes a read-classification (which portal reads are replica-eligible; authorization, session and
> read-after-write reads always stay on the primary). The `READ_DB` seam below is therefore **not built**; treat it as the
> design to follow once a replica exists. No mobile feature may depend on a replica.

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

| Item                                                          | Depends on                                                      |
| ------------------------------------------------------------- | --------------------------------------------------------------- |
| Notices/announcements module                                  | backend Communication module (ADR-0069; built, Phase 6; migration 0231 on the test and development databases) |
| Push tokens (`user_devices`) + Expo push sending (via outbox) | backend Communication module (ADR-0069); Expo push behind a `PushSender` port; built (Phase 6; migration 0231 on the test and development databases) |
| SMS/email delivery of activation codes                        | an email/SMS provider decision (ADR-0069 D5); the admin hands codes over until then |
| Class timetable                                               | Academic ADR (ADR-0037 made per-class routine a non-goal)       |
| Per-student ledger statement                                  | Finance; `finance/student-ledger` has only reconciliation today |
| Attendance in student profile                                 | `student-profile.service.ts` note                               |

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

Work-package view (`roadmap.md` §2): WP-1 = 1+2+3, WP-2 = 5 remainder + 6 remainder, WP-3 = 7 teacher,
WP-4 = 4, WP-5 = 7 guardian + 8, WP-6 = 9, WP-7 = 10.

Also required with the ADRs: backend `docs/project/roadmap.md` (mobile track — it has none today),
`docs/security/authentication.md`, `docs/api/ENDPOINTS.md` updates, the RLS registry and
`DATA_OWNERSHIP.md` for any new table — protected files, user approval. Not done by this kit.

---

# 12. Teacher onboarding — request B11 (2026-10-21)

Section 11 is the order table, so B11 is section 12.

**Problem.** In the web app a "teacher" is created in two unlinked places (backend ADR-0062): the Staff page
creates a `staff_members` row only (no user, membership or role), and the Team page creates the user, the
membership and its roles (invite or direct create); an account is then linked to the staff row by hand, and only
an active, non-guardian membership can be linked. Nothing makes a new teacher able to sign in to the mobile
teacher shell, no `teacher` role is seeded by code, and a school created by `POST /platform/tenants` has **no
license** until one is issued, which blocks every non-platform-admin (`LICENSE_NOT_FOUND`, ADR-0035 L2/L8) with
the app's "School unavailable" screen. Platform admins bypass that check, so an admin tester does not see it.

**Request (design and ADR are the backend owner's).**

1. One flow that leaves a new teacher with a staff row, a login, an active or invited membership and a role that
   holds `attendance.mark` and/or `exam_result.save` (plus `attendance.self` for My Attendance), created or linked
   atomically with one audit trail; or a role template a school can apply in one step.
2. A school must hold an active license before users can be invited or activated, or the invite screen must say
   that the license is missing.
3. Optional: tell the person creating a teacher whether the account is activated and which mobile modules their
   role reaches.

**Mobile impact.** None to the contract: the app reads `GET /tenancy/my-schools` (`license.status`) and
`GET /tenancy/my-permissions` as today. The blocked screen names the license reason once the teacher shell work
is built (`docs/project/TEACHER_APP_PLAN.md` Phase 1).

**Status.** Proposed. Not implemented. **Update 2026-10-22:** the role part of this request (item 1, "a role that holds the
teacher permissions") is built as B12 (section 13). What remains is the single atomic flow (staff row, login, membership,
role and link in one transaction with one audit trail) and the licence rule. Why it is not a thin wrapper, the decisions
B11-1 to B11-6 and the work order are in `docs/project/DEFERRED_WORK_REQUIREMENTS.md` §3. It needs an ADR in the backend
repo and the owner's answers; nothing is started.

---

# 13. Default Teacher role — request B12 (2026-10-22), built

**Problem.** The platform seeded only `tenant_admin` and `guardian`. A school had to build a teacher role by hand, and a
new teacher with no usable role (neither `attendance.mark` nor `exam_result.save`) landed on the app's "Use the web app"
screen (`docs/project/TEACHER_APP_PLAN.md` §3.4 H4). The owner named this as the cause of the original "new teacher cannot
use the app" report.

**Built (backend migration `0236_default_teacher_role`, applied by the owner's go-ahead on 2026-10-22 as an exception to the
no-web-code rule).** One platform-wide staff role, key **`default_teacher`** (not `teacher`: a platform key is reserved for
every school, and the development database already holds a school-made `teacher` role), with exactly `attendance.mark`,
`attendance.read`, `attendance.self`, `exam_result.save` and `exam_result.read`. Not granted: `attendance.mark_any`,
`exam_result.save_any`, `exam_result.publish`, `exam_result.lock`, `attendance.staff_manage`, `attendance.configure`,
`event.manage`, `calendar.read`, any finance key. What a teacher may touch is still decided by teacher assignments.

**Evidence.** A fresh database migrated from zero reaches 0236 with five grants; the migration is idempotent and aborts if a
permission key is missing; a fresh account holding only this role passed 17 API checks (the five keys, roster, own
attendance, marks entry for the assigned subject; refused for another section, an unassigned subject, publish, return,
staff attendance, member management and notices). Applied to the shared test database, the mobile test database and, on
2026-10-22, the development database (only up to 0236; two later migrations of another session stayed pending).

**Update 2026-10-23 (backend migration `0239_exam_attendance_scope_and_teacher_access`, owner's instruction).** `default_teacher` now
also holds `calendar.read` and `exam_attendance.mark` (and `leave.apply`, copied by `0238` to every role holding `attendance.self`).
Exam attendance is limited to the classes and sections the caller is assigned to (either assignment kind) unless the role holds the new
key `exam_attendance.mark_any`, which was copied once to every role that held `exam_attendance.mark`. Applied to the shared web test
database only: the private mobile test database `zn_school_mobile_test` is still at 0236 (five keys) and the development database was
not touched. The app uses none of the three new keys. The web app now hides pages by the same `GET /tenancy/my-permissions` keys
(ADR-0074, web repo); this app already did so through `requiredPermission` in the feature registry.

**Mobile impact.** None to the contract. `docs/project/ROLES_ACCESS_CHECK.md` holds the full check.

---

# 14. Row-level security on roles — request B13 (2026-10-22)

**Problem.** `roles`, `role_permissions`, `permissions` and `membership_roles` have no row-level security (Reproduced: in
school B's tenant context the application role could read school A's custom role). Isolation of custom roles rests on one
application filter (`tenant_id IS NULL OR tenant_id = :tenantId`), the accepted decision of backend ADR-0033 D8, and the RLS
registry has no entry for three of the tables. The owner asked for roles to reach the mobile app "with RLS enabled".

**Request.** A new ADR amending ADR-0033 D8: row-level security on `roles` (platform roles readable by all and immutable by
the application role; custom roles visible and writable only in their own school), on `role_permissions` through its role, an
explicit "global reference data" entry for `permissions`, and the registry and data-ownership documents brought in line. The
cost is mostly in tests (24 of 102 e2e specs seed global roles through the application connection, so the shared `seedRole`
helper must use the owner connection) and two reads outside a tenant context (`backup.service`, `findRolesByKeys`). The full
analysis, design and work order are in `docs/project/DEFERRED_WORK_REQUIREMENTS.md` §2.

**Mobile impact.** None: the app reads permission keys from `GET /tenancy/my-permissions`, never these tables.

**Status.** Proposed. Needs the ADR (drafted for the owner on request) and its acceptance; nothing is started.

---

# 15. Marks portal asks A, B and C — request B14 (2026-10-22)

From `docs/project/MARKS_PLAN.md` §9. None blocks the built marks screens.

| | Ask | Why |
| --- | --- | --- |
| A | `isOptional` and `includeInResults` on each subject of `GET /portal/teacher/exams` | the app cannot know when a blank subject is legal |
| B | Scope `GET /academic/students?examId=` and `GET /academic/exam-results?examId=` by assignment for a caller without `exam_result.save_any` (the analogue of the attendance roster fix, S-1) | **Reproduced 2026-10-22:** an account with no staff link read the exam's roster (including guardian names) and every subject's marks |
| C | A stable `errorCode` on each bulk failure and on the 400 responses of the marks gate | lets the app map causes without reading English sentences |

**Status.** Proposed. B is the one with a security effect; the owner raises these in the backend repo.

---

# 16. Guardian portal gaps — request B15 (2026-10-22)

From `docs/project/GUARDIAN_V1_PLAN.md` §2.2 and §9. None blocks Guardian V1 steps G0 to G3.

1. Guardian PDF routes: invoice, receipt, marksheet.
2. The guardian's own advance pool (ADR-0059) in the guardian fees route.
3. A currency field for the school (`GET /settings/tenant` returns `timezone`, `calendarPreference`, `numberFormat`, `locale` only).
4. School-defined attendance status labels readable by a guardian (today they need the staff permission `attendance.read`).
5. Optional: an aggregated `GET /portal/guardian/home`; a student photo.

**Status.** Proposed; each needs its own backend decision.

---

# 17. Calendar, notices and exam attendance on the phone — request B16 (2026-10-23), built

**Status: built and applied** in the web/API repository on the owner's brief of 2026-10-23 (the owner asked for both repositories to be worked
together this once; the usual rule that this repository never changes the backend is unchanged). Backend facts: that repository's
`docs/api/ENDPOINTS.md` §7d, §7e, §7g and `docs/project/project-status.md` (last section).

| Item | What the app needs | State |
| --- | --- | --- |
| B16a | The platform role `default_teacher` holds `calendar.read` and `exam_attendance.mark` (it now holds eight keys: `attendance.mark`, `attendance.read`, `attendance.self`, `calendar.read`, `exam_attendance.mark`, `exam_result.read`, `exam_result.save`, `leave.apply`; none of the "any" keys) | **Built**: migration `0239`, applied to the backend test database, the phone-test database and, on 2026-10-23, the development database (three role-permission rows added, none removed) |
| B16b | Exam attendance limited to the caller's assigned classes (either kind of assignment), lifted only by `exam_attendance.mark_any`, which was copied once to every role that held `exam_attendance.mark` | **Built**; a proposed ADR (not accepted) is in the backend repository, `docs/project/implementation-plan/adr-0075-exam-attendance-scoping-PROPOSED.md` |
| B16c | `GET /portal/teacher/exam-attendance`: which published exams and papers the caller may record, with `recordable` and `taught` flags and the sections the roster can be narrowed to (the existing exam list was built for marks and uses another rule: out of draft, results pending, `allow_modify`) | **Built** (smallest compatible change: a read through the owning service, no table) |
| B16d | An optional `sectionId` on the exam attendance roster, narrowing only | **Built** |
| B16e | (web only) `GET /tenancy/memberships/:id/effective-permissions` for administrators | **Built**; the app does not call it |

**New request B17 — scope two web-open reads to the teacher's classes (proposed, needs the owner; not built).** Two reads the default teacher
holds a key for ignore who is asking, so a teacher who calls them directly sees every class: `GET /academic/exam-results?examId=` (`exam_result.read`
or `exam_result.save`; the marks screen calls it for the exam it opened, so the app is not the cause) and the attendance reports
(`attendance.read`, which the roster needs). A third, wider gap is known and was deferred by the owner (ADR-0074 option C): the student and Finance
setup reads are membership-only. All three are reproduced in the backend repository's `apps/api/test/default-teacher-access.e2e-spec.ts` (`it.failing`
cases F-1 to F-4). The phone calls only the scoped portal routes for names and rosters, so the app's own screens are not affected; the marks
screen's results call is the one place it touches F-1.
