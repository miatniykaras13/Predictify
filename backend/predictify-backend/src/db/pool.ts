import pg from "pg";
import { env } from "../config/env.js";

const { Pool } = pg;

export const pool = new Pool({
  connectionString: env.databaseUrl,
  max: env.dbPoolMax,
  idleTimeoutMillis: env.dbIdleTimeoutMs,
});

export async function checkDatabase(): Promise<void> {
  await pool.query("SELECT 1");
}
