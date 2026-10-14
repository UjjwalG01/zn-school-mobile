# ZN School Mobile

The mobile companion app of the **ZN School Operations Platform** — one app for **teachers** and
**guardians**, running against the same NestJS API and PostgreSQL database as the web platform.

## Status

Planned. No code exists yet. See `docs/project/project-status.md`.

---

## What it does

| Audience | v1 (see roadmap M2/M3) | Later |
|---|---|---|
| Teacher | My classes/subjects, section attendance, marks entry for exams open to entry, exam routine | Classroom, homework/assignments, lesson planning, question capture by scan |
| Guardian | Linked children, profile, attendance history, fee position, invoices, payments + receipts, published results + marksheet, exam routine | Notices, push notifications, class timetable |

A user can be a teacher **and** a guardian, and can belong to several schools. The app shows the
shell that matches the roles the user holds in the selected school.

Access always requires: identity → authentication → active school membership → role → permission
(enforced by the backend, never by the app).

---

## Tech stack

| Concern | Choice |
|---|---|
| Runtime | Expo SDK (managed workflow, **dev builds**, EAS Build/Update) |
| Language | TypeScript (strict) |
| UI | React Native + React 19 (matches web) |
| Routing | expo-router (file-based) |
| Server state | TanStack Query + persisted cache (AsyncStorage persister) |
| Secure storage | expo-secure-store (tokens only) |
| Local unlock | expo-local-authentication (optional biometric unlock) |
| Camera / QR | expo-camera (activation QR; later: question scanning) |
| PDF | download from reprint endpoints → expo-file-system → OS viewer / expo-sharing |
| Dates | `nepali-date-converter` (same library and rules as the backend/web) |
| Toasts | one shared toast component (web uses `sonner`; pick one RN equivalent, do not mix) |
| Tests | Jest + React Native Testing Library; Maestro for E2E flows |

Do not add a library outside this table without following `CLAUDE.md` → Dependency Discipline.

---

## Setup

Prerequisites: Node ≥ 22, pnpm ≥ 10, Expo account (EAS), Android Studio and/or Xcode for dev
builds, a running backend API (see backend repo `README`).

```powershell
pnpm install
Copy-Item .env.example .env        # then edit EXPO_PUBLIC_API_URL
pnpm start                         # Metro + Expo dev client
pnpm android                       # or: pnpm ios
```

### Environment

| Variable | Meaning |
|---|---|
| `EXPO_PUBLIC_API_URL` | Backend base URL, e.g. `http://192.168.1.10:3001` (a device cannot reach `localhost`) |
| `EXPO_PUBLIC_APP_ENV` | `development` \| `staging` \| `production` |

`EXPO_PUBLIC_*` values are bundled into the app — **never put a secret in them**.

### Dependency notes

- **ESLint is pinned to 9.x** (`eslint@^9.39.5`). `eslint-config-expo` pulls in `eslint-plugin-react`
  and `eslint-plugin-import`, which do not support ESLint 10 yet. `expo install eslint` resolves to
  10 — do not accept that bump until both plugins list ESLint 10 in their peer range. pnpm marks the
  9.x line as deprecated; that is expected.
- **`unrs-resolver` install script is denied** (`allowBuilds` in `pnpm-workspace.yaml`). pnpm 11
  blocks dependency build scripts by default. This one only compiles an optional native speed-up
  for the import resolver; linting works without it. Do not run `pnpm approve-builds` for it, and
  review any new entry pnpm adds to `allowBuilds` before committing it.
- **Installing dev dependencies on Windows:** PowerShell swallows `--`, so
  `pnpm exec expo install <pkg> -- --save-dev` fails there. Use `pnpm add -D <pkg>` (then
  `pnpm exec expo install --check`), or run the `expo install` form from Git Bash.
- **Tests must not live under `app/`** — expo-router treats every file there as a route. Put them in
  the root `__tests__/` or next to library code in `src/**/__tests__/`.

---

## Scripts (to be created in M1)

| Script | Does |
|---|---|
| `pnpm start` | Expo dev server |
| `pnpm android` / `pnpm ios` | Run dev build |
| `pnpm lint` | ESLint |
| `pnpm typecheck` | `tsc --noEmit` |
| `pnpm test` | Jest |
| `pnpm verify` | lint + typecheck + test |

---

## Folder structure (target)

```text
app/                    expo-router routes
  (auth)/               activation, login, school picker, role picker
  (teacher)/            teacher shell (tabs)
  (guardian)/           guardian shell (tabs)
src/
  api/                  the ONE api client + per-domain request functions
  auth/                 session store, refresh, secure storage
  features/             one folder per feature module (see docs/architecture/FEATURE_MODULES.md)
  components/           shared UI components
  lib/                  date, format, money, permissions helpers
  theme/                design tokens
docs/                   project documentation (this kit)
```

---

## Documentation

Start with `CLAUDE.md`, then `docs/project/project-status.md` and `docs/project/roadmap.md`.
