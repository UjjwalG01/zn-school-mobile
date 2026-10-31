---
description: Four-phase plan for the teacher app shell: fix new-teacher school access, five consistent tabs (Dashboard, Attendance, Academic, More, Profile), tab features, integration and device verification.
purpose: One place for the scope, decisions, acceptance criteria, SQL and evidence of the teacher-shell work, so each phase is marked complete only when its criteria have run.
access: Read
---

# Teacher App Shell — Four-Phase Plan

## Status

Written 2026-10-21 from the owner's four-phase prompt. **Phases 0 to 3 are built in this
repo and Phase 4's code checks ran (E5, rerun as E6 and E7: typecheck, lint, 421 tests, Android bundle export).
`ponytail-review` and `impeccable critique` ran on the UI diff (E6, findings in §11.6); on the owner's choice the top
fixes were built (E7), and at the owner's request the rest of the findings (E8, 424 tests). Still open: the "new
teachers can reach their school" criterion (pending the owner), the month stepper's lower bound, and the
physical-device run (§11.3, §11.5). Nothing has been seen on a device.** The table in §9
is the only place a phase is marked. Belongs to M2 (`docs/project/roadmap.md`
§4). Plan approved by the owner in chat on 2026-10-21.

**Update 2026-10-22.** (1) The owner reports that the cause of "a new teacher cannot use the app" is **the role**, not the
license (§3.4 H4, decision D11): a teacher whose role grants neither `attendance.mark` nor `exam_result.save` is sent to
"Use the web app", and the platform seeds no teacher role. A default Teacher role is requested for the web/API project
(`ROLES_ACCESS_CHECK.md`). (2) The owner will test on their own Android phone and will not use an emulator (D10); the
assistant started none. The test stack for that run is in §6.2; the API-side parts of §6.1 ran against it (E9, E10), and
the phone-only parts are still the owner's.

**Owner constraints for this work:**

- **No code in the web/API repo (`zn-school-platform-v1`).** It is read-only reference. Anything it needs is
  a backend request in `docs/backend/BACKEND_PREREQUISITES.md` (B11 below) and work stops at that boundary.
- No ADR or architectural decision is marked Accepted by this work (backend repo or here).
- Database checks run on `zn_school_test` only; the matching SQL for the dev database is handed to the owner.
- Another Claude session (`zn-school-mobile-a4`) left uncommitted edits in this repo. Edits here are small and
  anchored, nothing is reverted, **nothing is committed**.

---

# 1. Goal and completion criteria

Fix new-teacher school access and organise the teacher shell into five consistent tabs, reusing existing
screens and APIs. Done when (owner's list):

1. Newly created teachers can reach their assigned school with the right permissions.
2. All five tabs work consistently and respect role-based access.
3. Existing teacher features keep working.
4. School switching and sign-out handle session and cached data safely.
5. Tests pass, device verification is recorded, and documentation matches what was built.

Criteria 1 and 5 depend on things this repo cannot do alone (a web/API change or a license fix, and a
physical device); they are reported as pending, never as passed, until evidence exists.

---

# 2. Decisions

| #   | Decision                                                                                                                                                                                                                        | By                    |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------- |
| D1  | No code changes in the web/API repo; it is read-only                                                                                                                                                                            | Owner, 2026-10-21     |
| D2  | Five tabs in this order: Dashboard, Attendance, Academic, More, Profile                                                                                                                                                         | Owner prompt          |
| D3  | Attendance subtabs (Student Attendance, My Attendance) are an in-screen `SegmentedControl`, not a navigation library                                                                                                            | Plan, smallest design |
| D4  | Tab icons: `@expo/vector-icons` (Ionicons), declared as one explicit dependency via `expo install`                                                                                                                              | Owner, 2026-10-21     |
| D5  | Academic tab is a hub of what exists (My classes, My subjects, Open exams read-only) plus non-clickable "Coming soon" rows for Marks entry and Exam routine; `teacher.marks` stays a separate later run                         | Owner, 2026-10-21     |
| D6  | `teacher.selfAttendance` (My Attendance) moves into v1, reversing the 2026-10-18 "after v1" note, because the owner's plan puts it in the Attendance tab                                                                        | Owner prompt          |
| D7  | Profile and More carry no module key (`mobileModuleKey: null`) so a school can never hide them and nobody loses Sign out / Switch school                                                                                        | Plan                  |
| D8  | A school switch clears the shell, so the guard unmounts the tab navigator and it is rebuilt for the new school, dropping nested screens (a roster) of the previous one. No per-school `key` (removed 2026-10-21: it changed nothing, §11.2)                                                                                              | Plan                  |
| D9  | Phase 1 database checks: `zn_school_test` read-only only; dev SQL given to the owner                                                                                                                                            | Owner, 2026-10-21     |
| D10 | The app is tested on the owner's own Android phone; **no emulator is used or started.** Everything that needs the app on a screen waits for that run; API-side checks run over HTTP against a test stack                       | Owner, 2026-10-22     |
| D11 | The owner reports the cause of the original "new teacher cannot access the app" as **the role** (H4). A default Teacher role is needed in the web/API project; it is requested, not built from this repo (D1)                    | Owner, 2026-10-22     |
| D12 | **Exception to D1:** on "accept the recommendation and start implementation" (2026-10-22) the default Teacher role was added in the web/API project (migration `0236`, role `default_teacher`); migration `0239` later added Calendar/Exam Attendance permissions. The mobile status records those applications as historical; current target-environment state remains to be confirmed. D1 otherwise stands | Owner, 2026-10-22     |

---

# 3. Phase 1 — Audit of new-teacher school access

## 3.1 What the message is

"The ZN School service is not available for this school right now" is `unavailable.license`, shown by
`app/(context)/school-unavailable.tsx` when the session is `blocked`. `blocked` is set only from API events
(`src/api/client.ts` → `SessionEvents.tsx`): a 403 `TENANT_ACCESS_DENIED` (`suspended`) or
`LICENSE_NOT_FOUND | LICENSE_SUSPENDED | LICENSE_EXPIRED | LICENSE_NOT_YET_VALID` (`license`). It is cleared by
`startSession`, `endSession`, `selectTenant` and `clearTenant`; the app never sets it on its own. **Static.**

## 3.2 Backend path (read from the backend repo, no edits)

- Every tenant route, including `GET /tenancy/my-permissions` (the app's first tenant call), runs
  `TenantAuthorizationService.assertTenantIsAccessible` for **non-platform-admins only**
  (`apps/api/src/tenancy/tenant-authorization.service.ts`, `assertIsActiveMember` returns early for
  `user.isPlatformAdmin`). It refuses a `suspended`/`archived` tenant and any license that is not effectively
  `active` (ADR-0035 L2, L8). **Static.**
- `POST /platform/tenants` creates a `trial` tenant with **no license**; `initialize` refuses until a license is
  issued (`tenancy.service.ts` `createTenant`, `initialize`). **Static.**
- `GET /tenancy/my-schools` lists schools whose tenant status is `trial` or `active` even when the license is
  invalid ("the user must still be able to open the switcher and leave it") and carries
  `license.status` = `none | suspended | expired | scheduled | active`. **Static.**
- Backend e2e `tenant-licenses.e2e-spec.ts` covers the license block (backend evidence, not rerun here).

## 3.3 How a "teacher" is created in the web (two unlinked records, ADR-0062)

1. **Staff** (`POST /staff`, permission `staff.manage`): creates a `staff_members` row only. It is **not a
   login**: no user, no membership, no role.
2. **Team** (`POST /tenancy/memberships/invite` or `/direct-create`, permission `identity.manage_members`):
   creates the user (if new), the membership (`invited` with an activation token, or `active` with an admin-typed
   password) and the `membership_roles` rows for the `roleKeys` sent.
3. **Link** (`PUT /staff/:id/membership` or `membershipId` on create): only an **active, non-guardian**
   membership can be linked.

Nothing provisions access when a staff row is created, and no `teacher` role is seeded by code (a school
builds one in `/admin/roles`). **Static.**

## 3.4 Ranked causes

| #   | Cause                                                                                                                                                         | What the app shows                          | Where the fix lives                                                       |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------- | ------------------------------------------------------------------------- |
| H1  | The school has no license, or it is expired, suspended or not yet valid. A platform admin bypasses the check, so an admin tester sees the app work; the first real non-admin teacher hits the 403 | "School unavailable" (**the reported message**) | Data: issue/renew the license in web Platform admin. Not code             |
| H2  | The teacher exists only on the Staff page (no login)                                                                                                          | cannot sign in                              | Web/API: onboarding request B11 (not coded here)                          |
| H3  | The membership is still `invited` (never activated); `my-schools` lists active memberships only                                                               | "No school access"                          | Web/API process; mobile activation is blocked on B3                       |
| H4  | Active membership, but the role has neither `attendance.mark` nor `exam_result.save`                                                                          | "Use the web app"                           | Role setup in web `/admin/roles`                                          |

Only H1 produces the "School unavailable" screen. H1 is **UNVERIFIED** until the SQL in §3.6 is run against the school that
shows it (dev is the owner's to run; the test database result says nothing about dev).

**Owner report, 2026-10-22: the cause was H4, the role (D11).** What the code and the live stack show about it:

- The teacher shell appears only when `GET /tenancy/my-permissions` returns `all: true` or `attendance.mark` or
  `exam_result.save` (`src/auth/resolveShell.ts`, unit-tested). Any other staff role gives an empty shell list and the
  screen "Use the web app: your role in this school is not available in the mobile app" (`web-only`, **Static**, plus the
  live answer `{ all: false, keys: [] }` for a role with no permissions, **Reproduced**, E10).
- The historical E10 reproduction found only `tenant_admin` (194 permissions) and `guardian` (6) on that database; it did not represent the later `default_teacher` migration. Staff created on the web Staff page still get no login and no role (§3.3), so B11's atomic onboarding flow remains a separate deferred backend item.
- A role made by hand does work: a custom role holding `attendance.mark`, `attendance.read`, `attendance.self`,
  `exam_result.save` and `exam_result.read` opened every teacher route (**Reproduced**, E10). A role that lacks
  `attendance.read` still gets the shell (it has `attendance.mark`) but its roster and settings calls are refused (403).
- Fix: a default Teacher role in the web/API project, with the exact permissions in `docs/project/ROLES_ACCESS_CHECK.md`
  (request B12). **Implemented 2026-10-22 as the platform role `default_teacher`** (migration `0236`; owner-authorised
  exception D12): verified on a fresh database and through the API, applied to the test databases and, on 2026-10-22 at the
  owner's request, to the development database (up to 0236 only). B11 (onboarding) still decides how a teacher gets the role, a login and a
  staff link together; it is not started (Q2).
- H1 remains a possible second cause for a school that has no valid license; the owner recorded the dev SQL (§3.6) as optional after naming the role as the original cause.

## 3.5 Phase 1 work in this repo

1. This section plus the acceptance table in §9.
2. Read-only SQL on `zn_school_test` (§3.6), result recorded in §10.
3. **Mobile hardening, no web change:** the blocked screen names the license reason from `my-schools`
   `license.status` (new `unavailable.reason.*` keys, en + ne) so an administrator can tell "no license" from
   "expired"; tests that (a) a blocked school can be left through the picker when the user has two schools,
   (b) `TENANT_MEMBERSHIP_NOT_FOUND` drops the school and removes its cached queries, (c) selecting another
   school clears `blocked`.
4. Backend request **B11 — Teacher onboarding** in `docs/backend/BACKEND_PREREQUISITES.md` (§3.7).

## 3.6 SQL (read-only; run as the superuser so RLS does not hide rows)

Replace `<email>` and `<school>`. No row is changed. Do not paste hashes or tokens into any document.

```sql
-- 1. License state per school (H1). 'effective' mirrors effectiveLicenseStatus (UTC date).
SELECT t.name, t.status AS tenant_status, l.status AS license_status, l.valid_from, l.valid_until,
       CASE WHEN l.id IS NULL THEN 'none'
            WHEN l.status = 'suspended' THEN 'suspended'
            WHEN l.valid_from > (now() AT TIME ZONE 'utc')::date THEN 'scheduled'
            WHEN l.valid_until IS NOT NULL AND l.valid_until < (now() AT TIME ZONE 'utc')::date THEN 'expired'
            ELSE 'active' END AS effective
FROM tenants t LEFT JOIN tenant_licenses l ON l.tenant_id = t.id
ORDER BY t.name;

-- 2. One person's membership, roles and whether any role can use the teacher shell (H3, H4).
SELECT u.email, t.name AS school, m.status AS membership_status,
       COALESCE(string_agg(DISTINCT r.key, ', '), '(no role)') AS roles,
       COALESCE(bool_or(p.key IN ('attendance.mark', 'exam_result.save')), false) AS teacher_permission
FROM users u
JOIN memberships m ON m.user_id = u.id
JOIN tenants t ON t.id = m.tenant_id
LEFT JOIN membership_roles mr ON mr.membership_id = m.id
LEFT JOIN roles r ON r.id = mr.role_id
LEFT JOIN role_permissions rp ON rp.role_id = r.id
LEFT JOIN permissions p ON p.id = rp.permission_id
WHERE u.email = '<email>'
GROUP BY u.email, t.name, m.status;

-- 3. Is the staff row linked to a login (H2)?
SELECT s.staff_code, s.full_name, s.employment_status, s.membership_id IS NOT NULL AS linked
FROM staff_members s JOIN tenants t ON t.id = s.tenant_id
WHERE t.name = '<school>' ORDER BY s.staff_code;
```

## 3.7 Backend request B11 — Teacher onboarding (to be written into BACKEND_PREREQUISITES.md)

- **Need:** creating a teacher in the web must leave a person who can sign in to the mobile teacher shell:
  staff row, user, active (or invited) membership and a role with `attendance.mark`/`exam_result.save` (and
  `attendance.self` for My Attendance), created or linked atomically with one audit trail.
- **Also:** a school must hold an active license before users are invited (otherwise every non-admin is blocked
  at first login).
- **Mobile contract needed:** nothing new for the app; it reads `my-schools`, `my-permissions`.
- **Status:** Proposed. Owner/web session decides the design and the ADR; this repo does not implement it.

---

# 4. Phase 2 — Five-tab navigation

Registry-driven (`src/features/registry.ts` stays the only list). Manifest changes
(`src/features/types.ts`): `mobileModuleKey: string | null` (null = no school switch) and optional `tab?: string`
(the tab feature that lists a `placement: 'menu'` feature). Visibility (`src/features/visibility.ts`): null key,
and `visibleTabs`: **a tab is shown when its own rule passes or any visible feature names it in `tab`.** (The
approved plan also listed an any-of `requiredPermission`; dropped while building, because the hosting rule already
gives a teacher with only `attendance.self` the Attendance tab, so the list form would be unused code.)

| Tab | Feature id | Rule | Hosts |
| --- | --- | --- | --- |
| Dashboard | `teacher.home` | module `my_dashboard` | — |
| Attendance | `teacher.attendance` (`stack`) | `attendance.mark`, license `academic`, module `attendance`; also shown through its child | `teacher.selfAttendance` (`attendance.self`) |
| Academic | `teacher.academic` (`stack`) | license `academic` | `teacher.assignments` |
| More | `teacher.more` | none | — |
| Profile | `teacher.profile` | none, no module key | — |

- Subtabs: `src/components/SegmentedControl.tsx` (≥ 44 pt, tokens only, `accessibilityRole="tab"` with
  `selected` state). With one visible subtab no control is drawn.
- `ClassListScreen` takes `header` and `skipSingle`; the one-class auto-redirect is off when My Attendance is
  visible (the redirect replaces the tab root and would strand the second subtab).
- `app/teacher/_layout.tsx`: Ionicons from `@expo/vector-icons`, no per-school `key` (D8); the "no features"
  dead end disappears because Profile is always visible.
- Routes: `app/teacher/{academic/,more.tsx,profile.tsx}`; `assignments` moves to
  `app/teacher/academic/assignments.tsx`; Home's "+N more" link follows.

---

# 5. Phase 3 — Tab features (existing APIs only)

- **Dashboard:** existing sections stay; add `StatTile`s (classes, subjects, open exams) from the cached
  `my-classes` and `exams`; `AccountActions` moves to Profile. The approved plan also had a shortcut row (Take
  attendance, My attendance, Academic); it was built and then **removed on 2026-10-21 on the owner's decision after the
  review** (§11.6): the tab bar already leads to each, and the row pushed today's classes below the fold. Visual
  redesign is later, with Impeccable.
- **Attendance:** Student Attendance = existing class list → roster. **My Attendance** (new
  `src/features/teacher/selfAttendance/`) uses `GET /attendance/staff/self?month=` and
  `POST /attendance/staff/self` (no body; the server decides who and when; permission `attendance.self`).
  Outcomes: `created | unchanged` (a second tap is a no-op), 404 not linked to a staff member, 409
  `ATTENDANCE_ALREADY_RECORDED` or inactive staff, 400 holiday / weekly off / present switched off, offline.
  Keys `[tenantId, 'teacher', 'self-attendance', month]`, Daily stale-time class, cache patched from the response.
- **Academic:** hub; My classes (existing `AssignmentsScreen`), My subjects, Open exams (read-only, existing
  `useTeacherExams`, `buildExamCards`); "Coming soon" rows for Marks entry and Exam routine (planned, not
  registered, not clickable).
- **More:** placeholder only.
- **Profile:** name, email/phone from `GET /identity/me`, current school (no license dates: they are the administrator's business, E8), Switch school
  (existing `/school-picker`, `chooseSchool`, `removeTenantQueries`), shell switcher when both shells exist,
  Sign out (existing `logout`: revoke, wipe tokens, context, persisted cache, pdf cache).

---

# 6. Phase 4 — Integration, tests, docs, device

- Tests: visibility (null key, tab rule); teacher layout (five tabs, role-aware hiding, Profile always
  present, remount on school change); `SegmentedControl`; self-attendance model and screen (created,
  unchanged double tap, 404 / 409 / 400, offline, duplicate submit); Profile (switch clears the old school's
  cache, sign-out wipes); Phase 1 cases; session expiry and offline retry (existing tests re-run).
- Gates: `pnpm verify`, then `pnpm exec expo export --platform android`. The owner's Metro (8081) and dev API
  (3001) are never touched.
- Docs: this file, `PHASE_PROMPTS.md`, `project-status.md`, `TEACHER_FEATURES.md`, `API_CONTRACT.md`,
  `UI_SYSTEM.md`; protected and approved in the plan: `roadmap.md`, `FEATURE_MODULES.md`, `ARCHITECTURE.md` §4,
  `BACKEND_PREREQUISITES.md` (B11).

## 6.1 Device checklist (owner; test stack only, never a production school)

Run with a non-admin teacher account that has `attendance.mark`, `attendance.self` and a staff link.

1. Sign in; the app lands on Dashboard; five tabs show icon + label; light and dark.
2. Cold start and warm start request counts on Dashboard (expect `my-classes` and `exams` only).
3. Attendance → Student Attendance → roster → save; airplane mode → save → reconnect → retry (`replayed`);
   double-tap Save.
4. Attendance → My Attendance → Mark present; second tap says nothing changed; a holiday or weekly off day
   shows the refusal message; an unlinked account shows the "ask your school" message.
5. Academic hub lists My classes, My subjects, Open exams; "Coming soon" rows do nothing.
6. Profile → Switch school (with two schools) → data of the first school is gone, tabs rebuild; Sign out →
   login screen, back button cannot reopen the app.
7. Idle until the session expires → next action returns to login with the expiry notice.
8. A school whose license is expired or missing → "School unavailable" with the reason, and Switch school /
   Sign out still work.
9. System font 1.3×, Nepali strings, low-end Android scroll on a long roster.

Added 2026-10-22: 10. Marks entry (`MARKS_PLAN.md`): open a subject, enter and save, leave with unsaved edits, submit,
read-only after submit, the stale-version conflict (§6.2), and an account without `exam_result.save` shows no Marks row.
11. An account whose role grants neither `attendance.mark` nor `exam_result.save` lands on "Use the web app" (the original
role problem, §3.4 H4); the screen now also says "or ask your school to give you the Teacher role" (Q10).
12. Student details (`STUDENT_INFO_PLAN.md`, built 2026-10-22): on the Attendance roster each student has an "i" button
beside the status badge; it opens name, admission number, status, class and roll, date of birth, gender, blood group and
the guardians (name, relationship, a Call link, no e-mail). Check a student of another section is refused ("You don't
have access to this student."), the call link opens the phone's dialer, and after closing and reopening the app the
details are fetched again (they are never saved on the phone).
13. `phone.default@example.com` behaves like `phone.teacher@example.com` (the default role, items 1 to 10).

## 6.2 Test stack for the owner's phone run (prepared 2026-10-22)

**The app is tested on the owner's own Android phone; no emulator is used (D10).** The owner's Android walkthrough on the test stack was **completed 2026-10-26**; all items in §6.1 were verified on the owner's physical device against the test backend.

| Piece | Value |
| --- | --- |
| API | Docker container `zn-mobile-test-api` (the owner's `zn-school-api` image, built 2026-10-21), `http://192.168.1.65:3411` on the LAN. Not the dev API (3001), which is untouched |
| Database | `zn_school_mobile_test`, its own database in the same Postgres container, migrated to 0235 (the same 236 migrations as the shared test database). **Why separate:** other sessions' e2e specs `TRUNCATE` the shared `zn_school_test`, which wiped the first fixture within minutes |
| Pointing the app at it | In this repo's `.env` (the owner's file, not edited by the assistant) set `EXPO_PUBLIC_API_URL=http://192.168.1.65:3411`, restart Metro with a cleared cache (Metro inlines `EXPO_PUBLIC_*` at bundle time), and put the old value back afterwards |
| School | `portal-teacher school` (licensed, test data). Its academic year was moved to 2026-04-14 … 2027-04-13 so today's attendance roster has students (the e2e fixture's year is in 2082 AD) |
| Exam | `Mobile Check mvj48665 - Grade 1 A`: Mathematics (Theory 80, Practical 20) taught by the phone teacher, Science (Theory 60, Practical 40) taught by another account; five students (rolls 1, 2, 3, 10 and one non-numeric, to see the numeric sort) |
| Stop and clean up | `docker rm -f zn-mobile-test-api`; data: `DROP DATABASE zn_school_mobile_test` (run through `docker exec zn-school-postgres psql -U zn_school -d postgres`) |

Accounts (password for every account: `TenantUserPass123`; test data only):

| Account | Role | What it should show on the phone |
| --- | --- | --- |
| `phone.teacher@example.com` | custom role `teacher_custom` (made through the web API, five permissions); class teacher of Grade 1 A and Mathematics teacher | everything: Dashboard, Attendance (students and My Attendance), Academic with Marks entry, Profile |
| `phone.default@example.com` | the platform role **`default_teacher`** only (migration 0236); class teacher of Grade 1 A and Mathematics teacher | the same as `phone.teacher`: proves the default role end to end |
| `phone.attendance@example.com` | custom role `attendance_only`; class teacher of Grade 1 A | Attendance and My Attendance; **no** Marks entry row |
| `pt-plain@example.com` | role with no permissions | "Use the web app" (the original problem, H4) |
| `pt-subject@example.com` | global role with only `attendance.mark` and `exam_result.save` (a deliberately incomplete role) | shell opens, Marks works; the student roster and My Attendance are refused or hidden (no `attendance.read`, no `attendance.self`) |
| `pt-unlinked@example.com` | same incomplete role, no staff link | shell opens; lists are empty or refused ("not linked to a staff member") |

**The stale-version conflict on one phone.** Open Marks entry → Mathematics, type new marks for Anil Rai and do **not**
save. Tell the assistant ("conflict Anil Rai"): it makes the Science teacher's account save Anil Rai, which moves his
result version. Then press Save on the phone: expect the conflict message, the highlighted student and the Keep mine /
Use theirs choice. The same trigger covers the two-account case without a second phone.

Other helpers the assistant runs on request: change the school's license (expired, suspended, none, restored; for item 8),
show what the server holds for the Mathematics marks, delete today's attendance for a clean re-run, and add a fresh exam
after the marks have been submitted. They are throwaway scripts in the assistant's session folder, not in either
repository; the HTTP steps they make are the ones recorded in E9 and in `MARKS_PLAN.md` E-M2.

---

# 7. Out of scope

Marks entry, exam routine, notices and push, offline writes, activation and phone login (B1–B3), the Dashboard
visual redesign, any guardian screen, any change in the web/API repo.

---

# 8. Open items

| Item | Owner |
| --- | --- |
| Add a default `teacher` role in the web/API project (request B12, `ROLES_ACCESS_CHECK.md`); the owner names the cause as the role (D11) | Owner / web session |
| Confirm H1 on the dev database with the §3.6 SQL; fix the license in web Platform admin if confirmed (optional while the role is the named cause) | Owner |
| B11 teacher onboarding: design, ADR and build in the web/API repo | Owner / web session |
| Run on the owner's own phone (§6.1, §6.2); no emulator (D10) | **COMPLETED 2026-10-26** |
| Nepali strings added here need native review (as for the rest of `ne.ts`) | Owner |

---

# 9. Acceptance and status

Status vocabulary as in `project-status.md`. A row changes only with evidence in §10.

| Phase | Criterion | Status |
| --- | --- | --- |
| 0 | Plan, decisions and docs written | Done 2026-10-21 |
| 1 | Cause audited and ranked from code | Done 2026-10-21 (Static, §3, E1) |
| 1 | Read-only SQL on `zn_school_test` recorded; dev SQL handed over | Done 2026-10-21 (E2). The test database holds only e2e fixtures, so it says nothing about the failing school; the dev SQL is §3.6 and is the owner's to run |
| 1 | Blocked screen names the license reason; blocked-school, unauthorized-school, switch tests green | Done 2026-10-21 (E3) |
| 1 | B11 written in `BACKEND_PREREQUISITES.md` | Done 2026-10-21 (section 12 there) |
| 1 | New teachers reach their school with correct permissions | **Role implementation recorded as built:** the backend platform role `default_teacher` was added in migration `0236` and extended with Calendar/Exam Attendance permissions in `0239` (see dated status evidence in `project-status.md`). Current target-environment state and an end-to-end new-teacher phone walkthrough remain unverified. H1 (license) remains optional per the owner's recorded decision |
| 2 | Five tabs from the registry, role-aware, Profile always visible, tabs rebuilt on school switch | Built and unit-tested 2026-10-21 (E5). Not run on a device |
| 3 | Dashboard, Attendance (two subtabs), Academic hub, More, Profile built on existing APIs | Built and unit-tested 2026-10-21 (E5). Not run against the test stack or on a device; the live shape of the self-attendance record is unconfirmed (§11.3) |
| 4 | `pnpm verify` green; Android bundle exports; docs updated | Done 2026-10-21 (E5; docs listed in §11.1) |
| 4 | Test school switching, permissions, session expiry, sign-out, offline retry, duplicate submissions, tenant isolation | Unit tests with a mocked API (E5). **API side Reproduced 2026-10-22 against the test stack (E9, E10):** attendance roster, save, replay, stale version, self attendance, license block codes, permissions of default and custom roles, custom-role isolation between schools. The app itself was not run: phone run pending (D10) |
| 4 | `impeccable` and `ponytail-review` run on the UI diff (mobile rule `mobile-frontend.md` §9) | Run 2026-10-21 (E6), in one context and from code only (no device). One defect fixed; the other findings are in §11.6 and **await the owner's choice**. `ui-ux-pro-max` was not run (not available here) |
| 4 | Review fixes the owner chose ("top fixes", shortcut row removed): Dashboard cut, flat "Coming soon" rows, chevron on tappable cards, filled active-tab icon, headers follow the dark scheme, "Classes" label | Built and unit-tested 2026-10-21 (E7). Not seen on a device |
| 4 | Rest of the review findings (round 2): compact month list, Sign out confirm, no license on Profile, stepper icons, no repeated titles, pinned subtab control, `key` removed, `StatTile` local | Built and unit-tested 2026-10-21 (E8). Not seen on a device; the month stepper's lower bound is not built (§11.6) |
| 4 | Physical-device run (§6.1, §6.2) | **Pending the owner's phone run** (no emulator, D10). A historical stack/account snapshot exists; confirm the current test-stack URL, account readiness and app configuration immediately before running. No phone-screen evidence is recorded. |

---

# 10. Evidence log

Each entry: command or query, exact outcome, what it does not cover.

**E1 (Static, Phase 1).** Read from the backend repo without edits: `tenant-authorization.service.ts`
(`assertIsActiveMember`, `assertTenantIsAccessible`), `tenant-license.service.ts` (`assertLicenseActive`),
`tenancy.service.ts` (`createTenant`, `initialize`, `inviteMember`, `createMemberDirect`, `listMySchools`),
`staff.service.ts`, `tenancy.controller.ts`. Does not cover: which of H1–H4 applies to the owner's school.

**E2 (Reproduced, test database, 2026-10-21).** Three read-only queries (the §3.6 shapes) through
`docker exec -i -e PGOPTIONS='-c default_transaction_read_only=on' zn-school-postgres psql -U zn_school -d zn_school_test`
(session confirmed `default_transaction_read_only = on`, database `zn_school_test`, superuser so RLS did not hide
rows). Result: two tenants, "RLS Tenant A" with an `active` license and "RLS Tenant B" with **no license row,
effective `none`**; memberships: 3 invited and 1 active in A, 1 active in B, none with a role; one staff row in A,
not linked. These are fixtures left by the last e2e run, not a school anyone uses. They show that the H1 state (an
`active` tenant with no license) exists in this schema; they do not show that the failing school is in it.
Nothing was written; no server was started; no migration or e2e was run.

**E3 (Reproduced, mobile unit tests, 2026-10-21).** `pnpm exec jest src/auth src/i18n`: 11 suites, 67 tests
passed (new: `schoolBlock.test.ts` 3 tests, `SessionEvents.test.tsx` 6 tests). `pnpm typecheck` and `pnpm lint`
clean. They assert: the license error code is kept as the block reason and mapped to the four reason messages; a
suspended school keeps its own message; selecting another school or clearing the school clears the block and its
reason; a lost membership drops only that school's cached queries and refetches `my-schools`; events are ignored
when signed out; `unauthorized` ends the session locally with the expiry notice. Does not cover: the screen
rendering on a device, real backend responses.

**E4 (Reproduced, at the pause, 2026-10-21).** `pnpm typecheck` clean; `pnpm lint` clean (0 problems);
`pnpm test` 44 suites, 377 tests passed. The first full run timed out one test (`AssignmentsScreen`, the cold-run
flake already noted in `project-status.md`); that suite and `src/components` rerun alone: 7 suites, 48 tests
passed. Does not cover: any device, the Android bundle export (not run this session), the new screens (no test
or route exists for them yet).

**E5 (Reproduced, after Phases 2 and 3 were built, 2026-10-21).** `pnpm typecheck` clean; `pnpm lint` clean (0
problems); `pnpm test` **50 suites, 420 tests passed** (baseline before this work: 365 tests). `pnpm exec expo export
--platform android` (to a temporary folder, the owner's Metro on 8081 untouched) succeeded: one Hermes bundle of
3.2 MB, and only `Ionicons.ttf` of the icon fonts (the `@expo/vector-icons` barrel import would have bundled every
family, so the layout imports `@expo/vector-icons/Ionicons`). New or changed tests: `__tests__/teacher-layout.test.tsx`
(five tabs with title and icon, Attendance hidden by module / license / no permission, Attendance shown for
`attendance.self` only, More and Profile never hidden, tabs dropped and rebuilt for the second school, redirects),
`visibility.test.ts` (null module key, `visibleTabs`), `attendance/__tests__/manifest.test.ts` (registry order,
`teacher.selfAttendance`), `attendance/__tests__/AttendanceTabScreen.test.tsx` (subtabs, switching, one-class list
kept, a lone subtab draws no control, the `subtab` param), `selfAttendance/__tests__/{model,MyAttendanceScreen}.test.ts(x)`
(created, unchanged, double tap sends one request, 409 both ways, 400, offline, 404 not linked, holiday, month
stepping), `academic/__tests__/AcademicHubScreen.test.tsx`, `profile/__tests__/ProfileScreen.test.tsx`,
`components/__tests__/SegmentedControl.test.tsx`, `HomeScreen.test.tsx` (tiles, shortcuts, the moved link, no Sign out),
`lib/__tests__/date.test.ts` (months). The API is mocked in all of them. Two of the first full runs timed out a
first test per suite under load (cold Jest, noted in `project-status.md`); the final full run was clean. Does not
cover: a real backend, a device, a real navigator (the layout test mocks `Tabs`), the look of any screen, the
Nepali text.

**E6 (Reproduced for the checks; Static for the reviews, 2026-10-21, after E5).** Two review skills were run on the
UI diff from the web-repo session, reading the files with no device and no emulator:

- `ponytail-review` on the files listed in §11.1 (components, tab screens, registry helpers, layout). It reported
  what could be cut (§11.6) and, while reading `AttendanceTabScreen`, a defect (see §11.2): the local subtab state
  could disagree with the `subtab` param. **Fixed**: the param is the single source (`AttendanceTabScreen.tsx`,
  `attendance/routes.ts`), `= {}` dropped from `MyAttendanceScreen`'s props, two Home assertions and the
  `AttendanceTabScreen` switching test updated to the new hrefs and to `setParams`.
- `impeccable critique`, **degraded**: one context instead of two isolated assessments (spawning agents was not
  requested in this session); Assessment A was written before the detector ran. The detector
  (`impeccable detect --json` over the ten UI files) returned `[]` (0 findings, exit 0); it reads web markup and
  CSS, so that says nothing about React Native `StyleSheet` screens. No `.impeccable/critique/` snapshot was
  written (it would add an untracked folder to the repo); this entry and §11.6 are the record. First run for these
  screens, so no trend.

After the fix: `pnpm verify` (lint, then typecheck, then `jest`) green, **50 suites, 420 tests passed** (the count is
unchanged: no test was added, two assertions and one test body were changed). The same worker-exit and `act()`
console noise as before appeared in `RosterScreen` (existing). Does not cover: a device (so the `router.setParams`
call on a nested-stack tab is untested against a real navigator; the unit test mocks `expo-router`), the look of
any screen, `ui-ux-pro-max`.

**E7 (Reproduced, the owner's review choices built, 2026-10-21).** After the E6 reports the owner chose "top fixes
only" and "remove all three shortcuts". Built: Dashboard shortcut block removed, with `tabHref`, `MY_ATTENDANCE_HREF`,
`useVisibleTabs`, `dashboard.shortcuts` and `dashboard.takeAttendance` (the layout now calls `visibleTabs` directly);
"Coming soon" rows on the Academic hub are flat and muted (no card surface, `accessibilityState.disabled`); `Card`
with `onPress` ends in a chevron (`chevron-forward`, hidden from screen readers; affects every tappable card: the
class cards, the My classes card); the active tab shows the filled Ionicons glyph (`home`, `person-circle`, ...);
`useHeaderOptions` (card surface, text colour) on the tab bar's header and both nested stacks so the header follows
the dark scheme; `dashboard.classes` is "Classes" / "कक्षाहरू" (was "Classes today" / "आजका कक्षा"; the Nepali is a
draft for native review). Tests: two Home tests rewritten (tiles and no shortcut block; no exams tile), one
layout test added (outline when inactive, filled when active, for Dashboard, Profile and More), the
`AttendanceTabScreen` param test renamed. Checks: `pnpm verify` ran lint and typecheck clean; the first full jest run
after the edits had **6 first-test-in-suite 5 s timeouts** (the cold-cache flake already noted in `project-status.md`;
each suite passed warm), a rerun of `src/features/teacher` passed 15 suites / 191 tests, and a second full run passed
**50 suites, 421 tests** (420 plus the new layout test). `pnpm exec expo export --platform android` (to a temporary
folder) succeeded, one 3.2 MB Hermes bundle. Does not cover: a device; the look of the chevron, the flat rows or the
dark header (none seen); a real navigator for the header options; `ui-ux-pro-max`.

**E8 (Reproduced, the rest of the review findings built, 2026-10-21).** Built on the owner's request to resolve
everything left in §11.6:

- `MyAttendanceScreen`: the month is one `Card` of compact rows (date left, status badge right) under a counts line
  built by `statusSummary` in `model.ts` ("Away 1 · In school 2": one count per status, ordered by status key so the
  line reads the same each month), not one card per day.
- `AccountActions`: Sign out is a `link` button (as on `resolve`, `school-picker`, `school-unavailable`) and asks first
  with a native `Alert` (Cancel / Sign out, destructive); new keys `common.cancel`, `shell.signOutTitle`,
  `shell.signOutBody` (en, ne). The same component serves the guardian placeholder, so it asks there too. The school-context
  screens still sign out without asking (they are dead-end screens).
- `ProfileScreen`: no in-body title, no license dates or expiry banner (keys `profile.title`, `profile.licenseUntil`,
  `profile.licenseExpiring` removed, en and ne). `MoreScreen`: the one explanatory line (`more.title` removed).
- `Stepper`: `chevron-back` / `chevron-forward` Ionicons instead of text glyphs.
- `AttendanceTabScreen` now renders the segmented control above the subtab (a plain `View` with the control, then the
  subtab filling the rest), so a long class list scrolls under it; the `header` prop of `ClassListScreen` and
  `MyAttendanceScreen` is gone. Unverified on a device: the subtab's own `SafeAreaView` adds no top inset under the nested
  stack header.
- `app/teacher/_layout.tsx`: `key={tenantId}` removed (D8 and §11.2 reworded; the protected `ARCHITECTURE.md` §4
  sentence "keyed by the selected school" corrected to match, one sentence). `StatTile.tsx` deleted; the tile is a local
  function in `HomeScreen.tsx` (UI_SYSTEM reworded).

Tests: Profile (no title, no license text even when the license is about to end; Sign out asks, Cancel does nothing,
confirm signs out), `statusSummary` (2), My Attendance (counts line and rows), Attendance tab (the control is outside every
scroll view), the removed "warns when the license is about to end" test. `pnpm typecheck` and `pnpm lint` clean; a first
full run after the edits had **3 first-test-in-suite 5 s timeouts** (the cold-cache flake again; all passed warm); the warm
full run passed **50 suites, 424 tests** (421, plus 4 new, minus 1 removed). `pnpm exec expo export --platform android`
(temporary folder) succeeded, one 3.2 MB bundle. Does not cover: a device; how the chevrons, the compact rows, the
Alert, or the pinned control look or behave; `ui-ux-pro-max`; the Nepali strings (drafts).

**E9 (Reproduced over HTTP, 2026-10-22): the shell and attendance contracts against the test stack.** A throwaway script
(outside both repos) called a test API container on its own database; 24 requests, 23 as the mobile types and docs
state, 1 wrong expectation of mine (an account without `attendance.self` gets 403 before any staff-link check; the 404
needs `attendance.self` and no link, which was then checked and holds). Observed:

- `GET /identity/me` → `{ id, email, phone (null), fullName, isPlatformAdmin, sessionTimeoutMinutes }`, matching `Me`.
  `GET /tenancy/my-schools` → `[{ tenantId, name, status, audience, license: { status, tierName, validUntil, expiringSoon,
  modules } }]`; `GET /tenancy/my-permissions` → `{ all, keys }`.
- `GET /attendance/roster`: `{ date, dayInfo: { schoolDay, reason, holidayName }, rows: [{ enrollmentId, studentId, fullName,
  admissionNumber, rollNumber (a string), sectionId, record: null | { id, status, remarks (null), version } }] }`. The roster
  only has rows when the academic year's dates contain the date (the e2e fixture's year is in 2082 AD, so it was empty until
  the year was moved; a real school is unaffected). `GET /attendance/settings` also carries `weeklyOffDays`,
  `lowAttendanceThresholdPercent` and per-status weights; the app reads only labels, codes and `active`.
- `POST /attendance/records/bulk`: 201 `{ ok: true, replayed: false, results: [{ studentId, id, version, outcome }] }`; the
  same key and body → `replayed: true`; the same key with another body → 409 `HTTP_CONFLICT`; a stale `version` → a 2xx
  `{ ok: false, failures: [{ identifier: { studentId, row }, error: "This record was changed by someone else — reload and
  try again" }] }` (not a 409, as the app assumes); re-saving with the real version → `outcome: updated`, version 2.
- **P1.7 done.** `GET /attendance/staff/self` → `{ staff: { id, staffCode, fullName, employmentStatus }, today, todayDay,
  month, records: [] }`; a record has `id, tenantId, staffMemberId, attendanceDate, status, remarks (null), source ('self'),
  markedAt, markedByUserId, version, createdAt, updatedAt`. `POST` answers **200** with `{ outcome: 'created', record, day }`,
  a second tap `unchanged`. `?month=2026-09` → empty list; `?month=garbage` → 400 "month must be YYYY-MM"; `attendance.self`
  without a staff link → 404 "No staff member is linked to your account — ask an administrator" (GET and POST).
- License block: an expired license → 403 `LICENSE_EXPIRED`, suspended → `LICENSE_SUSPENDED`, no row →
  `LICENSE_NOT_FOUND` (messages "Your license has expired…", "Access to this service has been suspended…", "This school
  does not have a license…"), while `GET /tenancy/my-schools` stays 200 and reports `license.status: expired` and
  `validUntil`. The license was restored afterwards.

Not covered: the app; a weekly off day or holiday (the fixture school has none, so the refusal wording was not seen); a
second school; session expiry; the idle limit.

**E10 (Reproduced, 2026-10-22): roles and mobile access.** Summary here, evidence and the B12 request in
`docs/project/ROLES_ACCESS_CHECK.md`. A freshly migrated database holds two roles, `tenant_admin` and `guardian`, and no
teacher role. A global role and a custom role made through `POST /admin/roles` both reach the mobile app only as permission
keys from `GET /tenancy/my-permissions`; a custom role with five permissions opened every teacher route; a role with no
permissions gives `keys: []` (the app shows "Use the web app"). Custom roles of one school are invisible to another through
the API and cannot be assigned there. **`roles`, `role_permissions` and `permissions` have no row-level security** (accepted
decision in ADR-0033 D8): the application role, in another school's tenant context, can read a school's custom role. A
revoked role takes effect on the server at once (the same token gets 403), but the app caches permissions for 15 minutes
unless a 403 refreshes them.

---

# 11. Build record and what remains (updated 2026-10-25)

Phases 0 to 3 are built in this repo, and Phase 4's code checks ran (E5). The owner explicitly authorized grouped commits
on 2026-10-25; this plan no longer prohibits committing, but repository checks and review remain required. The web/API repo
has no edits and must stay that way (owner rule D1).

## 11.1 What was built

| Piece | Files |
| --- | --- |
| School-unavailable reason (Phase 1) | `src/auth/schoolBlock.ts`, `session.ts` (`blockedReason`), `SessionEvents.tsx`, `app/(context)/school-unavailable.tsx`, `src/i18n/{en,ne}.ts` (`unavailable.reason.*`), tests `src/auth/__tests__/{schoolBlock,SessionEvents}.test.ts(x)`, `guards.test.ts` |
| Dependency | `@expo/vector-icons ^15.1.1` in `package.json` and `pnpm-lock.yaml` (owner approved) |
| Manifest model and registry | `src/features/types.ts` (`mobileModuleKey: string or null`, `tab?: string`), `visibility.ts` (null key, `visibleTabs`), `routes.ts` (`routeName`, `menuHref`), `registry.ts` (seven features in `order`), manifests `teacher/{academic,more,profile,selfAttendance}/manifest.ts`, updated `home`, `attendance`, `assignments` manifests |
| Shell | `app/teacher/_layout.tsx` (tabs from `visibleTabs`, Ionicons with the filled glyph on the active tab, tab bar and header tinted from tokens, no per-school `key`, no "no features" branch), `app/teacher/{attendance,academic}/_layout.tsx` (header tint), `app/teacher/{more,profile}.tsx`, `app/teacher/academic/{_layout,index,assignments}.tsx` (assignments moved here), `app/teacher/attendance/index.tsx` now the subtab host |
| Shared components | `src/components/{SegmentedControl,Stepper}.tsx` (the Dashboard's count tile is a local component of `HomeScreen`); `DateStepper.tsx` is a thin wrapper over `Stepper`; `AccountActions.tsx` (quiet links, Sign out asks first); `Card.tsx` (a tappable card ends in a chevron), `src/theme/useTheme.ts` (`useHeaderOptions`) |
| Attendance tab | `teacher/attendance/AttendanceTabScreen.tsx` (new host), `ClassListScreen.tsx` (`header`, `skipSingle`), `dayOffText.ts` (moved from `RosterScreen.tsx`), `routes.ts` (`ATTENDANCE_TAB_HREF`) |
| My Attendance | `src/api/attendance.ts`, `src/api/types/attendance.ts`, `teacher/selfAttendance/{model,queries,MyAttendanceScreen}`, `TEACHER_SELF_ATTENDANCE_ACCESS` in `teacher/access.ts`, `shiftMonth` and `formatMonth` in `src/lib/date.ts` |
| Dashboard | `teacher/home/HomeScreen.tsx` (summary tiles, link to My classes inside Academic; `AccountActions` removed; no shortcut row), `MarksSection` takes a `title` |
| Academic, More, Profile | `teacher/academic/AcademicHubScreen.tsx`, `teacher/more/MoreScreen.tsx`, `teacher/profile/ProfileScreen.tsx`; `Me` in `src/api/types/identity.ts` has nullable `email` and `phone` |
| Strings | `src/i18n/{en,ne}.ts`: `selfAttendance.*`, `tabs.*`, `dashboard.*`, `academic.*`, `more.*`, `profile.*`, `attendance.studentTab|subtabs` |
| Docs | this file, `PHASE_PROMPTS.md`, `project-status.md`, `TEACHER_FEATURES.md`, `API_CONTRACT.md`, `UI_SYSTEM.md`, and the protected ones `roadmap.md`, `FEATURE_MODULES.md`, `ARCHITECTURE.md` §4, `BACKEND_PREREQUISITES.md` (B11) |

## 11.2 Deviations from the approved plan

- The any-of `requiredPermission` was **dropped**: the tab-hosting rule already shows the Attendance tab to a
  teacher who only holds `attendance.self`.
- A generic `Stepper` was extracted from `DateStepper` so the month stepper reuses it instead of copying the arrows.
- The `key={tenantId}` the plan asked for on the tab navigator was built as insurance and **removed on 2026-10-21**
  (E8): a school switch clears the shell, so the guard already unmounts the tabs (the layout test shows they are
  dropped and rebuilt for the new school).
- The open subtab of the Attendance tab is the `subtab` route parameter and nothing else (`AttendanceTabScreen`
  keeps no state): the control writes it with `router.setParams`, and the one link in (`ATTENDANCE_TAB_HREF`, used by
  Home's "+N more") names `students`. The first build kept a local copy and followed the param only when it changed,
  so the tab (which stays mounted) ignored a link that asked for the subtab the param already named; found in the
  `ponytail-review` pass and fixed (E6). The Dashboard's My Attendance link was removed with the shortcut row (E7), so
  only the control writes `self`.
- Marks entry and Exam routine are text rows with a "Coming soon" badge (owner decision D5); the Marks entry row
  shows only to a teacher who holds `exam_result.save`.

## 11.3 Not done, and not verified

- **`ui-ux-pro-max` was not run** (not available in the web-repo session where this was built; mobile rule
  `mobile-frontend.md` §9). `ponytail-review` and `impeccable critique` were run (E6, findings in §11.6). The
  `impeccable` run was single-context and code-only; a run from a session opened in this repo, on a device build,
  is still the proper finish. The Dashboard redesign was out of scope by decision.
- The look of every new screen remains unverified on a device: no emulator is used. Tab bar colours, headers, Dark mode,
  dropdown placement, font scale and low-end scrolling must be checked in the owner's Android run.
- **Historical live shape of `GET /attendance/staff/self`**: record fields (`attendanceDate`, `status`, `source`, `version`)
  and `todayDay` were confirmed over HTTP on 2026-10-22 (E9); recheck on the current target stack during the owner run if the environment differs.
- The phone's own date is used only for Home's date line and `my-classes`; My Attendance shows the school's `today`.
- The protected `roadmap.md` M2 checkbox for the shell stays unchecked until the device run (§6.1).
- The Nepali strings added here are drafts and need native review.

## 11.4 Gotchas found

- **Typed routes are on** (`experiments.typedRoutes`). `.expo/types/router.d.ts` is regenerated by the owner's Expo
  dev server (Metro, port 8081). A `router.push` to a brand-new path fails `tsc` until it regenerates; `tabHref` and
  `menuHref` return a cast `Href` so registry-derived paths do not depend on that. Do not edit `.expo` by hand and do
  not start or stop the owner's server.
- Docs `roadmap.md`, `FEATURE_MODULES.md`, `ARCHITECTURE.md`, `BACKEND_PREREQUISITES.md`, `TEACHER_FEATURES.md`,
  `UI_SYSTEM.md`, `API_CONTRACT.md` are CRLF: the `Edit` tool keeps CRLF and accepts multi-line anchors, but the file
  must first be read with the Read tool (not `cat`), and "modified since read" means read it again.
- A role query for a container fails unless it is `accessible`; `SegmentedControl`'s group is deliberately not
  accessible (it would hide its tabs from a screen reader), so tests find it by label.
- `SessionEvents` listeners are module-global; a test that mounts it must unmount it in `afterEach`.
- A long shell heredoc was cut off mid-line once; write test files with the Write tool, not `cat <<EOF`.
- Windows Git Bash rewrites `/tmp/...` arguments to `docker exec`; pipe SQL through stdin instead.

## 11.5 Owner items still open

Confirm H1 on dev with §3.6 and issue or renew the license in web Platform admin if confirmed; decide B11 in the
web/API repo; the device run in §6.1; native review of the Nepali strings; the month stepper's lower bound (the other
§11.6 findings are built, E7 and E8). What follows the shell, phase by phase with every pending task and owner:
`docs/project/V1_DELIVERY_PLAN.md`; the next feature's plan: `docs/project/MARKS_PLAN.md`.

## 11.6 Review findings (E6); built in two rounds (E7, E8)

**Round 1, the owner's choice, 2026-10-21: "top fixes only" and "remove all three shortcuts" (E7).** Built: the first
ponytail row (shortcuts), impeccable rows 1 to 5. **Round 2, the owner's request the same day (E8).** Built: impeccable
rows 6 and 7 (compact month list with a counts line; Sign out asks first and is a quiet link; no license dates on
Profile) and the row-8 items the owner named (chevron icons on the stepper, no repeated in-body titles on Profile and
More, the Attendance subtab control pinned above the scrolling area), plus the two ponytail rows (`key={tenantId}` removed,
`StatTile` made local to `HomeScreen`). **Open:** the month stepper still has no lower bound (row 8, `canGoBack`
is always true); it needs a rule from the backend (license start or school year), so it stays a note. The wording below
is the report as written.

`ponytail-review` (over-engineering only; `net: about -50 lines possible`, most of it the first row):

| Where | Finding | State |
| --- | --- | --- |
| `HomeScreen.tsx` shortcuts block, `routes.ts` `tabHref`, `attendance/routes.ts` `MY_ATTENDANCE_HREF`, `useVisibleTabs` | The three shortcuts (Take attendance, My Attendance, Academic) repeat the bottom tab bar, and Attendance already has its own "+N more" link. Cutting them removes the block, `tabHref`, `MY_ATTENDANCE_HREF`, the `subtab=self` link path and its test, and `useVisibleTabs` (the layout can call `visibleTabs` directly). The shortcuts are in the approved plan (§5), so this is the owner's call | Open, owner decision |
| `app/teacher/_layout.tsx` `key={tenantId}` | A school switch clears the shell and the guard already unmounts the tabs (§11.2), so the key changes nothing today; D8 asked for it | Open, owner decision (edit D8 if removed) |
| `StatTile.tsx` | One screen uses it (three times); could be a local component until a second screen needs it | Optional |
| `AttendanceTabScreen.tsx` local subtab state | Replaced by the `subtab` param | **Fixed** (E6) |
| `MyAttendanceScreen.tsx` `= {}` | Default props object never needed | **Fixed** (E6) |

`impeccable critique` (design review from code; Operate surface; the new screens scored as a set, **26 of 40,
Acceptable**: visibility of status 3, match with the real world 3, control and freedom 3, consistency 2, error
prevention 3, recognition 3, flexibility 2, minimalism 2, error recovery 3, help 2):

| # | Sev | Finding | Fix |
| --- | --- | --- | --- |
| 1 | P1 | Dashboard order: header, tiles, three shortcut cards and only then today's classes to mark. The teacher's first job is below the fold on a small phone, and every block is a same-weight `Card` | Same cut as the first ponytail row, or move `AttendanceSection` above the tiles; keep one "My Attendance" action |
| 2 | P1 | Academic hub: the "Coming soon" rows are `Card`s that look the same as the tappable My classes card and do nothing when tapped | Render them muted and flat (no card surface), and give tappable cards a chevron |
| 3 | P2 | Active tab shows only by colour: every tab icon is the `-outline` variant for active and inactive, and accent vs muted grey have similar contrast on white | Use the filled Ionicons variant when `focused` |
| 4 | P2 | Dark mode: the tab bar takes tokens but the navigation header stays the default light one (no theme provider; noted in §11.3). White header over a dark screen | `headerStyle` / `headerTintColor` from the `header` and `textInverse` tokens in the layout's `screenOptions` |
| 5 | P2 | "Classes today" counts the class placements returned by `my-classes?date=`, not a timetable | Rename to "Classes" (en + ne) |
| 6 | P2 | My Attendance month list: one full `Card` per day (up to 31, mostly "Present"), inside a `ScrollView` | Compact one-line rows plus a counts line; `FlatList` if kept long |
| 7 | P2 | Profile: Sign out is the one filled primary button (existing `AccountActions`) with no confirmation, under a short screen; the teacher also sees license expiry they cannot act on | Make Sign out secondary with a confirm; show the school name only |
| 8 | P3 | Titles repeat: the tab header says "Profile" (and "More") and the body repeats it; the `‹ ›` stepper arrows are text glyphs while the tab bar uses icons; `canGoBack` never ends; the segmented control scrolls away with the list | Drop the in-body titles; use `chevron-back` / `chevron-forward`; cap the month at the license start or school year |

Cognitive load: 3 of 8 checklist items fail on the Dashboard (single focus, chunking, visual hierarchy), so
"moderate, address soon". Strengths: every state of My Attendance gives feedback (button loading, toast, badge, offline
banner); touch targets meet 44 pt throughout; Profile and More can never be hidden, so nobody is locked out of Sign out.
Commands the owner could run next: `/impeccable distill` (row 1), `/impeccable layout` (rows 2, 6), `/impeccable
polish` (rows 3, 4, 8), `/impeccable clarify` (row 5), none applied yet. The Dashboard visual redesign stays out of
scope (§7) unless the owner lifts it.
