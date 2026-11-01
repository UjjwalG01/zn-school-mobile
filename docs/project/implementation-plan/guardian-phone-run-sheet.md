# Guardian portal: phone run sheet

**Status: not run on a phone.** This sheet is for the owner to run on a physical phone. Nothing here has been executed on a device.

## Before you start

- Stack: the test API at `http://192.168.1.65:3411` (container `zn-mobile-test-api`, database `zn_school_mobile_test`). It serves the
  guardian routes as built on 2026-10-31. It runs an older image than the web repo's latest backend, so the finance notification events
  and the removed invoice and receipt routes are **not** on it until the image is rebuilt (owner approval needed).
- Build: the app with `EXPO_PUBLIC_API_URL=http://192.168.1.65:3411` (dev client on the phone).
- Account: a guardian login linked to a child on the test school. Use the owner's own credentials. None are written in this repo.
- Data limits (known): the test child has no released and issued marksheet, so the download step can only show the refusal. No invoice
  or payment exists for the test child, so no finance notification row can appear yet.

## Steps

Record each step as Pass, Fail or Not tested, with the phone model, Android or iOS version, and a screenshot for any Fail.

| # | Step | Expected |
|---|------|----------|
| 1 | Sign in as the guardian, pick the school | Home opens; the child card shows; no teacher tabs |
| 2 | Home: child card, upcoming events, latest notices, advance (if any) | Figures match the web for the same child; the advance shows a currency code only if the school has one set |
| 3 | Attendance: change the month with the stepper; try to go past this month | The stepper stops at the current month; each day shows a label (Present, Absent, Late, ...), never a raw code |
| 4 | Results: open a released result | Summary and subject marks show |
| 5 | Results: tap "View marksheet" | A preview opens with the figures; nothing is downloaded yet |
| 6 | In the preview: tap "Download marksheet" with no issued marksheet | A plain message: "The marksheet is not ready yet. Ask the school." (or the refusal text) |
| 7 | Same, with an issued marksheet (once the owner has one) | The share sheet opens with the PDF; the file can be saved or printed |
| 8 | Fees: the summary | Owes or clear, the net outstanding, invoiced, paid, refunded, advance, last payment; **no** invoice list, receipt, payment history or pay button |
| 9 | Child switcher with two children (if the test account has them) | Switching changes every tab's child; a remembered child stays after restart |
| 10 | Inbox: open it from the bell | Rows show with their labels; a row for an absence or results does not open a screen; a calendar row opens the calendar |
| 11 | Notices, then Calendar: change the month | Lists load; an empty month says so |
| 12 | Airplane mode, then open a tab | An offline message, not a crash; back online it recovers |
| 13 | Switch to Nepali (Profile) | Labels translate; check text fits on a small screen (provisional strings) |
| 14 | Text size at the largest system setting | No clipped buttons on Home, Results and the preview |
| 15 | Sign out, then sign in as a different guardian | No data from the first account shows |

## Known gaps (not verified by this run)

- Finance notifications (`invoice_issued`, `payment_recorded`): built in the web repo, not on the test stack, no test data.
- Fiscal year: not shown in the guardian app (see the plan §16).
- Nepali strings are provisional; native review is pending.
