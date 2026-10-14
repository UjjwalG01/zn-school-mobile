# Mobile Security Rules

## 1. Token Storage

- Access and refresh tokens live **only** in `expo-secure-store`.
- Never in AsyncStorage, the query cache, logs, crash reports, analytics or deep links.
- The access token may be held in memory as well; the refresh token is read from SecureStore when
  needed.

---

## 2. Refresh

- One refresh in flight at a time (single-flight lock); queued requests wait for it.
- Refresh tokens rotate on every refresh — always persist the new pair before using it.
- A 401 from `/identity/refresh` = session over → full local logout (§4).

---

## 3. Authentication ≠ School Access

Being logged in does not mean access to a school. Always resolve schools via
`GET /tenancy/my-schools` and handle `TENANT_MEMBERSHIP_NOT_FOUND` / `TENANT_ACCESS_DENIED` /
`LICENSE_*` by leaving that school.

---

## 4. Logout and School Switch

Logout: call `POST /identity/logout`, delete SecureStore entries, clear the persisted query cache,
delete downloaded PDFs. School switch: clear the in-memory and persisted cache of the previous
school (query keys are prefixed by `tenantId`, so remove by prefix).

---

## 5. Guardian Data Boundary

Guardian screens call only `/portal/guardian/*` endpoints (once approved). Never call staff
endpoints (`/students`, `/finance/*`) from guardian screens, even if they happen to succeed.

---

## 6. Activation Codes

Treat activation codes like passwords: never log them, never persist them after use, clear the
input on success.

---

## 7. Device

- Optional biometric unlock gates the UI locally; it is not a server credential.
- Screenshots are not blocked by default (blocking them on finance/result screens is a later
  decision, not a default).
- Release builds: no dev menu, no `console.log` of payloads, HTTPS-only API URL.

---

## 8. Secrets

No secret in `EXPO_PUBLIC_*`, `app.json`, or source. The app has no secrets — anything it needs is
public by definition.
