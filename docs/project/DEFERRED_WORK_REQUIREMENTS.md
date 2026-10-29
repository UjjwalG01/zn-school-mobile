---
description: What must be decided and in place before three deferred items can start; the plain-403 cache wipe (mobile), row-level security on roles (backend ADR) and B11 teacher onboarding (backend and web).
purpose: Turn "what do we need to start X" into a checklist per item (decisions, preconditions, ordered work, tests, documents), so each can start the moment its decisions are made.
access: Read
---

# Requirements to Start the Deferred Items

## Status

Written 2026-10-22 on the owner's question. **None of the three deferred items is implemented** (audit 2026-10-25). Evidence is **Static** (read from code and
documents on 2026-10-22) unless a line says Reproduced; the Reproduced facts come from the live checks recorded in
`TEACHER_APP_PLAN.md` E9/E10 and `GUARDIAN_V1_PLAN.md` E-G1. Owner rules that apply: no ADR is marked Accepted by the
assistant; protected files change only on the owner's approval; a decision that touches architecture waits for the owner.

**Mobile-project audit (2026-10-25).** Item 1 is still missing: a tenant-scoped 403 maps to `forbidden`, but the app does not
revalidate access or remove that school's cached queries app-wide. Current write hooks invalidate selected queries only; a
read may continue to display persisted cached data. No code or test was found for `revalidateAccess` or a global 403 wipe.
Items 2 and 3 are backend/web work and have no mobile implementation. The built `default_teacher` role (B12) does not
implement B11's atomic staff + login + membership + role onboarding flow.

**Decision reconciliation.** `V1_DELIVERY_PLAN.md` §11 (V-D3) records the owner's decision to wipe the school's cached data
on a plain 403, with a loop guard. That resolves the choice in §1.2 in favour of **option (a), literal wipe**; option (b)'s
permission re-check is not the selected behavior unless the owner revises the decision. This is an audit reconciliation of an
already-recorded owner decision, not a new decision. Implement the loop guard as part of item 1; do not let a refused request
cause an unbounded re-fetch/wipe cycle.

**Next work.** The next mobile implementation from this requirements plan is item 1 (plain-403 school cache wipe), which
should land before Guardian V1 G1. Independently, `V1_DELIVERY_PLAN.md` Phase 1 still makes the owner's Android test-stack
walkthrough the next project verification gate; that device run does not depend on any of these three items. Item 2 needs an
owner-requested backend ADR before code; item 3 needs the owner's B11-1…B11-6 answers and an accepted backend ADR before code.

| Item                           | Where                      | Needs an ADR                   | Needs an owner decision first        | Can the assistant start now                   | Size |
| ------------------------------ | -------------------------- | ------------------------------ | ------------------------------------ | --------------------------------------------- | ---- |
| 1. Plain-403 cache wipe        | mobile only                | no (it implements ADR-0065 D8) | **Answered:** V-D3 selects option (a) | yes; implement the selected behavior in §1.4 | M    |
| 2. Row-level security on roles | backend (and test helpers) | **yes**, amending ADR-0033 D8  | the ADR itself (accept, then build)  | the ADR draft yes; code after acceptance      | L    |
| 3. B11 onboarding              | backend and web            | **yes**                        | scope and rules (§3.2)               | the ADR draft yes; code after acceptance      | L    |

**Backend plan (2026-10-29).** Items 2 to 4 and the other open backend requests (B11, B13 to B15, B17 to B21) are now planned in the web/API repository, phase by phase, with their ADR drafts, tests and gates; see §5. The owner accepted B11-1…B11-6 as recommended and chose new `exam_result.read_any` / `attendance.read_any` keys for the read-scoping asks. Phases 1 to 3 are built there (2026-10-29; the dev API container is not yet rebuilt); phases 4 to 6 are planned.

The three are independent of each other. None of them blocks the marks phone run. Item 1 should land before Guardian V1
step G1, because a revoked guardian relies on it.

---

# 1. Plain-403 cache wipe (S-9 client half)

## 1.1 What exists

- **The rule it implements.** Backend ADR-0065 D8: the cache, the tokens and the tenant store are wiped on logout; a failed
  refresh (401); _"a 403 with `errorCode = TENANT_MEMBERSHIP_NOT_FOUND` **or any permission revocation**"_; and a school
  switch that changes the shell.
- **What the app does today.** `TENANT_MEMBERSHIP_NOT_FOUND` → `tenant-access-lost` → `dropSelectedSchool` (wipes that
  school's queries). Any other 403 is `forbidden`: the write hooks only _invalidate_ `my-permissions` (and, for marks,
  the exam list and `my-classes`); reads show "no access" or keep **cached data on screen** (`queryView`: cached data
  always wins; the persisted cache lives 7 days). So a revoked teacher or guardian keeps seeing what they last loaded.
- **The owner's answer (V-D3, 2026-10-22):** wipe the school's cached data on a plain 403, app-wide, with a loop guard.
- **Reproduced:** revoking a guardian's access made the _same_ access token get 403 on the next call at once (E-G1), so
  the server side of revocation is immediate; only the client reaction is missing.

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
   context, or the handler's own work.
2. **Handler and loop guard.** `SessionEvents` handles the event using the selected tenant from the session. Use a per-tenant
   single-flight/cooldown or equivalent guard, and suppress a retry loop from a screen that immediately re-fetches after its
   query is removed. This is a guard for the selected literal-wipe behavior, not an access revalidation.
3. **Wipe.** Call `removeTenantQueries` for only the selected school, then ensure the persisted query-cache blob is rewritten
   or removed so a killed app cannot restore the wiped tenant data. Preserve unrelated tenant and user-scoped session data as
   required for the app to resolve the next shell; let `useSessionContext` re-resolve access.
4. **Guardian.** A 403 on a child id removes that child from the local list (`GUARDIAN_V1_PLAN.md` §3 item 4); that is
   Guardian work and is not part of this item.
5. **Remove** per-hook invalidations only if they become redundant; otherwise leave them.

## 1.5 Tests and evidence

Unit: eligible plain 403 removes only the selected tenant's queries; the loop guard prevents repeated refetch/wipe; special
membership, school/license, entitlement and audience errors retain their existing handling; user-scoped and other-tenant data
remain intact; the persisted cache cannot restore wiped rows; sign-out and school switch remain unchanged. Live (HTTP, test
stack): exercise a representative scope 403 and access revocation response; distinguish server behavior from the app reaction.
Phone: revoke while a screen is open (the owner's run).

## 1.6 Documents

`API_CONTRACT.md` §4 (`forbidden`), `AUTH_AND_SESSION.md` §7, `project-status.md`, protected `ARCHITECTURE.md` (one sentence in
the cache section). Backend ADR-0065 needs **no** change; this implements the owner's recorded V-D3 behavior.

## 1.7 Start condition

**Satisfied:** V-D3 in `V1_DELIVERY_PLAN.md` records the owner's choice of option (a). Item 1 can start in the mobile repo; its
acceptance criteria are in §1.5. Do not start the backend items from this repo.

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
2. Implement item 1 (plain-403 school-cache wipe) in the mobile repo; V-D3 has already answered the decision and it should land before Guardian V1 G1.
3. Ask for the two backend ADR drafts (items 2 and 3) when ready; they can be written in parallel and accepted separately. Item 3 also needs B11-1…B11-6 answered before implementation.
4. Guardian V1 G0/G1 only after the phone run / Phase 2 gate (`GUARDIAN_V1_PLAN.md`), preferably after item 1.

---

# 5. Backend implementation plan (web/API repository)

Written 2026-10-29 at the owner's request. The backend design, phases, tests, ADR drafts and gates live in the web/API repository and are **not copied here** (that repository is the authority for backend design, and a copy would drift):

`zn-school-platform-v1/docs/project/implementation-plan/mobile-deferred-backend-implementation-plan.md` (companion: `mobile-deferred-backend-protected-doc-proposals.md`, same folder).

| Phase | Mobile ask | Backend ADR (provisional, Proposed once drafted) | State |
| --- | --- | --- | --- |
| 1 | B14-B, B17 F-1/F-2: scope exam-result, exam-roster and attendance-report reads by assignment, with new keys `exam_result.read_any` and `attendance.read_any` | 0077 | ADR Accepted 2026-10-29; **built 2026-10-29** (migration `0248` on the test and dev database; the dev API container is not yet rebuilt) |
| 2 | B14-A (`isOptional`, `includeInResults`), B14-C (stable code), B18 (`componentType`), **B21** (`GET /portal/teacher/exam-routines`, item 4 above) | 0078 | ADR Accepted 2026-10-29; **built 2026-10-29** (no schema; not yet deployed to the dev API container) |
| 3 | B19 (holiday notifications), B20 (`referenceDate` on a notification) | 0078 | ADR Accepted 2026-10-29; **built 2026-10-29** (migration 0249 on the test and development databases; the dev API image is not rebuilt) |
| 4 | Item 2 / B13: row-level security on roles | 0079 | Planned; ADR first |
| 5 | Item 3 / B11: atomic staff onboarding (`POST /staff/onboard`) | 0080 | Planned; ADR first |
| 6 | B15: guardian PDFs, guardian advance pool, school currency, attendance labels for guardians | 0081 | Planned; gated on the teacher phone run |

**Owner decisions recorded 2026-10-29.** B11-1…B11-6 accepted as recommended (§3.2). Read scoping uses new keys copied by migration to every current holder of the matching read key except the platform role `default_teacher`. The plan covers all four tracks. B9 (read replica) stays not built.

**What changes for the app, when each phase lands (phases 1 to 3 are built in the backend, but the dev API container is not yet rebuilt, so the app sees none of it yet):** `componentType`, `isOptional`, `includeInResults` and a stable `code` on marks failures arrive as added fields; `GET /portal/notifications` gains `referenceDate` and a holiday notification `type` (the bell must tolerate an unknown type); `GET /portal/teacher/exam-routines` appears for a future routine screen; teachers with the default role see only their own classes on the web-open reads (the phone already calls only scoped routes). `API_CONTRACT.md` is synced by hand in the same phase as each endpoint. Building these mobile pieces needs its own go-ahead.

**Rule unchanged.** No backend code is written from this repository (D1). The plan and proposals files were written in the web/API repository at the owner's request.
