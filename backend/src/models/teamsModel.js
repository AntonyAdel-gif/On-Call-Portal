// src/models/teamsModel.js
import pool from '../db.js';

export const getAll = async () => {
  const result = await pool.query('SELECT * FROM teams');
  return result.rows;
};

export const getById = async (id) => {
  const result = await pool.query(
    'SELECT * FROM teams WHERE team_id = $1',
    [id]
  );
  return result.rows[0];
};

export const create = async ({
  team_name,
  cycle_day,
  cycle_st_day,
  manager_emp_id,
}) => {
  const result = await pool.query(
    `INSERT INTO teams (team_name, cycle_day, cycle_st_day, manager_emp_id)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [team_name, cycle_day, cycle_st_day, manager_emp_id]
  );
  return result.rows[0];
};

export const update = async (id, fields) => {
  const { team_name, cycle_day, cycle_st_day, manager_emp_id } = fields;

  const result = await pool.query(
    `UPDATE teams
     SET team_name = $1,
         cycle_day = $2,
         cycle_st_day = $3,
         manager_emp_id = $4
     WHERE team_id = $5
     RETURNING *`,
    [team_name, cycle_day, cycle_st_day, manager_emp_id, id]
  );
  return result.rows[0];
};

export const getAllTeamIds = async () => {
  const result = await pool.query('SELECT team_id FROM teams');
  return result.rows.map((row) => row.team_id);
};

export const isManagerAssignedToAnotherTeam = async (managerEmpId, excludeTeamId = null) => {
  if (!managerEmpId) return false;
  const result = await pool.query(
    `SELECT team_id FROM teams
     WHERE manager_emp_id = $1
       AND ($2::INT IS NULL OR team_id <> $2::INT)`,
    [managerEmpId, excludeTeamId]
  );
  return result.rows.length > 0;
};

export const getAvailableAdmins = async (excludeTeamId = null) => {
  const result = await pool.query(
    `SELECT e.emp_id, e.emp_name, e.emp_mail, e.phone1, e.team_id, e.role
     FROM employee e
     WHERE e.role = 'admin'
       AND e.active_flg = TRUE
       AND e.emp_id NOT IN (
         SELECT manager_emp_id FROM teams
         WHERE manager_emp_id IS NOT NULL
           AND ($1::INT IS NULL OR team_id <> $1::INT)
       )
     ORDER BY e.emp_name ASC`,
    [excludeTeamId]
  );
  return result.rows;
};

export const remove = async (id) => {
  await pool.query(
    'UPDATE employee SET team_id = NULL, def_oncall_ord = NULL WHERE team_id = $1',
    [id]
  );
  await pool.query(
    'UPDATE applications SET team_id = NULL WHERE team_id = $1',
    [id]
  );
  await pool.query(
    'DELETE FROM schedule WHERE emp_id IN (SELECT emp_id FROM employee WHERE team_id = $1)',
    [id]
  );
  const result = await pool.query(
    'DELETE FROM teams WHERE team_id = $1 RETURNING *',
    [id]
  );
  return result.rows[0];
};
