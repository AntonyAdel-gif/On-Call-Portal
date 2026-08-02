// src/db.js
import 'dotenv/config';
import pg from 'pg';

const { Pool } = pg;

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});

pool.on('connect', () => {
  console.log('Connected to PostgreSQL');
});

pool.on('error', (err) => {
  console.error('Unexpected PostgreSQL error', err);
});

export default pool;