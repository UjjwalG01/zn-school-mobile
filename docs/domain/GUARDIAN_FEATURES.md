---
description: Guardian features of the mobile app — v1 read-only scope, visibility rules, backend dependencies, and future items.
purpose: Define what a guardian can see and the boundaries that keep guardian access limited to their own children.
access: Read
---

# Guardian Features

## Status

Planned (M3); **nothing is built in the app.** The backend pieces this was blocked on (B4 guardian identity, B7 guardian
portal reads, B8 released-results-only) are **built there**, and the guardian routes were Reproduced over HTTP on
2026-10-22 (`docs/project/GUARDIAN_V1_PLAN.md` §2.1): activation, phone login, the six `portal.*` keys, the children list,
profile, attendance, fees and notices, the refusal of another family's child and of every staff route. The detailed plan,
screens, sequence and decisions are in `GUARDIAN_V1_PLAN.md` (Draft, not approved). The table in §3 below is the original
intent; the built routes differ and are listed in `GUARDIAN_V1_PLAN.md` §2.3 (no `home` route, no `/profile`, no photo or
guardian list, attendance takes `dateFrom`/`dateTo`, fees is one route, no guardian PDFs yet).

---

# 1. Who is a guardian

A user linked to a `guardians` row via `guardians.user_id` (B4) and holding the guardian-audience
role in that school. Children = `student_guardians` links of that guardian. A parent with children
in two schools has two memberships and switches school like any user. A teacher who is also a parent
sees both shells.

Guardian is a Student-domain relationship (backend `docs/domain/student/GUARDIAN_ARCHITECTURE.md`).
Money follows the backend's guardian billing model (updated 2026-10-16): a student's receivable and
advance stay per student; siblings' invoices from one billing run can sit in a **consolidated invoice
group** (ADR-0025/0026); and since ADR-0059 a guardian can hold their own **advance pool** that is
reported **separately** from the student advance and never merged into one figure. Payments carry a
purpose (`invoice` or `advance`, ADR-0060). The app shows each figure as the API returns it.

---

# 2. Boundary rules

1. Guardian screens call **only** `/portal/guardian/*`. The backend resolves students from the
   login; a student id in a URL is always re-checked against the link.
2. The app is **read-only** for guardians in v1 — no edits to profile, no payments.
3. Results are visible only when `published` or `locked` (B8). `published` marksheet = draft
   watermark; `locked` = official copy (backend ADR-0037 D7).
4. Fee values are shown exactly as returned (no client math), with "updated <time>" (replica reads,
   `docs/database/DATA_ACCESS.md`).

---

# 3. v1 features

| Feature               | Screen content                                                                                                                                                                                                        | Endpoint (B7)                                                    |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| `guardian.home`       | per child: class/section, today's attendance, net outstanding, latest published result                                                                                                                                | `GET /portal/guardian/home`                                      |
| child switcher        | linked students                                                                                                                                                                                                       | `GET /portal/guardian/students`                                  |
| `guardian.profile`    | name, photo (if any), class/section, roll, guardians — guardian-safe subset                                                                                                                                           | `…/students/:id/profile`                                         |
| `guardian.attendance` | month calendar + list, counts                                                                                                                                                                                         | `…/students/:id/attendance?from&to`                              |
| `guardian.fees`       | per child: net outstanding, receivable, advance; the guardian's own advance pool as a separate figure; invoices (status, group context for consolidated invoices); payments (purpose, receipt). Posted documents only | `…/financial-position`, `…/invoices`, `…/payments`               |
| invoice / receipt PDF | download & share                                                                                                                                                                                                      | `GET /portal/guardian/invoices/:id/pdf`, `/payments/:id/receipt` |
| `guardian.results`    | exams with published/locked results, subject marks/grades as returned                                                                                                                                                 | `…/students/:id/results`                                         |
| marksheet PDF         | draft/official label                                                                                                                                                                                                  | `GET /portal/guardian/results/:id/marksheet`                     |
| `guardian.routine`    | exam routine PDF                                                                                                                                                                                                      | `GET /portal/guardian/exam-sessions/:id/routine`                 |

Financial-position fields mirror the existing staff endpoint
`GET /finance/students/:studentId/financial-position` (receivable, advance, netOutstanding, per
invoice outstanding/status) — same service, guardian-scoped. The portal adds the guardian-pool and
invoice-group fields; their exact shape, how voided documents appear, and the optional per-exam "hide
from guardians" switch (A11) are decided in the Portal read API ADR (WP-5). Until that ADR is
accepted, treat this table as intent, not contract.

---

# 4. Not in v1

Online fee payment (payment gateway = integration + finance ADR), notices and push (M4), class
timetable (no backend model), per-student ledger statement (backend has only reconciliation
today), messaging teachers, student self-login (backend `STUDENT_ARCHITECTURE.md` §8 — optional
future User↔Student link).

---

# 5. Future

| Item                           | Depends on                                                        |
| ------------------------------ | ----------------------------------------------------------------- |
| Notices / announcements + push | notices module ADR, push tokens, backend Phase 9                  |
| Ledger statement               | Finance ADR / endpoint                                            |
| Online payment                 | payment gateway integration ADR (Phase 9) + finance posting rules |
| Leave application for child    | attendance domain extension ADR                                   |
| Homework view                  | M5 teacher homework feature                                       |
