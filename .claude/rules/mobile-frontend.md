# Mobile Frontend Rules

## 1. Reuse First

Before creating a component, hook or helper:

1. Search `src/components`, `src/lib`, `src/features`.
2. Search at least one analogous feature.
3. Reuse or generalize; do not create a teacher-specific or guardian-specific copy of a shared
   component.
4. Document any unavoidable new shared component in `docs/frontend/UI_SYSTEM.md`.

---

## 2. One API Client

There is exactly one HTTP client: `src/api/client.ts`. Do not call `fetch` anywhere else. Do not
create a second wrapper. Feature code calls typed request functions in `src/api/<domain>.ts`.

---

## 3. Server State Lives in TanStack Query

- No server data in React context or a global store.
- Query keys always start with `[tenantId, ...]` so a school switch never shows another school's
  cache.
- Use the `staleTime` classes in `.claude/rules/api-and-data.md`; do not invent per-screen values.

---

## 4. No Hardcoded Configuration

Do not hardcode currency, date format, calendar (AD/BS), fiscal year, school name, tax, grade
scales. Read them from tenant settings / API responses.

---

## 5. Centralized Dates

All date display and input goes through `src/lib/date.ts` (one module, wraps
`nepali-date-converter`). Canonical value is AD `YYYY-MM-DD` — same as the backend. Never format a
date inline in a screen.

---

## 6. Theming

Colors, spacing, radius and typography come from `src/theme/tokens.ts` (mirrors the web CSS
variables — see `docs/frontend/UI_SYSTEM.md`). No literal colors in components. Support light and
dark.

---

## 7. Permission-Aware UI Is Not Security

Hide/disable actions the user lacks permission for (hint from `GET /tenancy/my-permissions`), but
always handle a 403 from the backend gracefully.

---

## 8. Feature Modules

New functionality is added as a feature module registered in `src/features/registry.ts` (see
`docs/architecture/FEATURE_MODULES.md`). Do not add tabs or routes outside the registry.

---

## 9. Accessibility and Low-End Devices

- Touch targets ≥ 44pt; screen-reader labels on icon buttons.
- Long lists use `FlatList`/`FlashList` with stable keys; never `ScrollView` + `map` for rosters.
- Test on a low-end Android device profile.
