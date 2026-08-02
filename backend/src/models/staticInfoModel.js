// src/models/staticInfoModel.js
import pool from '../db.js';

export const getAll = async () => {
  const result = await pool.query(`
    SELECT info_id, team_name, url
    FROM static_info
  `);
  return result.rows;
};

export const create = async ({ team_name, url, created_by }) => {
  const result = await pool.query(
    `INSERT INTO static_info (team_name, url, created_by)
     VALUES ($1, $2, $3)
     RETURNING *`,
    [team_name, url, created_by]
  );
  return result.rows[0];
};

export const update = async (id, fields) => {
  const { team_name, url } = fields;
  const result = await pool.query(
    `UPDATE static_info SET team_name = $1, url = $2 WHERE info_id = $3 RETURNING *`,
    [team_name, url, id]
  );
  return result.rows[0];
};

export const remove = async (id) => {
  const result = await pool.query(
    `DELETE FROM static_info WHERE info_id = $1 RETURNING *`,
    [id]
  );
  return result.rows[0];
};