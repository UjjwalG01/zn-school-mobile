---
description: Check of how default and custom roles made in the web/API project reach the mobile app, how they are isolated between schools, and the draft request (B12) for a default Teacher role.
purpose: Record what was verified about roles and mobile access, name the gaps, and hold the request text for the web/API project until the owner approves adding it to BACKEND_PREREQUISITES.md.
access: Read
---

# Roles and Mobile Access — Check and Request B12

## Status

Written 2026-10-22 on the owner's instruction: *check that the roles created in the web app / main backend (default and
custom) reach the mobile app, with row-level security, and a default teacher role is needed in the web app.* The owner
also named the role as the reason a new teacher could not use the app at first (`TEACHER_APP_PLAN.md` §3.4 H4, D11).

**Update 2026-10-22 (later): B12 is implemented.** The owner accepted the recommendations in this document ("accept the
recommendation and start implementation", the first exception to rule D1) and the default Teacher role was added in the
web/API project: migration `0236_default_teacher_role` seeds the platform role **`default_teacher`** (not `teacher`; §4
item 5 turned out to be real: the development database already has a school-made `teacher` role, in a Playwright test
school). It holds the five permissions of §5 (no `calendar.read`, as accepted). **State:** written and verified on a
freshly migrated database (237 migrations, 5 grants; a second run changes nothing; a missing permission key aborts),
applied to the shared test database and to the private mobile test database, and exercised through the API by a fresh
account holding only that role (17 requests: the five keys, roster, own attendance, marks entry for the assigned
subject, and refusals for another section, an unassigned subject, publish, return, staff attendance, member management
and notices). **Applied to the development database on 2026-10-22 at the owner's request, only up to 0236**: the migration journal
also held two unfinished migrations of another session (`0237_leave_tables`, `0238_leave_permissions`), which a plain
`pnpm db:migrate` would have applied too, so drizzle was run against a private copy of the migrations whose journal ends at
0236. The dev ledger went from 230 to 231 rows and `default_teacher` holds exactly its five permissions there; the other
two stay pending for their owner (they will apply normally later, their timestamps are newer). A data-only copy of the dev
`roles` and `role_permissions` was taken first. The role is data only, so the dev API needs no rebuild. Not committed. No ADR was written or
accepted; whether a seeded role counts as a permission-model change is the owner's call. The web/API record is in
`zn-school-platform-v1/docs/project/project-status.md` ("Default Teacher role") and `docs/api/ENDPOINTS.md` (`GET /tenancy/roles`).
Row-level security on roles (Q4) and onboarding in one flow (Q2, B11) are **not** started. Sections 4 and 5 below are kept as
written; read `teacher` in §5 as `default_teacher`.

**Update 2026-10-23: the same role control now reaches both clients.** (1) On the owner's instruction the web/API project added
`calendar.read` and `exam_attendance.mark` to `default_teacher` (migration `0239`), with exam attendance limited to the teacher's
assigned classes (new key `exam_attendance.mark_any` lifts the limit; it was copied once to every role that held
`exam_attendance.mark`). Applied to the shared web test database only; `zn_school_mobile_test` is still at 0236, so `phone.default@`
still holds five keys there until that database is migrated. (2) The web app now hides pages, sidebar entries and actions by the keys
of `GET /tenancy/my-permissions` (ADR-0074, web repo), the same keys this app reads. Nothing in either client reads a role name, so a role
made or changed in the web's Role Management / Assign Role reaches the app only as keys. The app's mechanism already existed and is
unchanged: `requiredPermission` per feature manifest (`src/features/visibility.ts`), `errorAction` 'forbidden' refetches
`my-permissions`, and stale queries refetch on foreground (permissions are stale after 15 minutes). A key taken away therefore reaches a
phone at the next foreground after that, or at its first refused request; the backend refuses it at once either way.

**Before this update:** nothing in the web/API project had been changed (rule D1); the request in §5 was a draft and
`BACKEND_PREREQUISITES.md` (protected) is still not edited. Evidence level is stated per line: **Static** (read from
code or documents) or **Reproduced** (executed, E10 in `TEACHER_APP_PLAN.md`).

---

# 1. How the app uses roles (Static)

- The app never reads a role or a role name. It reads `GET /tenancy/my-permissions` → `{ all, keys }`, the union of the
  permission keys of every role the membership holds, **default and custom alike**. A role is invisible to the app except
  through those keys.
- Teacher shell: `all` or `attendance.mark` or `exam_result.save` (`src/auth/resolveShell.ts`). Every other staff role gives
  "Use the web app". Per feature: `attendance.mark` (Attendance), `attendance.self` (My Attendance), `exam_result.save`
  (Marks entry), plus the school's license and the mobile-module switch (`src/features/teacher/access.ts`).
- The audience (staff or guardian) comes from `my-schools` (`audience`), not from a role name. The app has no role-name
  logic anywhere, in line with the platform rule against hard-coded role names.
- Permissions are cached for 15 minutes (the Session class). A plain 403 from a write invalidates them
  (`useSubmitMarks.ts`, `useSubmitAttendance.ts`), so a revoked role shows up at the latest on the next refused action.

# 2. What the platform has (Reproduced on a freshly migrated database)

| Fact | Result |
| --- | --- |
| Roles seeded by the migrations | `tenant_admin` (staff, 194 permissions) and `guardian` (guardian audience, 6). **No teacher role.** |
| Where a school's own roles live | `roles.tenant_id` set (custom, made in the web `Role Management`); `tenant_id` null = platform-wide |
| Row-level security | `memberships`, `staff_members`, `teacher_assignments` on and forced; **`roles`, `role_permissions`, `permissions`, `membership_roles` off** |
| Registry entry | `docs/security/rls/registry.yaml` lists `membership_roles` (deliberately outside RLS, ADR-0014) but has **no entry for `roles`, `role_permissions` or `permissions`** |
| Decision on record | ADR-0033 D8 (Accepted): *"No RLS is added to `roles`"*; isolation is the filter `tenant_id IS NULL OR tenant_id = :tenantId` in `TenantRoleService` and `TenancyService.listRoles` |

# 3. Live results (Reproduced, 2026-10-22, E10)

A test API on its own database `zn_school_mobile_test`; an administrator, teachers with a global role, a custom role and
no permissions, and a second school.

| # | Question | Result |
| --- | --- | --- |
| 1 | Does a **default (global) role** reach the app? | Yes. A global role holding `attendance.mark` and `exam_result.save` gave `{ all: false, keys: [both] }` |
| 2 | Does a **custom role** made through `POST /admin/roles` reach it? | Yes. `teacher_custom` with five permissions gave exactly those five keys; `my-classes`, `attendance/settings`, `attendance/staff/self`, `portal/teacher/exams` and `my-schools` all answered 200 |
| 3 | A role with no permissions | `{ all: false, keys: [] }`; `portal/teacher/exams` is 403. The app resolves **no shell → "Use the web app"** |
| 4 | Is a custom role of school A visible or usable in school B **through the API**? | No. `GET /admin/roles` for B is empty, `GET /tenancy/roles` for B lists only the global roles, an invite or an assignment in B with A's key is refused ("One or more roleKeys do not exist", "Role … does not exist"), and A's teacher gets 403 `TENANT_MEMBERSHIP_NOT_FOUND` for B |
| 5 | Is it isolated **by row-level security**? | **No.** As the application role in school B's tenant context, `select key from roles` returned school A's custom role (`teacher_custom[portal-teacher]`) next to the global ones. The contrast table `staff_members` returned 0 rows in the same context. The isolation is the application filter only, as ADR-0033 D8 decided |
| 6 | Can a custom role be a guardian role? | No. The create DTO has no audience (custom roles are staff) and role assignment refuses a guardian role |
| 7 | How fast does a revoke reach the user? | Server side at once: the same access token got 403 on the next call and `my-permissions` returned `keys: []`. The app shows it within 15 minutes, or on the next refused action |

# 4. Gaps (numbered; each is the owner's to decide)

1. **No default Teacher role** (the owner's point). A new teacher has no role, or a role a school built by hand with the
   right keys. Without `attendance.mark` or `exam_result.save` the app shows "Use the web app". → request **B12** (§5).
2. **A role is not enough.** Even with the right role, an account needs an active, non-guardian membership **linked to a
   staff record** and, for scoping, teacher assignments (ADR-0062, ADR-0068). With a role but no link the shell opens and
   the lists are empty or 403 ("Your account is not linked to a staff member"). → B11 (onboarding) decides how all four
   (staff, login, membership, role) are created together.
3. **A role can be incomplete in a way that half works.** A role with `attendance.mark` but not `attendance.read` opens the
   shell and then every roster call is refused; one without `attendance.self` hides My Attendance. This is why the
   default role must carry the full set.
4. **Roles have no row-level security** and are missing from the RLS registry. Application filtering is the only guard for
   custom roles (ADR-0033 D8). The owner asked for RLS on roles; that reverses an Accepted decision, so it needs a new
   backend ADR (question Q4 in `V1_DELIVERY_PLAN.md` §11.1). The mobile app is unaffected either way.
5. **A global key can collide with a school's own role.** `TenantRoleService.create` refuses a custom key equal to a
   platform key, but a school that **already** created `teacher` keeps it, and `getRoleByKey` then finds two rows for
   `teacher` and picks one with no ordering. Adding a global `teacher` must first look for existing custom roles with
   that key (or use a distinctive key), see §5.

# 5. Draft request B12 — default Teacher role (for `docs/backend/BACKEND_PREREQUISITES.md`, not yet added)

**Format follows that file. Status: Proposed. Needs: the owner's approval of the permission set; an ADR note or addendum
in the web/API project if it counts as a permission-model change.**

**Need.** A platform-wide default role a school can give a teacher so that the mobile app (and the web) work without the
school hand-building a role. Today only `tenant_admin` and `guardian` exist.

**Proposal.** One global role (`tenant_id` null, audience `staff`), key `teacher`, seeded by a migration so every existing
and new school sees it at once (no per-school copy). Permissions:

| Permission | Why the mobile app needs it (route) |
| --- | --- |
| `attendance.mark` | `POST /attendance/records/bulk`; `GET /attendance/my-classes`; the teacher portal routes (`attendance.mark` or `exam_result.save`) |
| `attendance.read` | `GET /attendance/roster`, `GET /attendance/settings`, `GET /attendance/records` |
| `attendance.self` | `GET`/`POST /attendance/staff/self` (My Attendance) |
| `exam_result.save` | `POST /academic/exam-results/bulk-entry`, `POST /academic/exams/:id/submissions/:subject/submit`, `GET /portal/teacher/exams` |
| `exam_result.read` | not needed by the app (`GET /academic/exam-results` accepts `save`); include only if the web Teacher should see results |
| `calendar.read` | later: the calendar screen (ADR-0073 D6 grants it to every staff role **at migration time**, so a role added later must be granted it explicitly; `default_teacher` has it since migration `0239`) |

**Not included on purpose:** `attendance.mark_any`, `exam_result.save_any` (all classes and subjects), `exam_result.publish`,
`exam_result.lock`, `attendance.staff_manage`, `attendance.configure`, `event.manage`, any finance key. The web side may
add keys the web Teacher needs (students, classes); this repo cannot say which.

**Notices need no key.** A teacher reads notices through `GET /portal/notices` and `GET /portal/notifications`
(membership only, shared with guardians); `communication.notice_manage` is for writing.

**Before building (collision, §4 item 5).** Check for existing custom roles keyed `teacher`:
`select tenant_id, key from roles where key = 'teacher' and tenant_id is not null;` (read-only, on the development database,
by the owner or the web session). If any exist, either use a distinctive key (for example `default_teacher`) or migrate the
school's role to the global one deliberately.

**Acceptance.** A fresh school: invite a user with `roleKeys: ['teacher']`, link a staff record and a teacher assignment, and
the mobile app reaches the teacher shell, the roster, My Attendance and Marks entry; the same account cannot reach another
class's roster (`attendance.mark_any` absent) or publish results. An e2e spec in the web project holds this.

**Related:** B11 (onboarding in one flow), question Q4 (row-level security on roles), `TEACHER_APP_PLAN.md` §3.4 H4.

# 6. Not verified

- Anything the app shows (the "Use the web app" screen was derived from `resolveShell` and the existing unit tests, not
  seen on a phone). The phone run includes an account for it: `TEACHER_APP_PLAN.md` §6.2.
- The development database: its roles, whether any school already has a `teacher` custom role, and its license state.
- Whether the web `Role Management` screen lists global roles for assignment in the same way (only the API was called).
- The `calendar.read` grant timing beyond what ADR-0073 D6 says.
