---
description: Mobile UI system — design tokens aligned with the web app, shared components, dates (AD/BS), language, accessibility and PDF viewing.
purpose: Keep one visual grammar across mobile screens and consistent with the web platform.
access: Read
---

# UI System

## Status

Designed. Built in M1.

---

# 1. Design tokens

`src/theme/tokens.ts` is the only place colors, spacing, radius and type live. Light values mirror
the web CSS variables in the backend repo `apps/web/src/index.css`:

| Token         | Web variable           | Light     |
| ------------- | ---------------------- | --------- |
| `bg`          | `--color-bg-content`   | `#f5f6f8` |
| `card`        | `--color-bg-card`      | `#ffffff` |
| `header`      | `--color-bg-header`    | `#1c2131` |
| `brand`       | `--color-bg-sidebar`   | `#1e3a8a` |
| `text`        | `--color-text`         | `#282a2e` |
| `textMuted`   | `--color-text-muted`   | `#6b7280` |
| `textInverse` | `--color-text-inverse` | `#f5f6f8` |
| `accent`      | `--color-accent`       | `#2563eb` |
| `border`      | `--color-border`       | `#e0e0e0` |
| `destructive` | `--color-destructive`  | `#dc2626` |
| `success`     | `--color-success`      | `#16a34a` |
| `warning`     | `--color-warning`      | `#d97706` |
| `radius`      | `--radius`             | 8         |

Dark values are defined alongside (M1). When the web palette changes, update this table and the
tokens together. Components never use literal colors.

---

# 2. Shared components (build once in `src/components`)

| Component                                           | Use                                                                                                                                                                |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `Screen`                                            | safe area, header, pull-to-refresh, offline/"as of" banner                                                                                                         |
| `ListScreen`                                        | `FlashList` + empty/loading/error states + pagination                                                                                                              |
| `Card`                                  | home summaries                                                                                                                                                     |
| `StatusBadge`                                       | same statuses/colors as web (`present/absent/late/half_day/excused`, `paid/partial/unpaid`, `published/locked`); attendance labels come from the school's settings |
| `Field`, `TextField`, `PasswordField`, `PhoneField` | forms with `label` / `error` (web `Input` contract)                                                                                                                |
| `Select` (bottom sheet)                             | single choice pickers                                                                                                                                              |
| `DateField`, `DateText`                             | AD/BS (see §3)                                                                                                                                                     |
| `Money`                                             | formats API amounts with tenant currency settings                                                                                                                  |
| `PdfButton`                                         | download (cached) + open/share                                                                                                                                     |
| `ConfirmSheet`                                      | destructive / submit confirmations                                                                                                                                 |
| `Skeleton`                                          | loading placeholders (only for network-bound loads)                                                                                                                |
| `Toast`                                             | one toast API app-wide                                                                                                                                             |
| `Banner`                                            | `info` / `warning` note under the header (saved data, returned subjects); the offline banner reuses it                                                             |
| `QueryState`                                        | loading / error / empty / content for one query (error → view mapping via `errorAction`); `hideOnForbidden` hides a section on a plain 403                         |

Built with the teacher shell (2026-10-21, `docs/project/TEACHER_APP_PLAN.md`; unit-tested, not seen on a device):
`SegmentedControl` (`src/components/SegmentedControl.tsx`: two or three subtabs inside one screen, ≥ 44 pt, tokens
only, each option `accessibilityRole="tab"` with a `selected` state, the group labelled; used by Attendance for
Student Attendance / My Attendance; the screen renders it above its scrolling area so it stays on screen), `Stepper`
(`Stepper.tsx`: previous / next chevron icons around a label; `DateStepper` and the month stepper of My Attendance are
built on it), and tab icons from `@expo/vector-icons` (the Ionicons set only, imported
from `@expo/vector-icons/Ionicons` so no other icon font is bundled; one explicit dependency approved by the owner on
2026-10-21; a tab always keeps its text label, the icon is never the only signal). The tab bar takes its colours from the
tokens, and so do the navigation headers (`useHeaderOptions` in `src/theme/useTheme.ts`: card surface and text colour, so a
header follows the dark scheme). The active tab shows the filled glyph (`home`) and the others the outline
(`home-outline`), so the state is not carried by colour alone. A tappable `Card` ends in a chevron; a static card, and
the flat muted "Coming soon" rows of the Academic hub, do not, so a row that does nothing never looks like a button.
The Dashboard's count tile (a number over a label on a `Card`) is a local component of `HomeScreen`, because one screen
uses it; it moves to `src/components` when a second one does. `AccountActions` (Profile, and the guardian placeholder):
Switch school and Sign out are quiet link buttons, as on the school-context screens, and Sign out asks first with a
native `Alert` (it wipes the session and the cached data). A screen whose navigation header already names it does not
repeat the title in its body (Profile, More).

Teacher and guardian screens compose these; no per-feature copies.

Built so far: `Screen` (pull-to-refresh only when `onRefresh` is passed), `Card` (button with a trailing chevron only
when `onPress` is passed), `StatusBadge` (generic tones `success | warning | danger | neutral`, the label
is always shown; the web status-to-colour mapping above is not built yet), `Banner`, `QueryState`,
`AccountActions` ("Switch school" when more than one school, "Sign out"; used by Home and the
guardian placeholder until an account screen exists), and `ListScreen` (safe area + a virtualized
`SectionList`; **built without FlashList**, which would be a new dependency, and without the
pagination part, which arrives with the first paginated list), `Toast` (a store, `showToast(message, tone)`
in `src/lib/toast.ts`, plus `ToastHost` mounted once in the root layout; one toast at a time, shown at the
top so it never covers a bottom action, announced to screen readers), and `OfflineBanner` (the "Showing
saved data from <time>" note built on `Banner`; pass it `savedDataTimestamp([...queries])`). The root
layout also exports `ErrorFallback` as expo-router's `ErrorBoundary`: a plain "Something went wrong /
Try again" screen that never shows the error text. `DateStepper` (`src/components/DateStepper.tsx`: previous /
next day with the date in the tenant's calendar and the other calendar muted; `min` / `max` bounds disable the
arrows; generic by props, built for Attendance, reusable for Marks and the guardian month view). `ListScreen`
takes an optional `footer` rendered under the list (a sticky bar such as Attendance's Save button).
The rest of the table is still planned.

Built 2026-10-23 (`docs/project/CALENDAR_AND_EXAM_ATTENDANCE_PLAN.md`; unit-tested, not seen on a device): `SelectField`
(`src/components/SelectField.tsx`: the phone counterpart of the web's `Dropdown`. A labelled field, at least 44 pt, showing the chosen value
or a placeholder; it opens a sheet (core `Modal`, no new dependency) with a list of choices, each at least 44 pt, the chosen one carrying a check
as well as bold text and `accessibilityState.checked`; an optional first row clears an optional filter; a disabled field says why under it; the scrim
is the text colour at low opacity, not a literal colour. It knows nothing about exams: the caller keeps the value and decides what the next filter
offers). The exam filter step is built from it in `src/features/teacher/examFilters/` and reused by Marks entry and Exam attendance, so those two
flows look and behave alike (a feature-local form, not a shared component, until a second domain needs it). `LanguageSwitch`
(`src/components/LanguageSwitch.tsx`: English / नेपाली on `SegmentedControl`, each named in its own script; asks before re-mounting the screens
when any screen holds unsaved edits). The calendar's `MonthGrid` is a local component of the calendar feature (seven columns, each day at least
44 pt, a ring for today and a fill for the selected day, up to three marks, state never carried by colour alone).

---

# 3. Dates (AD/BS)

Same rules as the backend repo's `docs/frontend/date-system.md`:

- Library: `nepali-date-converter` (same as backend/web). One wrapper: `src/lib/date.ts`.
- Canonical value: AD `YYYY-MM-DD`. `DateField` always emits AD.
- Display calendar follows the tenant setting (`gregorian` | `nepali`); BS format `YYYY-MM-DD`.
- Supported BS range comes from the converter (BS 2000–2090) — read bounds from the wrapper, do not
  hardcode.
- Show the alternate calendar on long-press / secondary text, like the web's tooltip.

---

# 4. Language

English and Nepali strings from day one (`src/i18n/en.ts`, `ne.ts`), keys only in components. The language starts as the device's and the person changes it in Profile (`LanguageSwitch`; `chooseLocale` remembers it on the device, `loadStoredLocale` reads it before the first screen, `useLocale` makes the root layout re-mount its screens so every string is read again). The Nepali strings are drafted and need a fluent reviewer.
Numbers and money use the tenant locale settings. Library choice (e.g. `i18next` vs a tiny local
helper) is decided in M1 — prefer the smallest that supports interpolation and plurals.

---

# 5. Accessibility

Touch targets ≥ 44pt; labels on icon buttons; color is never the only signal (attendance status has
text + color); supports system font scaling to 1.3× without clipping.

---

# 6. PDFs

PDFs come only from backend reprint endpoints (the Document Engine renders them; the app never
builds documents). Flow: `PdfButton` → download with Bearer → cache file per tenant → open via OS
viewer / share sheet. A marksheet for a `published` (not `locked`) result is a watermarked draft —
show that label.

---

# 7. Design skills

UI work uses the project-enabled skills (see `CLAUDE.md` §9 and `.claude/rules/mobile-frontend.md`
§9):

1. `ui-ux-pro-max` before designing a screen or shared component.
2. `impeccable` (critique / polish / harden) on the result before it is called done.
3. `ponytail` / `ponytail-review` for the implementation and the diff.

The skills are web-leaning: take the principles (hierarchy, spacing rhythm, states, motion,
accessibility), then express them with §1 tokens and §2 components. No literal colors, no new UI or
animation libraries, no new fonts without approval. Any new shared component is listed in §2.
