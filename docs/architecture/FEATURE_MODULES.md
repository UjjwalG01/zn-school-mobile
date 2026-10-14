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
  id: 'teacher.attendance',
  audience: 'teacher',                  // 'teacher' | 'guardian'
  title: 'Attendance',                  // i18n key in practice
  icon: 'calendar-check',
  requiredPermission: 'attendance.mark',   // backend permission key, or null
  requiredEntitlement: 'academic',         // backend licensable module, or null
  mobileModuleKey: 'attendance',           // key in tenant_mobile_module_visibility
  placement: 'tab',                     // 'tab' | 'home-card' | 'menu'
  order: 20,
  routes: () => import('./routes'),
};
```

`src/features/registry.ts` is the only list of manifests.

---

# 3. Visibility rule

A feature is shown when **all** hold:

```text
manifest.audience matches the active shell
AND (requiredPermission is null OR in GET /tenancy/my-permissions keys, or all = true)
AND (requiredEntitlement is null OR in my-schools license.modules)
AND tenant_mobile_module_visibility[mobileModuleKey] is not false   (missing row = visible)
```

This is a **UX filter**. The backend still enforces permission, license and scope on every call.

Guardian features normally have `requiredPermission: null` — guardian access is enforced by the
guardian-audience portal endpoints (backend B4/B7), not by staff permission keys.

---

# 4. Registered features (planned)

| id | audience | phase | permission | entitlement | mobileModuleKey |
|---|---|---|---|---|---|
| teacher.home | teacher | M2 | — | — | `my_dashboard` (existing) |
| teacher.assignments | teacher | M2 | — | academic | `my_classes` (new) |
| teacher.attendance | teacher | M2 | attendance.mark | academic | `attendance` (existing) |
| teacher.marks | teacher | M2 | exam_result.save | academic | `exams` (existing) |
| teacher.routine | teacher | M2 | — | academic | `exams` (existing) |
| guardian.home | guardian | M3 | — | — | `my_dashboard` (existing) |
| guardian.profile | guardian | M3 | — | — | `students` (existing) |
| guardian.attendance | guardian | M3 | — | academic | `attendance` (existing) |
| guardian.fees | guardian | M3 | — | fees | `fee_history` (new) |
| guardian.results | guardian | M3 | — | academic | `marksheet` (existing) |
| guardian.routine | guardian | M3 | — | academic | `exams` (existing) |
| shared.notices | both | M4 | — | — | `notices` (new) |
| teacher.classroom / homework / lesson-plan / question-scan | teacher | M5 | (new keys via backend ADR) | academic | (new) |

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
