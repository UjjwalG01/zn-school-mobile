---
description: What must be decided and in place before three deferred items can start: the plain-403 cache wipe (mobile), row-level security on roles (backend ADR) and B11 teacher onboarding (backend and web).
purpose: Turn "what do we need to start X" into a checklist per item (decisions, preconditions, ordered work, tests, documents), so each can start the moment its decisions are made.
access: Read
---

# Requirements to Start the Deferred Items

## Status

Written 2026-10-22 on the owner's question. **Nothing here is started.** Evidence is **Static** (read from code and
documents on 2026-10-22) unless a line says Reproduced; the Reproduced facts come from the live checks recorded in
`TEACHER_APP_PLAN.md` E9/E10 and `GUARDIAN_V1_PLAN.md` E-G1. Owner rules that apply: no ADR is marked Accepted by the
assistant; protected files change only on the owner's approval; a decision that touches architecture waits for the owner.

| Item | Where | Needs an ADR | Needs an owner decision first | Can the assistant start now | Size |
| --- | --- | --- | --- | --- | --- |
| 1. Plain-403 cache wipe | mobile only | no (it implements ADR-0065 D8) | **one** (rule, §1.2) | yes, once §1.2 is answered | M |
| 2. Row-level security on roles | backend (and test helpers) | **yes**, amending ADR-0033 D8 | the ADR itself (accept, then build) | the ADR draft yes; code after acceptance | L |
| 3. B11 onboarding | backend and web | **yes** | scope and rules (§3.2) | the ADR draft yes; code after acceptance | L |

The three are independent of each other. None of them blocks the marks phone run. Item 1 should land before Guardian V1
step G1, because a revoked guardian relies on it.

---

# 1. Plain-403 cache wipe (S-9 client half)

## 1.1 What exists

- **The rule it implements.** Backend ADR-0065 D8: the cache, the tokens and the tenant store are wiped on logout; a failed
  refresh (401); *"a 403 with `errorCode = TENANT_MEMBERSHIP_NOT_FOUND` **or any permission revocation**"*; and a school
  switch that changes the shell.
- **What the app does today.** `TENANT_MEMBERSHIP_NOT_FOUND` → `tenant-access-lost` → `dropSelectedSchool` (wipes that
  school's queries). Any other 403 is `forbidden`: the write hooks only *invalidate* `my-permissions` (and, for marks,
  the exam list and `my-classes`); reads show "no access" or keep **cached data on screen** (`queryView`: cached data
  always wins; the persisted cache lives 7 days). So a revoked teacher or guardian keeps seeing what they last loaded.
- **The owner's answer (V-D3, 2026-10-22):** wipe the school's cached data on a plain 403, app-wide, with a loop guard.
- **Reproduced:** revoking a guardian's access made the *same* access token get 403 on the next call at once (E-G1), so
  the server side of revocation is immediate; only the client reaction is missing.

## 1.2 The one decision that is needed (and why the literal rule is risky)

A plain 403 is also the **normal, correct answer** for scope refusals, all seen live: a student outside the teacher's
classes (`studentInfo`), another section's roster, a subject that is not the teacher's, a wrong-section marks save, and a
guardian opening another family's child (E9, E-M2, E-G1). The literal rule would wipe the whole school's cache each time a
teacher taps a student they may not see. ADR-0065 D8's own words are "permission **revocation**", which a bare 403 does not
prove.

| Option | Behaviour | Cost |
| --- | --- | --- |
| (a) Literal | wipe the school's queries on every plain 403 | simple; loses the cache on harmless refusals; a screen that keeps failing re-fetches after each wipe, so it needs the loop guard to be strict |
| (b) **Recommended** | on a plain 403, re-read `my-permissions` and `my-schools` once; wipe **only if** the membership is gone, the permission keys lost something, or the audience changed; otherwise keep the cache and show the screen's own message | a little more code; matches D8's wording; no wipe loops, because the re-check is one request per school per cooldown |

**Decision needed from the owner: (a) or (b).** Everything below is written for (b); (a) is the same work without the
re-check.

## 1.3 Preconditions

None on the backend (the 403 codes and the immediate revocation exist). No new package. No protected file *must* change
(ARCHITECTURE §6 and AUTH_AND_SESSION §7 get one sentence each when it is built). Keep the mobile rule that the app's permission
checks are UX hints only.

## 1.4 Work, in order

1. **Event.** `src/api/client.ts` emits a new `forbidden` API event for a tenant-route 403 that is not already one of the
   handled codes (`TENANT_*`, `LICENSE_*`, `ENTITLEMENT_DENIED`, `TENANT_AUDIENCE_DENIED` stays a plain forbidden); not for the
   re-check's own requests.
2. **Handler.** `SessionEvents` calls a new `revalidateAccess(queryClient)` in `src/auth/schoolActions.ts`: single-flight,
   cooldown (proposed 30 s per school), fetch `my-permissions` and `my-schools` fresh, compare with the cached values.
3. **Wipe.** On revocation: `removeTenantQueries` for the school except the fresh session queries, drop the persisted copy
   (the persister rewrites within its 2 s throttle; force one write so a killed app cannot restore the old blob), and let
   `useSessionContext` re-resolve the shell (it ends on "Use the web app" or "No school access").
4. **Guardian.** A 403 on a child id removes that child from the local list (`GUARDIAN_V1_PLAN.md` §3 item 4); that is
   Guardian work and is not part of this item.
5. **Remove** the per-hook invalidations that this replaces only if they become redundant; otherwise leave them.

## 1.5 Tests and evidence

Unit: a scope 403 with unchanged permissions keeps the cache (b); lost keys wipe it; lost membership wipes it; the cooldown
and single-flight; the re-check's own 403 does not re-enter; the session queries survive; the persisted cache is rewritten;
sign-out and school switch unchanged. Live (HTTP, test stack): revoke a role, make one refused call, and read the
permissions answer the app would act on. Phone: revoke while a screen is open (the owner's run).

## 1.6 Documents

`API_CONTRACT.md` §4 (`forbidden`), `AUTH_AND_SESSION.md` §7, `project-status.md`, protected `ARCHITECTURE.md` (one sentence in
the cache section). Backend ADR-0065 needs **no** change under option (b).

## 1.7 Start condition

**The owner answers §1.2. Then it can start immediately.**

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

| Table | Policy | Why |
| --- | --- | --- |
| `roles` | read: `tenant_id IS NULL OR tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid`; write (insert, update, delete): `tenant_id = that tenant` only | platform roles stay readable by every school and immutable by the application role (changed only by migrations, as superuser); custom roles are visible and writable only in their own school. Use the `NULLIF` guard of `memberships` so an unset setting fails closed |
| `role_permissions` | through its role: `EXISTS (select 1 from roles r where r.id = role_id)` (the `roles` policy applies inside) | it has no tenant column; adding one would duplicate a fact (single source of truth) |
| `permissions` | no RLS; recorded in the registry as global reference data | no tenant boundary exists |
| `membership_roles` | unchanged (outside RLS, ADR-0014); optional join policy through `memberships` | already reachable only through a membership the `memberships` policy gates |

## 2.4 Code and test cost (the real size of this item)

- **Reads outside a tenant context (audited 2026-10-22).** Inside `withTenantContext`: `tenant-role.service`, `tenancy.service`
  (list, invite, assign), `membership-access`, `guardian-portal-access`, `tenant-authorization`. **Outside:**
  `backup/backup.service.ts` (the platform-wide export reads every role on the raw connection; the per-school branch also
  uses the raw connection) and `identity.service.findRolesByKeys` when called with the raw executor. Under RLS these see only
  platform roles. The established fix is the one `backup.service` already uses for other tables: iterate tenants and read
  inside `withTenantContext`. Activation, which has no tenant context, still finds the global `guardian` role because the
  read policy admits `tenant_id IS NULL`.
- **Test helper.** `test/helpers/roles.ts` `seedRole` inserts *global* roles through the **application** connection. Under the
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
- **The role gap is closed** by `default_teacher` (migration 0236, 2026-10-22). What remains is the *one flow*.
- **Why it cannot be a thin wrapper (Static):** `StaffService.create` and `TenancyService.inviteMember` each open their own
  `withTenantContext` transaction. Calling them one after the other is not atomic: a failed link after a successful invite
  leaves a login with no staff row. Atomicity needs variants that accept the caller's transaction (an `…InTx` pair), or the
  orchestrating service must own the single transaction and call lower-level helpers. That is a module-boundary decision
  (rule 12: cross-module interaction only through public services and contracts).
- Existing building blocks that already behave correctly: `maxUsers` is checked on invite
  (`TENANT_MAX_USERS_REACHED`, 409); an existing person (a teacher joining a second school) gets a membership without a new
  user; delivery of the activation token is out of band (no e-mail service).

## 3.2 Decisions needed from the owner (recommendations)

| # | Decision | Recommendation |
| --- | --- | --- |
| B11-1 | Scope: teachers only, or any staff | **Any staff type**; the web form offers `default_teacher` as the default role for teaching staff and none for others. Teacher *assignments* stay a separate step (they depend on the academic year) |
| B11-2 | Login mode | **Invite** (activation token handed over out of band, as today); direct create with an administrator-typed password stays available but is not the default |
| B11-3 | Licence rule | The flow refuses with a clear message when the school has no active licence (it applies to platform administrators too, who bypass the route guard) |
| B11-4 | Permission | Require **both** `staff.manage` and `identity.manage_members`; no new permission key |
| B11-5 | Idempotency | An idempotency key on the request (rule 10); a repeat returns the first result and creates nothing twice |
| B11-6 | Confirmation screen | Show the activation code once, whether the account is active, and which mobile modules the role reaches (the optional third part of B11) |

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

1. Answer §1.2 (cache wipe rule) → the assistant builds item 1 (mobile only, no ADR).
2. Run the marks phone run (independent of all three).
3. Ask for the two ADR drafts (items 2 and 3) when ready; they can be written in parallel and accepted separately.
4. Guardian V1 G0/G1 after the phone run (`GUARDIAN_V1_PLAN.md`), preferably after item 1.
