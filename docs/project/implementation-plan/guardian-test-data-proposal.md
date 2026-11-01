---
description: Revised test-data proposal for the guardian fee and notification checks on the owner's mobile test database (zn_school_mobile_test). Read-only portal for guardians; payments recorded by staff only; notifications informational. Awaiting decisions; nothing created.
purpose: Give the owner one reviewable list of decisions and writes before any finance or exam record is created, and name the conflicts with accepted decisions that must be settled first.
access: Read
---

# Guardian test data — revised proposal (awaiting decisions)

**Status: proposed, 2026-10-31 (revision 2). Nothing has been written.** Target: `zn_school_mobile_test` only (API `:3411`, image
`sha256:5caf…`). The development database and the dev API are out of scope. No Day-End run.

This revision follows the owner's 2026-10-31 requirements: the Guardian Portal is read-only; guardians see only the fee information the
school intends for them; they receive informational fee notifications; payments are recorded only by staff.

---

## 0. Decisions needed before anything is created (blocking)

| # | Conflict or gap | Source | What is needed from the owner |
| --- | --- | --- | --- |
| D-A | **Guardian invoice and receipt PDFs** are required by an accepted ADR and built, but the new requirements forbid guardians to view, open, download or print invoices and receipts. | ADR-0081 D1–D2 (**Accepted**, built 2026-10-31); `GET /portal/guardian/invoices/:id/pdf`, `…/payments/:id/receipt`; mobile plan GV-D6r | Confirm the owner's requirement, then **amend ADR-0081** (an accepted ADR is not changed by the app work) and remove the two routes. Until then they stay live but must not be built into the app. |
| D-B | **Guardian fees route** returns invoice rows (`position.invoices`) and payment rows (`payments.rows`). The requirements allow neither. | ENDPOINTS §7e (`GET /portal/guardian/students/:id/fees`) | Choose a reduced guardian fee summary (for example: `netOutstanding`, a per-child status, the last payment date and amount, and the due date of the next bill) and a new read route or a changed response. This is a backend contract change and needs approval. |
| D-C | **No notification exists** for "bill issued" or "payment received". The contract lists seven types; none is finance. | `communication-events.contract.ts` (`NOTIFICATION_TYPE`) | Approve two new informational types (`invoice_issued`, `payment_recorded`) raised by Finance through the communication event path (module boundary, ADR-0069 D6 pattern). Without this, requirements 6 and 7 cannot be tested. |
| D-D | **Fiscal-year dates.** The "Shrawan 1 – Asar 31" rule is **not written** in any repo document or memory (only month-name lists exist). The earlier 14 April – 13 April dates are not that rule. | repo search, 2026-10-31 | The owner states the exact dates (AD) for this school's fiscal year, or confirms where the rule is recorded. Conversion from Bikram Sambat must use the centralised date handling, not a hand-made calculation. |
| D-E | **Currency and required School Setup fields** are missing: `currencyCode`, `currencySymbol`, `country`, `phonePrimary`. `currencyDecimalPlaces` and `receiptPrefix` are also unset. | `GET /school-setup`; ADR-0081 D4 | The owner gives every value. None is assumed. Once a posted invoice exists, the `finance_identity` group locks (ADR-0039). |
| D-F | Test results: lock and notify (for the seven section-A students' guardians, in the test database only). | ENDPOINTS §7a, `results/publish` and `results/lock` | Yes or no. |

**No write happens until D-A to D-F are decided and the exact values are presented back and approved.**

---

## 1. Current state (Reproduced; read-only queries and admin GETs, 2026-10-31)

| Item | State |
| --- | --- |
| Guardian | `3cf0ebbc…`, activated, mobile login works |
| Children | **Child One** (`STU-2026-0007`, Grade 1 **A**, primary); **Child Two** (`STU-2026-0008`, Grade 1 **B**) |
| Academic year | `2082/83` |
| Finance setup | none: no fiscal year, chart of accounts, voucher types, payment methods, tax types, fee groups, categories, plans, cash or bank accounts |
| Invoices, payments | 0 and 0 |
| Exams | "Mobile Check …": exam `published`, results `pending`; section A has 7 active enrolments |
| Released result | one result of another family's student (`64351fed…`), used for the isolation check |
| School Setup | `currencyCode: null`, `currencySymbol: null`, missing required fields `country`, `phonePrimary`; `finance_identity` open |

**`currencyCode: null` (resolved):** the API is correct. `GET /settings/tenant` reads `tenant_settings.currency_code`; the test tenant has
no such row and no currency was ever set. No default is substituted (D-E).

---

## 2. Revised test-data sequence (executes only after §0 is decided)

Each step uses an existing application service through its public route, with a staff account. No direct SQL writes.

| # | Operation (route) | Records | Financial / accounting effect |
| --- | --- | --- | --- |
| 1 | `PATCH /school-setup` with the approved finance and required fields (D-E) | `tenant_settings`, `tenants`, `number_sequences` | none (configuration) |
| 2 | `POST /finance/chart-of-accounts/seed` `{ tenantId }` | account groups, ledgers, default links, voucher types, payment methods as the seed creates them | none |
| 3 | `POST /finance/fiscal-years` with the approved dates (D-D) | `fiscal_years` (`open`) | none |
| 4 | `POST /finance/fee-groups`, `POST /finance/fee-occurrences`, `POST /finance/fee-categories`, `POST /finance/fee-plans`, `POST /finance/fee-plans/:id/lines` (one line, amount per D-E) | fee master data | none |
| 5 | `POST /finance/fee-assignments/plan/bulk` `{ feePlanId, studentIds: [Child One, Child Two] }` | two assignments | none (assignment is not a charge) |
| 6 | `POST /finance/billing-runs` (or per assignment `POST /finance/fee-assignments/:id/generate-invoice`), `autoPost: false`, `invoiceDate` set | two **draft** invoices | none until posted |
| 7 | `POST /finance/invoices/:id/post` for each invoice | invoices `posted`; Fees' student-ledger `due` entry; a staged draft voucher `Dr AR / Cr Fee Income` (amount = the plan line) | Receivable per child; no Day-End |
| 8 | Staff records a payment: `POST /finance/payments` `{ fiscalYearId, studentId: Child One, paymentDate, amount, method, paymentMethodId, allocations: [{ invoiceId, amount }], idempotencyKey }` | one payment, one allocation | staged voucher `Dr Cash/Bank / Cr AR` for the amount; Child One's outstanding falls by that amount |
| 9 | Notifications, once D-C is approved and built: `invoice_issued` at step 7, `payment_recorded` at step 8 | notification rows for the guardian(s) linked to the child | none |

**Staff-only actions:** steps 1–8 are performed by a staff account (`portal-teacher-admin`), never by the guardian's session.

## 3. Exact finance values (to be approved; none assumed)

| Value | Source of the value | Status |
| --- | --- | --- |
| `currencyCode`, `currencySymbol`, `currencyDecimalPlaces`, `receiptPrefix` | owner | **needed** (D-E) |
| `country`, `phonePrimary` (School Setup required fields) | owner | **needed** (D-E) |
| Fiscal year start and end (AD) | owner (rule not found in repo, D-D) | **needed** |
| Fee plan line amount | owner (proposed: 5000.00, quantity 1) | **needed** |
| Payment amount | owner (proposed: 2000.00, cash) | **needed** |
| `invoiceDate` and `dueDate` | owner | **needed** |

## 4. Records to be created, with financial effects

Two posted invoices (one per child, the plan line amount each), one payment of the approved amount allocated to Child One's invoice,
and the configuration in step 1–5. Each posting stages a voucher that is pending until Day-End; this plan does not run Day-End.

## 5. Notifications that will be generated, and who receives them

Only after D-C is approved and built:

| Event | Type (proposed) | Recipient | Content (informational) |
| --- | --- | --- | --- |
| Step 7, invoice posted | `invoice_issued` | guardians linked to the child (both children's guardians, if any) | "A new bill has been issued for {child}." No amount, no link, no document. *Amount exposure to be decided.* |
| Step 8, payment recorded | `payment_recorded` | the guardians linked to the child | "A payment has been recorded for {child}." No amount unless the owner approves it. |

No notification is sent to any real person: the test database has only the designated test accounts.

## 6. Guardian access-denial tests (to run after the writes)

Run as the activated guardian (Child One's family) and as the other guardian (Child Two's family, or the outside family):

1. **Read-only:** every `POST`, `PATCH` and `DELETE` on finance, fee and invoice routes is refused for a guardian (403).
2. **Invoice details and documents:** `GET /finance/invoices/…` (staff) and the guardian routes for an invoice → 403; the invoice PDF
   route (`…/invoices/:id/pdf`) → 403 once D-A is applied (and 403 for every id today).
3. **Receipts and payments:** the receipt route → 403; `POST /finance/payments` → 403 for the guardian; the guardian fees route (once D-B
   is applied) shows only the approved summary, with no invoice or payment rows.
4. **Fiscal years and configuration:** `GET /finance/fiscal-years`, `POST /finance/fiscal-years`, the fee plan, category and occurrence
   routes → 403 for the guardian (the staff-route sweep already shows 403 for guardians on every staff route).
5. **Other family:** Child One's fee summary, notifications and documents under the other guardian → 403 or an empty list, never data.
6. **Unknown ids:** the same 403 as "not yours" (no existence leak).
7. **Notifications contain no links to documents and no payment action** (checked in the notification row content and the rendered app).
8. **Settings:** `GET /settings/tenant` shows `currencyCode` equal to the approved value (the field works, not only the null case).

## 7. Cleanup: limitations and the recommended retention approach

| Record | Supported way out | Limit |
| --- | --- | --- |
| Invoice payment | `POST /finance/payments/:id/cancel` is **refused** for invoice payments (advances only). `POST /finance/payments/:id/reverse` needs **Day-End** to have run. | **No supported reversal exists without Day-End.** |
| Invoice | `POST /finance/invoices/:id/void` cancels a posted invoice before Day-End and releases its fees; `unpost` is refused while a payment is allocated. | Must follow the payment's removal, which is impossible here (above) |
| Results | platform-only unpublish `POST …/:examId/unpublish` (`published` → `draft`). **Not verified:** unpublish of a `locked` result, and lock release. | platform admin only |
| Notifications | rows stay in the inbox | cannot be deleted by a guardian; the test stack only |
| Configuration | archive or deactivate (`active: false`); never deleted (ADR-0029) | rows remain |

**Recommended retention (option A):** keep the posted test invoice and payment as test history, archive the configuration after the
checks, and record that these records exist and cannot be reversed without Day-End. Nothing immutable is altered and no Day-End is run.
**Option B:** drop and recreate `zn_school_mobile_test`. It removes all test data and the owner's test accounts, so it needs a separate,
explicit approval.

---

## 8. Approvals requested (answer each)

1. D-A: confirm the guardian no-PDF requirement, and approve the ADR-0081 amendment that removes guardian invoice and receipt PDFs.
2. D-B: approve the reduced guardian fee summary and name the fields it shows (or ask for a proposal).
3. D-C: approve the two informational finance notification types and whether the amount may appear in them.
4. D-D: the exact fiscal-year AD dates, or the place the Shrawan 1 – Asar 31 rule is recorded.
5. D-E: the currency code, symbol, decimal places, receipt prefix, country and primary phone.
6. Fee plan line amount, payment amount, `invoiceDate` and `dueDate`.
7. D-F: lock and notify the test results (yes or no).
8. Cleanup: option A (recommended) or option B.

Nothing above is executed until these are answered.
