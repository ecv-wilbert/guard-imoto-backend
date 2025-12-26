import pkg from 'pg';
import { DB_CONFIG } from './env.js';
import { logDb } from '../utils/logger.js';

const { Pool } = pkg;

export const pool = new Pool(DB_CONFIG);

// Call this once at server start to verify DB connection
export async function initDb() {
  try {
    const client = await pool.connect();
    logDb('Connected to PostgreSQL');
    client.release();
  } catch (err) {
    logDb(`Failed to connect: ${err.message}`);
    process.exit(1);
  }
}

// Wrapper for queries
export async function query(text, params = []) {
  const start = Date.now();
  const res = await pool.query(text, params);
  const duration = Date.now() - start;
  logDb(`Query executed in ${duration}ms, rows: ${res.rowCount}`);
  return res;
}
