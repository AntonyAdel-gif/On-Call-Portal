// src/models/scheduleModel.js
import pool from '../db.js';

let schemaChecked = false;
// Dynamically alters PostgreSQL schedule table on initial run to ensure cycle_id column exists
// without requiring manual database migration scripts.
export const ensureCycleIdColumnExists = async () => {
  if (schemaChecked) return;
  try {
    await pool.query('ALTER TABLE schedule ADD COLUMN IF NOT EXISTS cycle_id INTEGER');
    schemaChecked = true;
  } catch (err) {
    console.error('Failed to ensure cycle_id column exists on schedule table:', err);
  }
};

// Purges schedule rows extending beyond 60 days into the future to keep table size bounded.
export const cleanExcessFutureSchedule = async (maxDaysAhead = 60) => {
  await pool.query(
    `DELETE FROM schedule
     WHERE start_dt > NOW() + ($1 || ' days')::INTERVAL`,
    [maxDaysAhead]
  );
};

// Purges historical schedule rows older than 1 year to adhere to data retention compliance limits.
export const cleanPastSchedule = async (maxYearsBack = 1) => {
  await pool.query(
    `DELETE FROM schedule
     WHERE start_dt < NOW() - ($1 || ' years')::INTERVAL`,
    [maxYearsBack]
  );
};

// Extends team rotation schedule up to minDaysAhead (default 60 days).
// Excludes team managers (t.manager_emp_id) and inactive employees, ordering by def_oncall_ord.
export const extendRotation = async (teamId, cyclesToAdd = null, minDaysAhead = 60) => {
  await ensureCycleIdColumnExists();
  const teamRes = await pool.query(
    'SELECT cycle_day, cycle_st_day FROM teams WHERE team_id = $1',
    [teamId]
  );
  if (teamRes.rows.length === 0) return [];
  const { cycle_day, cycle_st_day } = teamRes.rows[0];

  // Exclude team manager from shift assignments to keep them dedicated to escalation/management.
  const empRes = await pool.query(
    `SELECT e.emp_id, e.bk_emp_id
     FROM employee e
     JOIN teams t ON e.team_id = t.team_id
     WHERE e.team_id = $1 AND e.active_flg = TRUE
       AND (t.manager_emp_id IS NULL OR e.emp_id <> t.manager_emp_id)
     ORDER BY e.def_oncall_ord ASC`,
    [teamId]
  );
  const employees = empRes.rows;
  if (employees.length === 0) return [];

  const lastRes = await pool.query(
    `SELECT s.emp_id, s.end_dt FROM schedule s
     JOIN employee e ON s.emp_id = e.emp_id
     WHERE e.team_id = $1
     ORDER BY s.end_dt DESC LIMIT 1`,
    [teamId]
  );

  // Skip appending new rows if existing coverage buffer already meets or exceeds minDaysAhead requirement.
  if (lastRes.rows.length > 0) {
    const lastEnd = new Date(lastRes.rows[0].end_dt);
    const daysRemaining = (lastEnd.getTime() - Date.now()) / (1000 * 60 * 60 * 24);
    if (daysRemaining >= minDaysAhead) {
      return [];
    }
  }

  // Increment cycle_id to trace which generation batch each new schedule row belongs to.
  const maxCycleRes = await pool.query(
    `SELECT COALESCE(MAX(s.cycle_id), 0) AS max_cycle
     FROM schedule s
     JOIN employee e ON s.emp_id = e.emp_id
     WHERE e.team_id = $1`,
    [teamId]
  );
  const nextCycleId = Number(maxCycleRes.rows[0].max_cycle) + 1;

  let currentStart;
  let startIndex;

  if (lastRes.rows.length === 0) {
    currentStart = new Date(cycle_st_day);
    startIndex = 0;
  } else {
    const { emp_id: lastEmpId, end_dt: lastEnd } = lastRes.rows[0];
    currentStart = new Date(lastEnd);
    const lastIndex = employees.findIndex((e) => e.emp_id === lastEmpId);
    startIndex = (lastIndex + 1) % employees.length;
  }

  const rows = [];
  const targetEnd = new Date(Date.now() + minDaysAhead * 24 * 60 * 60 * 1000);
  let i = 0;

  while (
    cyclesToAdd !== null
      ? i < cyclesToAdd
      : currentStart < targetEnd
  ) {
    const emp = employees[(startIndex + i) % employees.length];
    const startDt = new Date(currentStart);
    const endDt = new Date(currentStart);
    endDt.setDate(endDt.getDate() + cycle_day);

    rows.push({
      emp_id: emp.emp_id,
      bk_emp_id: emp.bk_emp_id,
      start_dt: startDt,
      end_dt: endDt,
      cycle_id: nextCycleId,
    });
    currentStart = endDt;
    i++;
  }

  // Uses ON CONFLICT DO NOTHING to avoid duplicate key violations if a row already exists for (emp_id, start_dt).
  for (const row of rows) {
    await pool.query(
      `INSERT INTO schedule (emp_id, start_dt, end_dt, bk_emp_id, cycle_id)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (emp_id, start_dt) DO NOTHING`,
      [row.emp_id, row.start_dt, row.end_dt, row.bk_emp_id, row.cycle_id]
    );
  }

  return rows;
};

// Current Cycle Lock Check:
// Determines if either target employee's shift in the current active cycle has already started (start_dt <= NOW()).
// Returns true to signal that a rotation order swap or schedule edit must be blocked (HTTP 400).
export const hasCycleProgressedPastOrderSwap = async (teamId, empIdX, empIdY) => {
  await ensureCycleIdColumnExists();
  const activeRes = await pool.query(
    `SELECT s.cycle_id
     FROM schedule s
     JOIN employee e ON s.emp_id = e.emp_id
     WHERE e.team_id = $1 AND s.start_dt <= NOW() AND s.end_dt > NOW()
     LIMIT 1`,
    [teamId]
  );

  let currentCycleId = null;
  if (activeRes.rows.length > 0) {
    currentCycleId = activeRes.rows[0].cycle_id;
  } else {
    const recentRes = await pool.query(
      `SELECT s.cycle_id
       FROM schedule s
       JOIN employee e ON s.emp_id = e.emp_id
       WHERE e.team_id = $1 AND s.start_dt <= NOW()
       ORDER BY s.start_dt DESC
       LIMIT 1`,
      [teamId]
    );
    if (recentRes.rows.length > 0) {
      currentCycleId = recentRes.rows[0].cycle_id;
    }
  }

  if (currentCycleId === null || currentCycleId === undefined) {
    return false;
  }

  const empIds = [Number(empIdX)];
  if (empIdY && Number(empIdY) !== Number(empIdX)) {
    empIds.push(Number(empIdY));
  }

  const rowsRes = await pool.query(
    `SELECT emp_id, start_dt
     FROM schedule
     WHERE cycle_id = $1 AND emp_id = ANY($2::int[])`,
    [currentCycleId, empIds]
  );

  const now = new Date();
  for (const row of rowsRes.rows) {
    if (new Date(row.start_dt) <= now) {
      return true;
    }
  }

  return false;
};

// Clears future schedule rows for a team before running future-only regeneration.
export const clearFutureSchedule = async (teamId) => {
  await pool.query(
    `DELETE FROM schedule
     WHERE emp_id IN (SELECT emp_id FROM employee WHERE team_id = $1)
       AND start_dt > NOW()`,
    [teamId]
  );
};

// Wipes future unstarted shifts and rebuilds rotation buffer from current roster configuration.
export const regenerateFutureRotation = async (teamId, cyclesToAdd = null) => {
  await clearFutureSchedule(teamId);
  return extendRotation(teamId, cyclesToAdd);
};

// Flexible lookup helper matching shift records by exact timestamp or ISO date string prefix.
export const getByStartDateAndEmp = async (startDt, empId) => {
  if (!startDt || !empId) return null;
  const strVal = typeof startDt === 'string' ? startDt : new Date(startDt).toISOString();
  const dateStr = strVal.split('T')[0];

  const result = await pool.query(
    `SELECT * FROM schedule
     WHERE emp_id = $1
       AND (
         start_dt = $2::timestamp
         OR start_dt::text LIKE $3 || '%'
       )
     LIMIT 1`,
    [Number(empId), strVal, dateStr]
  );
  if (result.rows.length > 0) return result.rows[0];

  const fallback = await pool.query(
    `SELECT * FROM schedule WHERE emp_id = $1 ORDER BY start_dt ASC`,
    [Number(empId)]
  );
  if (fallback.rows.length === 0) return null;

  const matched = fallback.rows.find((row) => {
    const rDate = new Date(row.start_dt).toISOString().split('T')[0];
    return rDate === dateStr;
  });

  return matched || fallback.rows[0];
};

export const getByStartDate = async (startDt) => {
  if (!startDt) return null;
  const strVal = typeof startDt === 'string' ? startDt : new Date(startDt).toISOString();
  const dateStr = strVal.split('T')[0];

  const result = await pool.query(
    `SELECT * FROM schedule
     WHERE start_dt = $1::timestamp
        OR start_dt::text LIKE $2 || '%'
     LIMIT 1`,
    [strVal, dateStr]
  );
  return result.rows[0];
};

// Returns full chronological rotation schedule for a single team.
export const getByTeamId = async (teamId) => {
  const result = await pool.query(
    `SELECT
       s.start_dt,
       s.end_dt,
       s.emp_id,
       COALESCE(s.bk_emp_id, e.bk_emp_id) AS bk_emp_id,
       e.emp_name AS on_call_name,
       e.phone1 AS on_call_phone,
       b.emp_name AS backup_name,
       b.phone1 AS backup_phone
     FROM schedule s
     JOIN employee e ON s.emp_id = e.emp_id
     LEFT JOIN employee b ON COALESCE(s.bk_emp_id, e.bk_emp_id) = b.emp_id
     WHERE e.team_id = $1
     ORDER BY s.start_dt`,
    [teamId]
  );
  return result.rows;
};

// Uses window function ROW_NUMBER() PARTITION BY team_id to return the top N upcoming shifts per team for the multi-team matrix view.
export const getFullScheduleAllTeams = async (weeksPerTeam = 8) => {
  const result = await pool.query(
    `SELECT * FROM (
       SELECT
         t.team_id,
         t.team_name,
         s.start_dt,
         s.end_dt,
         e.emp_name AS on_call_name,
         e.phone1 AS on_call_phone,
         b.emp_name AS backup_name,
         b.phone1 AS backup_phone,
         ROW_NUMBER() OVER (PARTITION BY t.team_id ORDER BY s.start_dt) AS rn
       FROM schedule s
       JOIN employee e ON s.emp_id = e.emp_id
       JOIN teams t ON e.team_id = t.team_id
       LEFT JOIN employee b ON COALESCE(s.bk_emp_id, e.bk_emp_id) = b.emp_id
       WHERE s.start_dt >= NOW() - INTERVAL '1 day'
     ) ranked
     WHERE rn <= $1
     ORDER BY team_id, start_dt`,
    [weeksPerTeam]
  );
  return result.rows;
};

// Returns historical shifts up to 1 year back for past schedule history logs and Excel reporting.
export const getPastSchedules = async ({ teamId = null } = {}) => {
  let query = `
    SELECT
      s.start_dt,
      s.end_dt,
      s.emp_id,
      e.emp_name AS on_call_name,
      e.ftid AS on_call_ftid,
      e.phone1 AS on_call_phone,
      COALESCE(s.bk_emp_id, e.bk_emp_id) AS bk_emp_id,
      b.emp_name AS backup_name,
      b.phone1 AS backup_phone,
      t.team_id,
      t.team_name,
      mgr.emp_name AS manager_name,
      mgr.phone1 AS manager_phone
    FROM schedule s
    JOIN employee e ON s.emp_id = e.emp_id
    JOIN teams t ON e.team_id = t.team_id
    LEFT JOIN employee b ON COALESCE(s.bk_emp_id, e.bk_emp_id) = b.emp_id
    LEFT JOIN employee mgr ON t.manager_emp_id = mgr.emp_id
    WHERE s.start_dt <= NOW()
      AND s.start_dt >= NOW() - INTERVAL '1 year'
  `;
  const params = [];

  if (teamId) {
    params.push(Number(teamId));
    query += ` AND t.team_id = $${params.length}`;
  }

  query += ` ORDER BY s.start_dt DESC`;

  const result = await pool.query(query, params);
  return result.rows;
};

// Executes cross-week trade by exchanging emp_id values across two distinct schedule timestamps.
export const swapAcrossWeeks = async (startDt1, startDt2, empId1, empId2) => {
  const str1 = typeof startDt1 === 'string' ? startDt1 : new Date(startDt1).toISOString();
  const str2 = typeof startDt2 === 'string' ? startDt2 : new Date(startDt2).toISOString();
  const dStr1 = str1.split('T')[0];
  const dStr2 = str2.split('T')[0];

  await pool.query(
    `UPDATE schedule
     SET emp_id = $1
     WHERE (emp_id = $2 OR $2 IS NULL)
       AND (start_dt = $3::timestamp OR start_dt::text LIKE $4 || '%')`,
    [Number(empId2), empId1 ? Number(empId1) : null, str1, dStr1]
  );

  await pool.query(
    `UPDATE schedule
     SET emp_id = $1
     WHERE (emp_id = $2 OR $2 IS NULL)
       AND (start_dt = $3::timestamp OR start_dt::text LIKE $4 || '%')`,
    [Number(empId1), empId2 ? Number(empId2) : null, str2, dStr2]
  );
};

// Executes same-week backup swap by updating assigned on-call emp_id for a single shift row.
export const swapWithOwnBackup = async (startDt, empId1, empId2) => {
  const str = typeof startDt === 'string' ? startDt : new Date(startDt).toISOString();
  const dStr = str.split('T')[0];

  await pool.query(
    `UPDATE schedule
     SET emp_id = $1
     WHERE (emp_id = $2 OR $2 IS NULL)
       AND (start_dt = $3::timestamp OR start_dt::text LIKE $4 || '%')`,
    [Number(empId2), empId1 ? Number(empId1) : null, str, dStr]
  );
};