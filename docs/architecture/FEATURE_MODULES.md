---
description: The feature-module registry that lets teacher and guardian features be added without changing the app shell.
purpose: Keep the app extensible (classroom, assignments, lesson planning, scanning, notices…) with one consistent gating model.
access: Read
---

# Feature Modules

## Status

Designed. Implemented in M1 (registry) with the first modules in M2/M3.

---

# 1. Why

Teacher and guardian features will keep growing. Each one must plug in without editing the shells,
and must be hidden automatically when the user lacks permission, the school lacks the license, or
the school disabled it for mobile.

---

# 2. Declaration

Each feature lives in `src/features/<id>/` and exports one manifest:

```ts
export const attendanceFeature: FeatureManifest = {
  id: "teacher.attendance",
  audience: "teacher", // 'teacher' | 'guardian'
  title: "Attendance", // i18n key in practice
  icon: "calendar-check",
  requiredPermission: "attendance.mark", // backend permission key, or null
  requiredEntitlement: "academic", // backend licensable module, or null
  mobileModuleKey: "attendance", // key in tenant_mobile_module_visibility
  placement: "tab", // 'tab' | 'home-card' | 'menu'
  stack: true, // optional: the route is a nested stack with its own header
  order: 20,
  routes: () => import("./routes"),
};
```

`src/features/registry.ts` is the only list of manifests.

**Tabs and hosted features (built 2026-10-21, `docs/project/TEACHER_APP_PLAN.md`; unit-tested, not yet run on a
device).** The teacher shell has five tabs: Dashboard, Attendance, Academic, More, Profile.
Each is a manifest with `placement: 'tab'`. A feature with `placement: 'menu'` names the tab that lists it in
`tab?: string` (for example `teacher.selfAttendance` → `teacher.attendance`, `teacher.assignments` →
`teacher.academic`). `mobileModuleKey` may be `null` (no school toggle; used by Profile, More and the Academic
hub so a school can never hide Sign out or Switch school). The rule for a tab is in §3.

`stack` (optional, default false): the feature's route is a directory with its own `_layout` holding a
nested `Stack` (e.g. Attendance: class list, then roster). The shell's tab layout then hides the tab's
own header (`headerShown: false`) so the nested stack draws one, with a back button. The nested
layout must repeat any header action the tab header carried (the shell switcher). Features without
`stack` keep the tab header exactly as before. Added with `teacher.attendance` (owner decision D1,
2026-10-21).

---

# 3. Visibility rule

A feature is shown when **all** hold:

```text
manifest.audience matches the active shell
AND (requiredPermission is null OR in GET /tenancy/my-permissions keys, or all = true)
AND (requiredEntitlement is null OR in my-schools license.modules)
AND tenant_mobile_module_visibility[mobileModuleKey] is not false   (missing row = visible)
```

When `mobileModuleKey` is `null` the last line does not apply. **A tab is shown when its own rule holds or
any visible feature names it in `tab`** (built 2026-10-21, `visibleTabs`): a teacher who may only mark their own attendance
(`attendance.self`, no `attendance.mark`) still gets the Attendance tab, through `teacher.selfAttendance`.

This is a **UX filter**. The backend still enforces permission, license and scope on every call.

Guardian features normally have `requiredPermission: null` — guardian access is enforced by the
guardian-audience portal endpoints (backend B4/B7), not by staff permission keys.

---

# 4. Registered features (planned)

| id                                                         | audience | phase | permission                 | entitlement | mobileModuleKey           |
| ---------------------------------------------------------- | -------- | ----- | -------------------------- | ----------- | ------------------------- |
| teacher.home                                               | teacher  | M2    | —                          | —           | `my_dashboard` (existing) |
| teacher.assignments (menu, tab `teacher.academic`)         | teacher  | M2    | —                          | academic    | `my_classes` (new)        |
| teacher.attendance (tab; also shown through `teacher.selfAttendance`) | teacher  | M2    | attendance.mark            | academic    | `attendance` (existing)   |
| teacher.marks (menu, tab `teacher.academic`)               | teacher  | M2 (built 2026-10-22) | exam_result.save           | academic    | `exams` (existing)        |
| teacher.routine                                            | teacher  | later | —                          | academic    | `exams` (existing)        |
| teacher.selfAttendance                                     | teacher  | M2 (v1 again, 2026-10-21; menu, tab `teacher.attendance`) | attendance.self            | academic    | `attendance` (existing)   |
| teacher.academic (hub tab)                                 | teacher  | M2 (built 2026-10-21) | —                  | academic    | — (none)                  |
| teacher.more (placeholder tab)                             | teacher  | M2 (built 2026-10-21) | —                  | —           | — (none)                  |
| teacher.profile (tab)                                      | teacher  | M2 (built 2026-10-21) | —                  | —           | — (none)                  |
| guardian.home                                              | guardian | M3    | —                          | —           | `my_dashboard` (existing) |
| guardian.profile                                           | guardian | M3    | —                          | —           | `students` (existing)     |
| guardian.attendance                                        | guardian | M3    | —                          | academic    | `attendance` (existing)   |
| guardian.fees                                              | guardian | M3    | —                          | fees        | `fee_history` (new)       |
| guardian.results                                           | guardian | M3    | —                          | academic    | `marksheet` (existing)    |
| guardian.routine                                           | guardian | later | —                          | academic    | `exams` (existing)        |
| shared.notices                                             | both     | teacher side M2 (owner 2026-10-22), guardian side M3/M4; push M4 | —                          | —           | `notices` (new)           |
| teacher.classroom / homework / lesson-plan / question-scan | teacher  | M5    | (new keys via backend ADR) | academic    | (new)                     |

**Detail screens without a manifest (built 2026-10-22).** A screen that is only a detail of an existing feature is not a
registry feature. "Student details" (opened from an Attendance roster row, `docs/project/STUDENT_INFO_PLAN.md`) lives in the
Attendance stack (`app/teacher/attendance/student.tsx`) and is gated by an access constant, not a manifest:
`TEACHER_STUDENT_INFO_ACCESS` in `src/features/teacher/access.ts` (permission `attendance.mark`, entitlement `academic`,
mobile module key `students`, an existing key), evaluated with the same `isFeatureVisible` rule. It therefore has its own
school switch without adding a row to this table. `marksEntryHref` (`teacher.marks`) is the same pattern for a screen of a
registered feature.

The backend already stores toggles per `moduleKey` (`PATCH /settings/tenant/mobile-modules`, free
string). The web's platform "System Customization" screen toggles a fixed list —
`MOBILE_MODULES` in `apps/web/src/pages/platform/types.ts`: `dashboard, my_dashboard, students,
attendance, exams, marksheet, fee_collection, expenses, reports, activity_log, user_management,
user_manual`. Reuse those keys where the meaning matches (above); the **new** keys (`my_classes`,
`fee_history`, `notices`) must be added to that web list in the backend repo before the mobile app
relies on them. Staff-only keys (`fee_collection`, `expenses`, `reports`, `activity_log`,
`user_management`) are not used by this app in v1.

---

# 5. Adding a feature (checklist)

1. Backend first: endpoints, permission key, ADR if new domain behavior — in the backend repo.
2. `src/features/<id>/` with manifest, routes, hooks, screens.
3. Register in `registry.ts`.
4. Add to the table in §4 and to `docs/domain/*_FEATURES.md`.
5. Add `staleTime` class usage (no new classes without review).
6. Tests: visibility rule (permission/license/visibility off), main screen render, error states.
