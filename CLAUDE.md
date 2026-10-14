# CLAUDE.md

Mandatory operating rules for Claude Code in the **ZN School Mobile** repository.

---

## Mandatory Reuse-First Engineering Policy

1. SEARCH FIRST.
2. IDENTIFY EXISTING IMPLEMENTATIONS (in this repo, and the backend repo's contracts).
3. COMPARE THEM WITH THE CURRENT REQUIREMENT.
4. REUSE WHEN POSSIBLE.
5. EXTEND GENERIC IMPLEMENTATIONS WHEN APPROPRIATE.
6. ONLY CREATE NEW CODE WHEN REUSE IS TECHNICALLY INSUFFICIENT.
7. DOCUMENT WHY A NEW IMPLEMENTATION IS NECESSARY.

Before writing, modifying, or deleting implementation code, read the applicable rules under
`.claude/rules/`.

---

# 1. Purpose

This repository is the mobile client of the **ZN School Operations Platform**. It serves teachers and
guardians. It owns **no data** and **no business rules** — the backend repo (`zn-school-platform-v1`)
owns the API, the database, validation, authorization, tenant isolation and every financial and
academic rule.

Objectives:

- correct, read-only presentation of backend truth to guardians
- correct, minimal write flows for teachers (attendance, marks)
- low server load (few, cacheable, batched requests)
- never weaken tenant isolation, authorization or data correctness
- implement only approved scope

---

# 2. Authority Hierarchy

1. Explicit user instruction in the current task
2. Backend repo `CLAUDE.md`, `.claude/CLAUDE.md`, accepted ADRs and architecture docs
3. This `CLAUDE.md`
4. `docs/architecture/*` in this repo
5. `docs/project/roadmap.md` and phase scope
6. `.claude/rules/*`
7. Existing implementation and conventions
8. General Expo / React Native conventions

If two authoritative documents conflict: **STOP**, report the conflict, wait for direction.

---

# 3. The Backend Boundary (most important rule)

- **Never change the backend from this repository.** If a feature needs a new endpoint, field,
  permission or behavior, write it up as a backend request (see
  `docs/backend/BACKEND_PREREQUISITES.md` format) and stop at that boundary.
- Never call an endpoint documented as **Proposed** or **Planned** as if it exists. Verify against
  the backend repo's `docs/api/ENDPOINTS.md`.
- Never re-implement a backend rule in the app (fee math, result calculation, grade computation,
  attendance eligibility, permission logic). Display what the API returns.
- The app's permission checks are **UX hints only** (ADR-0038). The backend is authoritative.
- Never send `tenantId` that did not come from `GET /tenancy/my-schools`.

---

# 4. Core Approval Rule

Do not make or silently introduce an architectural decision without explicit user approval. In this
repo that includes:

- navigation architecture, state management, server-state/caching strategy
- auth/session storage strategy
- offline write support
- push notification provider
- adding a native module / leaving the Expo managed workflow
- any new third-party SDK (analytics, crash reporting, payments)

Gate: identify → read relevant docs → options → recommendation → consequences → **STOP**.

---

# 5. Scope and Phase Discipline

Implement only the requested scope and the current phase in `docs/project/roadmap.md`.

Do not pull ahead:

- offline writes (M6, tied to backend roadmap Phase 10)
- notices / push notifications (M4, tied to backend roadmap Phase 9)
- future teacher features (M5)

If extra work is discovered, report it as blocker / required follow-up / optional / future work.

---

# 6. Progressive Context Loading

Always read: this file, the task, and `docs/project/project-status.md` when continuing work.
Then read only the affected feature folder, its doc in `docs/domain/`, and the relevant rule files.
Do not load the whole repo or the whole backend repo.

---

# 7. Protected Files

Require explicit user approval before modification:

```text
CLAUDE.md
.claude/
docs/architecture/
docs/backend/BACKEND_PREREQUISITES.md
docs/project/roadmap.md
app.json / app.config.ts (bundle id, scheme, permissions)
eas.json
```

---

# 8. Verify Before Completion

Before declaring work complete:

1. `pnpm lint`
2. `pnpm typecheck`
3. `pnpm test`
4. Run the flow on a dev build (Android at minimum) against a **test** backend — never against a
   production school.
5. Review: security (tokens, logs), tenant switching, permission-hint behavior, offline/poor-network
   behavior, request count of the screen.
6. Update `docs/project/project-status.md`; never document an unimplemented feature as done.

Report failures faithfully with output.

---

# 9. Shell

The developer uses Windows / PowerShell. Verify every example command for PowerShell syntax before
giving it.
