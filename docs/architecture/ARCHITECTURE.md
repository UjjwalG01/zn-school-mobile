---
description: Architecture of the ZN School mobile app — layers, role shells, data flow, caching, build and release.
purpose: The approved shape every mobile feature must fit into.
access: Read
---

# Mobile Architecture

## Status

Designed (2026-10-14). Not implemented. Decisions marked **Proposed** need user approval before
code depends on them.

---

# 1. Position in the platform

```text
 Web app (React)        Mobile app (Expo RN)
        \                    /
         \   HTTPS + JWT    /
          NestJS API (backend repo)  ── one codebase, one set of rules
               │            │
         primary DB    read replica (portal reads, B9)
          (writes)      (falls back to primary)
```

- No mobile-specific backend, no BFF, no second database. SSOT stays in the backend.
- The mobile app is a **client only**: no business rules, no calculations of fees/results/grades.

---

# 2. Layers

```text
app/ (expo-router routes)          screens: layout + composition only
  └── src/features/<feature>/      feature module: screens, hooks, components for one capability
        └── src/api/<domain>.ts    typed request functions (one per endpoint)
              └── src/api/client.ts   the ONE HTTP client: base URL, Bearer, tenantId,
                                      ApiError, single-flight refresh, events
src/auth/                          session state, SecureStore, refresh, logout
src/lib/                           date (AD/BS), money format, permission hint, ids
src/components/ , src/theme/       shared UI + tokens
```

Rules:

- Screens never call `fetch` or `client` directly — only feature hooks (`useQuery`/`useMutation`
  wrapping `src/api/*`).
- Features never import from another feature's internals; shared code moves to `src/components`
  or `src/lib`.

---

# 3. Context resolution (who am I, where, as what)

```text
login → GET /identity/me
      → GET /tenancy/my-schools           (0 → "no school access" screen; 1 → auto-select; n → picker)
      → GET /tenancy/my-permissions?tenantId=
      → resolve shells for that school:
           teacher shell  if user holds a staff role with teacher capabilities (B5 assignments exist
                          or attendance.mark / exam_result.save permission)
           guardian shell if user holds the guardian-audience role (B4)
           both → shell switcher in the header
           neither (e.g. accountant only) → "use the web app" screen
```

Selected `tenantId` and shell are persisted (non-secret) so a restart lands on the same screen
without extra calls; they are revalidated in the background.

---

# 4. Navigation

expo-router file-based groups: `(auth)`, `(teacher)`, `(guardian)`. Each shell is a tab layout whose
tabs come from the **feature registry** (see `FEATURE_MODULES.md`), not hardcoded. Deep links use
the `znschool://` scheme (activation, later notifications).

---

# 5. Data layer and caching

- **TanStack Query** is the only server-state store. Query keys: `[tenantId, domain, ...params]`.
- **Persisted cache** (AsyncStorage persister, throttled writes, versioned buster key = app
  version) so cold start renders cached data instantly, then revalidates per `staleTime` class
  (`.claude/rules/api-and-data.md` §5).
- `refetchOnWindowFocus` → replaced by app-foreground refetch, throttled to once per 60 s, and only
  for stale queries.
- No polling anywhere.
- Mutations invalidate only their own keys.

Load-reduction summary (why the app is light on the server):

| Measure | Effect |
|---|---|
| Long mobile session (B1) | no repeated logins; one refresh per ~15 min of active use |
| `/portal/*/home` aggregates (B7) | one request on app open instead of 4–6 |
| Bulk attendance (B6) | 1 request per section instead of N |
| Persisted cache + staleTime | most screens open without a request |
| Reprint PDFs cached on device | PDF rendered once server-side, downloaded once |
| Read replica (B9) | guardian traffic off the primary |

---

# 6. Offline behavior (until M6)

- Reads: show persisted cache with an "as of <time>" banner when offline.
- Writes: blocked with a clear message when offline; never silently queued.
- Offline write queue is M6 (backend Phase 10) — do not build earlier.

---

# 7. Error handling

One mapping from `ApiError.errorCode` to app behavior lives in `src/api/errors.ts` (see
`docs/api/API_CONTRACT.md` §4). Screens show the mapped message; unknown errors show a generic
message and are reported to the crash reporter (without payloads).

---

# 8. Build, environments, release

- EAS Build profiles: `development` (dev client), `staging`, `production`.
- **EAS Update** for JS-only fixes, channel per profile. Native changes require a store build.
- `app.config.ts` reads `EXPO_PUBLIC_API_URL` per profile. Production URL must be HTTPS.
- Minimum OS targets and app store identifiers: decided in M1 (Proposed).
- Version check: if the backend later adds a minimum-app-version header, the app shows a forced
  update screen (Proposed, needs backend ADR).

---

# 9. Shared code with the backend repo

`@zn-school/shared-types` is a private workspace package (TypeScript source, not published) and
exports only `ApiError` and document-layout types. The backend has no shared DTO package. For now
the mobile app **hand-writes response types** in `src/api/types/` from `ENDPOINTS.md`.
Publishing shared types (or OpenAPI codegen) is a backend decision — Proposed, not assumed.

---

# 10. Decision table

| # | Decision | Status |
|---|---|---|
| A1 | Expo managed + dev builds + EAS | Decided (user, 2026-10-14) |
| A2 | expo-router | Decided |
| A3 | TanStack Query + persisted cache as the only server-state store | Decided |
| A4 | expo-secure-store for tokens | Decided |
| A5 | No local database (SQLite) until M6 | Proposed |
| A6 | Hand-written API types until backend offers shared types/OpenAPI | Proposed |
| A7 | Crash reporting provider | Open (decide in M1) |
| A8 | Push provider (Expo push vs FCM direct) | Open (M4) |
