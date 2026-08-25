# ARCHITECTURE.md — On-Call Portal Full Application Documentation

This document serves as the comprehensive system architecture, database schema, business rule engine, API reference, and frontend component documentation for the On-Call Rotation Portal.

---

## 1. System Overview: How the Whole System Fits Together

The On-Call Portal is an enterprise Web Application designed to manage on-call employee rotation schedules, team applications, backup coverage, escalation contacts, and swap requests across multiple engineering teams.

```
+-------------------------------------------------------------------------------+
|                             CLIENT / FRONTEND                                 |
|  React 18 + Vite Web Application (Port 5173 / dynamic dev port)              |
|                                                                               |
|  - Role-based routing (Public, Employee/User, Admin/Manager, Super Admin)    |
|  - AuthContext (JWT session restoration & profile state)                      |
|  - apiClient (apiFetch wrapper: attaches Bearer JWT token, handles errors)   |
+-------------------------------------------------------------------------------+
                                      |
                                      | HTTP REST API (Authorization: Bearer <JWT>)
                                      v
+-------------------------------------------------------------------------------+
|                             SERVER / BACKEND                                  |
|  Node.js + Express 5 REST API Server (Port 8003)                              |
|                                                                               |
|  - MVC Architecture (Routes -> Middlewares -> Controllers -> Models)          |
|  - Auth & Security: LDAP/Active Directory Bind + JWT Token Issuance           |
|  - Automated Jobs: Schedule Buffer Extension & Auto-Cleanup Cron Jobs        |
|  - OpenAPI / Swagger UI: Mounted at /api-docs                                |
+-------------------------------------------------------------------------------+
                  |                                           |
                  v                                           v
+-----------------------------------+       +-----------------------------------+
|            DATABASE               |       |         MOCK AD / LDAP            |
| PostgreSQL Database (raw pg pool) |       | LLDAP Docker Container (Port 3890)|
| - Roster, Teams, Apps, Schedules  |       | - Active Directory User Auth      |
| - Swap Requests & History         |       +-----------------------------------+
+-----------------------------------+
```

### Authentication & Authorization Lifecycle
1. **LDAP Bind**: Unauthenticated users login at `/login` with company credentials (username/password). Express server attempts an LDAP bind against Active Directory (mocked locally via LLDAP).
2. **JWT Issuance**: Upon successful LDAP bind, the backend matches `username` to an employee record in PostgreSQL via `employee.ftid`. If found and active, the backend signs a JWT payload `{ emp_id, role, team_id }`.
3. **Frontend Session**: The frontend stores the JWT in `localStorage` and loads the profile via `GET /api/auth/me`. Every subsequent API call through `apiClient` sends `Authorization: Bearer <token>`.
4. **Role-Based Access Control (RBAC)**:
   - **Public (Unauthenticated)**: Access to `/public/oncall`, `/public/teams/:teamId/apps`, and `/public/static-info`.
   - **User (Employee)**: Access to personal schedule, team schedule matrix, teammates list, and sending/responding to swap requests.
   - **Admin (Team Manager)**: All `user` capabilities plus full management of own team's roster, rotation order swapping, backup assignments, team app additions, Excel bulk roster import, and past schedule history logs.
   - **Super Admin**: System-wide administrative access to manage all teams, full employee directory, role promotion/demotion, applications catalog, static directory links, manual schedule extensions, and full audit logs.

---

## 2. Backend Architecture

### Backend Directory Structure
```
backend/
├── .env / .env.example
├── docker-compose.yml       # Local LLDAP container setup
├── package.json
├── src/
│   ├── app.js               # Express application setup, CORS, route mounting, swagger UI
│   ├── server.js            # Server entry point & port listener
│   ├── db.js                # PostgreSQL connection pool (pg)
│   ├── config/
│   │   ├── ldapConfig.js    # LDAP / Active Directory connection options
│   │   └── swaggerConfig.js # OpenAPI 3.0 specification config
│   ├── utils/
│   │   └── jwt.js           # JWT signing and verification helpers
│   ├── middlewares/
│   │   ├── authMiddleware.js # Validates Bearer JWT and populates req.user
│   │   └── requireRole.js    # RBAC middleware enforcing user/admin/super_admin roles
│   ├── models/              # Pure SQL queries (no ORM)
│   │   ├── employeeModel.js
│   │   ├── teamsModel.js
│   │   ├── applicationsModel.js
│   │   ├── scheduleModel.js
│   │   ├── swapRequestsModel.js
│   │   ├── publicViewModel.js
│   │   └── staticInfoModel.js
│   ├── controllers/         # Validation, business logic, response formatting
│   │   ├── authController.js
│   │   ├── employeeController.js
│   │   ├── teamsController.js
│   │   ├── applicationsController.js
│   │   ├── scheduleController.js
│   │   ├── swapRequestsController.js
│   │   ├── publicViewController.js
│   │   └── staticInfoController.js
│   ├── routes/              # Route definitions with @openapi JSDoc annotations
│   │   ├── authRoutes.js
│   │   ├── employeeRoutes.js
│   │   ├── teamsRoutes.js
│   │   ├── applicationsRoutes.js
│   │   ├── scheduleRoutes.js
│   │   ├── swapRequestsRoutes.js
│   │   ├── publicViewRoutes.js
│   │   └── staticInfoRoutes.js
│   └── jobs/
│       ├── rotationJob.js        # Cron job extending schedule buffer (~60 days ahead)
│       └── scheduleCleanupJob.js # Cron job purging excess future/past schedule rows
```

---

## 3. Database Schema

```sql
CREATE TYPE role_type AS ENUM ('user', 'admin', 'super_admin');
CREATE TYPE swap_status AS ENUM ('pending', 'accepted', 'rejected');

-- Teams table
CREATE TABLE teams (
    team_id SERIAL PRIMARY KEY,
    team_name VARCHAR NOT NULL,
    email VARCHAR(255), -- Distribution address CC'd on weekly on-call reminders
    cycle_day INT NOT NULL DEFAULT 7,
    cycle_st_day DATE NOT NULL,
    manager_emp_id INT REFERENCES employee(emp_id) ON DELETE SET NULL
);

-- Employee table
CREATE TABLE employee (
    emp_id SERIAL PRIMARY KEY,
    emp_name VARCHAR NOT NULL,
    phone1 VARCHAR NOT NULL,
    phone2 VARCHAR,
    emp_mail VARCHAR NOT NULL,
    team_id INT REFERENCES teams(team_id) ON DELETE SET NULL,
    ftid VARCHAR NOT NULL UNIQUE,
    def_oncall_ord INT, -- Rotation order (1, 2, 3...) per team
    active_flg BOOLEAN DEFAULT TRUE,
    role role_type DEFAULT 'user',
    bk_emp_id INT REFERENCES employee(emp_id) ON DELETE SET NULL,
    CONSTRAINT chk_backup_not_self CHECK (bk_emp_id IS NULL OR bk_emp_id <> emp_id)
);

-- Applications table
CREATE TABLE applications (
    application_id SERIAL PRIMARY KEY,
    application_name VARCHAR NOT NULL,
    sla VARCHAR,
    basicat VARCHAR,
    cartoo_id VARCHAR(5) CHECK (LENGTH(cartoo_id) = 5),
    team_id INT REFERENCES teams(team_id) ON DELETE SET NULL
);

-- Schedule table
CREATE TABLE schedule (
    emp_id INT REFERENCES employee(emp_id),
    start_dt TIMESTAMP NOT NULL,
    end_dt TIMESTAMP NOT NULL,
    bk_emp_id INT REFERENCES employee(emp_id),
    cycle_id INT, -- Tracks rotation generation run index
    PRIMARY KEY (emp_id, start_dt)
);

-- Static directory info table
CREATE TABLE static_info (
    info_id SERIAL PRIMARY KEY,
    team_name VARCHAR NOT NULL,
    url VARCHAR NOT NULL,
    created_by INT REFERENCES employee(emp_id),
    created_at TIMESTAMP DEFAULT NOW()
);

-- Swap requests table
CREATE TABLE swap_requests (
    request_id SERIAL PRIMARY KEY,
    requester_emp_id INT REFERENCES employee(emp_id) NOT NULL,
    target_emp_id INT REFERENCES employee(emp_id) NOT NULL,
    requester_schedule_start TIMESTAMP NOT NULL,
    target_schedule_start TIMESTAMP NOT NULL,
    status swap_status DEFAULT 'pending',
    requested_at TIMESTAMP DEFAULT NOW(),
    responded_at TIMESTAMP
);
```

---

## 4. Key Business & Rotation Rules

1. **Role Rules**:
   - `user`: Employee who can view schedules and request/respond to swaps.
   - `admin`: Team Manager. Can manage team employees, assign backups, reorder rotation, add applications for own team, and view team past schedule logs. An admin can manage at most **one team** at a time (`teams.manager_emp_id`). Admins CANNOT promote employees to `super_admin`.
   - `super_admin`: System Administrator. Full access to all teams, applications, employees, and global schedule management. Excluded from on-call rotations (`team_id = NULL`, `def_oncall_ord = NULL`).

2. **Team Manager Exclusion**:
   - The team manager (`teams.manager_emp_id`) must have role `admin` and is **EXCLUDED** from the team's active on-call rotation (`def_oncall_ord = NULL`).

3. **Rotation Order & Auto-Renumbering**:
   - Rotation order (`def_oncall_ord`) is a unique 1-indexed sequence per team among active rotation members.
   - New employees auto-receive the next available order number (`max(def_oncall_ord) + 1`).
   - Deactivating, deleting, or moving an employee automatically decrements the `def_oncall_ord` of all remaining teammates with higher order numbers to close gaps.

4. **Rotation Order Swaps & Current Cycle Lock**:
   - Changing an employee's `def_oncall_ord` to an existing number swaps order positions with the target employee.
   - **Current Cycle Lock**: The swap is **BLOCKED (HTTP 400)** if EITHER employee's shift in the *current active cycle* (`cycle_id` whose date range contains `NOW()`) has already started (`start_dt <= NOW()`).
   - If neither shift has started, the swap proceeds and triggers an instant future-only schedule regeneration (`clearFutureSchedule` + `extendRotation` for shifts with `start_dt > NOW()`).

5. **Schedule Generation & Buffer**:
   - Cycle length = `cycle_day * number_of_active_rotation_employees`.
   - Background job `rotationJob.js` runs periodically to ensure schedule coverage extends at least 60 days into the future (`minDaysAhead = 60`).
   - Column `schedule.cycle_id` tracks which generation run each row belongs to.

6. **Swap Requests (Two-Way Trade Engine)**:
   - **Same-Week Swap**: `target_schedule_start == requester_schedule_start`. Requester swaps shift with their designated backup employee for that week (`swapWithOwnBackup`).
   - **Cross-Week Trade**: `target_schedule_start != requester_schedule_start`. Requester trades shift with another scheduled employee across different weeks (`swapAcrossWeeks`).
   - Both scenarios require valid `target_schedule_start` and server-side validation against actual schedule rows.

7. **Backup Employees (`bk_emp_id`)**:
   - Backup employees must belong to the same team and cannot be self (`bk_emp_id <> emp_id`).
   - Team managers (`teams.manager_emp_id`) cannot be assigned as backup employees.

---

## 5. API Reference

Base URL: `http://localhost:8003/api`  
Interactive OpenAPI / Swagger Documentation: `http://localhost:8003/api-docs`

| Method | Endpoint Path | Role Auth | Description & Request/Response Notes |
|---|---|---|---|
| `GET` | `/` | None | Server health check endpoint |
| `GET` | `/api-docs` | None | Interactive OpenAPI 3.0 Swagger UI documentation |
| `POST` | `/auth/login` | None | `{ username, password }` -> `{ token }` |
| `GET` | `/auth/me` | Any | Returns full profile of logged-in employee |
| `GET` | `/public/oncall` | None | Returns current on-call status per team |
| `GET` | `/public/teams/:teamId/apps` | None | Returns applications & escalation manager for specified team |
| `GET` | `/public/static-info` | None | Returns static directory rows |
| `GET` | `/schedule` | Any | Multi-team upcoming rotation matrix (flat rows, top N weeks per team) |
| `GET` | `/schedule/:teamId` | Any | Full rotation schedule for a single team |
| `GET` | `/schedule/past/history` | Admin / Super Admin | Past schedule history logs (`?teamId=` filter available) |
| `POST` | `/schedule/:teamId/extend` | Super Admin | Manually triggers rotation extension for a team (`{ cyclesToAdd }`) |
| `GET` | `/employees` | Admin / Super Admin | Admin gets own team roster; Super Admin gets all employees |
| `GET` | `/employees/teammates` | Any | Returns simplified list of teammates (`emp_id`, `emp_name`) for own team |
| `GET` | `/employees/:id` | Admin / Super Admin | Single employee details (Admin limited to own team) |
| `POST` | `/employees` | Admin / Super Admin | Create new employee (requires `ftid`, auto-assigns rotation order) |
| `PUT` | `/employees/:id` | Admin / Super Admin | Edit employee (role, team, backup, active flag, rotation order) |
| `DELETE` | `/employees/:id` | Admin / Super Admin | Delete employee record |
| `GET` | `/teams` | Any | List all teams |
| `GET` | `/teams/available-admins` | Any | Returns admins not managing another team (`?excludeTeamId=` supported) |
| `GET` | `/teams/:id` | Any | Single team details |
| `POST` | `/teams` | Super Admin | Create new team (`{ team_name, cycle_day, cycle_st_day, manager_emp_id, app_ids }`) |
| `PUT` | `/teams/:id` | Super Admin | Update team details and assigned application list |
| `DELETE` | `/teams/:id` | Super Admin | Delete team |
| `GET` | `/applications` | Super Admin | List all applications |
| `POST` | `/applications` | Admin / Super Admin | Create app (Admin's app forced to own `team_id`; requires 5-char `cartoo_id`) |
| `PUT` | `/applications/:id` | Super Admin | Edit application |
| `DELETE` | `/applications/:id` | Super Admin | Remove application |
| `POST` | `/static-info` | Super Admin | Create static info row (`{ team_name, url }`) |
| `PUT` | `/static-info/:id` | Super Admin | Edit static info row |
| `DELETE` | `/static-info/:id` | Super Admin | Delete static info row |
| `GET` | `/swap-requests/sent` | Any | List swap requests sent by logged-in user |
| `GET` | `/swap-requests/pending` | Any | List pending swap requests received by logged-in user |
| `POST` | `/swap-requests` | Any | Submit new swap request (`{ target_emp_id, requester_schedule_start, target_schedule_start }`) |
| `DELETE` | `/swap-requests/:id` | Any | Cancel pending swap request sent by user |
| `PUT` | `/swap-requests/:id/respond` | Any | Target employee responds (`{ status: 'accepted' \| 'rejected' }`) |

---

## 6. Frontend Architecture

The frontend is a single-page application built with **React 18** and **Vite**, using modular Vanilla CSS-in-JS style objects.

### Frontend Directory Structure
```
frontend/
├── index.html
├── package.json
├── vite.config.js
├── src/
│   ├── main.jsx             # React entry point rendering App in AuthProvider & BrowserRouter
│   ├── App.jsx              # Main routing component with ProtectedRoute wrappers
│   ├── index.css            # Global CSS, design system tokens, CSS variables
│   ├── context/
│   │   └── AuthContext.jsx   # Global auth state, session restore, login & logout
│   ├── services/
│   │   ├── apiClient.js     # Shared apiFetch helper with Bearer JWT injection & error handling
│   │   └── api.js           # Reusable API service calls mapping to backend routes
│   ├── utils/
│   │   └── excelHelper.js   # XLSX export, roster template generator & bulk import parser
│   ├── components/
│   │   ├── Header.jsx       # Global navigation bar with branding, user info & role badge
│   │   ├── ProtectedRoute.jsx # Route guard enforcing authentication & role permissions
│   │   ├── OrangeLogo.jsx   # Brand identity logo component
│   │   ├── ScheduleTable.jsx# On-call schedule table & multi-team matrix component
│   │   ├── StaticInfoTable.jsx # Directory static links table component
│   │   ├── TeamAppsModal.jsx# Modal displaying team applications & escalation contact
│   │   ├── PastSchedulesSection.jsx # Historical shift log table with filter & export
│   │   ├── EmployeeForm.jsx # Add/Edit employee modal form with order swap confirmation
│   │   ├── TeamForm.jsx     # Add/Edit team modal form with available admin selection
│   │   ├── ApplicationForm.jsx # Add/Edit application form (4 fields: name, SLA, basicat, cartoo_id)
│   │   ├── StaticRowForm.jsx# Add/Edit static directory link form
│   │   └── ui/              # Reusable UI primitives
│   │       ├── Button.jsx             # Accessible button primitive
│   │       ├── Table.jsx              # Reusable table container & styling wrapper
│   │       ├── Pagination.jsx         # Client-side table pagination control
│   │       └── ExcelImportControl.jsx # Bulk Excel file uploader & template downloader
│   └── pages/
│       ├── PublicSchedulePage.jsx      # Unauthenticated public dashboard
│       ├── LoginPage.jsx               # LDAP user login page
│       ├── EmployeeDashboardPage.jsx   # Standard employee dashboard (Schedule, Swap Requests)
│       ├── AdminDashboardPage.jsx      # Team manager dashboard (Roster, Rotation, Apps, Excel, Past Logs)
│       └── SuperAdminDashboardPage.jsx # Super admin system dashboard (All Teams, All Users, Apps, Directory)
```

### How `AuthContext` and `apiClient` Work Together

```
 +------------------------+             +------------------------+
 |   AuthContext.jsx      |             |     apiClient.js       |
 |                        |             |                        |
 |  Stores:               |             |  apiFetch(path, opts)  |
 |   - token (JWT)        |             |  1. Reads JWT token    |
 |   - user (Profile)     | <---------> |  2. Adds Auth Header   |
 |   - loading (Boolean)  |             |  3. Sends JSON fetch   |
 |                        |             |  4. Parses error body  |
 |  Methods:              |             +------------------------+
 |   - login(u, p)        |                          |
 |   - logout()           |                          v
 +------------------------+             +------------------------+
             |                          |     Backend API        |
             +------------------------> |  GET /api/auth/me      |
               restores session on load +------------------------+
```

1. **`apiClient.js` (`apiFetch`)**:
   - Reads JWT token from `localStorage.getItem('token')`.
   - Automatically sets header `Authorization: Bearer <token>` and `Content-Type: application/json`.
   - On response error (non-2xx), parses backend `{ error: "..." }` message and throws an Error object.
2. **`AuthContext.jsx` (`AuthProvider`)**:
   - On app mount, if a `token` exists in `localStorage`, calls `GET /api/auth/me` to fetch the verified employee profile.
   - Provides global `user`, `token`, `login`, `logout`, and `loading` state to all components via `useAuth()`.
   - Prevents flash of unauthenticated UI during session restoration.

### Page-by-Page Responsibilities

1. **`PublicSchedulePage.jsx`**:
   - **Path**: `/`
   - **Access**: Unauthenticated / Public
   - **Responsibility**: Displays current active on-call employees per team (`GET /public/oncall`) and static directory links (`GET /public/static-info`). Clicking a team name opens `TeamAppsModal` to show supported applications and escalation contact (`GET /public/teams/:teamId/apps`).

2. **`LoginPage.jsx`**:
   - **Path**: `/login`
   - **Access**: Unauthenticated
   - **Responsibility**: Provides corporate login form (username/password). Submits credentials to `POST /api/auth/login`. On success, stores JWT token and redirects user to their role-specific dashboard.

3. **`EmployeeDashboardPage.jsx`**:
   - **Path**: `/dashboard` (Role: `user`)
   - **Access**: Logged-in Employees
   - **Responsibility**: Shows employee's personal upcoming shift schedule (`GET /api/schedule/:teamId`), full team rotation matrix (`GET /api/schedule`), teammates roster, and swap request UI. Allows sending same-week backup swaps or cross-week trades and responding to pending incoming requests.

4. **`AdminDashboardPage.jsx`**:
   - **Path**: `/admin` (Role: `admin`)
   - **Access**: Team Managers
   - **Responsibility**: Team management center for own team. Features employee roster with inline editable rotation order (`def_oncall_ord`) with swap confirmation dialogs, backup assignment, new employee creation, application addition, Excel bulk employee import/template download, and past schedule history with date/search filters and Excel export.

5. **`SuperAdminDashboardPage.jsx`**:
   - **Path**: `/super-admin` (Role: `super_admin`)
   - **Access**: System Administrators
   - **Responsibility**: Master administration panel. Manage all teams (create/edit with manager & app assignment), manage global employee directory (create/edit/delete, promote/demote roles), manage global applications catalog (create/edit/delete with 5-character `cartoo_id`), manage static directory links, trigger manual schedule extensions, and inspect system-wide past schedule logs.

---

## 7. Excel Import / Export System

- **`excelHelper.js`**: Utilizes `xlsx` library to handle client-side spreadsheet generation and parsing:
  - `exportPastSchedulesToExcel(data, fileName)`: Exports formatted schedule history to Excel.
  - `downloadEmployeeTemplate()`: Generates standard `.xlsx` employee roster template with pre-filled headers (`emp_name`, `phone1`, `phone2`, `emp_mail`, `ftid`, `role`, `active_flg`) and validation guidelines.
  - `parseEmployeeExcel(file)`: Parses uploaded Excel files into clean JSON objects for bulk creation.
- **`ExcelImportControl.jsx`**: Reusable component providing file upload dropzone and template download trigger for Admin & Super Admin dashboards.

---

## 8. Local Development Setup

### 1. Database Setup (PostgreSQL)
Create database `oncall_portal` and execute schema SQL script (or run backend initialization).

### 2. Mock LDAP Setup (LLDAP Docker)
```bash
docker compose up -d
```
- LDAP Server: `localhost:3890`
- Web UI: `http://localhost:17170` (Admin: `admin` / `password`)
- Create test users in LLDAP with `uid` matching `employee.ftid` values in PostgreSQL.

### 3. Backend Setup (`backend`)
Create `.env` file:
```env
PORT=8003
DB_HOST=localhost
DB_PORT=5432
DB_NAME=oncall_portal
DB_USER=postgres
DB_PASSWORD=postgres
JWT_SECRET=super_secret_jwt_key_123
LDAP_URL=ldap://localhost:3890
LDAP_BASE_DN=dc=example,dc=com
```
Run backend server:
```bash
cmd.exe /c "npm install"
cmd.exe /c "npm run dev"
```

### 4. Frontend Setup (`frontend`)
Run frontend dev server:
```bash
cmd.exe /c "npm install"
cmd.exe /c "npm run dev"
```

---

## 9. Verification Checklist

Before declaring any feature complete, verify the following:
- [x] Login with LDAP credentials returns valid JWT token and populates `req.user`.
- [x] `GET /auth/me` restores user session on browser reload without console errors.
- [x] Public view dashboard loads without authentication.
- [x] Rotation order change triggers confirmation dialog and updates PostgreSQL database.
- [x] Blocked order swap returns HTTP 400 when shift in current cycle has already started.
- [x] Team manager is excluded from on-call rotation.
- [x] Bulk Excel import and schedule export function cleanly.
- [x] OpenAPI Swagger UI at `/api-docs` loads interactive documentation cleanly.
