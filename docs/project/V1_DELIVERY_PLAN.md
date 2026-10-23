---
description: Four-phase delivery plan for the first release of the ZN School mobile app (finalize the foundation, complete Teacher V1, implement Guardian V1, release readiness), with every pending task, its owner, its gate and its exit criteria.
purpose: One place that orders the remaining mobile work, ties each phase to the real backend state and to roadmap.md, and keeps the pending items from being lost; it approves nothing and changes no gate.
access: Read
---

# Mobile V1 Delivery Plan

## Status

**Draft written 2026-10-22 from the owner's mobile roadmap. Not approved. Nothing in it is built by this document.**
It is the *delivery* view over `docs/project/roadmap.md` (M0 to M6: the protected, backend-gate view) and changes none
of its gates or decisions. A phase is approved, started and completed only as recorded in `project-status.md`.

Where things stand today (2026-10-22), from `project-status.md` and `TEACHER_APP_PLAN.md`:

- The five-tab teacher shell, My Attendance, the Academic hub, Profile and the review fixes are **built and
  unit-tested** (`pnpm verify` 2026-10-22: 58 suites, 556 tests; the Android bundle exports). **Nothing has run in the app
  on a phone. Nothing is committed** (a peer session also left about 70 uncommitted files here).
- Teacher Home, My classes and Student attendance are built and unit-tested, likewise not run on a phone.
- **Marks entry is built and unit-tested** (2026-10-22, `MARKS_PLAN.md`). Its server contract and the attendance and
  self-attendance contracts were **Reproduced over HTTP against a test stack** (plan E-M2, E9). The app has not run on a phone.
- **How the app is tested (decision D10, 2026-10-22):** on the owner's own Android phone; **no emulator**. The test stack
  and accounts for it are in `TEACHER_APP_PLAN.md` §6.2. Anything that needs the app on a screen waits for that run.
- No guardian screen, no activation or phone login, no notices or push, no PDF button exist in the app yet.
- **The "new teachers can reach their school" criterion has a named cause (2026-10-22): the role.** The platform has no
  default Teacher role, and a role without `attendance.mark` or `exam_result.save` leaves the app on "Use the web app".
  The fix, a default Teacher role in the web/API project (request B12, `ROLES_ACCESS_CHECK.md`), was **built the same day as
  `default_teacher`** (migration `0236`; applied to the test databases and, at the owner's request on 2026-10-22, to the development database)
  next to B11 (onboarding, not started). The license check on the dev database (H1) is now optional.
- **Student details (teacher half) is built and unit-tested** (2026-10-22, `STUDENT_INFO_PLAN.md`); the Guardian build has
  not started (GV-D1). `pnpm verify`: 62 suites, 599 tests; the Android bundle exports.

**Recommendation (owner's roadmap):** do not start Guardian V1 and do not add more Dashboard styling yet. Verify the
shell first, then make marks entry the next separately planned task. The larger Dashboard redesign stays a later
UI-focused task with Impeccable.

Status vocabulary: Planned · Proposed (needs approval) · Designed · In Progress · Implemented · Approved. "Built" means
code and unit tests exist; it is not "done" until its device or test-stack check has run.

---

# 1. Release scope

**Teacher V1 first, then Guardian V1, on the same backend.** The mobile app and the web app stay separate repositories
that share the versioned API and the existing authorization rules.

| Teacher V1 | Guardian V1 |
| --- | --- |
| Dashboard with the supported summaries | Secure activation and login |
| Student attendance and self attendance | Access only to linked children |
| Academic: classes, exams, marks entry | Student information and academic results |
| Authorized student information | Fees, invoices and payment history |
| Relevant notices and notifications | Notices and notifications |
| Profile, school switching, sign-out | Profile, session management, sign-out |

These are target capabilities, not a claim that each is ready. The backend API and the web project must be checked
before each feature is scheduled. Fees and notices use the existing authoritative data and permission rules, never
mobile-specific business logic. Earlier owner scope decisions still stand: exam routine PDFs are after v1 (2026-10-18);
My Attendance is in v1 (2026-10-21).

## 1.1 How the four phases map to roadmap.md

| This plan | roadmap.md |
| --- | --- |
| Phase 1, finalize the foundation | M1 part A leftovers and the device checks of the M2 teacher shell |
| Phase 2, complete Teacher V1 | the rest of M2 (marks), plus the teacher side of M4 (notices) and the student-information and fees questions |
| Phase 3, implement Guardian V1 | M1 part B (activation, phone login, long sessions), M3, and the guardian side of M4 |
| Phase 4, release readiness | the cross-phase requirements (roadmap §10) and the release setup (A7, A9) |

The roadmap lists notices and push as a later phase (M4) with its own gate. Putting the **teacher side of notices into
Phase 2** follows the owner's Teacher V1 list and the 2026-10-18 release scope ("attendance, marks, fees, student
information and notices"); it needs the owner to confirm that M4's teacher part moves forward and that the roadmap's M4
gate is met (§2, §6 decision V-D1).

---

# 2. Backend state the mobile work depends on

The mobile app tracks these dependencies; it does not duplicate backend work. Source: the web/API repo's
`docs/project/project-status.md` ("Mobile upgrade", ADR-0065 to ADR-0070) and `docs/api/ENDPOINTS.md`, **read 2026-10-22,
read-only**. "Implemented" there means on the owner's word and not yet Verified; some parts were built on the test
database first. Nothing was re-run for this plan.

| Dependency | Backend state recorded there | Mobile state |
| --- | --- | --- |
| B1, B2 mobile session policy, login by phone or email (ADR-0066) | Implemented, test and development databases (2026-10-18): `POST /identity/login { identifier, password, clientType }`, mobile idle limit 7 days by default (`mobile_session_timeout_minutes`, no absolute cap), refresh reuse revokes the family, `POST /identity/logout-all`, login throttling | Login is email only; phone and `clientType` not built (M1 part B) |
| B3 short activation code and QR (ADR-0067) | Built: `POST /identity/activate { code, identifier, password }`; admin-issued single and bulk codes and a printable slip on the web Guardian Portal page; the printed QR now encodes `<web origin>/activate?code=…` | No activation screen (placeholder); the scanner must read **both** the bare code and that URL |
| B4 guardian audience (ADR-0067) | Built: `roles.audience`, guardian role, `guardians.user_id`; a guardian-only membership is refused on every staff route (403 `TENANT_AUDIENCE_DENIED`) | `GUARDIAN_ROLE_AVAILABLE = false` in `src/auth/useSessionContext.ts`; the guardian shell is unreachable |
| B5, B6 marks scoping, per-subject entry, submissions (ADR-0068) | Built (0229, 0230); development database migrated through 0230 (2026-10-21) | Not started; `MARKS_PLAN.md` |
| B7 teacher portal reads | `my-classes`, `exams`, `students/:id` built | `my-classes` and `exams` used by Home and Academic; `students/:id` not used |
| B7 guardian portal reads, B8 released results only | Built: `students`, `students/:id`, `…/attendance`, `…/results` (released only), `…/fees`; every route re-proves the guardian link. **Not built:** guardian PDFs (invoice, receipt, marksheet), guardian advance, the `home` routes | Not started |
| B10 notices, notifications, devices (ADR-0069) | Built (0231, test and development databases): staff `/communication/notices`, portal `/portal/notifications`, `/read`, `/portal/notices`, `/portal/devices`. **Not built:** email, invoice and payment events, a web notice screen, delivery receipts. Real pushes need an Expo project | Not started |
| Release hardening (ADR-0065 phase 8 note) | S-1 to S-15 run API side; **S-9's client half is not met** against ADR-0065 D8 (a plain 403 keeps cached data on screen); the owner's test-stack run on a device is open | Open; see P3.8 and P4 |

**Stale in the mobile documents (found while writing this plan; not edited here):** the B1 to B4, B8 and B10 rows of the
`project-status.md` backend table and the "Known until backend B1 ships: 30-minute limit" note read "not built"; the
roadmap's M0 table and M4 gate text read "not built". They are out of date against the backend status above. Reconciling
them is task P4.7; `roadmap.md` is protected and needs the owner's approval first.

---

# 3. Phase 1 — Finalize the mobile foundation

**Status: Next.** Goal: prove the existing shell works in the real environment.
**Gate to enter:** none (the shell is built). **Run in:** the mobile repo; the device run is the owner's.

| # | Task | Who | State |
| --- | --- | --- | --- |
| P1.1 | Run the Android app on **the owner's phone** against the **test stack** (never a production school; **no emulator**, D10) with the accounts in `TEACHER_APP_PLAN.md` §6.2; follow §6.1 | Owner | Stack and accounts ready (2026-10-22). **Not started as of 2026-10-22 07:05 UTC**, checked on the stack: no session was created after the assistant's own last login (06:26), no marks, submissions or attendance exist for the phone-run exam, and the app's `.env` still points at the dev API (`:3001`) with the owner's Metro unchanged since 05:20 UTC. What would show the run began: a new login of a `phone.*` account, then marks or attendance rows |
| P1.2 | Verify what only a device shows: the Attendance subtabs and the pinned control, the month rows, the chevrons on tappable cards, the nested-header spacing (the subtab area should add no extra top inset under the stack header; so far a code-level expectation only), the native Sign out confirmation | Owner | Not started |
| P1.3 | Test school switching, session expiry, sign-out and cache clearing, system font 1.3x, Nepali text, low-end scroll on a long roster | Owner | Not started |
| P1.4 | Confirm hypothesis H1 on the **dev** database with the SQL in `TEACHER_APP_PLAN.md` §3.6 (a school with no, expired or suspended licence blocks every non-platform-admin) and fix the licence in the web Platform admin if confirmed | Owner | **Now optional:** the owner names the role as the cause (D11). The block mechanism itself was Reproduced on a test database (E9: `LICENSE_EXPIRED`, `LICENSE_SUSPENDED`, `LICENSE_NOT_FOUND`); whether the dev school has a valid license is still unknown |
| P1.5 | Decide **B11 teacher onboarding** (create the staff row, login, membership and role together; require an active licence before inviting). It is built, if at all, in the web/API repo; this repo only holds the request (`BACKEND_PREREQUISITES.md` §12) | Owner / web session | Open |
| P1.5a | **B12 — default Teacher role** in the web/API project (and the question of row-level security on roles). Drafted in `ROLES_ACCESS_CHECK.md`; adding it to the protected `BACKEND_PREREQUISITES.md` needs the owner's approval of the diff | Owner / web session | **Role built 2026-10-22** as `default_teacher` (migration `0236`); **applied to the development database the same day** at the owner's request, up to 0236 only (a peer session's leave migrations 0237 and 0238 stayed pending). The `BACKEND_PREREQUISITES.md` entry (section 13) is written. Open: row-level security on roles (Q4, `DEFERRED_WORK_REQUIREMENTS.md` §2) |
| P1.6 | Review the cold-start Jest flake: the first test of a suite can exceed its 5 s timeout on a first run after edits and passes warm (seen after both review rounds, recorded in E7 and E8). Find the cause (cold transform cache) and fix or document the fix; show any `jest` config change before making it | Claude | **Reproduced again 2026-10-22** (the first test of `MarksEntryScreen.test.tsx`, 5 s timeout on its first run after the edit; 31/31 warm, then the full run green). Cause is a cold transform cache (**plausible, not proven**). **Fix applied 2026-10-22 (Q8 accepted): `testTimeout: 20000` in the Jest config in `package.json`;** the full suite then ran without the timeout |
| P1.7 | Live check of `GET /attendance/staff/self` (record fields `attendanceDate`, `status`, `source`, `version`, `todayDay`) on the test stack; today they are read from backend code | Owner (stack) / Claude | **Done 2026-10-22** (E9): fields confirmed, `POST` answers 200, the 404 for an unlinked account confirmed |
| P1.8 | Native review of the Nepali strings (all drafted by the assistant, including the sign-out strings) | Owner | Not started |
| P1.9 | Record the device evidence as new entries in `TEACHER_APP_PLAN.md` §10 and update its §9 acceptance rows only for what ran | Claude, after P1.1 to P1.3 | Waiting on the run |
| P1.10 | Finish the design review: `ui-ux-pro-max` was never run (not available in the session that built the shell), and `impeccable` ran code-only in one context; run both from a session opened in this repo, on a device build | Owner / Claude | Not started |
| P1.11 | Month stepper has no lower bound (it needs a rule from the backend: licence start or school year). Decide the rule or accept an unbounded stepper | Owner | Open; recorded in `TEACHER_APP_PLAN.md` §11.6 |

**Carried from M1 part A (not in the owner's Phase 1 list, still pending; ordered by relevance to a device run):**
link EAS (`eas init`) and make a development build (Expo Go is fine for the current shell but cannot handle the
`znschool://` scheme); the PDF download and cache button; optional biometric or PIN unlock; change password; decisions
A7 (crash reporting) and A9 (minimum OS, bundle id and package name). Each stays out of Phase 1 unless the owner pulls
it in; A7 and A9 are needed by Phase 4.

**Documentation to update, only where the verified implementation requires it:** `TEACHER_APP_PLAN.md`,
`project-status.md`, `docs/frontend/UI_SYSTEM.md`, `docs/architecture/ARCHITECTURE.md` (protected).

**Exit gate:** the core shell and the school and session behaviour are verified on a device, and every unresolved
decision (H1, B11, the month bound) is recorded explicitly. The `roadmap.md` M2 shell checkbox is ticked only then
(protected: owner approval).

**Out of scope:** any new feature, any Dashboard restyle.

---

# 4. Phase 2 — Complete Teacher V1

**Status: Planned.** Goal: the core teacher workflows. **Gate to enter:** Phase 1 exit for the pieces that depend on the
device run; the marks plan can be approved and built before it, but marks entry is not "done" until it has run on the
test stack.

| # | Task | Who | State |
| --- | --- | --- | --- |
| P2.1 | **Marks plan.** Approve `docs/project/MARKS_PLAN.md` (contract check, findings, screens, validation, errors, tests, acceptance) and answer its decisions M-D1 to M-D6 | Owner | **Done 2026-10-22** (approved; M-D1 send the version on every save; M-D2 to M-D6 as recommended) |
| P2.2 | Raise the three marks backend asks (A: `isOptional`/`includeInResults` on portal exams, B: assignment-scoped reads of the exam roster and results, C: stable codes on bulk failures and gate errors) in the web/API repo | Owner | Not started; none blocks the build. **B is now Reproduced** (an unlinked account read the roster with guardian names and every subject's marks), which raises its priority |
| P2.3 | **Build marks entry** per `MARKS_PLAN.md` §10: subject-scoped entry, save, validation, version-conflict handling, idempotent save, submit and returned states, under the backend's contract. Publish and lock stay staff-only | Claude, after P2.1 | **Built and unit-tested 2026-10-22** (58 suites, 556 tests; export OK; `MARKS_PLAN.md` §12, E-M1). Not run on a phone |
| P2.4 | Confirm the live shapes of the marks calls on the test stack (MARKS_PLAN §12 row 2); run marks entry on the stack and on a device with two accounts for the conflict case | Owner (stack) / Claude | Shapes and the two-account conflict **Reproduced over HTTP 2026-10-22** (E-M2). The phone run, with the conflict triggered from the Science account, is the owner's (`TEACHER_APP_PLAN.md` §6.2) |
| P2.5 | **Student information.** `GET /portal/teacher/students/:studentId` exists (student, guardians' contact details, enrollments; allowed only for a class or subject teacher of the student, or `attendance.mark_any`; otherwise 403). Plan the screen (where it opens from, which fields a teacher should see, the guardian-contact privacy question), check the live shape, then build. No registry feature id is decided yet | Claude plan, owner approval | **Teacher half BUILT 2026-10-22** (`STUDENT_INFO_PLAN.md`; SI-D1 to SI-D6 accepted): live shape captured, "Student details" button on each Attendance roster row, the profile screen, not persisted on the phone, own `students` school switch, no `FEATURE_MODULES.md` change needed. 62 suites / 599 tests, export OK; not run on a phone. The guardian half waits for Guardian V1 |
| P2.6 | **Notices and notifications (teacher side).** Check the backend routes in `ENDPOINTS.md` §7f against `API_CONTRACT.md`; build the shared notices list and detail (feature `shared.notices`, module key `notices`) and the in-app inbox once, so Guardian V1 reuses it; push registration needs an Expo project and a development build (P1 carry-over, A8 decided: Expo push) | Claude, after V-D1 | Wanted by the owner (V-D1, 2026-10-22: teachers need notices). Not started: needs its own plan. **Contract check done (Static, 2026-10-22):** a teacher reads notices through `GET /portal/notices` and `GET /portal/notifications`, which are membership-only and shared with guardians (the staff `/communication/notices` routes need `communication.notice_manage` and are for writing). So no new permission and no backend change are needed for reading |
| P2.10 | **Default Teacher role** (B12) and the roles access result (`ROLES_ACCESS_CHECK.md`): default and custom roles reach the app through permission keys; custom roles are isolated by application code, not row-level security (ADR-0033 D8) | Owner / web session | Check done 2026-10-22 (E10); the request awaits the owner |
| P2.7 | **Fees information for teachers.** No teacher-audience fees route exists: the portal fees route is guardian-only and the staff finance routes need finance permissions | Owner | **Closed 2026-10-22: teachers do not need fees (V-D2). No teacher fees screen.** |
| P2.8 | Every screen honours the active school, the assigned role and server authorization: tests per feature (visibility, unauthorized, school switch, cache clearing) | Claude, with each build | Ongoing |
| P2.9 | Write the marks run prompt into `PHASE_PROMPTS.md` (after approval) and keep the status docs current | Claude | After P2.1 |

**Documentation:** `MARKS_PLAN.md`, `PHASE_PROMPTS.md`, `project-status.md`, `API_CONTRACT.md`, `TEACHER_FEATURES.md`,
`FEATURE_MODULES.md` (protected), and a short plan per feature that needs one (student information, notices).

**Exit gate:** the teacher workflows pass automated tests **and** device verification against the test environment.
Marks cannot bypass the backend's authorization, publish or lock rules.

**Out of scope:** exam routine (after v1), publishing or locking results, offline writes (M6), extended teacher features
(M5: classroom, homework, lesson plans, question scan), any change in the web/API repo.

---

# 5. Phase 3 — Implement Guardian V1

**Status: Planned. Do not start before Phase 2 is verified** (owner's recommendation). Goal: guardians reach only
their own linked children. **The detailed plan is `docs/project/GUARDIAN_V1_PLAN.md` (Draft 2026-10-22, not approved):**
screens, navigation, states, sequencing, tests and decisions; the table below stays the task list.

**Gate to enter:** the roadmap's M3 gate needs B4, B7 guardian and B8 recorded as **Implemented** in
`project-status.md`, and M1 part B needs B1 to B3. The backend repo says they are built (§2); the owner has not recorded
them in the mobile documents. That recording, and flipping `GUARDIAN_ROLE_AVAILABLE`, are the owner's steps.

| # | Task | Who | State |
| --- | --- | --- | --- |
| P3.1 | Record B1 to B4, B7 guardian and B8 (and B10 for push) as Implemented in `project-status.md` after checking `ENDPOINTS.md` documents each | Owner | Not started |
| P3.2 | **Activation and login** (M1 part B): phone or email identifier (E.164, Nepal default +977), `clientType: 'mobile'`, a wait message on 429 with no automatic retry, activation by typed code or QR (the scanner accepts the bare code and the `…/activate?code=` URL), deep link `znschool://activate?code=…` on a development build, password set, expired and attempt-limited codes handled, the code never logged or stored, refresh-token reuse shown as "session expired" | Claude | Not started |
| P3.3 | **Administrator-issued activation**, single or bulk, is the web Guardian Portal page (built on the web). Mobile only redeems; verify end to end that a code issued there for a guardian-child link activates on a phone and that a guardian with no link sees nothing | Owner (web issue) / Claude (app) | Not started |
| P3.4 | Linked-child selection and the child switcher from `GET /portal/guardian/students`; guardian shell, home | Claude | Not started |
| P3.5 | Student information (`…/students/:id`) and attendance history (`…/attendance`, month view, counts as returned) | Claude | Not started |
| P3.6 | Academic results (`…/results`, released results only); the marksheet PDF has **no guardian route yet**, so it waits on a backend ask | Claude / owner | Not started; backend gap |
| P3.7 | Fees and payment history (`…/fees`: financial position and payments exactly as returned, no client arithmetic, "updated <time>"). Invoice and receipt PDFs have **no guardian route yet**, and the guardian advance pool is not listed there; both wait on a backend ask | Claude / owner | Not started; backend gap |
| P3.8 | **Decided 2026-10-22 (V-D3): wipe the school's cached queries on a plain 403.** Not built yet (needs a loop guard, see V-D3). **Revalidate child access and school permissions when the context changes** (switch child, switch school, 403). Decide the S-9 client behaviour: ADR-0065 D8 wipes the cache on a 403 with `TENANT_MEMBERSHIP_NOT_FOUND` "or any permission revocation"; the app wipes only on `TENANT_MEMBERSHIP_NOT_FOUND`, and on any other 403 it keeps the cached data on screen (cached data wins in `queryView`, the persisted cache lives 7 days), so a revoked guardian keeps seeing what they last loaded | Owner decision, then Claude | Open decision V-D3 |
| P3.9 | Notices, in-app inbox and push registration, **reusing** the teacher-side notices from P2.6 | Claude | Not started |
| P3.10 | Keep guardian features separate: the `guardian` route group, `guardian.*` feature ids, no teacher screen reachable, common components reused safely (no copies) | Claude | Not started |
| P3.11 | Documentation: `GUARDIAN_FEATURES.md`, activation and session flows in `AUTH_AND_SESSION.md`, the endpoint mapping in `API_CONTRACT.md`, a permission matrix, the M3 prompt in `PHASE_PROMPTS.md` | Claude | Not started |

**Exit gate:** tests prove a guardian cannot reach an unrelated student's information, fees, results or notices (the API
side is covered by the backend's S-14 sweep; the app side must show no stale or other-child data after any switch), and
the flows run on a device with a guardian who has two children.

**Out of scope:** online payment, ledger statement, messaging, student self-login, the exam routine PDF (after v1).

---

# 6. Phase 4 — Release readiness

**Status: Planned.** Goal: verify both audiences and prepare a controlled release.

| # | Task | Who | State |
| --- | --- | --- | --- |
| P4.1 | Test teacher and guardian accounts across several schools and children: roles, session expiry, school switching, activation, sign-out, cache clearing | Owner / Claude | Not started |
| P4.2 | Duplicate submissions, network interruption, conflict handling and error recovery for attendance, marks and activation | Claude / owner | Not started |
| P4.3 | Notices and push behaviour on a device (needs the Expo project); Android builds through EAS (profiles `development`, `staging`, `production`); accessibility (font scale, screen reader, contrast); lower-end device performance | Owner | Not started |
| P4.4 | Decide A7 (crash reporting provider) and A9 (minimum OS, bundle id, package name), then set up release identifiers and signing | Owner | Open |
| P4.5 | Confirm the API and database migrations are applied to the **intended** environments and name them (the test stack, the development database, any staging or production). The mobile docs do not yet say which stack each check ran on | Owner | Not started |
| P4.6 | Close the open security items: the S-9 client behaviour (V-D3), the unscoped attendance reports (`/reports/attendance/*`, pending an owner decision in the backend repo), and the backend's own 8.4 gates | Owner (backend repo) | Open |
| P4.7 | Reconcile the mobile plan, `PHASE_PROMPTS.md`, `project-status.md` and `roadmap.md` with the backend status (§2); update the main project's API documentation only where a real contract gap is found | Claude, owner for protected files | Not started |
| P4.8 | Separate the mobile changes from unrelated and peer-session work; commit only reviewed changes, by the owner's instruction | Owner | Not started. Nothing is committed today |
| P4.9 | Document release limitations (no offline writes, no exam routine, text-only notices, whatever the device run shows) | Claude | Not started |

**Exit gate:** automated checks and device tests pass, the release limitations are documented, and both apps use the same
authoritative backend behaviour.

---

# 7. Rules that hold in every phase

| Area | Rule |
| --- | --- |
| Data ownership | The backend is the source of truth; the app has no business rules (fees, balances, marks, grades, results are backend-owned). |
| API integration | Reuse the versioned endpoints; verify the contract (shape, permission, errors) before building a screen; call only endpoints marked Exists in `API_CONTRACT.md`. |
| School isolation | Revalidate membership and permissions when the school changes; query keys start with `[tenantId, …]`; a school switch clears the old school's data. |
| Marks | Draft and submit through the backend rules; authorized staff control publishing and locking. |
| Attendance | Keep the atomic all-or-none saves and the existing conflict and idempotency behaviour. |
| Sessions | The agreed sliding seven-day inactivity policy (mobile default 10080 minutes) and server-side revocation. |
| Offline | No offline writes in V1 and no local database before M6; cached sensitive data follows the clearing policy (wiped on sign-out and school switch). |
| Notifications | Use the existing in-app inbox and push architecture (backend ADR-0069, Expo push); no separate mobile event system. |
| Architecture | Do not change accepted ADRs or mark any ADR Implemented or Verified without the required review and approval. |
| Process | Mobile `CLAUDE.md` applies: reuse first, tokens only, keys-only i18n (en and ne), `pnpm verify` before "done", never document unbuilt work as done, no commit without the owner. |

---

# 8. Documentation and coordination

Mobile-specific instructions live **only in the mobile repository** and are never copied into the web repository. Shared
API, data-ownership and security decisions live in the web/API repository. This plan, `MARKS_PLAN.md`, and every file
named below sit in this repo's `docs/`.

| Where | What |
| --- | --- |
| Mobile repo | `V1_DELIVERY_PLAN.md`, `MARKS_PLAN.md`, `TEACHER_APP_PLAN.md`, `PHASE_PROMPTS.md`, `project-status.md`, `UI_SYSTEM.md`, domain files, test plans, device evidence |
| Web/API repo (read-only from here) | `docs/api/ENDPOINTS.md`, the identity, academic and security documentation, its own mobile-upgrade plan and status |
| Cross-repository check, before every feature | map the screen to endpoints, request and response shapes, permissions and error behaviour; label each line Static (read from code or docs) or Reproduced (executed); change the web/API repo only for a real contract or backend gap, as a request the owner builds |

**Protected files** (owner approval and a shown diff before any edit): `roadmap.md`, `FEATURE_MODULES.md`,
`ARCHITECTURE.md`, `BACKEND_PREREQUISITES.md`, `CLAUDE.md`, `.claude/`.

---

# 9. Pending work at a glance

**Updated 2026-10-22:** the marks plan is approved (P2.1) and its build is done (P2.3); the phone run replaces the
"physical device" wording below (D10, no emulator); the license check (P1.4) is optional because the role is the named
cause; the decisions still open are Q1 to Q10 in §11.1. The paragraphs below are otherwise as written on 2026-10-22 morning.

**Owner actions (nothing below can be done by the assistant):** the device run (P1.1 to P1.3); the licence check on the
dev database (P1.4); the B11 decision (P1.5); native review of Nepali strings (P1.8); approve `MARKS_PLAN.md` and
answer M-D1 to M-D6 (P2.1); raise the marks backend asks (P2.2); the fees-for-teachers decision (P2.7); record the
guardian backend items as Implemented (P3.1); the S-9 client decision (P3.8); A7 and A9 (P4.4); name the environments
(P4.5); commit (P4.8).

**Assistant work, once started or approved:** P1.6 (the Jest flake), P1.7 and P1.9 (after a stack and a run), P2.3 and
P2.9 (after the marks plan is approved), the student-information and notices plans (P2.5, P2.6), Guardian V1 (Phase 3,
not before Phase 2 is verified), reconciliation (P4.7).

**Unverified claims carried forward:** everything the shell looks like on a phone; the live shape of
`/attendance/staff/self`; the Nepali strings; the cause of the licence message on the dev database; the backend status in
§2 as it applies to the stack the app will run against.

---

# 10. Immediate next steps

1. Run the phone walkthrough on the test stack (`TEACHER_APP_PLAN.md` §6.1 and §6.2: no emulator, D10), including the
   marks conflict. **Owner.**
2. Answer Q1 to Q10 (§11.1), above all Q3 (the default Teacher role). **Owner.**
3. Record the phone evidence and reconcile the status documents (P1.9, P4.7 for the parts that apply). **Claude, after 1.**
4. ~~Review `MARKS_PLAN.md` and answer its decisions.~~ **Done 2026-10-22** (approved).
5. ~~Build marks entry.~~ **Built and unit-tested 2026-10-22**; its phone run is step 1. Then: teacher notices plan (P2.6)
   and student information (`STUDENT_INFO_PLAN.md`, needs the `FEATURE_MODULES.md` diff approved).
6. Finish Teacher V1, then begin Guardian V1 (`GUARDIAN_V1_PLAN.md`), then run the release verification.

---

# 11. Decisions

V-D1 to V-D3 were answered by the owner on 2026-10-22. V-D4 and V-D5 are still open (Proposed).

| # | Decision | Answer or recommendation |
| --- | --- | --- |
| V-D1 | Move the teacher side of notices (roadmap M4) into Phase 2, and accept the roadmap's M4 gate as met on the backend's word | **Answered 2026-10-22: teachers need notices** (in Phase 2). It still needs its own plan and a check of `ENDPOINTS.md` §7f before code; shared build so Guardian V1 reuses it |
| V-D2 | Does a teacher need fees information, and through which route and permission | **Answered 2026-10-22: no.** Teachers do not need a fees route; no teacher fees screen is built |
| V-D3 | The S-9 client half: wipe the school's cached queries on a plain 403 (as ADR-0065 D8 reads), or narrow D8 | **Answered 2026-10-22: wipe the school's cached data on a plain 403** (read from "plain db"; a plain 403 is the one the app maps to `forbidden`). Applies to the whole app, not only guardians. Design caution before building: wiping while the failing screen is mounted can refetch, 403 again and wipe again, so the build needs a loop guard; the offline "saved data" banner stays for genuine network failures (status 0) |
| V-D4 | Whether Phase 1 pulls in the M1 part A leftovers needed for a device run (EAS link, development build) | Recommendation: only the development build, when the `znschool://` scheme or push is needed; Expo Go is enough for the current shell |
| V-D5 | Where the lower bound of the month stepper comes from | Recommendation: defer; low impact |

Existing open decisions A5 to A13 stay as in `roadmap.md` §12.

## 11.1 Open owner decisions, numbered (2026-10-22)

**The owner accepted every recommendation below on 2026-10-22** ("accept the recommendation and start implementation"),
and the same for SI-D1 to SI-D6 (`STUDENT_INFO_PLAN.md`) and GV-D1 to GV-D9 (`GUARDIAN_V1_PLAN.md`). What that produced:

| Q | Accepted | State |
| --- | --- | --- |
| Q1 | skip the dev licence SQL | nothing to do |
| Q2 | default role first, onboarding later | role done (Q3); B11 not started |
| Q3 | global default Teacher role, five permissions | **Built as `default_teacher`** (migration `0236`, web/API project, owner-authorised exception D12); verified; applied to the test databases and, 2026-10-22, to the development database (only up to 0236); not committed |
| Q4 | row-level security on roles as a separate backend ADR | not started (needs an ADR in the web/API project) |
| Q5 | accept Nepali drafts for the phone test | nothing to do; review before release |
| Q6 | raise ask B now, A and C later | the owner raises it |
| Q7 | leave the month stepper unbounded | nothing to do |
| Q8 | Jest `testTimeout: 20000` | **Done** (`package.json`); the full suite ran without the cold-start timeout afterwards |
| Q9 | wait for the phone run, then commit by group | nothing committed |
| Q10 | add "or ask your school to give you the Teacher role" | **Done** (`useWeb.body`, en and ne) |

What it takes to start the three deferred items (plain-403 cache wipe, row-level security on roles, B11 onboarding), with the
one decision each needs: `docs/project/DEFERRED_WORK_REQUIREMENTS.md`. The protected documents (`roadmap.md`,
`FEATURE_MODULES.md`, `ARCHITECTURE.md`, `BACKEND_PREREQUISITES.md`) were brought up to date on 2026-10-22 at the owner's request
(task P4.7 for the parts that apply now).

SI-D1 to SI-D6: the teacher half is **built** (§P2.5). GV-D1 (build G0 and G1 after the marks phone run passes, the rest
after Phase 2 is verified): the Guardian build has **not** started, on purpose.

Original text of the table follows. Each row has a recommendation and what it changes.

| # | Question | Options | Recommendation |
| --- | --- | --- | --- |
| Q1 | **H1, the license check on the dev database** (`TEACHER_APP_PLAN.md` §3.6). Run it? | (a) run the SQL now; (b) skip until the role fix is in and a teacher is still blocked | **(b).** You named the role as the cause. The license block itself is verified (E9), so the SQL only matters if a school really has no valid license |
| Q2 | **B11 teacher onboarding** (staff row, login, membership, role and a license check in one flow, in the web/API project) | (a) approve B11 as written in `BACKEND_PREREQUISITES.md` §12; (b) skip it and keep the three manual steps with a default Teacher role; (c) defer | **(b) now, (a) later.** The default role (Q3) removes the blocking problem cheaply; onboarding is a bigger web feature |
| Q3 | **B12, a default `teacher` role** in the web/API project. Which permissions? Where? | (a) a global role seeded by a migration with `attendance.mark`, `attendance.read`, `attendance.self`, `exam_result.read`, `exam_result.save` (every school gets it at once); (b) the same set plus `calendar.read` now; (c) per-school copies | **(a)**, adding `calendar.read` when the calendar screen ships. Never `*_any`, `publish`, `lock` or `attendance.staff_manage`. Draft and evidence: `ROLES_ACCESS_CHECK.md` |
| Q4 | **Row-level security on roles.** `roles`, `role_permissions` and `permissions` have none; custom roles are isolated by an application filter (accepted ADR-0033 D8). You asked for RLS | (a) keep ADR-0033 D8; (b) a new backend ADR adding RLS to `roles` (`tenant_id IS NULL OR tenant_id = current tenant`) and to `role_permissions` through the role | **(b)**, as a separate backend change; it does not block the mobile app, which never reads these tables, only `GET /tenancy/my-permissions` |
| Q5 | **Nepali strings** (all drafted by the assistant, including `marks.*` and `marks.submitConflict`) | (a) a native reviewer goes through `ne.ts` now; (b) accept the drafts for your own phone test and review before release | **(b)**, with (a) scheduled in Phase 4 |
| Q6 | **Marks backend asks A, B, C** (`MARKS_PLAN.md` §9) | (a) raise all three now; (b) raise only B now; (c) wait | **(b) now, A and C with the next backend phase.** B is a confirmed exposure (any member can read every student's guardian name and every subject's marks of an exam) |
| Q7 | **Month stepper lower bound** (My Attendance) | (a) leave it unbounded; (b) the academic year's start; (c) the license start | **(a) for v1.** Low impact; a rule can come with real data |
| Q8 | **Jest `testTimeout`** (the cold-start flake, P1.6) | (a) add `testTimeout: 20000` to the Jest config; (b) leave it and rerun the suite | **(a).** One line, no behaviour change; it is a config change, so it needs your yes |
| Q9 | **Commit approval.** Nothing is committed; this repo also holds about 70 files from another session | (a) commit in groups now (shell, marks, docs), leaving the other session's files; (b) wait for your phone run first | **(b).** Commit by group after the run, on your word. Separating the other session's files is its own step |
| Q10 | **The "Use the web app" wording** for a teacher with no usable role | (a) keep "Your role in this school is not available in the mobile app. Please use the ZN School web app."; (b) add "or ask your school to give you the Teacher role" (en and ne) | **(b).** It names the real remedy. A small text change that waits for your yes |

Student-information decisions (SI-D1 onwards) are in `STUDENT_INFO_PLAN.md`; Guardian V1 decisions (GV-D1 onwards) are in
`GUARDIAN_V1_PLAN.md`.

---

# 12. Evidence log

None yet. This plan records evidence only for what runs; the device and test-stack results go to
`TEACHER_APP_PLAN.md` §10 (Phase 1), `MARKS_PLAN.md` (marks) and the Guardian feature plan (Phase 3).
