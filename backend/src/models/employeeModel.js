// src/models/employeeModel.js

import pool from '../db.js';

export const getAll = async (teamId = null) => {
  if (teamId) {
    const result = await pool.query(
      'SELECT * FROM employee WHERE team_id = $1 ORDER BY def_oncall_ord ASC',
      [teamId]
    );
    return result.rows;
  }
  const result = await pool.query('SELECT * FROM employee ORDER BY team_id, def_oncall_ord ASC');
  return result.rows;
};

export const getByManagerId = async (managerEmpId) => {
  const result = await pool.query(
    `SELECT e.* FROM employee e
     JOIN teams t ON e.team_id = t.team_id
     WHERE t.manager_emp_id = $1
     ORDER BY e.def_oncall_ord ASC`,
    [managerEmpId]
  );
  return result.rows;
};

export const getById = async (id) => {
  const result = await pool.query('SELECT * FROM employee WHERE emp_id = $1', [id]);
  return result.rows[0];
};
//for swap request
export const getTeammates = async (teamId) => {
  const result = await pool.query(
    'SELECT emp_id, emp_name FROM employee WHERE team_id = $1 AND active_flg = TRUE',
    [teamId]
  );
  return result.rows;
};

export const getByFtid = async (ftid) => {
  const result = await pool.query('SELECT * FROM employee WHERE ftid = $1', [ftid]);
  return result.rows[0];
};

// Resolves a local fallback login to a usable employee profile. Prefer an
// employee whose FTID is the local username; if one has not been created,
// use the first active employee with the credential's fixed role.
export const getLocalAuthCandidate = async (ftid, role) => {
  const result = await pool.query(
    `SELECT * FROM employee
     WHERE active_flg = TRUE
       AND (LOWER(ftid) = LOWER($1) OR role = $2)
     ORDER BY CASE WHEN LOWER(ftid) = LOWER($1) THEN 0 ELSE 1 END, emp_id
     LIMIT 1`,
    [ftid, role]
  );
  return result.rows[0];
};

// Next free rotation number for a team — used automatically on creation
export const getNextOrder = async (teamId) => {
  const result = await pool.query(
    'SELECT COALESCE(MAX(def_oncall_ord), 0) + 1 AS next_order FROM employee WHERE team_id = $1',
    [teamId]
  );
  return result.rows[0].next_order;
};

export const create = async ({
  emp_name, phone1, phone2, emp_mail, team_id, ftid, def_oncall_ord, role, bk_emp_id,
}) => {
  const result = await pool.query(
    `INSERT INTO employee (emp_name, phone1, phone2, emp_mail, team_id, ftid, def_oncall_ord, role, bk_emp_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING *`,
    [emp_name, phone1, phone2, emp_mail, team_id, ftid, def_oncall_ord, role || 'user', bk_emp_id]
  );
  return result.rows[0];
};

export const update = async (id, fields) => {
  const {
    emp_name, phone1, phone2, emp_mail, team_id,
    def_oncall_ord, active_flg, role, bk_emp_id, ftid,
  } = fields;

  const result = await pool.query(
    `UPDATE employee
     SET emp_name = $1, phone1 = $2, phone2 = $3, emp_mail = $4, team_id = $5,
         def_oncall_ord = $6, active_flg = $7, role = $8, bk_emp_id = $9, ftid = $10
     WHERE emp_id = $11
     RETURNING *`,
    [emp_name, phone1, phone2, emp_mail, team_id, def_oncall_ord, active_flg, role, bk_emp_id, ftid, id]
  );
  return result.rows[0];
};

export const getByTeamAndOrder = async (teamId, order) => {
  const result = await pool.query(
    'SELECT * FROM employee WHERE team_id = $1 AND def_oncall_ord = $2',
    [teamId, order]
  );
  return result.rows[0];
};

// Swaps two employees' rotation order (or just moves one, if the target number is free)
export const updateOrder = async (teamId, empId, newOrder) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const currentRes = await client.query('SELECT def_oncall_ord FROM employee WHERE emp_id = $1', [empId]);
    if (currentRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return null;
    }
    const currentOrder = currentRes.rows[0].def_oncall_ord;

    const holderRes = await client.query(
      'SELECT emp_id FROM employee WHERE team_id = $1 AND def_oncall_ord = $2 AND emp_id != $3',
      [teamId, newOrder, empId]
    );

    if (holderRes.rows.length > 0) {
      const holderEmpId = holderRes.rows[0].emp_id;
      // Step 1: Temporarily set holder's order to -1 to avoid duplicate key conflict
      await client.query('UPDATE employee SET def_oncall_ord = -1 WHERE emp_id = $1', [holderEmpId]);
      // Step 2: Set empId's order to newOrder
      await client.query('UPDATE employee SET def_oncall_ord = $1 WHERE emp_id = $2', [newOrder, empId]);
      // Step 3: Set holder's order to currentOrder
      await client.query('UPDATE employee SET def_oncall_ord = $1 WHERE emp_id = $2', [currentOrder, holderEmpId]);
    } else {
      await client.query('UPDATE employee SET def_oncall_ord = $1 WHERE emp_id = $2', [newOrder, empId]);
    }

    await client.query('COMMIT');
    const result = await pool.query('SELECT * FROM employee WHERE emp_id = $1', [empId]);
    return result.rows[0];
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

// Deleting now closes the gap in that team's rotation order
export const remove = async (id) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const empRes = await client.query('SELECT team_id, def_oncall_ord FROM employee WHERE emp_id = $1', [id]);
    if (empRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return;
    }
    const { team_id, def_oncall_ord } = empRes.rows[0];

    await client.query('DELETE FROM employee WHERE emp_id = $1', [id]);
    await client.query(
      'UPDATE employee SET def_oncall_ord = def_oncall_ord - 1 WHERE team_id = $1 AND def_oncall_ord > $2',
      [team_id, def_oncall_ord]
    );
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

export const changeTeam = async (empId, newTeamId) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Get the employee's current team and rotation order
    const empRes = await client.query(
      'SELECT team_id, def_oncall_ord FROM employee WHERE emp_id = $1',
      [empId]
    );
    const { team_id: oldTeamId, def_oncall_ord: oldOrd } = empRes.rows[0];

    if (oldTeamId === newTeamId) {
      await client.query('ROLLBACK');
      return null; // no actual team change, nothing to do
    }

    // 2. Find who had this employee as their backup
    const backupForRes = await client.query(
      'SELECT emp_id FROM employee WHERE bk_emp_id = $1',
      [empId]
    );

    // 3. Find the next employee (higher rotation order) in the OLD team
    const nextRes = await client.query(
      `SELECT emp_id FROM employee
       WHERE team_id = $1 AND def_oncall_ord > $2
       ORDER BY def_oncall_ord ASC LIMIT 1`,
      [oldTeamId, oldOrd]
    );
    const nextEmpId = nextRes.rows[0]?.emp_id || null;

    // 4. Reassign backup for whoever relied on the moving employee
    if (nextEmpId) {
      for (const row of backupForRes.rows) {
        await client.query(
          'UPDATE employee SET bk_emp_id = $1 WHERE emp_id = $2',
          [nextEmpId, row.emp_id]
        );
      }
    }

    // 5. Close the gap in the old team's rotation order
    await client.query(
      `UPDATE employee SET def_oncall_ord = def_oncall_ord - 1
       WHERE team_id = $1 AND def_oncall_ord > $2`,
      [oldTeamId, oldOrd]
    );

    // 6. Move employee to new team, placed at the end of its rotation order
    const maxOrdRes = await client.query(
      `SELECT COALESCE(MAX(def_oncall_ord), 0) + 1 AS next_ord
       FROM employee WHERE team_id = $1`,
      [newTeamId]
    );
    const newOrd = maxOrdRes.rows[0].next_ord;

    const result = await client.query(
      `UPDATE employee
       SET team_id = $1, def_oncall_ord = $2, bk_emp_id = NULL
       WHERE emp_id = $3
       RETURNING *`,
      [newTeamId, newOrd, empId]
    );

    await client.query('COMMIT');
    return result.rows[0];
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};
