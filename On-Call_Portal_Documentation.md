On-Call Portal
System & Technical Documentation
Version 1.0  |  Generated from the supplied source repository  |  August 2026
This document describes the implemented On-Call Rotation Portal, including its purpose, architecture, technology stack, roles, business rules, database model, REST API, frontend structure, scheduling engine, Excel workflows, security model, local development setup, and verification guidance.
# 1. System Overview
The On-Call Portal is a web application for managing engineering on-call rotations across multiple teams. It provides a public on-call dashboard, employee self-service scheduling and shift swaps, team-manager administration, system-wide administration, application catalog management, backup coverage, escalation information, and historical schedule data.
## 1.1 Main Capabilities
- View the current on-call employee for each team without authentication.
- Authenticate employees against LDAP/Active Directory and establish a JWT-based application session.
- Show personal schedules, team rotation schedules, and teammate information.
- Submit, accept, reject, and cancel shift-swap requests.
- Manage team rosters, rotation order, backup assignments, and team applications.
- Import employee roster data from Excel and export historical schedules to Excel.
- Manage teams, employees, applications, directory links, and schedules as a super administrator.
- Automatically extend future schedule coverage and clean up schedule data using background jobs.
- Expose an interactive OpenAPI/Swagger UI for the backend API.
## 1.2 High-Level Architecture
The application follows a layered client/server architecture:
React 18 + Vite frontend
        |
        | HTTP REST / Bearer JWT
        v
Node.js + Express 5 backend
   |              |
   |              +--> LDAP / LLDAP authentication
   |
   +--> PostgreSQL database
   |
   +--> node-cron scheduling/cleanup jobs
   |
   +--> OpenAPI / Swagger UI
# 2. Technology Stack

| Area | Technology |
| --- | --- |
| Frontend | React 18, Vite, React Router DOM 6 |
| Backend | Node.js, Express 5, ES Modules |
| Database | PostgreSQL using the pg connection pool and raw SQL |
| Authentication | LDAP/Active Directory bind using ldapjs |
| Session security | JSON Web Tokens using jsonwebtoken |
| Background processing | node-cron |
| API documentation | OpenAPI 3.0, swagger-jsdoc, swagger-ui-express |
| Excel | xlsx for import, templates, and exports |
| Local LDAP | LLDAP Docker container |
| Browser automation/testing support | Puppeteer dependency is included in the frontend project |

# 3. User Roles and Permissions

| Role | Typical user | Capabilities |
| --- | --- | --- |
| Public | Unauthenticated users | View current on-call dashboard, team applications/escalation information, and static directory links. |
| User | Employee | View personal/team schedules, teammates, and create/respond to shift-swap requests. |
| Admin | Team Manager | Manage own team roster, rotation order, backups, applications, Excel roster import, and team schedule history. |
| Super Admin | System Administrator | Manage all teams, employees, applications, static links, roles, schedule extensions, and global history. |

# 4. Authentication and Authorization
1. The user submits a username and password to POST /api/auth/login.
2. The backend attempts an LDAP bind against the configured LDAP server.
3. After successful authentication, the backend looks up the employee using the LDAP username/FTID mapping.
4. For an active employee, the backend signs a JWT containing employee ID, role, and team ID.
5. The frontend stores the token in localStorage and uses it for subsequent API requests.
6. The frontend restores a session after reload through GET /api/auth/me.
7. Backend authMiddleware validates the Bearer token and populates req.user.
8. requireRole middleware restricts administrative operations by role.
Important implementation note: the repository includes a local LLDAP Docker setup for development/testing. Production deployments should use the organization's real directory configuration and must protect JWT secrets and database credentials through environment/secret management.
# 5. Backend Architecture

| Layer | Responsibility |
| --- | --- |
| Routes | Define REST endpoints, role requirements, and OpenAPI annotations. |
| Middleware | Authenticate JWTs and enforce role-based access control. |
| Controllers | Validate requests, execute business rules, and format responses. |
| Models | Contain raw PostgreSQL SQL queries; no ORM is used. |
| Jobs | Extend schedule coverage and clean historical/future schedule rows. |
| Config/Utils | LDAP configuration, Swagger configuration, database access, and JWT helpers. |

## 5.1 Backend Directory
backend/
├── src/app.js
├── src/server.js
├── src/db.js
├── src/config/
├── src/controllers/
├── src/jobs/
├── src/middlewares/
├── src/models/
├── src/routes/
└── src/utils/
# 6. Database Design
The PostgreSQL schema is centered on teams, employees, applications, schedules, static directory entries, and swap requests. Roles and swap statuses are represented as PostgreSQL enum types.

| Table | Purpose |
| --- | --- |
| teams | Team definitions, rotation cycle settings, and manager assignment. |
| employee | Employee directory, team membership, role, rotation order, active flag, and backup assignment. |
| applications | Applications supported by teams, including SLA, Basicat, and Cartoo identifiers. |
| schedule | Generated on-call shift periods and backup information. |
| static_info | Static directory links displayed on the public dashboard. |
| swap_requests | Two-party shift trade requests and their lifecycle. |

## 6.1 Key Relationships and Constraints
- teams.manager_emp_id references employee.emp_id.
- employee.team_id references teams.team_id.
- employee.bk_emp_id references employee.emp_id and cannot equal the employee's own emp_id.
- applications.team_id references teams.team_id.
- schedule.emp_id and schedule.bk_emp_id reference employee.emp_id.
- swap_requests references both requester and target employees.
- employee.ftid is required and is used to match authenticated LDAP users.
- Rotation order is constrained to be unique within a team using a deferred unique constraint.
# 7. Scheduling and Business Rules
- The team manager is an admin and is excluded from the active on-call rotation.
- Rotation order is a 1-based sequence among active rotation members.
- A newly created employee receives the next available rotation order.
- When an employee is removed, deactivated, or moved, later rotation positions are renumbered to close gaps.
- If a requested rotation-order change targets an existing position, the two positions are swapped.
- A rotation-order swap is blocked with HTTP 400 when either employee's shift in the current active cycle has already started.
- When a permitted order swap occurs, future schedule rows are regenerated without changing already-started/current shifts.
- Cycle length is based on cycle_day multiplied by the number of active rotation employees.
- The background rotation job maintains at least approximately 60 days of future schedule coverage.
- schedule.cycle_id identifies the schedule generation cycle.
## 7.1 Shift Swaps
The swap subsystem supports two main cases. A same-week request uses the requester's designated backup for the corresponding shift. A cross-week request trades the requester's scheduled shift with another employee's scheduled shift. The server validates the referenced schedule rows before processing the request.
# 8. REST API Reference
Base URL: http://localhost:8003/api

| Method | Endpoint | Access | Purpose |
| --- | --- | --- | --- |
| POST | /auth/login | Public | Authenticate using LDAP and return a JWT. |
| GET | /auth/me | Authenticated | Return the logged-in employee profile. |
| GET | /public/oncall | Public | Return current on-call status by team. |
| GET | /public/teams/:teamId/apps | Public | Return team applications and escalation information. |
| GET | /public/static-info | Public | Return public static directory links. |
| GET | /schedule | Authenticated | Return upcoming multi-team schedule matrix. |
| GET | /schedule/:teamId | Authenticated | Return a team's schedule. |
| GET | /schedule/past/history | Admin / Super Admin | Return historical schedule information. |
| POST | /schedule/:teamId/extend | Super Admin | Manually extend a team's rotation. |
| GET | /employees | Admin / Super Admin | Return roster data according to the caller's scope. |
| GET | /employees/teammates | Authenticated | Return simplified teammates for the caller's team. |
| GET | /employees/:id | Admin / Super Admin | Return one employee. |
| POST | /employees | Admin / Super Admin | Create an employee. |
| PUT | /employees/:id | Admin / Super Admin | Update an employee. |
| DELETE | /employees/:id | Admin / Super Admin | Delete an employee. |
| GET | /teams | Authenticated | List teams. |
| GET | /teams/available-admins | Authenticated | List admins available for team management. |
| GET | /teams/:id | Authenticated | Return one team. |
| POST | /teams | Super Admin | Create a team. |
| PUT | /teams/:id | Super Admin | Update a team. |
| DELETE | /teams/:id | Super Admin | Delete a team. |
| GET | /applications | Super Admin | List applications. |
| POST | /applications | Admin / Super Admin | Create an application. |
| PUT | /applications/:id | Super Admin | Update an application. |
| DELETE | /applications/:id | Super Admin | Delete an application. |
| POST | /static-info | Super Admin | Create a static directory entry. |
| PUT | /static-info/:id | Super Admin | Update a static directory entry. |
| DELETE | /static-info/:id | Super Admin | Delete a static directory entry. |
| GET | /swap-requests/sent | Authenticated | List requests sent by the caller. |
| GET | /swap-requests/pending | Authenticated | List pending requests received by the caller. |
| POST | /swap-requests | Authenticated | Create a shift-swap request. |
| DELETE | /swap-requests/:id | Authenticated | Cancel a pending sent request. |
| PUT | /swap-requests/:id/respond | Authenticated | Accept or reject a request. |

## 8.1 API Documentation UI
When the backend is running, the OpenAPI/Swagger interface is available at:
http://localhost:8003/api-docs
# 9. Frontend Architecture

| Component | Responsibility |
| --- | --- |
| App.jsx | Application routing and role-aware route protection. |
| AuthContext.jsx | Global token/profile state, login, logout, and session restoration. |
| apiClient.js | Shared fetch wrapper that adds Bearer authentication and handles API errors. |
| api.js | Reusable API service functions. |
| PublicSchedulePage.jsx | Public on-call dashboard. |
| LoginPage.jsx | LDAP login interface. |
| EmployeeDashboardPage.jsx | Employee schedules and swap requests. |
| AdminDashboardPage.jsx | Team manager administration. |
| SuperAdminDashboardPage.jsx | System-wide administration. |
| ScheduleTable.jsx | Schedule presentation. |
| EmployeeForm.jsx / TeamForm.jsx / ApplicationForm.jsx | Administrative forms. |
| PastSchedulesSection.jsx | Historical schedule viewing and export. |
| excelHelper.js | Excel import/template/export logic. |

## 9.1 Main User Pages

| Path | Page | Purpose |
| --- | --- | --- |
| / | PublicSchedulePage | Public dashboard showing active on-call employees and directory information. |
| /login | LoginPage | Username/password login against LDAP. |
| /dashboard | EmployeeDashboardPage | Employee schedule, team matrix, teammates, and swap management. |
| /admin | AdminDashboardPage | Team roster, rotation, backups, applications, Excel tools, and history. |
| /super-admin | SuperAdminDashboardPage | Global administration for teams, employees, applications, static links, and schedules. |

# 10. Excel Import and Export
- The employee template contains fields such as emp_name, phone1, phone2, emp_mail, ftid, role, and active_flg.
- Admins and super admins can download the roster template.
- Uploaded employee spreadsheets are parsed client-side and converted to objects before being submitted to the backend.
- Historical schedule data can be exported to Excel.
- The Excel functionality is implemented with the xlsx package.
# 11. Background Jobs

| Job | Function |
| --- | --- |
| rotationJob.js | Runs periodically to maintain future schedule coverage, targeting approximately 60 days ahead. |
| scheduleCleanupJob.js | Removes schedule data outside the intended retention/future window according to the implemented cleanup logic. |

# 12. Local Development Setup
## 1. PostgreSQL
Create a database named oncall_portal and execute backend/sql/schema.sql.
## 2. LLDAP
From backend/, run docker compose up -d. The development LDAP service is configured on localhost:3890 and its web UI on localhost:17170.
## 3. Backend
Run npm install in backend/, create .env from .env.example, then run npm run dev. The API listens on port 8003 by default.
## 4. Frontend
Run npm install in frontend/ and npm run dev. Vite normally serves the frontend on port 5173.
## 5. LDAP test users
Create test users in LLDAP whose uid values match employee.ftid values in PostgreSQL.
## 12.1 Environment Variables

| Variable | Purpose |
| --- | --- |
| PORT | Backend HTTP port, e.g. 8003 |
| DB_HOST | PostgreSQL host |
| DB_PORT | PostgreSQL port, normally 5432 |
| DB_NAME | Database name, e.g. oncall_portal |
| DB_USER | PostgreSQL user |
| DB_PASSWORD | PostgreSQL password |
| JWT_SECRET | Secret used to sign/verify JWTs |
| LDAP_URL | LDAP server URL |
| LDAP_BASE_DN | LDAP base distinguished name |

# 13. Security Considerations
- LDAP authentication is performed server-side; passwords are not intended to be stored in PostgreSQL.
- JWTs are required for protected API operations.
- RBAC is enforced in the backend and should not rely only on frontend route guards.
- Administrative scope is checked server-side, with team managers restricted to their own team for applicable operations.
- JWT secrets and database/LDAP credentials should not use development defaults in production.
- The supplied local LLDAP credentials are development values and must not be reused in production.
- CORS and deployment configuration should be reviewed before exposing the service outside a trusted network.
- Input validation and database constraints provide defense-in-depth, but production deployments should also use HTTPS and secure secret storage.
# 14. Verification and Testing Guidance
- LDAP login returns a valid JWT for an active employee.
- GET /auth/me restores the session after browser refresh.
- Public dashboard works without authentication.
- A team manager is excluded from the on-call rotation.
- Rotation order changes are confirmed and persisted correctly.
- A current-cycle order change is rejected once an affected shift has started.
- Backup assignment cannot point to the employee themself.
- Employee creation receives an appropriate rotation order.
- Excel roster import and schedule export complete successfully.
- Swagger UI loads and reflects the documented API.
- Automatic schedule extension maintains the intended future coverage.
- Swap requests validate the referenced schedule rows and enforce their lifecycle.
# 15. Recommended Maintenance Practices
- Keep README.md and ARCHITECTURE.md synchronized with implementation changes.
- Update OpenAPI annotations whenever routes, request bodies, or responses change.
- Use database migrations rather than editing production schemas manually.
- Add automated unit/integration tests around scheduling, rotation-order changes, swaps, and authorization because these are business-critical areas.
- Use a production-grade secret manager and rotate JWT/database credentials as appropriate.
- Review schedule cleanup retention rules before production rollout.
- Document the production LDAP topology separately from the local LLDAP setup.
- Add a deployment/runbook document covering backup, recovery, monitoring, and incident response.
# 16. Source-of-Truth Notes
This documentation was generated from the supplied On-Call Portal repository, especially its README, architecture documentation, PostgreSQL schema, route definitions, backend structure, and frontend structure. Where repository documentation and schema history differ, the implemented source files should be treated as the primary technical reference and revalidated before production deployment.
# Appendix A — Repository Structure
On-Call-Portal-main/
├── README.md
├── ARCHITECTURE.md
├── backend/
│   ├── docker-compose.yml
│   ├── .env.example
│   ├── sql/schema.sql
│   └── src/
│       ├── config/
│       ├── controllers/
│       ├── jobs/
│       ├── middlewares/
│       ├── models/
│       ├── routes/
│       └── utils/
└── frontend/
    └── src/
        ├── components/
        ├── context/
        ├── pages/
        ├── services/
        └── utils/
