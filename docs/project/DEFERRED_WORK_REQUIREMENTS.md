---
description: What must be decided and in place before three deferred items can start; the plain-403 cache wipe (mobile), row-level security on roles (backend ADR) and B11 teacher onboarding (backend and web).
purpose: Turn "what do we need to start X" into a checklist per item (decisions, preconditions, ordered work, tests, documents), so each can start the moment its decisions are made.
access: Read
---

# Requirements to Start the Deferred Items

## Status

Written 2026-10-22 on the owner's question. Item 1 (plain-403 cache wipe) is **implemented and verified by automated tests** (audit 2026-10-26); physical-device verification on a test stack remains pending. Items 2 and 3 remain unbuilt (audit 2026-10-25). Evidence is **Static** (read from code and
documents on 2026-10-22) unless a line says Reproduced; the Reproduced facts come from the live checks recorded in
`TEACHER_APP_PLAN.md` E9/E10 and `GUARDIAN_V1_PLAN.md` E-G1. Owner rules that apply: no ADR is marked Accepted by the
assistant; protected files change only on the owner's approval; a decision that touches architecture waits for the owner.

**Mobile-project audit (2026-10-26).** Item 1 is implemented and verified by automated tests: `src/api/client.ts` emits `forbidden` for eligible tenant-route 403 responses (excluding special codes, public requests, and `skipTenant` requests) bound to the originating tenant; `SessionEvents.tsx` handles the event with a per-tenant loop guard; and `removePersistedTenantQueries` in `src/lib/queryClient.ts` selectively clears the affected tenant's in-memory and persisted query cache while guarding against persistence race conditions and preserving other-tenant and user-scoped data. Physical-device verification on the owner's phone against a test backend remains pending. Items 2 and 3 are backend/web work and have no mobile implementation. The built `default_teacher` role (B12) does not
implement B11's atomic staff + login + membership + role onboarding flow.

**Decision reconciliation.** `V1_DELIVERY_PLAN.md` §11 (V-D3) records the owner's decision to wipe the school's cached data
on a plain 403, with a loop guard. That resolves the choice in §1.2 in favour of **option (a), literal wipe**; option (b)'s
permission re-check is not the selected behavior unless the owner revises the decision. This is an audit reconciliation of an
already-recorded owner decision, not a new decision. Implement the loop guard as part of item 1; do not let a refused request
cause an unbounded re-fetch/wipe cycle.

**Next work.** Item 1 is implemented and verified by automated tests; physical-device verification against the test backend remains pending. Independently, `V1_DELIVERY_PLAN.md` Phase 1 still makes the owner's Android test-stack
walkthrough the next project verification gate; that device run does not depend on any of these three items. Item 2 needs an
owner-requested backend ADR before code; item 3 needs the owner's B11-1…B11-6 answers and an accepted backend ADR before code.

| Item                           | Where                      | Needs an ADR                   | Needs an owner decision first        | Can the assistant start now                   | Size |
| ------------------------------ | -------------------------- | ------------------------------ | ------------------------------------ | --------------------------------------------- | ---- |
| 1. Plain-403 cache wipe        | mobile only                | no (it implements ADR-0065 D8) | **Answered:** V-D3 selects option (a) | **Implemented and automated-verified;** physical-device verification pending alongside general walkthrough | M    |
| 2. Row-level security on roles | backend (and test helpers) | **yes**, amending ADR-0033 D8  | the ADR itself (accept, then build)  | the ADR draft yes; code after acceptance      | L    |
| 3. B11 onboarding              | backend and web            | **yes**                        | scope and rules (§3.2)               | the ADR draft yes; code after acceptance      | L    |
| 4. B21 routine prerequisite    | mobile only (backend must implement first) | no (draft only) | **Answered:** draft defines `GET /portal/teacher/exam-routines` contract; backend must implement before mobile Phase 2 display work | Draft ready; backend implementation needed first | S    |

**Backend plan (2026-10-29).** Items 2 to 4 and the other open backend requests (B11, B13 to B15, B17 to B21) are now planned in the web/API repository, phase by phase, with their ADR drafts, tests and gates; see §5. The owner accepted B11-1…B11-6 as recommended and chose new `exam_result.read_any` / `attendance.read_any` keys for the read-scoping asks. Phases 1 to 5 are built there (2026-10-29; the dev API container was rebuilt the same day); phase 6 is planned.

The three are independent of each other. None of them blocks the marks phone run. Item 1 should land before Guardian V1
step G1, because a revoked guardian relies on it.

---

# 1. Plain-403 cache wipe (S-9 client half)

## 1.1 What exists

- **The rule it implements.** Backend ADR-0065 D8: the cache, the tokens and the tenant store are wiped on logout; a failed
  refresh (401); _"a 403 with `errorCode = TENANT_MEMBERSHIP_NOT_FOUND` **or any permission revocation**"_; and a school
  switch that changes the shell.
- **Implementation status (2026-10-26).** Implemented per V-D3 (option a). Eligible tenant-route 403 responses emit a tenant-bound `forbidden` event (`src/api/client.ts`), handled by `SessionEvents.tsx` using a per-tenant loop guard (`forbiddenTenants`). `removePersistedTenantQueries` in `src/lib/queryClient.ts` drops the tenant's queries in memory and rewrites the persisted cache snapshot in AsyncStorage with generation tracking, preventing reviving of wiped data by throttled writes or hydration. User-scoped (`_user`) and other-tenant queries are preserved.
- **Previous app behavior (prior to implementation).** `TENANT_MEMBERSHIP_NOT_FOUND` → `tenant-access-lost` → `dropSelectedSchool` (wipes that
  school's queries). Any other 403 mapped to `forbidden` without wiping cached reads, meaning persisted cached data remained visible.
- **The owner's answer (V-D3, 2026-10-22):** wipe the school's cached data on a plain 403, app-wide, with a loop guard.
- **Reproduced:** revoking a guardian's access made the _same_ access token get 403 on the next call at once (E-G1), so
  the server side of revocation is immediate; client reaction is now implemented.

## 1.2 Decision recorded and implementation consequence

A plain 403 is also the **normal, correct answer** for scope refusals, all seen live: a student outside the teacher's
classes (`studentInfo`), another section's roster, a subject that is not the teacher's, a wrong-section marks save, and a
guardian opening another family's child (E9, E-M2, E-G1). Wiping on every such refusal can clear useful school cache. ADR-0065 D8
uses the phrase "permission revocation", which a bare 403 does not prove.

The owner already answered this in `V1_DELIVERY_PLAN.md` §11 (V-D3): **wipe the selected school's cached data on every plain
403**, app-wide, with a loop guard. This is option (a); the answer is not still pending. Implement the literal behavior unless
the owner changes that recorded decision. The acknowledged consequence is loss of that school's cached data after ordinary
scope refusals; the guard must prevent a failing screen from creating an immediate refetch/wipe loop.

Option (b), re-reading `my-permissions` and `my-schools` and wiping only on a detected membership, permission or audience
change, was the earlier recommendation in this draft. It is **not** the selected behavior and should not be implemented as
a substitute for V-D3 without a new owner decision.

## 1.3 Preconditions

None on the backend (the 403 codes and the immediate revocation exist). No new package. No protected file _must_ change
(ARCHITECTURE §6 and AUTH_AND_SESSION §7 get one sentence each when it is built). Keep the mobile rule that the app's permission
checks are UX hints only.

## 1.4 Work, in order

1. **Event.** `src/api/client.ts` emits a new `forbidden` API event only for an eligible tenant-route 403, excluding handled
   membership, school/license, entitlement and audience codes. Do not react to public/identity requests, missing tenant
   context, or the handler's own work. (**Implemented:** `client.ts` binds `tenantId` from originating request, verifies `!options.public`, and excludes special codes).
2. **Handler and loop guard.** `SessionEvents` handles the event using the selected tenant from the session. Use a per-tenant
   single-flight/cooldown or equivalent guard, and suppress a retry loop from a screen that immediately re-fetches after its
   query is removed. This is a guard for the selected literal-wipe behavior, not an access revalidation. (**Implemented:** `SessionEvents.tsx` maintains `forbiddenTenants` guard set per tenant, cleared on school/session switch).
3. **Wipe.** Call `removeTenantQueries` for only the selected school, then ensure the persisted query-cache blob is rewritten
   or removed so a killed app cannot restore the wiped tenant data. Preserve unrelated tenant and user-scoped session data as
   required for the app to resolve the next shell; let `useSessionContext` re-resolve access. (**Implemented:** `removePersistedTenantQueries` in `src/lib/queryClient.ts` drops in-memory tenant queries and serializes clean snapshot to AsyncStorage with generation barrier).
4. **Guardian.** A 403 on a child id removes that child from the local list (`GUARDIAN_V1_PLAN.md` §3 item 4); that is
   Guardian work and is not part of this item.
5. **Remove** per-hook invalidations only if they become redundant; otherwise leave them. (**Preserved:** existing per-hook invalidations left intact as defense in depth).

## 1.5 Tests and evidence

- **Automated verification (2026-10-26):**
  - Focused suites passed: `client.test.ts` (tenant-bound forbidden emission, special code exclusions, skipTenant/public exclusions, delayed response tenant binding), `SessionEvents.test.tsx` (selected tenant matching, loop guard, stale/signed-out event suppression), `queryClient.test.ts` (selective tenant removal, preservation of other tenants and `_user` scope, generation-barrier protection against throttled-persist revival, hydration coordination), `queryKeys.test.ts` (tenant prefixing and removal), and `logout.test.ts` (complete cache removal).
  - Repository-wide test suite passed: 86 suites / 812 tests. Typecheck: 0 errors. Lint: 0 errors, 1 pre-existing warning in `CurvedHeader.tsx`.
- **Physical-device verification requirement (Pending):**
  - Not yet run on a physical device against a running test backend.
  - The owner's general Android walkthrough does not substitute for exercising the plain-403 cache wipe under live access revocation.
  - Verification checklist for the owner's phone run:
    1. Sign in to a test school and load tenant-scoped data.
    2. Trigger an eligible tenant-scoped 403 response through the test backend.
    3. Confirm that cached data for the affected school is removed and does not reappear after navigation or app restart.
    4. Confirm that unrelated tenant data and user/session state remain intact.
    5. Confirm that special authorization flows (`TENANT_MEMBERSHIP_NOT_FOUND`, `LICENSE_*`), school switching, and logout retain their existing behavior.
    6. Record actual device, test environment, scenario, observed result, and any failure.

## 1.6 Documents

`API_CONTRACT.md` §4 (`forbidden`), `AUTH_AND_SESSION.md` §7, `project-status.md`, protected `ARCHITECTURE.md` (one sentence in
the cache section). Backend ADR-0065 needs **no** change; this implements the owner's recorded V-D3 behavior.

## 1.7 Start condition

**Satisfied & Implemented:** V-D3 in `V1_DELIVERY_PLAN.md` records the owner's choice of option (a). Implementation and automated test verification are complete. Physical-device check on the owner's Android phone remains pending.

---

# 2. Row-level security on roles (backend ADR)

## 2.1 What exists (Reproduced / Static)

- **Reproduced:** `roles`, `role_permissions`, `permissions` and `membership_roles` have row-level security **off**. As the
  application role in school B's tenant context, `select key from roles` returned school A's custom role. API-level
  isolation holds (an invite or assignment with another school's key is refused), because of the application filter
  `tenant_id IS NULL OR tenant_id = :tenantId`.
- **Decision on record:** ADR-0033 D8 (Accepted): "No RLS is added to `roles`". `docs/security/rls/registry.yaml` has no entry
  for `roles`, `role_permissions` or `permissions` (`membership_roles` is recorded as deliberately outside RLS, ADR-0014).
- **Owner's wish (2026-10-22):** roles reach the mobile app "with RLS enabled". The mobile app never reads these tables; it
  reads permission keys from `GET /tenancy/my-permissions`, so it is unaffected either way.

## 2.2 Preconditions

1. **A new ADR** (Proposed → the owner accepts) that amends ADR-0033 D8. ADRs and the RLS registry are protected files in the
   web/API project; the assistant drafts, the owner accepts. No code before acceptance.
2. The owner's yes to the principle: defence in depth for tenant-owned rows that today rely on one query filter.

## 2.3 Design the ADR must settle (recommendations)

| Table              | Policy                                                                                                                                                            | Why                                                                                                                                                                                                                                                                     |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `roles`            | read: `tenant_id IS NULL OR tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid`; write (insert, update, delete): `tenant_id = that tenant` only | platform roles stay readable by every school and immutable by the application role (changed only by migrations, as superuser); custom roles are visible and writable only in their own school. Use the `NULLIF` guard of `memberships` so an unset setting fails closed |
| `role_permissions` | through its role: `EXISTS (select 1 from roles r where r.id = role_id)` (the `roles` policy applies inside)                                                       | it has no tenant column; adding one would duplicate a fact (single source of truth)                                                                                                                                                                                     |
| `permissions`      | no RLS; recorded in the registry as global reference data                                                                                                         | no tenant boundary exists                                                                                                                                                                                                                                               |
| `membership_roles` | unchanged (outside RLS, ADR-0014); optional join policy through `memberships`                                                                                     | already reachable only through a membership the `memberships` policy gates                                                                                                                                                                                              |

## 2.4 Code and test cost (the real size of this item)

- **Reads outside a tenant context (audited 2026-10-22).** Inside `withTenantContext`: `tenant-role.service`, `tenancy.service`
  (list, invite, assign), `membership-access`, `guardian-portal-access`, `tenant-authorization`. **Outside:**
  `backup/backup.service.ts` (the platform-wide export reads every role on the raw connection; the per-school branch also
  uses the raw connection) and `identity.service.findRolesByKeys` when called with the raw executor. Under RLS these see only
  platform roles. The established fix is the one `backup.service` already uses for other tables: iterate tenants and read
  inside `withTenantContext`. Activation, which has no tenant context, still finds the global `guardian` role because the
  read policy admits `tenant_id IS NULL`.
- **Test helper.** `test/helpers/roles.ts` `seedRole` inserts _global_ roles through the **application** connection. Under the
  write policy that is refused. **24 of the 102 e2e specs** use it. The helper must move to the owner connection
  (`runAsOwner`, which exists for TRUNCATE), and every spec using it must pass again. This is the main cost.
- **Registry and docs** (protected): `registry.yaml` entries for the three tables, `DATA_OWNERSHIP.md`, a security note.
- **New e2e:** a school cannot read, update or delete another school's custom role or its grants through the application
  role; platform roles stay readable; the guardian activation path works without a tenant context; platform admin flows.
- **Verification:** the full e2e suite, one spec per process (this table is used almost everywhere), then the dev database
  migration (the owner's step).

## 2.5 Work, in order

ADR (drafted by the assistant, accepted by the owner) → migration (`ENABLE` and `FORCE`, policies) → `backup` and
`findRolesByKeys` fixes → `seedRole` on the owner connection → registry and docs → new e2e → full e2e run → owner applies
to dev.

## 2.6 Start condition

**The owner asks for the ADR draft** (a protected-file change in the web/API project, so it needs their word) and, later,
accepts it. Mobile impact: none.

---

# 3. B11 teacher onboarding (backend and web, ADR)

## 3.1 What exists

- **Three separate steps today (ADR-0062):** Staff page creates a `staff_members` row; Team page invites or directly creates
  the user, membership and roles; the account is then linked to the staff row by hand (`PUT /staff/:id/membership`; only an
  active, non-guardian membership is linkable). Nothing ties them together.
- **The role gap is closed** by `default_teacher` (migration 0236, 2026-10-22). What remains is the _one flow_.
- **Why it cannot be a thin wrapper (Static):** `StaffService.create` and `TenancyService.inviteMember` each open their own
  `withTenantContext` transaction. Calling them one after the other is not atomic: a failed link after a successful invite
  leaves a login with no staff row. Atomicity needs variants that accept the caller's transaction (an `…InTx` pair), or the
  orchestrating service must own the single transaction and call lower-level helpers. That is a module-boundary decision
  (rule 12: cross-module interaction only through public services and contracts).
- Existing building blocks that already behave correctly: `maxUsers` is checked on invite
  (`TENANT_MAX_USERS_REACHED`, 409); an existing person (a teacher joining a second school) gets a membership without a new
  user; delivery of the activation token is out of band (no e-mail service).

## 3.2 Decisions needed from the owner (recommendations)

| #     | Decision                           | Recommendation                                                                                                                                                                                      |
| ----- | ---------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| B11-1 | Scope: teachers only, or any staff | **Any staff type**; the web form offers `default_teacher` as the default role for teaching staff and none for others. Teacher _assignments_ stay a separate step (they depend on the academic year) |
| B11-2 | Login mode                         | **Invite** (activation token handed over out of band, as today); direct create with an administrator-typed password stays available but is not the default                                          |
| B11-3 | Licence rule                       | The flow refuses with a clear message when the school has no active licence (it applies to platform administrators too, who bypass the route guard)                                                 |
| B11-4 | Permission                         | Require **both** `staff.manage` and `identity.manage_members`; no new permission key                                                                                                                |
| B11-5 | Idempotency                        | An idempotency key on the request (rule 10); a repeat returns the first result and creates nothing twice                                                                                            |
| B11-6 | Confirmation screen                | Show the activation code once, whether the account is active, and which mobile modules the role reaches (the optional third part of B11)                                                            |

## 3.3 Preconditions

1. **A new ADR** (new endpoint, cross-module orchestration, a combination of two permissions, a single audit entry) — Proposed,
   accepted by the owner.
2. B11-1 to B11-6 answered (the ADR carries them).
3. `default_teacher` applied to the development database (done 2026-10-22).

## 3.4 Work, in order

ADR → transaction-accepting variants in `StaffService` and the membership services (no behaviour change; existing specs stay
green) → the orchestrating endpoint (proposed `POST /staff/onboard`) with one audit entry (`staff.onboard`) next to the
existing ones → ENDPOINTS → e2e → web: an "Add staff with login" action on the Staff page, showing the result of B11-6 → web
tests → owner applies nothing to the dev database (no migration unless the ADR adds a table; it should not).

## 3.5 Tests

e2e: a complete success (staff row, login, membership, role, link, one audit trail); **rollback** when any step fails (no
orphan user, membership or staff row); idempotent replay; no licence; `maxUsers` reached; an existing person in a second
school; each missing permission; a guardian-only account is not linkable; role keys that do not exist. Web: form states and
the one-time code display.

## 3.6 Start condition

**The owner asks for the ADR draft and answers B11-1 to B11-6** (or accepts the recommendations). Mobile impact: none to the
contract; the activation screen for staff stays on the web.

---

# 4. Suggested order

1. Run the marks / teacher Android walkthrough on the test stack (independent of all three deferred items; owner-run per D10).
2. Item 1 (plain-403 school-cache wipe) is implemented and automated-verified; physical-device verification against the test stack remains to be exercised before Guardian V1 G1.
3. Ask for the two backend ADR drafts (items 2 and 3) when ready; they can be written in parallel and accepted separately. Item 3 also needs B11-1…B11-6 answered before implementation.
4. Guardian V1 G0/G1 only after the phone run / Phase 2 gate (`GUARDIAN_V1_PLAN.md`), preferably after item 1.

---

# 5. Backend implementation plan (web/API repository)

Written 2026-10-29 at the owner's request. The backend design, phases, tests, ADR drafts and gates live in the web/API repository and are **not copied here** (that repository is the authority for backend design, and a copy would drift):

`zn-school-platform-v1/docs/project/implementation-plan/mobile-deferred-backend-implementation-plan.md` (companion: `mobile-deferred-backend-protected-doc-proposals.md`, same folder).

| Phase | Mobile ask | Backend ADR (provisional, Proposed once drafted) | State |
| --- | --- | --- | --- |
| 1 | B14-B, B17 F-1/F-2: scope exam-result, exam-roster and attendance-report reads by assignment, with new keys `exam_result.read_any` and `attendance.read_any` | 0077 | ADR Accepted 2026-10-29; **built 2026-10-29** (migration `0248` on the test and dev database; the dev API container was rebuilt 2026-10-29) |
| 2 | B14-A (`isOptional`, `includeInResults`), B14-C (stable code), B18 (`componentType`), **B21** (`GET /portal/teacher/exam-routines`, item 4 above) | 0078 | ADR Accepted 2026-10-29; **built 2026-10-29** (no schema; in the dev API container since its rebuild on 2026-10-29) |
| 3 | B19 (holiday notifications), B20 (`referenceDate` on a notification) | 0078 | ADR Accepted 2026-10-29; **built 2026-10-29** (migration 0249 on the test and development databases; the dev API image was rebuilt 2026-10-29) |
| 4 | Item 2 / B13: row-level security on roles | 0079 | ADR Accepted 2026-10-29 (option B for the school switcher; no `membership_roles` policy); **built 2026-10-29** (migration 0250 on the test and development databases, dev API image rebuilt; the app never reads these tables, so nothing changes for it) |
| 5 | Item 3 / B11: atomic staff onboarding (`POST /staff/onboard`) | 0080 | ADR Accepted 2026-10-29; **built 2026-10-29** in the web repo (no schema; served by the dev API since its rebuild on 2026-10-29; the app does not call it, only the web Staff page) |
| 6 | B15: guardian PDFs, guardian advance pool, school currency, attendance labels for guardians | 0081 | The phone-run gate is cleared (owner's word, 2026-10-31); ADR-0081 **Accepted 2026-10-31**; backend built 2026-10-31 in the web repository (`0b25e1a`, `c18a63b`); mobile screens in a later mobile stage. Several linked students needs no new endpoint (`GET /portal/guardian/students` already lists them all and the link is proven per request); no web guardian UI is built |
| 7 | Staff invitation code re-issue and a place to enter it (found while testing B11) | 0082 | ADR-0082 **Accepted 2026-10-31**; backend and a small web drawer, no mobile work |

**Owner decisions recorded 2026-10-29.** B11-1…B11-6 accepted as recommended (§3.2). Read scoping uses new keys copied by migration to every current holder of the matching read key except the platform role `default_teacher`. The plan covers all four tracks. B9 (read replica) stays not built.

**What changes for the app, when each phase lands (phases 1 to 5 are built in the backend and the dev API container was rebuilt on 2026-10-29, so the dev API serves them; none of it has been run on a phone):** `componentType`, `isOptional`, `includeInResults` and a stable `code` on marks failures arrive as added fields; `GET /portal/notifications` gains `referenceDate` and a holiday notification `type` (the bell must tolerate an unknown type); `GET /portal/teacher/exam-routines` appears for a future routine screen; teachers with the default role see only their own classes on the web-open reads (the phone already calls only scoped routes). `API_CONTRACT.md` is synced by hand in the same phase as each endpoint. Building these mobile pieces needs its own go-ahead.

**Rule unchanged.** No backend code is written from this repository (D1). The plan and proposals files were written in the web/API repository at the owner's request.
