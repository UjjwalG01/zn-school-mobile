---
description: Detailed implementation plan for student attendance marking (teacher.attendance) — class list, roster, school-defined statuses, one bulk submit with an idempotency key, refused-batch and conflict handling.
purpose: Give a code-level plan (decisions, backend contract, files, code, tests, docs, verification) so the Attendance slice can be built from this document alone once the owner approves §0.2.
access: Read
---

# Teacher Attendance — Implementation Plan

## Status

**Drafted 2026-10-21. D1–D5 approved as recommended by the owner on 2026-10-21; built the same day (steps
1–8), unit-tested, not yet run on the test stack or a device (§9 open).** Deviation from §3: manifest `order`
is 15 (tab order Home, Attendance, My classes), not 30. Belongs to M2
(`docs/project/roadmap.md` §4, third bullet), feature `teacher.attendance`. It is the first **write** flow in
the app, so it also fixes the pattern Marks will reuse (draft, version, idempotency key, refusal display).

Docs read for this plan: `CLAUDE.md`, `.claude/rules/*`, `docs/project/{project-status,roadmap,PHASE_PROMPTS,TEACHER_HOME_PLAN}.md`,
`docs/domain/TEACHER_FEATURES.md` §2.3, `docs/api/API_CONTRACT.md`, `docs/architecture/{ARCHITECTURE,FEATURE_MODULES}.md`,
`docs/frontend/UI_SYSTEM.md`; in the backend repo `docs/api/ENDPOINTS.md` §7 / §7e **and the code behind it**
(`apps/api/src/attendance/{attendance.service.ts,dto/mark-attendance.dto.ts}`,
`common/{bulk-operation.util.ts,batch-idempotency.util.ts}`), because the docs and the code disagree in one place (§0 item 2).

---

# 0. Context and findings that shape the plan

Home and My classes are built and share one cached `GET /portal/teacher/my-classes` response. Home's
Attendance cards are deliberately not pressable yet ("the CTA is wired when the Attendance slice lands").
This slice adds the roster, the marking UI and the save.

## 0.1 Findings (verified against backend code, 2026-10-21)

1. **Everything needed already exists.** `GET /attendance/roster`, `GET /attendance/settings`,
   `POST /attendance/records/bulk`. No backend change, no new endpoint. The roster is served by the primary
   database (`withTenantContext(this.db, …)`; `READ_DB` does not exist yet), so read-after-write
   (`api-and-data.md` §7) holds.
2. **A stale `version` inside a bulk save is NOT an HTTP 409.** `applyRows` validates every row and throws
   `VERSION_CONFLICT_MESSAGE` as that row's failure, so it comes back as a **2xx**
   `{ ok:false, failures:[{ identifier:{ studentId, row }, error }] }`. `error` is an English sentence with
   **no `errorCode`**. The other per-row failures are also bare sentences ("already listed in row N", "no
   enrollment in the academic year…", "not currently placed in this class/section", "already recorded under
   another class/section", "academic year is locked", "enrollment ended on…", "{label} is not in use at this
   school"). `validateAllOrFail` returns **all** failing rows in one response.
   The rule "branch on `errorCode`, never on `message`" therefore leaves the app one safe option: show each
   `error` verbatim as a reason (display only) and detect conflicts **from data** — compare the roster's
   `record.version` with the version the draft was based on (§3.5). The docs' "409 → refetch and ask to
   re-apply" still applies, but only to the three true 409s below.
3. **True 409s:** `CONCURRENCY_VERSION_CONFLICT` (a race after validation), `ATTENDANCE_ALREADY_RECORDED`
   (two simultaneous first saves), and the same idempotency key with a different body (a bare
   `ConflictException`, **no `errorCode`**). `errorAction()` maps only the first to `conflict`, so the other
   two would fall to `unknown`. Plan: map **any 409** to `conflict` (§3.2).
4. **`version` semantics:** `0` = "I saw no record"; omitted = no check, last write wins. The app always sends
   it. The batch fingerprint covers date, class, section, reason and every row's `studentId, status, remarks,
   version` (order-insensitive), so a key may be reused **only** for a byte-identical payload.
5. **Date rules are request-level** (whole request fails): future/invalid date → 400 `ATTENDANCE_INVALID_DATE`;
   weekly off or holiday → 400; older than `backdateWindowDays` → needs `attendance.correct` (403) **and** a
   `reason` ≥ 5 chars (400); caller not the active class teacher and no `attendance.mark_any` → 403.
6. **Limits:** 1–200 rows per request (`MAX_ATTENDANCE_BULK_ROWS`, one transaction). `tenantId` goes in the
   **query only**; the DTO has no `tenantId`, so it must not be added to the body. A class with no sections
   omits `sectionId`.
7. **Unchanged rows are a no-op** (`outcome:'unchanged'`, no write, no audit), and a row whose status the
   school switched off cannot be newly used.
8. **Permissions:** roster and settings need `attendance.read`, save needs `attendance.mark`. Migration 0214
   granted `read` to every role that held `mark`, so `requiredPermission: 'attendance.mark'` is a correct UX
   hint; a later custom role with `mark` but no `read` gets a 403 on the roster ("no access", handled).
9. **Known backend gap (report only):** `rosterOn` ignores the caller (`_user`), so a `restricted` teacher can
   read any section's roster by id. Writes are scoped (403). The app only requests placements from
   `my-classes`. See §8.
10. **No UUID source on the device.** The key must be a UUID (`@IsUUID()`). `crypto.randomUUID` is not defined
    by Expo's `winter` polyfills or by React Native (searched `node_modules`); `expo-crypto` and `uuid` are not
    dependencies. Jest runs in Node, where `crypto.randomUUID` exists, so a green test proves nothing about the
    phone (§9 checks it). See D2.
11. **No NetInfo / expo-network.** "Offline" is only discovered when a request fails with status 0. That is
    enough for this slice: the save is the connectivity test, it is never auto-retried, and the draft and key
    are kept (§3.7).

## 0.2 Decisions needed from the owner (CLAUDE.md §4: navigation and a new dependency are approval items)

| # | Decision | Options | Recommendation | Consequence of the recommendation |
| --- | --- | --- | --- | --- |
| **D1** | Navigation inside the Attendance tab | **A** one screen: class chips/picker + date + roster. **B** nested stack: class list → roster screen. | **B** | Back gesture and an "unsaved changes" prompt are natural; Home's Attendance cards deep-link straight to a roster; a single-class teacher is redirected past the list. Costs one small manifest field (`stack`) and a layout tweak so the tab header is hidden for the nested stack. A is simpler but needs a picker for admins with `restricted:false` (30+ sections). |
| **D2** | Where the idempotency UUID comes from | **A** `src/lib/uuid.ts`: `crypto.randomUUID` → `getRandomValues` → `Math.random` v4, no dependency. **B** add `expo-crypto` (`Crypto.randomUUID()`). | **A** | No native module, no dev-client rebuild, no approval gate. The key is a dedupe token, not a secret (the server matches key + body fingerprint inside the tenant), so uniqueness is what matters. Weak point: on a runtime without `crypto` the `Math.random` path is not unpredictable. Choose B if you want cryptographic randomness (adds a native module). |
| **D3** | What "today" means | **A** device-local `todayIso()` (as Home). **B** school timezone from `GET /settings/tenant` via `Intl` (Hermes `Intl` unverified). | **A** | Wrong only when the phone's timezone is ahead of the school's around midnight; the backend then refuses with `ATTENDANCE_INVALID_DATE`, nothing is written, and the teacher steps back a day. Resolves the open item in `TEACHER_HOME_PLAN.md` §8. |
| **D4** | Past dates in v1 | **A** stop at the backdate window. **B** also build the correction flow (reason field + `attendance.correct`). | **A** | The stepper's lower bound is `today − backdateWindowDays` (from settings; a UX hint, the backend decides at the edge). Correcting older dates stays on web; add later as its own slice. |
| **D5** | A holiday / weekly off (`dayInfo.schoolDay === false`) | **A** show the roster read-only with a banner. **B** leave marking enabled and let the backend refuse. | **A** | The backend refuses every write on such a day (finding 5), so the teacher is not made to mark 40 students and then fail. It only reads what the API returned (`dayInfo`); it does not re-implement the calendar. |

---

# 1. What the teacher sees (content spec)

```text
Tab "Attendance" → class list (stack index)
┌ Header "Attendance"                                   [Switch to Guardian]
│ [info Banner] You can mark any class                  (only when restricted:false)
│ Card  Class 8 · A                              ›      ← my-classes.classes[] (same cached call as Home)
│ Card  Class 6                                  ›      (class with no sections: no " · section")
│ empty: "No classes assigned. Ask your school to assign you."
└ exactly one placement → opens its roster directly (router.replace)

Roster screen (stack, title = placement label)
┌ [‹ back]  Class 8 · A
│ [‹]  2026-10-21  ·  2083-07-04 (muted)  [›]            ← DateStepper (≤ today, ≥ today − backdateWindowDays)
│ [warning Banner] Holiday: Dashain. Attendance cannot be marked.    (dayInfo.schoolDay=false → read-only)
│ [info Banner]    Showing saved data from 09:42. Connect to save.   (refetch failed offline, roster cached)
│ [warning Banner] <backend message>                                 (request-level refusal: date / reason / 403)
│ Present 32 · Absent 3 · Late 1 · Not marked 4                      ← counts of the draft, school labels
│ [ Mark remaining present ]                                         (only if `present` is active)
│ ┌ row (FlatList, key = studentId) ───────────────────────────────
│ │ 12  Sita Sharma                         ADM-0412
│ │ [P] [A] [L] [HD] [E]     ← school shortCodes, inactive statuses not offered; selected = filled + label below
│ │ Present
│ │ Add remark            ► TextField (≤ 255)
│ │ <backend reason>                                  (danger caption, after a refused batch)
│ │ Changed by someone else — now Absent. Yours: Present   [Keep mine] [Use theirs]   (version mismatch)
│ └────────────────────────────────────────────────────────────────
└ sticky bar:  [ Save attendance (5) ]   hint: "No changes to save" / "Resolve the highlighted students first"
```

| Block | Source | Rules |
| --- | --- | --- |
| Class list | `useTeacherMyClasses(todayIso())` | no extra request when Home already loaded it; `restricted:false` banner; backend order |
| Date | `DateStepper` + `formatDate` / `formatAlternateDate` | display follows the tenant calendar; the value stays AD `YYYY-MM-DD`; bounds per D3/D4 |
| Day banner | `roster.dayInfo` | `reason` `holiday` shows `holidayName`; `weekly_off` / unknown reason → generic text; read-only (D5) |
| Status buttons | `GET /attendance/settings` `statuses` | `active` only, ordered by `sortOrder`, text = `shortCode`, accessibility label = `label`; a saved status that is now inactive still **displays** its label but cannot be newly picked |
| Counts | the draft merged over the roster | counts, not rules |
| Mark remaining present | draft | sets `present` on rows with **no saved record and no draft entry**; never overwrites a saved or edited row |
| Save | draft diff | sends **only changed/new rows**; so a conflict can only arise on a row the teacher touched |
| Status colour | fixed enum → tone | present success · absent danger · late / half_day warning · excused neutral; the text is always shown |

**Request budget:** open a class cold = roster + settings (2 GETs; `my-classes` is already cached). Warm = 0.
Each new date = 1 roster GET (cached per date). Save = **1 POST and 0 refetches** (the cache is patched from the
response, §3.8). A refused batch = 1 roster + 1 settings GET. Pull-to-refresh = roster + settings. No polling.

---

# 2. Backend contract used

| Call | Permission | Used fields |
| --- | --- | --- |
| `GET /attendance/roster?date=&classId=&sectionId?&tenantId=` | `attendance.read` | `{ date, dayInfo:{ schoolDay, reason, holidayName }, rows:[{ enrollmentId, studentId, fullName, admissionNumber, rollNumber, record:{ id, status, remarks, version } \| null }] }`. Omit `sectionId` for a class without sections |
| `GET /attendance/settings?tenantId=` | `attendance.read` | `{ backdateWindowDays, statuses:[{ status, label, shortCode, sortOrder, active }] }` (weights and thresholds are not used) |
| `POST /attendance/records/bulk?tenantId=` | `attendance.mark` | body `{ idempotencyKey, attendanceDate, classId, sectionId?, records:[{ studentId, status, remarks?, version }] }`; 201 `{ ok:true, replayed, results:[{ studentId, id, version, outcome }] }` or 2xx `{ ok:false, failures }` |

Outcome handling (reuse `errorActionOf`; **one** new mapping — §3.2):

| Result | Behavior | Key | Draft |
| --- | --- | --- | --- |
| 2xx `ok:true` | patch roster cache from `results`, clear draft, toast "Attendance saved" | drop | cleared |
| 2xx `ok:false` | per-student reasons under the rows, banner "Nothing was saved…", refetch roster + settings | drop | kept |
| `offline` (status 0, incl. timeout) | banner "No connection. Your changes are kept…" | **keep** (outcome unknown) | kept |
| `server` (5xx) | "Could not save, try again" | **keep** | kept |
| `conflict` (any 409) | refetch roster; version mismatches then show as conflicts (§3.5) | drop | kept |
| `validation` (400) | banner with the backend `message` (date rule, holiday, reason) | drop | kept |
| `forbidden` (403) | "You can't mark this class" + refetch `my-classes` and `my-permissions` | drop | kept |
| `feature-denied` | refresh my-schools (existing hook) | drop | kept |
| `wait` (429) | wait message, no auto retry | drop | kept |
| `session-expired`, `drop-school`, `school-suspended`, `license-blocked` | handled globally by `SessionEvents` | — | lost with the screen |

---

# 3. Code plan (new / changed files)

Folder note (as Home): `src/features/teacher/attendance/`, manifest id `teacher.attendance`.

```text
NEW   src/api/types/attendance.ts                 roster / settings / bulk types
NEW   src/api/attendance.ts                       getAttendanceRoster, getAttendanceSettings, postBulkAttendance
NEW   src/lib/uuid.ts                             newUuid()                              (D2)
EDIT  src/lib/date.ts                             + shiftIsoDate(iso, days)  (no inline date math in screens)
EDIT  src/api/errors.ts                           any 409 → 'conflict'
NEW   src/features/teacher/attendance/
        manifest.ts                               spreads TEACHER_ATTENDANCE_ACCESS
        queries.ts                                useAttendanceRoster, useAttendanceSettings (+ keys)
        attendanceModel.ts                        PURE: draft, payload, signature, conflicts, counts, cache patch
        useAttendanceDraft.ts                     useReducer over the model
        useSubmitAttendance.ts                    mutation + key lifecycle + outcome classification
        ClassListScreen.tsx
        RosterScreen.tsx
        components/{StatusPicker,AttendanceRow}.tsx
NEW   src/components/DateStepper.tsx              shared (value, min, max, calendar, onChange)
EDIT  src/components/ListScreen.tsx               + optional `footer` rendered under the list (sticky save bar)
EDIT  src/features/types.ts                       FeatureManifest.stack?: boolean         (D1)
EDIT  src/features/registry.ts                    + teacherAttendanceFeature
EDIT  app/teacher/_layout.tsx                     headerShown:false for `stack` features
NEW   app/teacher/attendance/{_layout,index,roster}.tsx   Stack + two re-export route files   (D1)
EDIT  src/features/teacher/home/sections/AttendanceSection.tsx   cards open the roster; "+N more" → tab
EDIT  src/i18n/en.ts, ne.ts                       new keys (both required: ne is Record<MessageKey,string>)
```

Reuse check (CLAUDE.md reuse-first): reused as-is — `apiGet` / `apiPost`, `tenantKey`, `STALE_TIME`,
`useSession`, `useTeacherMyClasses`, `placementLabel`, `TEACHER_ATTENDANCE_ACCESS`, `Card`, `Banner`,
`StatusBadge`, `Button`, `TextField`, `Text`, `QueryState` / `queryView`, `OfflineBanner` / `savedDataTimestamp`,
`showToast`, `ListScreen`, `useManualRefresh`,
`useRefreshSchoolsOnFeatureDenied`, `errorActionOf`, `formatDate`, `formatAlternateDate`, `todayIso`,
`formatTimestamp`, `t`. New code is limited to what none of these cover: the attendance API/types, the draft model,
the UUID, the stepper, the row UI. **Why new, not generic:** `StatusPicker` / `AttendanceRow` depend on the school's
status settings and are specific to this feature; `DateStepper` is generic by props and lives in `src/components`
(Marks and the guardian month view will use it).

## 3.1 `src/api/types/attendance.ts` and `src/api/attendance.ts`

```ts
// Hand-written from backend ENDPOINTS.md §7 and attendance.service.ts (A6). Only fields the app uses.
export type AttendanceStatus = 'present' | 'absent' | 'late' | 'half_day' | 'excused';

export interface AttendanceStatusSetting {
  status: AttendanceStatus;
  label: string;      // school-defined; never hardcode a label
  shortCode: string;  // 1–5 chars
  sortOrder: number;
  active: boolean;
}
export interface AttendanceSettings { backdateWindowDays: number; statuses: AttendanceStatusSetting[] }

export interface DayInfo { schoolDay: boolean; reason: 'weekly_off' | 'holiday' | null; holidayName: string | null }
export interface RosterRecord { id: string; status: AttendanceStatus; remarks: string | null; version: number }
export interface RosterRow {
  enrollmentId: string;
  studentId: string;
  fullName: string;
  admissionNumber: string;
  rollNumber: number | string | null; // confirm type / nullability on a live response (§5 step 0)
  record: RosterRecord | null;        // null = nothing saved that day → send version 0
}
export interface AttendanceRoster { date: string; dayInfo: DayInfo; rows: RosterRow[] }

export interface BulkAttendanceRow { studentId: string; status: AttendanceStatus; remarks?: string; version: number }
export interface BulkAttendanceRequest {
  idempotencyKey: string;
  attendanceDate: string;
  classId: string;
  sectionId?: string; // omitted for a class without sections; NO tenantId in the body (query only)
  records: BulkAttendanceRow[];
}
export interface BulkRowResult { studentId: string; id: string; version: number; outcome: 'created' | 'updated' | 'unchanged' }
export interface BulkRowFailure { identifier: { studentId: string; row: number }; error: string }
export type BulkAttendanceResult =
  | { ok: true; replayed: boolean; results: BulkRowResult[] }
  | { ok: false; failures: BulkRowFailure[] }; // 2xx: nothing was written
```

```ts
// src/api/attendance.ts
export interface RosterQuery { date: string; classId: string; sectionId: string | null }

export const getAttendanceRoster = ({ date, classId, sectionId }: RosterQuery) => {
  const parts = [`date=${encodeURIComponent(date)}`, `classId=${encodeURIComponent(classId)}`];
  if (sectionId) parts.push(`sectionId=${encodeURIComponent(sectionId)}`);
  return apiGet<AttendanceRoster>(`/attendance/roster?${parts.join('&')}`);
};
export const getAttendanceSettings = () => apiGet<AttendanceSettings>('/attendance/settings');
/** A refused batch is a 2xx `{ ok:false }`, not an ApiError — the caller must branch on `ok`. */
export const postBulkAttendance = (body: BulkAttendanceRequest) =>
  apiPost<BulkAttendanceResult>('/attendance/records/bulk', body);
```

## 3.2 `src/api/errors.ts` — one mapping change

```ts
if (errorCode === 'CONCURRENCY_VERSION_CONFLICT' || status === 409) return 'conflict';
```

Every 409 in this contract means "something changed or the key was reused: refetch and re-apply".
`ATTENDANCE_ALREADY_RECORDED` and the code-less idempotency 409 now land here. Extend `errors.test.ts`; update
`API_CONTRACT.md` §4 (the `CONCURRENCY_VERSION_CONFLICT` row). Note for review: this is a shared function.

## 3.3 `src/lib/uuid.ts` (D2 = A)

```ts
/** RFC 4122 v4. Used only as an idempotency key (a dedupe token, not a secret). Prefers the platform CSPRNG. */
export function newUuid(): string {
  const c = globalThis.crypto as Crypto | undefined;
  if (typeof c?.randomUUID === 'function') return c.randomUUID();
  const bytes = new Uint8Array(16);
  if (typeof c?.getRandomValues === 'function') c.getRandomValues(bytes);
  else for (let i = 0; i < 16; i += 1) bytes[i] = Math.floor(Math.random() * 256);
  bytes[6] = (bytes[6]! & 0x0f) | 0x40; // version 4
  bytes[8] = (bytes[8]! & 0x3f) | 0x80; // variant 10
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
```

## 3.4 `src/lib/date.ts` addition

```ts
/** AD ISO date moved by whole days (negative = earlier). Local date parts, never UTC. */
export function shiftIsoDate(iso: string, days: number): string;
```

Built on `new Date(y, m-1, d + days)` + `toIsoDate`. Test across a month, a year and (for BS display) a month boundary.

## 3.5 `attendanceModel.ts` (pure, unit-tested — the heart of the slice)

```ts
export const MAX_BULK_ROWS = 200; // transport limit mirrored from the backend DTO, not a business rule

/** What the teacher changed for one student. `baseVersion` = the version of the saved record the teacher SAW. */
export interface DraftEntry { status: AttendanceStatus; remarks: string; baseVersion: number }
export type Draft = Readonly<Record<string, DraftEntry>>; // key = studentId

const savedVersion = (row: RosterRow) => row.record?.version ?? 0;

export function effective(row: RosterRow, draft: Draft): { status: AttendanceStatus | null; remarks: string };
export function isChanged(entry: DraftEntry, row: RosterRow): boolean; // status or trimmed remarks differ from saved

export function setStatus(draft: Draft, row: RosterRow, status: AttendanceStatus): Draft;
//  new entry: baseVersion = savedVersion(row); existing entry keeps its baseVersion;
//  an entry equal to the saved record is removed (no phantom change).
export function setRemarks(draft: Draft, row: RosterRow, remarks: string): Draft;
export function markRemainingPresent(draft: Draft, rows: readonly RosterRow[]): Draft; // rows with no record and no entry

/** Rows whose server version moved since the teacher edited them → must be resolved before saving. */
export function conflictIds(rows: readonly RosterRow[], draft: Draft): string[];
export const keepMine = (draft: Draft, row: RosterRow): Draft => /* baseVersion := savedVersion(row) */;
export const useServer = (draft: Draft, studentId: string): Draft => /* delete the entry */;

export function changedCount(rows: readonly RosterRow[], draft: Draft): number;
export function buildBulkRows(rows: readonly RosterRow[], draft: Draft): BulkAttendanceRow[];
//  only changed entries, roster order, { studentId, status, remarks?: trimmed non-empty, version: baseVersion }

/** Canonical text of everything the backend fingerprints, WITHOUT the key. Order-insensitive. */
export function payloadSignature(p: Omit<BulkAttendanceRequest, 'idempotencyKey'>): string;

export interface PendingAttempt { signature: string; key: string }
/** Same signature → same key (retry of an identical payload); any edit → a new key. */
export function attemptFor(signature: string, pending: PendingAttempt | null, makeKey: () => string): PendingAttempt;
/** Keep the key only when the server may have processed the request (outcome unknown). */
export const keepKeyAfter = (action: ApiErrorAction): boolean => action === 'offline' || action === 'server';

export const failuresByStudent = (f: readonly BulkRowFailure[]): Record<string, string> => /* studentId → error */;

export function statusOptions(s: AttendanceSettings): AttendanceStatusSetting[]; // active, sortOrder asc
export function labelFor(s: AttendanceSettings, status: AttendanceStatus): string; // includes inactive; falls back to status

export interface Counts { byStatus: Partial<Record<AttendanceStatus, number>>; notMarked: number }
export function summarize(rows: readonly RosterRow[], draft: Draft): Counts;

/** Use the write response instead of a refetch (api-and-data §7). */
export function applySaved(roster: AttendanceRoster, draft: Draft, results: readonly BulkRowResult[]): AttendanceRoster;
//  for each result: record = { id, status/remarks from draft (trimmed, '' → null), version }; 'unchanged' keeps the row

export const MARK_TONE: Record<AttendanceStatus, BadgeTone> = { present: 'success', absent: 'danger', late: 'warning', half_day: 'warning', excused: 'neutral' };
```

Why `baseVersion`: the draft remembers the version it was made against, so a background refetch (foreground
refetch after 60 s, pull-to-refresh) or another user's save makes the mismatch visible **before** submit, with the
same mechanism that explains a refused batch afterwards. **Never auto-overwrite:** a conflicted row blocks Save
until the teacher chooses `Keep mine` (rebase) or `Use theirs` (drop the edit).

## 3.6 Queries

```ts
export const attendanceRosterKey = (tenantId: string | null, q: RosterQuery) =>
  tenantId ? tenantKey(tenantId, 'attendance', 'roster', q.date, q.classId, q.sectionId ?? 'none')
           : userKey('attendance-roster', 'no-school');
export const attendanceSettingsKey = (tenantId: string | null) =>
  tenantId ? tenantKey(tenantId, 'attendance', 'settings') : userKey('attendance-settings', 'no-school');

export function useAttendanceRoster(q: RosterQuery | null) { /* STALE_TIME.daily, enabled: tenantId && q */ }
export function useAttendanceSettings()                    { /* STALE_TIME.reference */ }
```

No new staleTime class. Roster = Daily (5 min, persisted, wiped on logout and school switch by key prefix).
Settings = Reference (6 h); a stale label is corrected on pull-to-refresh and after any refused batch.
The persisted roster contains student names; that is the existing Daily-class policy (`api-and-data.md` §5) and it is
wiped on logout.

## 3.7 `useSubmitAttendance.ts`

```ts
export function useSubmitAttendance(ctx: { classId: string; sectionId: string | null; date: string }) {
  const queryClient = useQueryClient();
  const attempt = useRef<PendingAttempt | null>(null);
  const inFlight = useRef(false); // guards the one-frame gap before `isPending` re-renders
  const mutation = useMutation({ mutationFn: postBulkAttendance });

  async function submit(rows: RosterRow[], draft: Draft): Promise<SubmitOutcome> {
    if (inFlight.current) return { kind: 'ignored' };
    const records = buildBulkRows(rows, draft);
    const base = { attendanceDate: ctx.date, classId: ctx.classId, ...(ctx.sectionId ? { sectionId: ctx.sectionId } : {}), records };
    attempt.current = attemptFor(payloadSignature(base), attempt.current, newUuid);
    inFlight.current = true;
    try {
      const result = await mutation.mutateAsync({ ...base, idempotencyKey: attempt.current.key });
      attempt.current = null; // 2xx (saved or refused): the key is spent
      if (result.ok) { patchRosterCache(queryClient, ctx, draft, result.results); return { kind: 'saved', replayed: result.replayed }; }
      return { kind: 'refused', failures: failuresByStudent(result.failures) };
    } catch (error) {
      const action = errorActionOf(error);
      if (!keepKeyAfter(action)) attempt.current = null;
      return { kind: 'error', action, message: error instanceof ApiError ? error.message : '' };
    } finally { inFlight.current = false; }
  }
  return { submit, isPending: mutation.isPending };
}
```

- Nothing here retries a POST (the client never does). The only retry is the teacher pressing Save again.
- **Why the key rule is safe:** after a timeout the first request may have committed. The retry carries the same
  key and the same body → the backend returns the stored result with `replayed:true` (serialized by an advisory
  lock, so a retry cannot race the original). After any edit the signature changes → a new key.
- The screen reacts to the outcome: `saved` → toast + clear draft; `refused` → keep draft, store `failures`,
  refetch roster and settings; `error` → table in §2.
- `patchRosterCache` = `queryClient.setQueryData(attendanceRosterKey(...), (r) => r && applySaved(r, draft, results))`.
  Only the roster key of this class/date is touched; no other key is invalidated.

## 3.8 Screens (structure)

```tsx
// RosterScreen.tsx
export default function RosterScreen() {
  const { classId, sectionId, date: dateParam } = useLocalSearchParams<{ classId: string; sectionId?: string; date?: string }>();
  const [date, setDate] = useState(dateParam ?? todayIso());
  const placement = { date, classId, sectionId: sectionId ?? null };
  const roster = useAttendanceRoster(placement);
  const settings = useAttendanceSettings();
  const calendar = useTenantSettings().data?.calendarPreference;
  const { draft, dispatch } = useAttendanceDraft();           // useReducer over the model
  const { submit, isPending } = useSubmitAttendance(placement);
  const [failures, setFailures] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState<Notice | null>(null);  // request-level refusal / offline text
  useRefreshSchoolsOnFeatureDenied(roster.error, settings.error);
  const { refreshing, onRefresh } = useManualRefresh(() => Promise.all([roster.refetch(), settings.refetch()]));
  // Loading / error / no-access via queryView on BOTH queries; content only when roster AND settings exist.
  // readOnly = !roster.data.dayInfo.schoolDay.   canSave = changed > 0 && no conflicts && !readOnly && rows ≤ MAX_BULK_ROWS && !isPending.
  return (
    <ListScreen sections={[{ data: rows }]} keyExtractor={(r) => r.studentId} /* FlatList tuning below */
      ListHeaderComponent={/* DateStepper, banners, counts, Mark remaining present */}
      renderItem={({ item }) => <AttendanceRow row={item} … />}
      footer={<Button title={t('attendance.save', { count })} loading={isPending} disabled={!canSave} onPress={onSave} />} />
  );
}
```

- **Draft lifetime:** component state only (memory), as `TEACHER_FEATURES` §2.3 says. Changing the date or leaving
  the screen with unsaved changes asks `Alert.alert` ("Discard changes?"); no new component. A school switch
  unmounts the screen (the draft goes with it; keys are tenant-prefixed anyway).
- **List performance (rule: never `ScrollView` + `map` for rosters):** virtualized list, `keyExtractor=studentId`,
  `AttendanceRow` in `React.memo`, callbacks keyed by `studentId` (dispatch-based) so one tap re-renders one row,
  `initialNumToRender≈12`, `windowSize≈7`. Verify on a low-end Android profile (§9).
- **Accessibility:** each status button ≥ 44 pt, `accessibilityLabel` = the school's full `label`,
  `accessibilityState.selected`; the selected status also prints its label under the buttons (colour is never the
  only signal); the save bar sits above the Android navigation bar (safe area).
- `ClassListScreen`: `useTeacherMyClasses(todayIso())`, `ListScreen` of pressable `Card`s
  (`router.push({ pathname: '/teacher/attendance/roster', params: { classId, sectionId, date } })`),
  `<Redirect>` to the roster when there is exactly one placement.
- `AttendanceSection` (Home): `Card onPress` → the same push; `onMore` → the Attendance tab.

## 3.9 Manifest, registry, layout, routes

```ts
// manifest.ts — spreads the access rule Home already uses, so it has one source (access.ts header comment)
export const teacherAttendanceFeature: FeatureManifest = {
  ...TEACHER_ATTENDANCE_ACCESS,            // audience, attendance.mark, academic, mobileModuleKey 'attendance'
  id: 'teacher.attendance', title: 'attendance.title', icon: 'calendar-check',
  placement: 'tab', order: 30, stack: true,
  routes: () => import('./ClassListScreen'),
};
```

- `FeatureManifest.stack?: boolean` — "the route is a nested stack with its own header": `app/teacher/_layout.tsx`
  adds `headerShown: false` for such a tab; non-stack features keep their exact current options (the existing layout
  test stays valid). `routeName('teacher.attendance')` is still `attendance` (a directory with `_layout` is a valid
  tab route name).
- `app/teacher/attendance/_layout.tsx` = a `Stack` (`headerRight: ShellSwitcher` on the list screen).
  `index.tsx` and `roster.tsx` are re-exports, as for the other features.
- **Protected-doc note:** the new manifest field belongs in `docs/architecture/FEATURE_MODULES.md` §2. That folder is
  protected, so the edit is listed for approval, not made.

---

# 4. i18n keys

Add to `en.ts` and `ne.ts` (Nepali drafted and flagged "needs native review", like the rest). Neutral wording
instead of plurals (the helper has none).

| Key | English |
| --- | --- |
| `attendance.title` | Attendance |
| `attendance.openClass` | Open attendance for {name} |
| `attendance.prevDay` / `attendance.nextDay` | Previous day / Next day |
| `attendance.dayHoliday` / `attendance.dayWeeklyOff` / `attendance.dayOff` | Holiday: {name}. Attendance cannot be marked. / Weekly off. Attendance cannot be marked. / Not a school day. Attendance cannot be marked. |
| `attendance.markRemaining` | Mark remaining present |
| `attendance.notMarked` | Not marked |
| `attendance.roll` | Roll {number} |
| `attendance.addRemark` / `attendance.remark` | Add remark / Remark |
| `attendance.save` | Save attendance ({count}) |
| `attendance.saved` | Attendance saved |
| `attendance.noChanges` | No changes to save |
| `attendance.resolveFirst` | Resolve the highlighted students first |
| `attendance.conflict` | Changed by someone else. Now: {server}. Yours: {mine} |
| `attendance.keepMine` / `attendance.useTheirs` | Keep mine / Use theirs |
| `attendance.refused` | Nothing was saved. Check the students below and save again. |
| `attendance.offlineKept` | No connection. Your changes are kept. Save again when you are online. |
| `attendance.saveFailed` | Could not save. Your changes are kept. Try again. |
| `attendance.forbidden` | You can't mark attendance for this class. |
| `attendance.empty` | No students are enrolled in this class on this date. |
| `attendance.tooMany` | This class has too many students to save at once. Use the web app. |
| `attendance.discardTitle` / `attendance.discardBody` | Discard changes? / Your unsaved attendance will be lost. |
| `attendance.discard` / `attendance.keepEditing` | Discard / Keep editing |

Backend `error` / `message` texts are English only and are shown as returned (§8, backend request 1).

---

# 5. Build order

Each step ends green on `pnpm lint`, `pnpm typecheck`, `pnpm test`.

0. Preconditions: owner answers D1–D5; one live call on the **test stack** for roster and settings to confirm
   `rollNumber` type/nullability, `remarks` null vs `""`, `sectionId` for a class without sections, the status list
   and the real `backdateWindowDays`. `showToast`, `OfflineBanner` and the error boundary exist (M1 part A,
   built 2026-10-21); the slice uses `showToast(t('attendance.saved'), 'success')` and
   `<OfflineBanner asOf={savedDataTimestamp([roster, settings])} />` instead of its own copies.
1. API layer: types, `attendance.ts`, `errorAction` 409 + tests.
2. `uuid.ts`, `shiftIsoDate` + tests.
3. `attendanceModel.ts` + tests (the logic is finished and proven before any UI exists).
4. `queries.ts`, `useAttendanceDraft`, `useSubmitAttendance` + tests.
5. Shared UI: `DateStepper`, `ListScreen` footer; `StatusPicker`, `AttendanceRow`.
6. `ClassListScreen`, `RosterScreen`, i18n keys.
7. Manifest, registry, `stack` flag, route files, layout, Home card links.
8. Docs (§7).
9. Verify (§9).

---

# 6. Tests

Jest + Testing Library (patterns of `HomeScreen.test.tsx`, `teacher-layout.test.tsx`).

- `attendanceModel.test.ts`: `setStatus` captures `baseVersion` once and keeps it; an edit equal to the saved record
  disappears; `markRemainingPresent` skips saved and edited rows and does nothing when `present` is inactive;
  `buildBulkRows` sends only changed rows, `version 0` for no record, no empty `remarks`, trimmed remarks, roster
  order; `conflictIds` flags a moved version and nothing else; `keepMine` / `useServer`; `payloadSignature` is
  order-insensitive and changes with any status / remark / version / date / section; `attemptFor` reuses the key for
  an identical signature and replaces it after an edit; `keepKeyAfter` (offline, server → true; others → false);
  `statusOptions` hides inactive and sorts; `labelFor` still resolves an inactive status; `summarize`;
  `applySaved` (created, updated, unchanged); 201 rows → not saveable.
- `uuid.test.ts`: v4 shape, 1,000 unique values, and the `getRandomValues` and `Math.random` fallbacks (stub
  `globalThis.crypto`).
- `attendance.test.ts` (pattern of `portal.test.ts`): roster URL with and without `sectionId`, settings URL, POST path
  `…/attendance/records/bulk?tenantId=…`, **body has no `tenantId`**, Bearer header present; a 2xx
  `{ ok:false }` resolves (is not an `ApiError`).
- `errors.test.ts`: any 409 → `conflict`, including a 409 with no `errorCode`.
- `useSubmitAttendance` (or RosterScreen): **duplicate tap** posts once; offline then retry reuses the **same key**;
  edit then retry uses a **new key**; success and 4xx drop the key; 5xx keeps it; `replayed:true` shows the saved toast.
- `RosterScreen.test.tsx` (mock `src/api/attendance`): renders the school's renamed labels and hides an inactive
  status; mark remaining present → one POST with the expected rows; **`ok:false`** shows each reason under its
  student, keeps the draft and refetches roster + settings; **version conflict** after refetch blocks Save until
  `Keep mine` / `Use theirs`; non-school-day banner and read-only; offline with cached roster shows the saved-data
  banner; 403 on the roster → no-access text; 403 on save → forbidden text and no draft loss; discard prompt on date
  change; cache patched after save (no extra GET).
- `ClassListScreen.test.tsx`: placements listed, press pushes the roster route with params, `restricted:false`
  banner, exactly one placement redirects, empty state.
- `teacher-layout.test.tsx`: the Attendance tab appears with `attendance.mark` + `academic` + module visible and is
  `href:null` without; a `stack` tab gets `headerShown:false`.
- `HomeScreen.test.tsx`: Attendance card press opens the roster route.
- `queryKeys` test: roster and settings keys are tenant-prefixed (no cross-school read).
- `DateStepper.test.tsx` and `date.test.ts` (`shiftIsoDate`).

---

# 7. Docs to update

- `docs/project/project-status.md`: Attendance row, decisions D1–D5 in the decisions log (when answered). Record only
  what actually ran; never mark Attendance done because screens exist.
- `docs/domain/TEACHER_FEATURES.md` §2.3: version conflicts in a bulk save arrive as `ok:false` failures (not 409);
  non-school day is read-only; past dates stop at the backdate window; the draft/`baseVersion` rule.
- `docs/api/API_CONTRACT.md` §2 / §4: roster and settings fields used, the failure shape, "any 409 → conflict".
- `docs/project/PHASE_PROMPTS.md` M2 task 3: add "a stale `version` is a per-row failure, not a 409" and link this plan.
- `docs/frontend/UI_SYSTEM.md` §2: `DateStepper` built; `ListScreen` footer.
- **Protected — explicit approval needed before touching:** `docs/architecture/FEATURE_MODULES.md` §2 (the `stack`
  manifest field). Report-only until approved. `docs/project/roadmap.md` is not touched.

---

# 8. Open items and backend requests (none block this slice)

Backend requests, in `docs/backend/BACKEND_PREREQUISITES.md` format when the owner wants them filed (that file is
protected; this plan only lists them):

1. **Stable `code` on bulk failure items** (e.g. `ATTENDANCE_VERSION_CONFLICT`, `ATTENDANCE_STATUS_NOT_IN_USE`) next
   to `error`. Today the app cannot localize reasons or recognize a version conflict from the response itself, so it
   shows English text and derives conflicts from versions. Optional; the design works without it.
2. **Scope `GET /attendance/roster` by assignment** for callers without `attendance.mark_any` (finding 9). Security
   hygiene; the app is unaffected.
3. Same-key/different-body 409 carries no `errorCode` (docs say 409; code is a bare `ConflictException`). Cosmetic.

App-side:

- A section with more than 200 students cannot be saved (one transaction, all-or-nothing, so the app must not
  chunk). The UI says so and points to the web app. Confirm the largest real section.
- Backdate boundary: whether `today − backdateWindowDays` itself is inside the window is the backend's call; the
  app allows it and shows the backend's answer.
- Device timezone vs school timezone: D3.
- Offline detection is "the last request failed with status 0". If the owner later wants a proactive indicator,
  that needs `@react-native-community/netinfo` or `expo-network` (a native module → approval).
- Teacher self attendance (`teacher.selfAttendance`) stays after v1 (owner decision 2026-10-18).

---

# 9. Verification

1. `pnpm lint`, `pnpm typecheck`, `pnpm test` (or `pnpm verify`). Report failures with output.
2. Run on Android against the **test stack** (PowerShell):
   `$env:EXPO_PUBLIC_API_URL = '<parallel test stack url>'; pnpm exec expo start`
   Never against a production school.
3. Test accounts: (a) active class teacher of a section **and** of a class without sections; (b) `attendance.mark_any`
   admin (`restricted:false`, many sections); (c) subject teacher who is not a class teacher (save → 403);
   (d) a role with `attendance.mark` but not `attendance.read` (roster 403).
4. Check: **`crypto.randomUUID` presence on the device** (log once in a dev build, then remove) and that the key
   passes the backend's `@IsUUID()`; cold open = roster + settings only; warm = 0; save = exactly one POST and no
   GET; a holiday and a weekly-off date (read-only banner); the backdate edge; **double tap on Save** (one request);
   airplane mode: save → "connection" message, draft kept, reconnect, save again (check the audit/`replayed`);
   two devices editing the same section (conflict flow); the school renames and deactivates a status; 40+ students
   scroll on a low-end Android profile; font scale 1.3; touch targets ≥ 44; light / dark; BS calendar display;
   Nepali strings; school switch and logout leave no previous-school roster behind.
5. Security review: the draft lives only in memory; no student name, remark or key in logs; the roster cache is wiped
   on logout / school switch; tenant id only from `my-schools`; guardian shell never reaches these screens.
6. Update `docs/project/project-status.md` only for what actually ran.
