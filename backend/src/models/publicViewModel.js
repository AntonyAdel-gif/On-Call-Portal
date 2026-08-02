// src/models/publicViewModel.js
import pool from '../db.js';

// The default dashboard — shows who's on-call RIGHT NOW for every team,
// plus their backup and their team's manager. No login required.
export const getCurrentOnCallDashboard = async () => {
  const result = await pool.query(`
    SELECT
      t.team_id,
      t.team_name AS team,
      e.emp_name AS on_call_person,
      e.phone1 AS on_call_phone,
      b.emp_name AS on_call_backup,
      b.phone1 AS on_call_backup_phone,
      m.emp_name AS manager_name,
      m.phone1 AS manager_phone
    FROM schedule s
    JOIN employee e ON s.emp_id = e.emp_id
    JOIN teams t ON e.team_id = t.team_id
    LEFT JOIN employee b ON COALESCE(s.bk_emp_id, e.bk_emp_id) = b.emp_id
    LEFT JOIN employee m ON t.manager_emp_id = m.emp_id
    WHERE NOW() BETWEEN s.start_dt AND s.end_dt
  `);
  return result.rows;
};

// Triggered when a user clicks a team name on the dashboard —
// shows every app that team supports, plus the team's manager (who also acts as escalation contact)
export const getTeamAppsAndEscalation = async (teamId) => {
  const result = await pool.query(
    `SELECT
       a.application_name,
       a.sla,
       a.basicat,
       a.cartoo_id,
       m.emp_name AS escalation_name,
       m.phone1 AS escalation_phone
     FROM applications a
     JOIN teams t ON a.team_id = t.team_id
     LEFT JOIN employee m ON t.manager_emp_id = m.emp_id
     WHERE t.team_id = $1`,
    [teamId]
  );
  return result.rows;
};