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

| Token | Web variable | Light |
|---|---|---|
| `bg` | `--color-bg-content` | `#f5f6f8` |
| `card` | `--color-bg-card` | `#ffffff` |
| `header` | `--color-bg-header` | `#1c2131` |
| `brand` | `--color-bg-sidebar` | `#1e3a8a` |
| `text` | `--color-text` | `#282a2e` |
| `textMuted` | `--color-text-muted` | `#6b7280` |
| `textInverse` | `--color-text-inverse` | `#f5f6f8` |
| `accent` | `--color-accent` | `#2563eb` |
| `border` | `--color-border` | `#e0e0e0` |
| `destructive` | `--color-destructive` | `#dc2626` |
| `success` | `--color-success` | `#16a34a` |
| `warning` | `--color-warning` | `#d97706` |
| `radius` | `--radius` | 8 |
| `onAccent` | — (mobile-only) | `#ffffff` — text on `accent` surfaces (web uses white button text) |

Dark values are defined alongside (M1). When the web palette changes, update this table and the
tokens together. Components never use literal colors.

---

# 2. Shared components (build once in `src/components`)

| Component | Use |
|---|---|
| `Screen` | safe area, header, pull-to-refresh, offline/"as of" banner |
| `ListScreen` | `FlashList` + empty/loading/error states + pagination |
| `Text` | themed text (`variant`, `tone`); the only way screens render text — scales with system font size |
| `Button` | `primary` / `link` variants; `loading` blocks re-press; ≥ 44pt |
| `MessageScreen` | full-screen title + body + actions (empty, error, blocked states) |
| `ShellSwitcher`, `ShellPlaceholder` | header action for users with both shells; placeholder body of a shell tab until feature modules land |
| `Card`, `StatTile` | home summaries |
| `StatusBadge` | same statuses/colors as web (`present/absent/late/half_day`, `paid/partial/unpaid`, `published/locked`) |
| `Field`, `TextField`, `PasswordField`, `PhoneField` | forms with `label` / `error` (web `Input` contract) |
| `Select` (bottom sheet) | single choice pickers |
| `DateField`, `DateText` | AD/BS (see §3) |
| `Money` | formats API amounts with tenant currency settings |
| `PdfButton` | download (cached) + open/share |
| `ConfirmSheet` | destructive / submit confirmations |
| `Skeleton` | loading placeholders (only for network-bound loads) |
| `Toast` | one toast API app-wide |

Teacher and guardian screens compose these; no per-feature copies.

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

English and Nepali strings from day one (`src/i18n/en.ts`, `ne.ts`), keys only in components.
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
