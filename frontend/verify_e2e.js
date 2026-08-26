import puppeteer from 'puppeteer';

// Set DB env vars before importing db.js
process.env.DB_HOST = 'localhost';
process.env.DB_PORT = '5432';
process.env.DB_USER = 'oncall_user';
process.env.DB_PASSWORD = 'Oncall@159357';
process.env.DB_NAME = 'oncall_portal';

const dbModule = await import('file:///e:/On-Call/ON_call_portal/On-Call-Portal/src/db.js');
const db = dbModule.default;

const FRONTEND_URL = 'http://localhost:5173';
const BACKEND_URL = 'http://localhost:8003/api';

const results = [];
let consoleErrors = [];

function logResult(step, status, detail = '') {
  console.log(`[VERIFICATION] ${status ? '✓ PASS' : '✗ FAIL'} - ${step} | ${detail}`);
  results.push({ step, status, detail, consoleErrors: [...consoleErrors] });
  consoleErrors = [];
}

async function runVerification() {
  console.log('=== STARTING ON-CALL PORTAL VERIFICATION CHECKLIST ===\n');

  const browser = await puppeteer.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();

  page.on('console', msg => {
    if (msg.type() === 'error') {
      const txt = msg.text();
      if (!txt.includes('favicon') && !txt.includes('Failed to load resource') && !txt.includes('ERR_BLOCKED_BY_CLIENT')) {
        console.log(`[BROWSER CONSOLE ERROR] ${txt}`);
        consoleErrors.push(txt);
      }
    }
  });

  page.on('pageerror', err => {
    console.log(`[BROWSER UNCAUGHT ERROR] ${err.message}`);
    consoleErrors.push(err.message);
  });

  try {
    // -------------------------------------------------------------------------
    // STEP 1: PUBLIC SCHEDULE & UNAUTHENTICATED VIEWS
    // -------------------------------------------------------------------------
    console.log('\n--- STEP 1: Public Schedule Page ---');
    await page.goto(`${FRONTEND_URL}/`, { waitUntil: 'networkidle0' });
    const publicTitle = await page.title();
    logResult('Public Schedule Page Load', consoleErrors.length === 0, `Title: "${publicTitle}"`);

    const publicContent = await page.content();
    const showsOnCall = publicContent.includes('On-Call') || publicContent.includes('Rotation') || publicContent.includes('Team');
    logResult('Public Schedule Data Display', showsOnCall, 'Renders schedule table and status');

    // -------------------------------------------------------------------------
    // STEP 2: SUPER ADMIN LOGIN & ME CHECK
    // -------------------------------------------------------------------------
    console.log('\n--- STEP 2: Super Admin Login & GET /auth/me ---');
    await db.query("UPDATE employee SET ftid='admin', role='super_admin' WHERE emp_id=1");

    await page.goto(`${FRONTEND_URL}/login`, { waitUntil: 'networkidle0' });
    await page.type('input:not([type="password"])', 'admin');
    await page.type('input[type="password"]', 'admin123');
    await page.click('button[type="submit"]');
    await new Promise(r => setTimeout(r, 1500));

    const token = await page.evaluate(() => localStorage.getItem('oncall-app-token'));
    logResult('Super Admin Login Token Saved', !!token, `Token acquired: ${!!token}`);

    const meProfile = await page.evaluate(async () => {
      const t = localStorage.getItem('oncall-app-token');
      const r = await fetch('http://localhost:8003/api/auth/me', {
        headers: { 'Authorization': `Bearer ${t}` }
      });
      return await r.json();
    });
    logResult('GET /auth/me Profile Response', meProfile && meProfile.role === 'super_admin', `emp_name: "${meProfile?.emp_name}", role: "${meProfile?.role}"`);
    logResult('Super Admin Dashboard Render', consoleErrors.length === 0, 'Console errors: ' + (consoleErrors.join('; ') || 'None'));

    // -------------------------------------------------------------------------
    // STEP 3: MUTATION - ADD APPLICATION
    // -------------------------------------------------------------------------
    console.log('\n--- STEP 3: Mutation - Add Application ---');
    const testAppName = `App_${Date.now()}`;
    await page.evaluate(async (appName) => {
      const t = localStorage.getItem('oncall-app-token');
      const r = await fetch('http://localhost:8003/api/applications', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${t}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          application_name: appName,
          sla: '99.99%',
          basicat: 'Core',
          cartoo_id: '12345'
        })
      });
      return await r.json();
    }, testAppName);

    const dbApp = await db.query('SELECT * FROM applications WHERE application_name=$1', [testAppName]);
    logResult('Add Application Mutation', dbApp.rows.length > 0, `Persisted in DB with ID ${dbApp.rows[0]?.application_id}`);

    // -------------------------------------------------------------------------
    // STEP 4: MUTATION - CREATE TEAM
    // -------------------------------------------------------------------------
    console.log('\n--- STEP 4: Mutation - Create Team ---');
    const testTeamName = `Team_${Date.now()}`;
    await page.evaluate(async (teamName, appId) => {
      const t = localStorage.getItem('oncall-app-token');
      const r = await fetch('http://localhost:8003/api/teams', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${t}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          team_name: teamName,
          cycle_day: 7,
          cycle_st_day: '2026-08-01',
          manager_emp_id: null,
          app_ids: [appId]
        })
      });
      return await r.json();
    }, testTeamName, dbApp.rows[0].application_id);

    const dbTeam = await db.query('SELECT * FROM teams WHERE team_name=$1', [testTeamName]);
    logResult('Create Team Mutation', dbTeam.rows.length > 0, `Persisted in DB with ID ${dbTeam.rows[0]?.team_id}`);

    // -------------------------------------------------------------------------
    // STEP 5: MUTATION - ADD EMPLOYEE
    // -------------------------------------------------------------------------
    console.log('\n--- STEP 5: Mutation - Add Employee ---');
    const testFtid = `FT${String(Date.now()).slice(-6)}`;
    await page.evaluate(async (ftid, teamId) => {
      const t = localStorage.getItem('oncall-app-token');
      const r = await fetch('http://localhost:8003/api/employees', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${t}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          emp_name: 'Test New Employee',
          phone1: '1234567890',
          phone2: '0987654321',
          emp_mail: 'newemp@orange.com',
          team_id: teamId,
          ftid: ftid,
          role: 'user'
        })
      });
      return await r.json();
    }, testFtid, dbTeam.rows[0].team_id);

    const dbEmp = await db.query('SELECT * FROM employee WHERE ftid=$1', [testFtid]);
    logResult('Add Employee Mutation', dbEmp.rows.length > 0, `Persisted in DB with emp_id ${dbEmp.rows[0]?.emp_id}`);

    // -------------------------------------------------------------------------
    // STEP 6: MUTATION - EDIT EMPLOYEE
    // -------------------------------------------------------------------------
    console.log('\n--- STEP 6: Mutation - Edit Employee ---');
    await page.evaluate(async (empId, teamId) => {
      const t = localStorage.getItem('oncall-app-token');
      const r = await fetch(`http://localhost:8003/api/employees/${empId}`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${t}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          emp_name: 'Updated Employee Name',
          phone1: '5555555555',
          emp_mail: 'updated@orange.com',
          team_id: teamId,
          role: 'user',
          active_flg: true
        })
      });
      return await r.json();
    }, dbEmp.rows[0].emp_id, dbTeam.rows[0].team_id);

    const dbEmpUpdated = await db.query('SELECT * FROM employee WHERE emp_id=$1', [dbEmp.rows[0].emp_id]);
    logResult('Edit Employee Mutation', dbEmpUpdated.rows[0]?.emp_name === 'Updated Employee Name', `Updated name: "${dbEmpUpdated.rows[0]?.emp_name}"`);

    // -------------------------------------------------------------------------
    // STEP 7: MUTATION - STATIC INFO ROW (ADD, EDIT, DELETE)
    // -------------------------------------------------------------------------
    console.log('\n--- STEP 7: Mutation - Static Info Row ---');
    await page.evaluate(async () => {
      const t = localStorage.getItem('oncall-app-token');
      await fetch('http://localhost:8003/api/static-info', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${t}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          team_name: 'DevOps Support',
          url: 'http://devops.company.local'
        })
      });
    });

    const dbStatic = await db.query('SELECT * FROM static_info WHERE team_name=$1', ['DevOps Support']);
    logResult('Add Static Info Row', dbStatic.rows.length > 0, `Persisted in DB with info_id ${dbStatic.rows[0]?.info_id}`);

    // Edit Static Info Row
    await page.evaluate(async (infoId) => {
      const t = localStorage.getItem('oncall-app-token');
      await fetch(`http://localhost:8003/api/static-info/${infoId}`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${t}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          team_name: 'DevOps Support Escalation',
          url: 'http://devops-esc.company.local'
        })
      });
    }, dbStatic.rows[0].info_id);

    const dbStaticUpdated = await db.query('SELECT * FROM static_info WHERE info_id=$1', [dbStatic.rows[0].info_id]);
    logResult('Edit Static Info Row', dbStaticUpdated.rows[0]?.team_name === 'DevOps Support Escalation', `Updated team_name: "${dbStaticUpdated.rows[0]?.team_name}"`);

    // -------------------------------------------------------------------------
    // STEP 8: ADMIN DASHBOARD VIEW
    // -------------------------------------------------------------------------
    console.log('\n--- STEP 8: Admin Dashboard View ---');
    await db.query("UPDATE employee SET ftid='admin_temp' WHERE emp_id=1");
    await db.query("UPDATE employee SET ftid='admin', role='admin', team_id=1 WHERE emp_id=2");

    await page.goto(`${FRONTEND_URL}/login`, { waitUntil: 'networkidle0' });
    await page.evaluate(() => localStorage.clear());
    await page.type('input:not([type="password"])', 'admin');
    await page.type('input[type="password"]', 'admin123');
    await page.click('button[type="submit"]');
    await new Promise(r => setTimeout(r, 1500));

    const adminProfile = await page.evaluate(async () => {
      const t = localStorage.getItem('oncall-app-token');
      const r = await fetch('http://localhost:8003/api/auth/me', {
        headers: { 'Authorization': `Bearer ${t}` }
      });
      return await r.json();
    });
    logResult('Admin Role Login', adminProfile && adminProfile.role === 'admin', `emp_name: "${adminProfile?.emp_name}", role: "${adminProfile?.role}"`);
    logResult('Admin Dashboard Load', consoleErrors.length === 0, 'Console errors: ' + (consoleErrors.join('; ') || 'None'));

    // -------------------------------------------------------------------------
    // STEP 9: MUTATION - SWAP REQUEST
    // -------------------------------------------------------------------------
    console.log('\n--- STEP 9: Mutation - Swap Request ---');
    // Set up two user role employees
    await db.query("UPDATE employee SET ftid='admin_temp2' WHERE emp_id=2");

    // Create/get user 1 (requester)
    let user1Res = await db.query("SELECT * FROM employee WHERE role='user' AND team_id=1 LIMIT 1");
    let user1Id;
    if (user1Res.rows.length > 0) {
      user1Id = user1Res.rows[0].emp_id;
    } else {
      const nu = await db.query("INSERT INTO employee (emp_name, emp_mail, team_id, ftid, role, def_oncall_ord) VALUES ('User Requester', 'req@co.com', 1, 'USERREQ', 'user', 1) RETURNING emp_id");
      user1Id = nu.rows[0].emp_id;
    }

    // Create/get user 2 (target)
    let user2Res = await db.query("SELECT * FROM employee WHERE team_id=1 AND emp_id != $1 LIMIT 1", [user1Id]);
    let user2Id;
    if (user2Res.rows.length > 0) {
      user2Id = user2Res.rows[0].emp_id;
    } else {
      const nu = await db.query("INSERT INTO employee (emp_name, emp_mail, team_id, ftid, role, def_oncall_ord) VALUES ('User Target', 'target@co.com', 1, 'USERTGT', 'user', 2) RETURNING emp_id");
      user2Id = nu.rows[0].emp_id;
    }

    // Assign schedule rows for valid swap request validation
    const reqStartDt = '2026-09-01 00:00:00';
    const tgtStartDt = '2026-09-08 00:00:00';
    await db.query("DELETE FROM schedule WHERE start_dt IN ($1, $2)", [reqStartDt, tgtStartDt]);
    await db.query("INSERT INTO schedule (emp_id, start_dt, end_dt, cycle_id) VALUES ($1, $2, '2026-09-08 00:00:00', 1)", [user1Id, reqStartDt]);
    await db.query("INSERT INTO schedule (emp_id, start_dt, end_dt, cycle_id) VALUES ($1, $2, '2026-09-15 00:00:00', 1)", [user2Id, tgtStartDt]);

    // Set user 1's ftid to 'admin'
    await db.query("UPDATE employee SET ftid='admin' WHERE emp_id=$1", [user1Id]);

    await page.goto(`${FRONTEND_URL}/login`, { waitUntil: 'networkidle0' });
    await page.evaluate(() => localStorage.clear());
    await page.type('input:not([type="password"])', 'admin');
    await page.type('input[type="password"]', 'admin123');
    await page.click('button[type="submit"]');
    await new Promise(r => setTimeout(r, 1500));

    const userProfile = await page.evaluate(async () => {
      const t = localStorage.getItem('oncall-app-token');
      const r = await fetch('http://localhost:8003/api/auth/me', {
        headers: { 'Authorization': `Bearer ${t}` }
      });
      return await r.json();
    });
    logResult('User Role Login', userProfile && userProfile.role === 'user', `emp_name: "${userProfile?.emp_name}", role: "${userProfile?.role}"`);
    logResult('User Dashboard Load', consoleErrors.length === 0, 'Console errors: ' + (consoleErrors.join('; ') || 'None'));

    // Create Swap Request
    await page.evaluate(async (targetId, reqDt, targetDt) => {
      const t = localStorage.getItem('oncall-app-token');
      await fetch('http://localhost:8003/api/swap-requests', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${t}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          target_emp_id: targetId,
          requester_schedule_start: reqDt,
          target_schedule_start: targetDt
        })
      });
    }, user2Id, reqStartDt, tgtStartDt);

    const dbSwap = await db.query('SELECT * FROM swap_requests WHERE requester_emp_id=$1 AND target_emp_id=$2', [user1Id, user2Id]);
    logResult('Create Swap Request Mutation', dbSwap.rows.length > 0, `Persisted in DB with ID ${dbSwap.rows[0]?.request_id}, status: "${dbSwap.rows[0]?.status}"`);

    // Target responds to swap request
    if (dbSwap.rows.length > 0) {
      // Login as target (user 2)
      await db.query("UPDATE employee SET ftid='user1_temp' WHERE emp_id=$1", [user1Id]);
      await db.query("UPDATE employee SET ftid='admin' WHERE emp_id=$1", [user2Id]);

      await page.goto(`${FRONTEND_URL}/login`, { waitUntil: 'networkidle0' });
      await page.evaluate(() => localStorage.clear());
      await page.type('input:not([type="password"])', 'admin');
      await page.type('input[type="password"]', 'admin123');
      await page.click('button[type="submit"]');
      await new Promise(r => setTimeout(r, 1500));

      await page.evaluate(async (reqId) => {
        const t = localStorage.getItem('oncall-app-token');
        await fetch(`http://localhost:8003/api/swap-requests/${reqId}/respond`, {
          method: 'PUT',
          headers: { 'Authorization': `Bearer ${t}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'rejected' })
        });
      }, dbSwap.rows[0].request_id);

      const dbSwapResponded = await db.query('SELECT * FROM swap_requests WHERE request_id=$1', [dbSwap.rows[0].request_id]);
      logResult('Respond to Swap Request Mutation', dbSwapResponded.rows[0]?.status === 'rejected', `Updated status in DB: "${dbSwapResponded.rows[0]?.status}"`);
    }

    // -------------------------------------------------------------------------
    // STEP 10: MUTATION - DELETE EMPLOYEE & CLEANUP
    // -------------------------------------------------------------------------
    console.log('\n--- STEP 10: Mutation - Delete Employee & Cleanup ---');
    await db.query("UPDATE employee SET ftid='user2_temp' WHERE emp_id=$1", [user2Id]);
    await db.query("UPDATE employee SET ftid='admin', role='super_admin' WHERE emp_id=1");

    await page.goto(`${FRONTEND_URL}/login`, { waitUntil: 'networkidle0' });
    await page.evaluate(() => localStorage.clear());
    await page.type('input:not([type="password"])', 'admin');
    await page.type('input[type="password"]', 'admin123');
    await page.click('button[type="submit"]');
    await new Promise(r => setTimeout(r, 1500));

    // Create a standalone employee without schedule history to test delete
    const delEmpFtid = `DEL${String(Date.now()).slice(-5)}`;
    await page.evaluate(async (ftid) => {
      const t = localStorage.getItem('oncall-app-token');
      await fetch('http://localhost:8003/api/employees', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${t}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          emp_name: 'Employee To Delete',
          emp_mail: 'del@orange.com',
          ftid: ftid,
          role: 'user'
        })
      });
    }, delEmpFtid);

    const empToDel = await db.query('SELECT * FROM employee WHERE ftid=$1', [delEmpFtid]);
    if (empToDel.rows.length > 0) {
      const empIdToDelete = empToDel.rows[0].emp_id;
      await page.evaluate(async (empId) => {
        const t = localStorage.getItem('oncall-app-token');
        await fetch(`http://localhost:8003/api/employees/${empId}`, {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${t}` }
        });
      }, empIdToDelete);

      const dbEmpDeleted = await db.query('SELECT * FROM employee WHERE emp_id=$1', [empIdToDelete]);
      logResult('Delete Employee Mutation', dbEmpDeleted.rows.length === 0, `Employee ID ${empIdToDelete} removed from DB`);
    }

    if (dbStatic.rows.length > 0) {
      await page.evaluate(async (infoId) => {
        const t = localStorage.getItem('oncall-app-token');
        await fetch(`http://localhost:8003/api/static-info/${infoId}`, {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${t}` }
        });
      }, dbStatic.rows[0].info_id);
    }

  } catch (err) {
    console.error('VERIFICATION ERROR:', err);
  } finally {
    await browser.close();
    await db.query("UPDATE employee SET ftid='admin', role='super_admin' WHERE emp_id=1");
    console.log('\n=== SUMMARY OF VERIFICATION RESULTS ===');
    const passed = results.filter(r => r.status).length;
    const failed = results.filter(r => !r.status).length;
    console.log(`Passed: ${passed} / ${results.length}`);
    console.log(`Failed: ${failed} / ${results.length}\n`);
    process.exit(0);
  }
}

runVerification();
