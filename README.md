# On-Call Rotation Portal

The **On-Call Portal** is an enterprise Web Application built to streamline engineering on-call rotation schedules, team application management, backup coverage, escalation contacts, shift swaps, and historical schedule audit logs across multiple teams.

---

## 🚀 Tech Stack

### Client / Frontend (`frontend`)
- **Framework**: React 18 + Vite
- **Routing**: React Router DOM (v6) with role-based `ProtectedRoute` guards
- **State & Services**: Global `AuthContext` for session management and `apiClient` (`apiFetch` wrapper with automatic JWT Bearer headers)
- **Styling**: Vanilla CSS-in-JS style objects with dynamic dark theme design tokens
- **Utilities**: `xlsx` library for client-side Excel template generation, roster bulk imports, and schedule exports

### Server / Backend (`backend`)
- **Runtime & Framework**: Node.js + Express 5 (ES Modules)
- **Database**: PostgreSQL (using raw `pg` connection pool, no ORM)
- **Security & Authentication**: On-prem Active Directory LDAP bind (`ldapjs`) + JWT token issuance (`jsonwebtoken`)
- **Background Jobs**: `node-cron` scheduled jobs for automatic rotation coverage extension (~60 days ahead) and historical data retention cleanup
- **API Documentation**: OpenAPI 3.0 specification generated via `swagger-jsdoc` and mounted at `/api-docs` via `swagger-ui-express`

### Authentication & Mock Services
- **Mock LDAP**: Local LLDAP Docker Container for Active Directory user authentication testing

---

## 📖 API Documentation & OpenAPI Reference

Interactive API documentation and schema specifications are automatically served via Swagger UI when running the backend:

👉 **[Interactive OpenAPI / Swagger UI Documentation](http://localhost:8003/api-docs)** (`http://localhost:8003/api-docs`)

---

## 🛠️ Local Development Setup

Follow these steps to set up and run the application locally:

### 1. Database Setup (PostgreSQL)
1. Ensure PostgreSQL is installed and running locally on port `5432`.
2. Create a new database named `oncall_portal`:
   ```sql
   CREATE DATABASE oncall_portal;
   ```
3. Run the database schema SQL scripts (located in `backend/sql/` or backend schema initialization) to create tables (`teams`, `employee`, `applications`, `schedule`, `static_info`, `swap_requests`).

   For an existing database, add the team distribution email used for reminder CCs:
   ```sql
   ALTER TABLE teams ADD COLUMN IF NOT EXISTS email VARCHAR(255);
   ```

---

### 2. Mock LDAP Setup (LLDAP Docker)
Launch the local mock Active Directory server using Docker Compose from the root backend directory:

```bash
cd backend
docker compose up -d
```

- **LDAP Server**: `ldap://localhost:3890`
- **Web UI**: `http://localhost:17170` (Admin login: `admin` / `password`)
- **User Setup**: Create test users in the LLDAP Web UI with `uid` values matching `employee.ftid` values in your PostgreSQL database.

---

### 3. Backend Setup (`backend`)

1. Navigate to the backend directory and install dependencies:
   ```bash
   cd backend
   npm install
   ```

2. Create a `.env` file in the `backend/` root directory:
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
   MAIL_ENABLED=false
   SMTP_HOST=smtp.example.com
   SMTP_PORT=587
   SMTP_SECURE=false
   SMTP_USER=on-call@example.com
   SMTP_PASSWORD=replace_with_smtp_password
   SMTP_FROM="On-Call Portal <on-call@example.com>"
   MAIL_TIME_ZONE=Africa/Cairo
   ONCALL_REMINDER_CRON="0 9 * * 1"
   ONCALL_REMINDER_TIME_ZONE=Africa/Cairo
   APP_BASE_URL=http://localhost:5173
   ```

   Set `MAIL_ENABLED=true` when the SMTP credentials are ready. Use `SMTP_SECURE=true` for implicit TLS (normally port 465); port 587 normally uses `SMTP_SECURE=false` and upgrades with STARTTLS. `SMTP_USER` and `SMTP_PASSWORD` may both be left empty for a trusted internal relay. The backend verifies the SMTP connection at startup and continues serving API requests if verification fails.

   The on-call reminder runs at 09:00 every Monday in `Africa/Cairo` by default. It emails each team's current on-call employee and CCs the address stored in `teams.email`. The cron expression and timezone can be changed with `ONCALL_REMINDER_CRON` and `ONCALL_REMINDER_TIME_ZONE`. If a team has no email address, the employee reminder is still sent without a CC and a warning is logged.

3. Start the backend development server:
   ```bash
   npm run dev
   ```
   The backend API will run at `http://localhost:8003/api`, and Swagger UI will be available at `http://localhost:8003/api-docs`.

---

### 4. Frontend Setup (`frontend`)

1. Open a new terminal window, navigate to the frontend directory, and install dependencies:
   ```bash
   cd frontend
   npm install
   ```

2. Start the Vite development server:
   ```bash
   npm run dev
   ```
3. Open the dev server URL displayed in your terminal (typically `http://localhost:5173`) in your browser.

---

## 📂 Repository Structure

```
.
├── ARCHITECTURE.md           # Full system architecture, business rules & component reference
├── README.md                 # Project overview and setup instructions
├── backend/                  # Backend Express API server
│   ├── docker-compose.yml   # LLDAP mock container setup
│   ├── src/
│   │   ├── app.js            # Express app, CORS, routes & Swagger UI setup
│   │   ├── server.js         # Server entry point
│   │   ├── config/           # LDAP & Swagger configuration
│   │   ├── controllers/      # Route request/response controllers
│   │   ├── jobs/             # Schedule rotation & cleanup cron jobs
│   │   ├── middlewares/      # JWT auth & RBAC middlewares
│   │   ├── models/           # Raw PostgreSQL SQL queries
│   │   ├── routes/           # API routes with @openapi JSDoc specs
│   │   └── utils/            # JWT signing helpers
│   └── package.json
└── frontend/                 # Frontend React 18 + Vite single-page app
    ├── src/
    │   ├── components/       # UI forms, tables, modals & primitives
    │   ├── context/          # AuthContext for global JWT session state
    │   ├── pages/            # Role-specific dashboard pages
    │   ├── services/         # API service helpers & apiClient
    │   └── utils/            # Excel import/export helpers
    └── package.json
```

---

## 🔐 User Roles & Permissions

- **Public (Unauthenticated)**: Access to real-time team on-call dashboard, team application details, and static directory links.
- **User (Employee)**: Personal dashboard showing upcoming shifts, full team rotation matrix, teammates roster, and two-way shift swap requests.
- **Admin (Team Manager)**: Team management panel for own team, employee roster management, rotation order swapping with confirmation, backup assignment, team app addition, Excel bulk roster import, and past schedule history logs.
- **Super Admin**: System-wide administrative access to manage all teams, global employee directory, role promotion/demotion, global application catalog, static directory links, manual schedule extensions, and global audit logs.
