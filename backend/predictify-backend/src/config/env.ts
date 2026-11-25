import "dotenv/config";

const number = (name: string, fallback: number): number => {
  const raw = process.env[name];
  if (raw === undefined) return fallback;
  const value = Number(raw);
  if (!Number.isFinite(value)) throw new Error(`${name} must be a number`);
  return value;
};

export const env = {
  nodeEnv: process.env.NODE_ENV ?? "development",
  host: process.env.HOST ?? "0.0.0.0",
  port: number("PORT", 3000),
  databaseUrl: process.env.DATABASE_URL ?? "",
  dbPoolMax: number("DB_POOL_MAX", 10),
  dbIdleTimeoutMs: number("DB_IDLE_TIMEOUT_MS", 30000),
} as const;

if (!env.databaseUrl) {
  throw new Error("DATABASE_URL is required");
}
