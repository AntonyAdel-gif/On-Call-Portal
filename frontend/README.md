# On-Call Schedule — Frontend

A React frontend for the On-Call Schedule Web App revamp, covering the
public schedule page, login, and the Admin / Super Admin dashboards from
the requirements doc. Built with [Vite](https://vitejs.dev) so it starts
instantly and needs almost no config.

The backend isn't built yet, so this runs on mock, in-memory data
(`src/data/mockData.js` + `src/services/api.js`). Every function in
`api.js` is written the way a real API call will look, with a
`// TODO(backend):` comment noting the real endpoint from the requirements
doc — swap the mock logic for real `fetch()` calls there later and no other
file needs to change.

## Demo logins

| Username     | Password  | Role        |
|--------------|-----------|-------------|
| `admin`      | `admin123`| Admin       |
| `superadmin` | `super123`| Super Admin |

## Project structure

```
oncall-app/
├── index.html              # HTML shell, mounts React into <div id="root">
├── vite.config.js          # dev server + build config
├── package.json            # dependencies & npm scripts
└── src/
    ├── main.jsx             # entry point
    ├── App.jsx               # routes (React Router)
    ├── index.css             # global styles + brand design tokens
    ├── context/
    │   └── AuthContext.jsx   # who's logged in, shared app-wide
    ├── services/
    │   └── api.js            # mock "backend" — swap for real fetch() later
    ├── data/
    │   └── mockData.js       # sample employees/teams/rows
    ├── components/           # reusable pieces (Header, tables, forms, modal)
    └── pages/                # one file per route/screen
```

## Setting this up in WebStorm

1. **Install Node.js** if you don't already have it (WebStorm needs it to
   run the dev server). Download the LTS version from
   [nodejs.org](https://nodejs.org) and install it, then restart WebStorm.

2. **Unzip the project** you downloaded, so you have a normal folder named
   `oncall-app` somewhere on your computer.

3. **Open it in WebStorm**:
   - `File` → `Open...`
   - Select the `oncall-app` folder itself (the one containing
     `package.json`), then click `Open`.

4. **Install dependencies.** WebStorm usually pops up a banner saying
   "Packages are not installed" with an **Install** button — click that.
   If you don't see the banner, open the built-in terminal
   (`View` → `Tool Windows` → `Terminal`, or `Alt+F12`) and run:
   ```bash
   npm install
   ```

5. **Run the app.** In that same terminal, run:
   ```bash
   npm run dev
   ```
   Vite will start a local dev server (usually at `http://localhost:5173`)
   and the browser should open automatically. If it doesn't, `Cmd/Ctrl`
   + click the `http://localhost:5173` link printed in the terminal.

6. **Optional but handy:** right-click `package.json` in WebStorm's project
   tree → `Show npm Scripts`. This gives you a panel where you can
   double-click `dev`, `build`, or `preview` instead of typing terminal
   commands.

7. **Hot reload:** while `npm run dev` is running, any file you save in
   WebStorm updates the browser instantly — no need to restart anything.

### Other useful commands

```bash
npm run build     # produces an optimized production build in dist/
npm run preview   # serves that production build locally, to sanity-check it
```

## Notes on how this maps to the requirements doc

- **US-01 / US-02 / US-03** → `PublicSchedulePage.jsx`, `ScheduleTable.jsx`,
  `TeamAppsModal.jsx`, `StaticInfoTable.jsx`
- **US-04** → the login button lives in `Header.jsx`
- **US-05 / US-06 / US-07** → `AdminDashboardPage.jsx` +
  `EmployeeForm.jsx`
- **US-08 / US-09 / US-10 / US-11** → `SuperAdminDashboardPage.jsx` +
  `TeamForm.jsx` / `StaticRowForm.jsx`
- **Role-based access control** → `AuthContext.jsx` (who's logged in) +
  `ProtectedRoute.jsx` (gates pages by role). Real enforcement must also
  live server-side once BE-01's auth middleware exists — the frontend
  checks here are for UX only, not security.

## Design

Visual styling (colors, type, square shapes, sentence case, dark
background for eco-branding) is pulled from the Orange brand guideline PDF
and centralized as CSS variables in `src/index.css`, so the whole app can
be retheme'd from one place.
