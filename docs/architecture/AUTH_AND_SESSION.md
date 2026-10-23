---
description: Activation, login, multi-school selection, long mobile sessions, refresh, logout and local unlock for the mobile app.
purpose: Define the exact authentication and session behavior of the mobile client against the backend.
access: Read
---

# Auth and Session

## Status

Designed. Depends on backend B1 (mobile sessions), B2 (phone login), B3 (activation code) —
all **Proposed and not built** (verified 2026-10-16; they are backend work package WP-1). Today's
backend behavior is noted where it differs. In the mobile repo the parts that need no new backend
are built (email login, SecureStore tokens, single-flight refresh, logout, school/shell resolution);
activation, phone login, biometric unlock and change password remain — see `project-status.md` and
M1 in `docs/project/roadmap.md`.

---

# 1. Principles

- Authentication proves identity; school access requires membership + role + permission
  (backend-enforced).
- No self-signup. A user exists only because a School Admin invited/created them.
- The same credentials work on web and mobile; mobile shows a subset of features.

---

# 2. First-time activation

```text
School Admin (web) invites user ─→ activation slip: name, school, 8-char code, QR
                                   (B3; today: UUID token, delivered by hand)

App: "Activate account"
  scan QR  (znschool://activate?code=XXXXXXXX)   or   type code
  → set password (min 8, matches backend rule)
  → POST /tenancy/memberships/activate { code, password }     (B3; today: { token, password })
  → go to login with identifier prefilled if returned
```

- A user who already has a password (e.g. a teacher joining a 2nd school, or a teacher who is also
  a guardian) activates with the code only; the password field is hidden when the backend says it is
  not required.
- Codes are single use, 8 characters, **24-hour** expiry, entered with the phone or email on record, and attempt-limited per account (backend ADR-0067).

---

# 3. Login

```text
POST /identity/login { identifier, password, clientType: 'mobile' }    (B1+B2)
   today: { email, password } → { accessToken, refreshToken }
→ store tokens in SecureStore
→ GET /identity/me → GET /tenancy/my-schools → school picker / auto-select
→ GET /tenancy/my-permissions?tenantId= → shell resolution (ARCHITECTURE §3)
```

- `identifier` accepts phone (normalized to E.164, Nepal default `+977`) or email.
- `429 AUTH_TOO_MANY_ATTEMPTS` → show wait message, do not retry automatically.

---

# 4. Session lifetime (B1)

| Token               | Lifetime                                                 | Where                                 |
| ------------------- | -------------------------------------------------------- | ------------------------------------- |
| Access              | 15 min                                                   | memory (+ SecureStore for cold start) |
| Refresh             | 30 days per token, rotated on every refresh (each rotation issues a fresh token) | SecureStore                           |
| Inactivity (mobile) | `mobile_session_timeout_minutes`, default 7 days (max 7, no absolute cap; ADR-0066) | enforced by backend at refresh        |

Effect: a guardian opening the app at least weekly never re-enters a password: each refresh issues a fresh 30-day
token and there is no absolute session cap (backend ADR-0066).

Today (before B1) the backend applies the web inactivity limit (default 30 min) to mobile too —
M1 must not ship to real users before B1.

---

# 5. Refresh

- Proactive: refresh when the access token has < 60 s left at request time (no background timers —
  the app does nothing while closed).
- Reactive: on 401 from any non-auth endpoint, refresh once (single-flight), replay the request
  once; a second 401 → logout.
- `POST /identity/refresh { refreshToken }` → new pair; **persist before use**.
- Refresh 401 → full logout (session expired, revoked, password changed elsewhere, or user
  suspended).

---

# 6. Logout

`POST /identity/logout { refreshToken }` (best effort) → delete SecureStore tokens → clear persisted
query cache → delete cached PDFs → go to login. Works offline (local part always runs).

---

# 7. Multi-school

- School switch = change selected `tenantId`; no new token (backend has no tenant claim).
- Remove the previous school's cached queries by key prefix.
- On `TENANT_MEMBERSHIP_NOT_FOUND` / `TENANT_ACCESS_DENIED` for the selected school: drop it,
  refetch my-schools.
- On `LICENSE_*`: show the school's "service unavailable" state (login still works).

---

# 8. Local unlock (optional)

Biometric / device PIN via `expo-local-authentication` after the app has been backgrounded for a
configurable time (default 5 min). Purely local UI gate — the tokens are unchanged and the server
is not called. Recommended default ON for teacher shell (marks/attendance), OFF for guardian;
user-changeable.

---

# 9. Password

- Change password: `POST /identity/change-password { currentPassword, newPassword, refreshToken }`
  — passing the current refresh token keeps this device signed in; other sessions are revoked.
- Wrong current password = `400 AUTH_CURRENT_PASSWORD_INCORRECT` (not 401 — do not log out).
- Forgot password: **not available** in the backend (no reset flow). Until it exists, the app shows
  "Ask your school to re-issue an activation code". Self-service reset = backend ADR (Phase 9
  delivery channel).

---

# 10. Security checklist

See `.claude/rules/security.md`. In short: SecureStore only, no tokens/codes in logs, wipe on
logout, guardian screens only call `/portal/guardian/*`.
