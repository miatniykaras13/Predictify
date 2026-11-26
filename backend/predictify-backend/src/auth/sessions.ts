import { createHash, randomBytes, randomUUID } from 'node:crypto';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { pool } from '../db/pool.js';
import { AuthError, invalidSession } from './errors.js';
import { hashPassword, verifyPassword } from './password.js';

const accessLifetime = 15 * 60;

export type SessionActor = {
  userId: string;
  sessionId: string;
};

type SessionRow = { id: string; user_id: string; expires_at: Date };

type Credentials = {
  session: SessionRow;
  refreshToken: string;
};

function refreshHash(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function readRefreshHash(token: string | undefined): string | undefined {
  return token && /^[a-zA-Z0-9_-]{43}$/.test(token)
    ? refreshHash(token)
    : undefined;
}

export async function registerAccount(input: {
  email: string;
  password: string;
  publicName: string;
}) {
  const passwordHash = await hashPassword(input.password);
  try {
    const result = await pool.query<{ id: string; publicName: string }>(
      'INSERT INTO app.users (email, public_name, password_hash) VALUES ($1, $2, $3) RETURNING id::text, public_name AS "publicName"',
      [input.email, input.publicName, passwordHash],
    );
    return result.rows[0]!;
  } catch (error) {
    if (
      error instanceof Error &&
      'code' in error &&
      error.code === '23505' &&
      'constraint' in error &&
      error.constraint === 'users_email_unique'
    ) {
      throw new AuthError(409, 'EMAIL_TAKEN', 'Email is already registered');
    }
    throw error;
  }
}

export async function startSession(
  email: string,
  password: string,
): Promise<Credentials> {
  const invalidCredentials = () =>
    new AuthError(401, 'INVALID_CREDENTIALS', 'Invalid email or password');
  const account = await pool.query<{ id: string; password_hash: string }>(
    'SELECT id::text, password_hash FROM app.users WHERE email = $1',
    [email],
  );
  const user = account.rows[0];
  if (!(await verifyPassword(password, user?.password_hash)) || !user) {
    throw invalidCredentials();
  }

  const refreshToken = randomBytes(32).toString('base64url');
  // Share the user row lock with password changes that revoke all sessions.
  const result = await pool.query<SessionRow>(
    'WITH account AS MATERIALIZED (' +
      'SELECT id FROM app.users WHERE id = $1 AND password_hash = $2 FOR UPDATE' +
      ') INSERT INTO app.sessions (id, user_id, refresh_token_hash, expires_at) ' +
      "SELECT $3, id, $4, date_trunc('second', clock_timestamp()) + interval '168 hours' FROM account " +
      'RETURNING id, user_id::text, expires_at',
    [user.id, user.password_hash, randomUUID(), refreshHash(refreshToken)],
  );
  const session = result.rows[0];
  if (!session) {
    throw invalidCredentials();
  }
  return { session, refreshToken };
}

export async function rotateSession(
  token: string | undefined,
): Promise<Credentials> {
  const previousHash = readRefreshHash(token);
  if (!previousHash) throw invalidSession();

  const refreshToken = randomBytes(32).toString('base64url');
  const result = await pool.query<SessionRow>(
    'WITH account AS MATERIALIZED (' +
      'SELECT users.id FROM app.users AS users JOIN app.sessions AS sessions ON sessions.user_id = users.id ' +
      'WHERE sessions.refresh_token_hash = $1 AND sessions.revoked_at IS NULL ' +
      'AND sessions.expires_at > clock_timestamp() FOR UPDATE OF users' +
      ') UPDATE app.sessions SET refresh_token_hash = $2 ' +
      'WHERE user_id IN (SELECT id FROM account) AND refresh_token_hash = $1 ' +
      'AND revoked_at IS NULL AND expires_at > clock_timestamp() ' +
      'RETURNING id, user_id::text, expires_at',
    [previousHash, refreshHash(refreshToken)],
  );
  const session = result.rows[0];
  if (!session) throw invalidSession();

  return { session, refreshToken };
}

export async function revokeSession(token: string | undefined): Promise<void> {
  const hash = readRefreshHash(token);
  if (!hash) return;

  await pool.query(
    'UPDATE app.sessions SET revoked_at = clock_timestamp() ' +
      'WHERE refresh_token_hash = $1 AND revoked_at IS NULL AND expires_at > clock_timestamp()',
    [hash],
  );
}

export async function issueAccessToken(
  reply: FastifyReply,
  session: SessionRow,
) {
  const issuedAt = Math.floor(Date.now() / 1000);
  const expiresAt = Math.min(
    issuedAt + accessLifetime,
    Math.floor(session.expires_at.getTime() / 1000),
  );
  if (expiresAt <= issuedAt) throw invalidSession();

  const accessToken = await reply.jwtSign({
    sub: session.user_id,
    sid: session.id,
    iat: issuedAt,
    exp: expiresAt,
  });
  return { accessToken, expiresIn: expiresAt - issuedAt };
}

export async function requireSession(
  request: FastifyRequest,
): Promise<SessionActor> {
  let payload: { sub?: unknown; sid?: unknown; exp?: unknown } | undefined;
  try {
    payload = await request.jwtVerify();
  } catch {
    throw invalidSession();
  }

  if (
    typeof payload?.exp !== 'number' ||
    typeof payload.sub !== 'string' ||
    !/^[1-9][0-9]{0,18}$/.test(payload.sub) ||
    BigInt(payload.sub) > 9223372036854775807n ||
    typeof payload.sid !== 'string' ||
    !/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(payload.sid)
  ) {
    throw invalidSession();
  }

  const active = await pool.query(
    'SELECT 1 FROM app.sessions WHERE id = $1 AND user_id = $2 ' +
      'AND revoked_at IS NULL AND expires_at > clock_timestamp()',
    [payload.sid, payload.sub],
  );
  if (!active.rowCount) throw invalidSession();

  return { userId: payload.sub, sessionId: payload.sid };
}
