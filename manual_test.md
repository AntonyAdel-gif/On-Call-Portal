# On‑Call Portal Manual Test Plan

---

## Mission Summary
Ensure the **On‑Call Portal** is reliable, secure, and easy to use for daily on‑call operations by validating authentication, schedule management, shift swaps, imports/exports, LDAP integration, background jobs, and role‑based access. Tests must catch functional regressions, surface usability issues, and provide clear, reproducible evidence for developers so fixes can be verified quickly.

---

## Objectives
- **Verify core flows:** login, dashboard, create/edit/delete rotations, shift swaps, import/export.
- **Validate integrations:** LDAP authentication, API endpoints, cron jobs, and notification delivery.
- **Confirm security and permissions:** RBAC enforcement and API authorization.
- **Capture usability issues:** form validation, error messages, and basic accessibility checks.
- **Provide reproducible evidence:** steps, screenshots, logs, and acceptance criteria for every failure.

---

## Acceptance Criteria for Test Run
- All **High** priority test cases pass or have tracked P0/P1 fixes with clear owners.
- Every failed case includes steps, evidence, severity, and a suggested workaround.
- Regression tests for fixed issues are added and scheduled for re‑run.
- Test lead and product owner sign off when target pass rate is met.

---
# AUTH-01a — Username rejected when trailing space entered

---

**Summary**  
When a user types a valid username with a trailing space (for example `Mekawy231 `) and submits the login form, the app rejects the username and the login fails. Trailing spaces should be ignored.

---

## 🔍 Steps to test
1. Open the app at `http://localhost:5173`.  
2. Click **Sign in**.  
3. In the username field type a valid username (e.g., `Mekawy231`) then press the **space** key once so the field contains `Mekawy231 `.  
4. Enter the correct password.  
5. Click **Submit** or press **Enter**.

---

## ✅ Expected
The app should **trim leading and trailing whitespace** from the username and proceed with authentication.  
Example: entering `Mekawy231 ` should be treated as `Mekawy231` and the user should be logged in and redirected to the personal dashboard.

---

## ❌ Actual result
Login fails while the trailing space is present; the user cannot sign in until the trailing space is removed.

---

## 🧾 Environment
- **Environment:** Local dev  
- **Browser:** Chrome 116 on Windows 10 (replace with actual)  
- **Backend branch:** `dev` (paste commit SHA)  
- **Frontend branch:** `main` (paste commit SHA)  
- **LLDAP:** running via Docker Compose  
- **URL:** `http://localhost:5173`

---

## ⚠️ Severity & Frequency
- **Severity:** **P1 (High)** — impacts login flow and is easy for users to trigger  
- **Frequency:** **Always** (reproducible every time)

---

## 📎 Evidence to attach
- Screenshot of the username field showing the trailing space.  
- Browser console log (DevTools → Console) if any errors appear.  
- Network request payload showing the username sent to backend (optional).

---

## 🛠 Workaround
Remove the trailing space from the username before submitting.

---

## 💡 Suggested fix
- **Frontend:** Trim username input before validation and before sending the request:
  ```js
  const username = usernameInput.value.trim();

---

### Example (filled) — AUTH-02 — Reject invalid credentials
```markdown

---
## AUTH-02 — Reject invalid credentials

---

**Summary**  
When a user enters a valid username but an incorrect password, the app should block login and show a clear, non‑revealing error message.

---

## 🔍 Steps to test
1. Open the app at `http://localhost:5173`.  
2. Click **Sign in**.  
3. Enter a valid LDAP username (e.g., `Mekawy231`).  
4. Enter an incorrect password (e.g., `wrongpass123`).  
5. Click **Submit** or press **Enter**.

---

## ✅ Expected
The app should display a clear error message (for example: **"Invalid username or password"**) and prevent login. No sensitive information should be exposed.

---

##  Actual result
The app displays the error message **"Invalid username or password"** and login is blocked.



---

## 🧾 Environment
- **Environment:** Local dev  
- **Browser:** Chrome 116 (replace with actual)  
- **Backend branch / commit:** `dev` / ___  
- **Frontend branch / commit:** `main` / ___  
- **LLDAP / Services:** running  
- **URL:** `http://localhost:5173`

---

## ⚠️ Severity & Frequency
- **Severity:** P1 (High)  
- **Frequency:** Always (reproducible every time with wrong password)

---

## 📎 Evidence to attach
- `screenshot-auth-invalid.png`  
- `network-login-401.json`  
- `console.log` (if any)




---


