---
description: Detailed implementation plan for the teacher landing page (Home tab, teacher.home) shown after a teacher logs in.
purpose: Give a code-level plan (content, backend contract, files, code, tests, docs, verification) so the Home slice can be built from this document alone.
access: Read
---

# Teacher Landing Page (Home) — Implementation Plan

## Status

**Built 2026-10-21 (steps 1–6, `pnpm verify` green); §9 verification on the test stack and a device is still open.**
Written 2026-10-19. Gate closed by the owner on 2026-10-21 (B5, B6, B7-teacher recorded Implemented).
Differences from this plan, all deliberate: (1) Attendance and Marks blocks are gated by
`TEACHER_ATTENDANCE_ACCESS` / `TEACHER_MARKS_ACCESS` (`src/features/teacher/access.ts`) because no
`teacher.attendance` / `teacher.marks` manifests exist yet and `isFeatureVisible` now takes just the four
fields it reads; (2) `QueryState` messages are `common.*` keys; (3) Home has an `AccountActions` footer
(sign out, switch school), which the old placeholder had and this plan omitted; (4) the layout redirects to
`/resolve` while permissions or schools are not loaded; (5) pull-to-refresh uses its own flag, not
`isRefetching`, so background refetches do not show a spinner; (6) `home.returned` is worded without a plural.
Belongs to M2 (`docs/project/roadmap.md` §4), feature `teacher.home`. It is the first feature module, so
it also wires the feature registry into the teacher tab layout.

Docs read for this plan: `CLAUDE.md`, `.claude/rules/*`, `docs/project/{project-status,roadmap}.md`,
`docs/domain/TEACHER_FEATURES.md`, `docs/api/API_CONTRACT.md`, `docs/architecture/{ARCHITECTURE,FEATURE_MODULES}.md`,
`docs/frontend/UI_SYSTEM.md`, and in the backend repo `docs/api/ENDPOINTS.md` §6a / §7 / §7e plus
`docs/project/implementation-plan/mobile-upgrade-implementation-plan.md` Phase 5.

---

# 0. Context and findings that shape the plan

After login a teacher flows `login → /resolve → useSessionContext → teacher shell → /teacher`. Today
`/teacher` renders `ShellPlaceholder` ("Features for this area are coming soon"). This plan replaces it
with a read-only summary of what the teacher can act on today.

1. **`GET /portal/teacher/home` does not exist.** The backend left it out on purpose (Phase 5 note
   "Left out on purpose"; ENDPOINTS §7e lists only `my-classes`, `exams`, `students/:id`). Stale
   references: `roadmap.md` §4, `TEACHER_FEATURES.md` §2.1, `FEATURE_MODULES.md` / `ARCHITECTURE.md`
   (`/portal/*/home`), `PHASE_PROMPTS.md` (M2 prompt). `API_CONTRACT.md` §3 is correct: compose Home.
   **Decision (owner, 2026-10-19): compose Home from two GETs; no per-section "attendance done" on Home.**
2. **Also not built:** `/portal/teacher/assignments` and `/portal/teacher/sections/:id/roster`.
   Attendance uses the existing `GET /attendance/roster`. Home does not need either.
3. **No academic-year label source.** No teacher portal response carries it, so Home v1 omits it.
4. **Gate.** `project-status.md` still lists B5/B6/B7 as Proposed / Partly built, but the backend built
   Phase 5 on the **test database only** (the dev database is not migrated). The M2 gate is strict
   (decided 2026-10-16). Before coding, the owner records B5 (marks scoping), B6 (per-subject marks, exams
   list) and B7-teacher as _Implemented_ in `project-status.md`, and `EXPO_PUBLIC_API_URL` points at the
   parallel test stack.
5. **Code drift noticed (not Home work, report only):** `School` in `src/api/types/tenancy.ts` has no
   `audience`, although `API_CONTRACT.md` §2 says `my-schools` returns it (ADR-0067 D10), and
   `useSessionContext.ts` still uses `GUARDIAN_ROLE_AVAILABLE = false`. Belongs to the guardian / M1 slice.
6. **Out of Home v1:** teacher self "Mark Present" and own attendance month (after v1, 2026-10-18), exam
   routine, notices (M4), timetable (no backend model), fees (not a teacher feature), holiday banner
   (`dayInfo` only comes from the roster), student search (no endpoint; reached from a roster row later).

---

# 1. What the teacher sees (content spec)

```text
┌ Tab header: "Home"                         [Switch to Guardian]  (only if both shells)
│ Hello, {fullName}                          ← GET /identity/me        (cached)
│ {school name}                              ← GET /tenancy/my-schools (cached)
│ {date in tenant calendar} · {other calendar, muted}   ← src/lib/date.ts + GET /settings/tenant
├ [warning Banner] 2 subjects were returned for correction     (only if any submission = returned)
├ [info Banner]    Showing saved data from 09:42               (only when a refetch failed offline and cache exists)
├ ATTENDANCE  (only if teacher.attendance is visible)
│   Card  Class 8 · A                                          ← my-classes.classes[]
│   Card  Class 6            (class with no sections: no " · section")
│   restricted:false → info Banner "You can mark any class"; show first 5 + "+N more"
├ MARKS ENTRY (only if teacher.marks is visible; hidden entirely on 403)
│   Card  Second Terminal · Class 8 · A    (exam name; session · class · section muted)
│           Mathematics   [Returned]       ← exams[].subjects[].submission.status
│           Science       [Not started]    ← submission === null
│           English       [Submitted]
├ MY SUBJECTS                                                  ← my-classes.subjects[] (first 5 + "+N more")
│   Mathematics — Class 8 · A
└ "Updated 09:42" (muted) · pull-to-refresh
```

| Block | Source | Fields used | Rules |
| --- | --- | --- | --- |
| Greeting | `useMe()` | `fullName` | show the whole `fullName`; never split names |
| School | `useMySchools()` | `name` of the selected `tenantId` | |
| Date | `todayIso()` + `useTenantSettings()` | `calendarPreference` | render only once settings exist (no hardcoded calendar); `formatDate` + `formatAlternateDate` |
| Attendance cards | `GET /portal/teacher/my-classes?date=` | `restricted`, `classes[]` | no roster call, so no done/pending and no holiday banner (decided); the CTA button is wired when the Attendance slice lands |
| Marks cards | `GET /portal/teacher/exams` | `examId, name, sessionName, className, sectionName`, `subjects[].{examSubjectId, subjectName, sectionId, submission.status}` | status is backend state only; sort returned → not started/draft → submitted; locked/published exams never appear (backend filters) |
| My subjects | same `my-classes` response | `subjects[]` | |
| Returned banner | derived from `exams` | count of `submission.status === 'returned'` | a count, not a business rule |

**Request budget:** warm start 0 requests (persisted cache + staleTime classes); cold start about 4
(my-classes, exams, tenant settings, mobile-modules) on top of the 3 context calls. Refresh =
pull-to-refresh or app foreground (already throttled to 60 s in `setupForegroundRefetch`). No polling.

---

# 2. Backend contract used (verified in backend `docs/api/ENDPOINTS.md` §7e / §7)

| Call | Permission | Response (fields the app uses) |
| --- | --- | --- |
| `GET /portal/teacher/my-classes?date=YYYY-MM-DD&tenantId=` | `attendance.mark` or `exam_result.save`, licence `academic` | `{ restricted, classes:[{classId, className, sectionId, sectionName}], subjects:[{…same, subjectOfferingId, subjectName}] }`; bad date → 400; no staff link → empty `subjects` |
| `GET /portal/teacher/exams?tenantId=` | same | `[{ examId, name, sessionName, classId, className, sectionId, sectionName, subjects:[{ examSubjectId, subjectOfferingId, subjectName, sectionId, sectionName, components[], submission:{status, version, returnedReason, submittedAt} \| null }] }]`; **403** with no staff link and no `exam_result.save_any` |
| `GET /settings/tenant` | Membership | `{ timezone, calendarPreference, numberFormat, locale }` (the app uses only `calendarPreference`) |
| `GET /settings/tenant/mobile-modules` | Membership | `[{ moduleKey, visible }]` (a missing row = visible) |

Error handling (reuse `errorAction()` in `src/api/errors.ts`):

| `errorAction` | Home behavior |
| --- | --- |
| `offline` | saved-data banner when cache exists, otherwise inline message + retry |
| `forbidden` on `exams` | hide the Marks section |
| `forbidden` on `my-classes` | "no access" text |
| `feature-denied` | hide the section, refetch my-schools |
| `license-blocked`, `school-suspended`, `session-expired`, `drop-school` | already handled globally by `SessionEvents` |
| `server`, `unknown` | inline "could not load" + `common.retry` |

---

# 3. Code plan (new / changed files)

Folder note: manifests live in `src/features/<id>/`; dots in folder names are awkward, so the folder is
`src/features/teacher/home/` while the manifest id stays `teacher.home`.

```text
NEW   src/api/types/portal.ts                 response types
NEW   src/api/portal.ts                       getTeacherMyClasses, getTeacherExams
NEW   src/api/types/settings.ts, src/api/settings.ts   getTenantSettings, getMobileModules
NEW   src/features/queries.ts                 useTenantSettings, useMobileModules (+ keys)
NEW   src/features/useVisibleFeatures.ts      builds VisibilityContext → visibleFeatures()
NEW   src/features/teacher/queries.ts         useTeacherMyClasses, useTeacherExams (shared by later teacher features)
NEW   src/features/teacher/home/manifest.ts   teacherHomeFeature
NEW   src/features/teacher/home/homeModel.ts  pure view-model (unit-tested)
NEW   src/features/teacher/home/HomeScreen.tsx + sections/{AttendanceSection,MarksSection,SubjectsSection}.tsx
NEW   src/components/{Card,StatusBadge,Banner,QueryState}.tsx   shared (UI_SYSTEM §2)
EDIT  src/components/Screen.tsx               optional refreshing / onRefresh (pull-to-refresh)
EDIT  src/lib/date.ts                         + formatTimestamp (time display must not be inline)
EDIT  src/features/registry.ts                + teacherHomeFeature
EDIT  src/features/types.ts                   title: MessageKey (type-safe i18n key)
EDIT  app/teacher/_layout.tsx                 tabs from the registry
EDIT  app/teacher/index.tsx                   re-export HomeScreen
EDIT  src/i18n/en.ts, ne.ts                   new keys (ne is Record<MessageKey,string>: both required)
```

Reuse check (CLAUDE.md reuse-first): existing and reused as-is — `apiGet`/`buildUrl` (`src/api/client.ts`),
`tenantKey`/`userKey` (`src/api/queryKeys.ts`), `STALE_TIME`, `useMe`/`useMySchools`/`useMyPermissions`
(`src/auth/queries.ts`), `useSession`, `useGuard`, `ShellSwitcher`, `Screen`, `Text`, `Button`,
`MessageScreen`, `visibleFeatures` (`src/features/visibility.ts`), `errorAction`, `formatDate`,
`formatAlternateDate`, `todayIso`, `t`. New code is limited to what none of these cover (the four shared
components, the two settings requests, the portal requests, the visibility hook, the view-model).

## 3.1 `src/api/types/portal.ts`

```ts
// Hand-written from backend ENDPOINTS.md §7e (A6). Only fields the app uses.
export interface TeacherPlacement {
  classId: string;
  className: string;
  /** null = a class with no sections (ADR-0054). Confirm sectionName is null too on a live response. */
  sectionId: string | null;
  sectionName: string | null;
}
export interface TeacherSubjectAssignment extends TeacherPlacement {
  subjectOfferingId: string;
  subjectName: string;
}
export interface TeacherMyClasses {
  /** false = holds attendance.mark_any: `classes` is every active section. */
  restricted: boolean;
  classes: TeacherPlacement[];
  subjects: TeacherSubjectAssignment[];
}
export type SubmissionStatus = 'draft' | 'submitted' | 'returned';
export interface MarksSubmission {
  status: SubmissionStatus;
  version: number;
  returnedReason: string | null;
  submittedAt: string | null;
}
export interface TeacherExamSubject {
  examSubjectId: string;
  subjectName: string;
  sectionId: string | null;
  sectionName: string | null;
  submission: MarksSubmission | null; // null = nothing saved yet
}
export interface TeacherExam {
  examId: string;
  name: string;
  sessionName: string;
  className: string;
  sectionId: string | null;
  sectionName: string | null;
  subjects: TeacherExamSubject[];
}
```

Components and `maxMarks` are left out until the Marks slice (check number vs decimal-string on a live
response then).

## 3.2 `src/api/portal.ts`

`tenantId` is attached by `buildUrl`, which also works when the path already holds a query string.

```ts
import { apiGet } from './client';
import type { TeacherExam, TeacherMyClasses } from './types/portal';

/** `GET /portal/teacher/my-classes?date=` — class placements + subject assignments (ENDPOINTS §7e). */
export const getTeacherMyClasses = (date: string) =>
  apiGet<TeacherMyClasses>(`/portal/teacher/my-classes?date=${encodeURIComponent(date)}`);

/** `GET /portal/teacher/exams` — exams open for entry with the caller's subjects and submission state. */
export const getTeacherExams = () => apiGet<TeacherExam[]>('/portal/teacher/exams');
```

## 3.3 `src/api/types/settings.ts` and `src/api/settings.ts`

```ts
// types/settings.ts
import type { CalendarPreference } from '../../lib/date';
export interface TenantSettings { calendarPreference: CalendarPreference }
export interface MobileModuleToggle { moduleKey: string; visible: boolean }

// settings.ts
export const getTenantSettings = () => apiGet<TenantSettings>('/settings/tenant');
export const getMobileModules = () => apiGet<MobileModuleToggle[]>('/settings/tenant/mobile-modules');
```

## 3.4 Query hooks

Same null-tenant pattern as `myPermissionsKey` in `src/auth/queries.ts`.

```ts
// src/features/queries.ts
export const tenantSettingsKey = (id: string) => tenantKey(id, 'tenant-settings');
export const mobileModulesKey = (id: string) => tenantKey(id, 'mobile-modules');

export function useTenantSettings() {
  const { tenantId } = useSession();
  return useQuery({
    queryKey: tenantId ? tenantSettingsKey(tenantId) : userKey('tenant-settings', 'no-school'),
    queryFn: getTenantSettings,
    staleTime: STALE_TIME.reference, // 6 h
    enabled: tenantId !== null,
  });
}
export function useMobileModules() { /* same shape: mobileModulesKey, getMobileModules, STALE_TIME.session */ }

// src/features/teacher/queries.ts
export const teacherMyClassesKey = (id: string, date: string) => tenantKey(id, 'teacher', 'my-classes', date);
export const teacherExamsKey = (id: string) => tenantKey(id, 'teacher', 'exams');

export function useTeacherMyClasses(date: string) { /* STALE_TIME.daily, enabled: tenantId !== null */ }
export function useTeacherExams(enabled = true) { /* STALE_TIME.daily, enabled: enabled && tenantId !== null */ }
```

- Stale-class choices (call out in review; no new class value): `exams` carries live submission state, so it
  is `daily` (5 min), not `reference`. The Marks slice invalidates `teacherExamsKey` after save / submit.
- Keys start with `[tenantId, …]`, so `removeTenantQueries` on school switch and logout already covers them.
- `date` is `todayIso()` (device local) so the key rolls over at midnight and matches the roster date the
  Attendance slice will send. Known edge: school timezone ≠ device timezone (see §8).

## 3.5 `src/features/useVisibleFeatures.ts`

```ts
export function useVisibleFeatures(audience: Audience): FeatureManifest[] {
  const { tenantId } = useSession();
  const permissions = useMyPermissions(tenantId);
  const schools = useMySchools();
  const modules = useMobileModules();
  return useMemo(() => {
    const school = schools.data?.find((s) => s.tenantId === tenantId);
    if (!permissions.data || !school) return [];
    return visibleFeatures(featureRegistry, {
      audience,
      permissions: permissions.data,
      licenseModules: school.license.modules,
      // a failed or missing mobile-modules call means "visible" (UX filter only; the backend enforces)
      mobileModules: Object.fromEntries((modules.data ?? []).map((m) => [m.moduleKey, m.visible])),
    });
  }, [audience, tenantId, permissions.data, schools.data, modules.data]);
}
```

Extract the context-building into a pure `buildVisibilityContext(...)` so it is testable without hooks.

## 3.6 `src/features/teacher/home/homeModel.ts` (pure)

```ts
export type SubjectProgress = 'notStarted' | 'draft' | 'submitted' | 'returned';
export const subjectProgress = (s: TeacherExamSubject['submission']): SubjectProgress =>
  s === null ? 'notStarted' : s.status;

export const placementLabel = (p: { className: string; sectionName: string | null }) =>
  p.sectionName ? `${p.className} · ${p.sectionName}` : p.className;

export interface ExamCard {
  key: string;                       // `${examId}:${sectionId ?? 'none'}`
  title: string;                     // exam name
  subtitle: string;                  // `${sessionName} · ${placementLabel}`
  subjects: { key: string; name: string; progress: SubjectProgress }[]; // key `${examSubjectId}:${sectionId ?? 'none'}`
  hasReturned: boolean;
  openCount: number;                 // notStarted + draft + returned
}
export function buildExamCards(exams: readonly TeacherExam[]): ExamCard[];   // sort: hasReturned desc, openCount desc, title asc
export const returnedCount = (cards: readonly ExamCard[]) => /* subjects with progress 'returned' */;
export const capList = <T,>(items: readonly T[], max = 5) => ({ shown: items.slice(0, max), more: Math.max(0, items.length - max) });
```

`returnedReason` is stored but not shown on Home (the Marks slice shows it).

## 3.7 Shared components

None of these exist yet; the existing ones are `Screen`, `Text`, `TextField`, `PasswordField`, `Button`,
`MessageScreen`, `ShellSwitcher`, `ShellPlaceholder`.

- `Card({ children, onPress?, accessibilityLabel? })` — `colors.card`, `colors.border`, `radius.lg`,
  `spacing.md`; a `Pressable` with `minHeight: MIN_TOUCH_TARGET` only when `onPress` is set.
- `StatusBadge({ label, tone: 'success' | 'warning' | 'danger' | 'neutral' })` — the text label is always
  shown (colour is never the only signal). Tone → `colors.success / warning / destructive / textMuted`.
  Submission mapping: notStarted → neutral, draft → neutral, submitted → success, returned → warning.
- `Banner({ tone: 'info' | 'warning', children })` — `warning` uses `colors.warning` background and
  `colors.warningForeground` text. The M1-A `OfflineBanner` reuses it.
- `QueryState({ query, isEmpty, emptyText, hideOnForbidden?, children })` — pending (`ActivityIndicator` +
  `t('common.loading')`), error with no data (via `errorAction`: offline / forbidden / other + retry
  `Button`), empty, else `children`.
- `Screen`: add `refreshing?: boolean; onRefresh?: () => void` and pass
  `refreshControl={onRefresh ? <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} /> : undefined}`
  to the `ScrollView`.
- Update `docs/frontend/UI_SYSTEM.md` §2 status for these (`Card`, `StatusBadge` were already planned there).
- **No new dependency:** tab icons stay text-only (`@expo/vector-icons` and FlashList are not declared in
  `package.json`; adding either needs approval). Home lists are capped at 5, so `View` + `map` is allowed
  here; roster-sized lists use `FlatList` in later slices.

## 3.8 `HomeScreen.tsx` (structure)

```tsx
export default function HomeScreen() {
  const { tenantId } = useSession();
  const me = useMe();
  const school = useMySchools().data?.find((s) => s.tenantId === tenantId);
  const calendar = useTenantSettings().data?.calendarPreference;
  const features = useVisibleFeatures('teacher');
  const has = (id: string) => features.some((f) => f.id === id);
  const today = todayIso();
  const classes = useTeacherMyClasses(today);
  const exams = useTeacherExams(has('teacher.marks'));
  const cards = useMemo(() => buildExamCards(exams.data ?? []), [exams.data]);
  const savedFrom = /* classes.isError && offline && classes.data ? classes.dataUpdatedAt : null */;
  return (
    <Screen refreshing={classes.isRefetching || exams.isRefetching} onRefresh={refetchAll}>
      <Header />  {/* greeting, school, date line */}
      {savedFrom ? <Banner tone="info">{t('home.savedData', { when: formatTimestamp(savedFrom, calendar) })}</Banner> : null}
      {returnedCount(cards) > 0 ? <Banner tone="warning">{t('home.returned', { count })}</Banner> : null}
      {has('teacher.attendance') ? <AttendanceSection query={classes} /> : null}
      {has('teacher.marks') ? <MarksSection query={exams} cards={cards} /> : null}
      <SubjectsSection query={classes} />
    </Screen>
  );
}
```

- Sections render `Text variant="title" accessibilityRole="header"` titles and wrap their body in `QueryState`.
  `MarksSection` passes `hideOnForbidden`.
- Card `onPress` stays `undefined` until the Attendance / Marks slices pass handlers (typed routes would not
  compile against screens that do not exist yet).
- Edge: if the school switches `my_dashboard` off for mobile, `teacher.home` is hidden. The layout then
  shows `MessageScreen` (`shell.noFeatures`) instead of an empty tab bar.

## 3.9 Manifest, registry and layout

```ts
// src/features/teacher/home/manifest.ts
export const teacherHomeFeature: FeatureManifest = {
  id: 'teacher.home', audience: 'teacher', title: 'shell.home', icon: 'home',
  requiredPermission: null, requiredEntitlement: null, mobileModuleKey: 'my_dashboard',
  placement: 'tab', order: 10, routes: () => import('./HomeScreen'),
};
// src/features/registry.ts
export const featureRegistry: readonly FeatureManifest[] = [teacherHomeFeature];
```

`app/teacher/_layout.tsx`:

- keep `useGuard('teacher')` first, then `useVisibleFeatures('teacher')` (both before the early returns);
- map visible `placement: 'tab'` features to `<Tabs.Screen name={routeName(id)} options={{ title: t(f.title) }} />`;
- routes of non-visible features get `options={{ href: null }}`;
- hide the tab bar when there is at most one tab (`tabBarStyle: { display: 'none' }`);
- route-name convention: the id minus the `teacher.` prefix, with `home` → `index`.

`app/teacher/index.tsx` becomes `export { default } from '../../src/features/teacher/home/HomeScreen';`
(expo-router needs a file per route; the registry stays the only list of features).

## 3.10 `src/lib/date.ts` addition

```ts
/** "09:42" for today, "2026-10-19 09:42" (tenant calendar) otherwise. Time display must not be inline in a screen. */
export function formatTimestamp(ms: number, calendar: CalendarPreference): string;
```

Local time via `getHours` / `getMinutes` padded (no `toLocaleTimeString`); the date part via
`formatDate(toIsoDate(d), calendar)`. Test it in `date.test.ts`.

---

# 4. i18n keys

Add to `src/i18n/en.ts` and `ne.ts`. Nepali is drafted and flagged "needs native review" like the rest.

| Key | English |
| --- | --- |
| `home.greeting` | Hello, {name} |
| `home.attendance` / `home.attendanceHint` | Attendance / Classes you can mark today |
| `home.noClasses` | No classes assigned. Ask your school to assign you. |
| `home.anyClass` | You can mark any class |
| `home.marks` / `home.noExams` | Marks entry / No exams are open for marks entry. |
| `home.subjects` / `home.noSubjects` | My subjects / No subjects assigned. |
| `home.more` | +{count} more |
| `home.returned` | {count} subjects were returned for correction |
| `home.savedData` | Showing saved data from {when} |
| `home.updated` | Updated {when} |
| `home.loadFailed` | Could not load this section. |
| `home.noAccess` | You don't have access to this section. |
| `home.progress.notStarted`, `.draft`, `.submitted`, `.returned` | Not started / Draft / Submitted / Returned |
| `shell.noFeatures` | No features are enabled for mobile at your school. Use the web app. |

Plurals: the local i18n helper has none. Word `home.returned` neutrally ("Returned for correction: {count}")
or add plural support — decide in review.

---

# 5. Build order

Each step ends green on `pnpm lint`, `pnpm typecheck`, `pnpm test`.

0. Preconditions (§0 item 4). On the test stack confirm with one live call: nullability of `sectionName`
   and `sessionName`, and the ordering of `classes`.
1. API layer: types, `portal.ts`, `settings.ts` + request tests.
2. `features/queries.ts`, `teacher/queries.ts`, `buildVisibilityContext` + `useVisibleFeatures` + test.
3. Shared UI: `Card`, `StatusBadge`, `Banner`, `QueryState`, `Screen` refresh.
4. `homeModel.ts` + tests; `formatTimestamp` + test.
5. `HomeScreen` + sections; i18n keys.
6. Manifest, registry, layout wiring, `app/teacher/index.tsx`.
7. Docs (§7).
8. Verify (§9).

---

# 6. Tests

Jest + Testing Library. No component tests exist yet — confirm the jest preset renders React Native in the
`jest` block of `package.json` before the first one.

- `homeModel.test.ts`: null submission → notStarted; counts; returned sorted first; class without section
  label; section-null key; `capList` more-count; empty inputs.
- `portal.test.ts` (pattern of `identity.test.ts`): URL is
  `<base>/portal/teacher/my-classes?date=2026-10-19&tenantId=…`, Bearer header present; a 403 body → `ApiError`
  with `status 403`.
- `buildVisibilityContext` / visibility: a mobile module `false` hides, a missing row shows, no permissions →
  empty list.
- `HomeScreen.test.tsx` (mock `src/api/portal`, wrap in `QueryClientProvider`): renders classes + exam cards;
  `restricted:false` banner and cap; `exams` 403 hides Marks; offline with cached data shows the saved-data
  banner; empty states; returned banner; no attendance CTA when `teacher.attendance` is not visible.
- Cache isolation: tenant A data is never read under tenant B — extend the existing `queryKeys` test with the
  new keys.

---

# 7. Docs to update

- `docs/project/project-status.md`: Home row, drift notes, gate record (the **owner** records B5/B6/B7 Implemented).
- `docs/domain/TEACHER_FEATURES.md` §2.1: Home is composed (my-classes + exams), no academic year, no done/pending.
- `docs/api/API_CONTRACT.md` §3: exact shapes of `my-classes` / `exams` as consumed.
- `docs/project/PHASE_PROMPTS.md` M2 prompt: remove `/portal/teacher/home`, `/assignments`, `/sections/:id/roster`.
- `docs/frontend/UI_SYSTEM.md` §2: mark `Card`, `StatusBadge`, `Banner`, `QueryState` built.
- **Protected — explicit approval needed before touching:** `docs/project/roadmap.md` §4 ("Home from one
  aggregated request"), `docs/architecture/FEATURE_MODULES.md` and `ARCHITECTURE.md` (`/portal/*/home`). They
  conflict with `API_CONTRACT.md` and the backend; report-only until approved.

---

# 8. Open items (not blockers for this slice)

- School timezone vs device timezone for "today" (`ATTENDANCE_INVALID_DATE` if the device is ahead): decide in
  the Attendance slice; ask the backend whether `my-classes` default-today should be used instead.
- Optional later backend request (`docs/backend/BACKEND_PREREQUISITES.md` format): `GET /portal/teacher/home`
  with attendance done / pending per section, if the request count or the missing status becomes a problem.
- `routes` in `FeatureManifest` is not consumed by expo-router file routing; keep it for now, review whether to
  drop it when the second feature lands.
- "+N more" lists were static in this slice. Since 2026-10-21 they link to My classes (`teacher.assignments`)
  when that tab is visible for the user, and stay plain text otherwise. The Marks list stays static until
  the Marks screen exists.

---

# 9. Verification

1. `pnpm lint`, `pnpm typecheck`, `pnpm test` (or `pnpm verify`). Report failures with output.
2. Run on Android against the **test stack** (PowerShell):
   `$env:EXPO_PUBLIC_API_URL = '<parallel test stack url>'; pnpm exec expo start`
3. Test accounts: (a) class teacher + subject teacher with an open exam; (b) `attendance.mark_any` admin
   (`restricted:false`, many sections); (c) teacher with `attendance.mark` only and no staff link (exams 403 →
   Marks hidden); (d) an exam with a returned subject.
4. Check: cold-start request count (about 4 new GETs), warm start 0, airplane mode shows the saved-data
   banner, pull-to-refresh, school switch shows no previous-school data, logout wipes the cache, light / dark,
   font scale 1.3, touch targets ≥ 44, Nepali strings.
5. Update `docs/project/project-status.md` only for what actually ran; never mark Home done because screens exist.
