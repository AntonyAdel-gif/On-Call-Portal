// src/models/applicationsModel.js
import pool from '../db.js';

export const getAll = async () => {
  const result = await pool.query(`
    SELECT application_id, application_name, sla, basicat, cartoo_id, support, team_id
FROM applications
  `);
  return result.rows;
};

export const getByTeamId = async (teamId) => {
  const result = await pool.query(
    `SELECT application_id, application_name, sla, basicat, cartoo_id, support
     FROM applications
     WHERE team_id = $1`,
    [teamId]
  );
  return result.rows;
};

export const getById = async (id) => {
  const result = await pool.query(
    'SELECT * FROM applications WHERE application_id = $1',
    [id]
  );
  return result.rows[0];
};

export const findDuplicate = async ({ application_name, cartoo_id, excludeId = null }) => {
  const result = await pool.query(
    `SELECT application_name, cartoo_id
     FROM applications
     WHERE ($1::int IS NULL OR application_id <> $1)
       AND (
         LOWER(TRIM(application_name)) = LOWER(TRIM($2))
         OR cartoo_id = $3
       )`,
    [excludeId, application_name, cartoo_id]
  );

  return {
    applicationNameExists: result.rows.some(
      (app) => app.application_name.trim().toLowerCase() === application_name.trim().toLowerCase()
    ),
    cartooIdExists: result.rows.some((app) => app.cartoo_id === cartoo_id),
  };
};

export const create = async ({
  application_name,
  sla,
  basicat,
  cartoo_id,
  support,
  team_id,
}) => {
  const result = await pool.query(
    `INSERT INTO applications
      (application_name, sla, basicat, cartoo_id, support, team_id)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [
      application_name,
      sla,
      basicat,
      cartoo_id,
      support,
      team_id || null,
    ]
  );

  return result.rows[0];
};

export const update = async (id, fields) => {
  const {
  application_name,
  sla,
  basicat,
  cartoo_id,
  support,
  team_id,
} = fields;
  const result = await pool.query(
  `UPDATE applications
   SET application_name = $1,
       sla = $2,
       basicat = $3,
       cartoo_id = $4,
       support = $5,
       team_id = $6
   WHERE application_id = $7
   RETURNING *`,
  [
    application_name,
    sla,
    basicat,
    cartoo_id,
    support,
    team_id || null,
    id,
  ]
);
  return result.rows[0];
};

export const remove = async (id) => {
  await pool.query('DELETE FROM applications WHERE application_id = $1', [id]);
};

export const assignToTeam = async (teamId, appIds) => {
  const result = await pool.query(
    `UPDATE applications SET team_id = $1 WHERE application_id = ANY($2::int[]) RETURNING *`,
    [teamId, appIds]
  );
  return result.rows;
};

// Clears team_id for apps that were on this team but are no longer in the kept list
export const unassignFromTeam = async (teamId, keepAppIds = []) => {
  if (keepAppIds.length === 0) {
    await pool.query('UPDATE applications SET team_id = NULL WHERE team_id = $1', [teamId]);
  } else {
    await pool.query(
      'UPDATE applications SET team_id = NULL WHERE team_id = $1 AND application_id != ALL($2::int[])',
      [teamId, keepAppIds]
    );
  }
};
