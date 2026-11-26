import { createHash, randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { buildApp } from '../src/app.js';
import { requireSession } from '../src/auth/sessions.js';
import { pool } from '../src/db/pool.js';

vi.hoisted(() => {
  if (!process.env.TEST_DATABASE_URL) {
    throw new Error('TEST_DATABASE_URL must point to a migrated test database');
  }
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
  process.env.AUTH_APP_ORIGIN = 'https://predictify.example.test';
  process.env.AUTH_ACCESS_TOKEN_SECRET = 'ac'.repeat(32);
});

const password = 'Длинный пароль 🔐 для теста';
const origin = 'https://predictify.example.test';
const app = buildApp();
const emails: string[] = [];

function nextEmail() {
  const email = randomUUID() + '@example.test';
  emails.push(email);
  return email;
}

function register(email: string, extra: Record<string, unknown> = {}) {
  return app.inject({
    method: 'POST',
    url: '/api/auth/register',
    payload: { email, password, publicName: '  Участник  ', ...extra },
  });
}

function login(email: string, candidate = password) {
  return app.inject({
    method: 'POST',
    url: '/api/auth/login',
    headers: { origin },
    payload: { email, password: candidate },
  });
}

function cookieRequest(route: 'refresh' | 'logout', cookie?: string) {
  return app.inject({
    method: 'POST',
    url: '/api/auth/' + route,
    headers: cookie ? { origin, cookie } : { origin },
  });
}

function protectedRequest(token?: string) {
  return app.inject({
    method: 'GET',
    url: '/api/test-protected',
    headers: token ? { authorization: 'Bearer ' + token } : {},
  });
}

function readCookie(response: Awaited<ReturnType<typeof login>>): string {
  const cookie = response.cookies[0];
  expect(cookie).toMatchObject({
    name: 'predictify_refresh',
    path: '/api/auth',
    httpOnly: true,
    secure: true,
  });
  expect(response.headers['set-cookie']).toContain('SameSite=Lax');
  return cookie!.name + '=' + cookie!.value;
}

type AccessResponse = { accessToken: string; expiresIn: number };

beforeAll(async () => {
  app.get('/api/test-protected', (request) => requireSession(request));
  await app.ready();
});

afterAll(async () => {
  try {
    if (emails.length) {
      await pool.query('DELETE FROM app.users WHERE email = ANY($1::text[])', [
        emails,
      ]);
    }
  } finally {
    await app.close();
    await pool.end();
  }
});

describe('accounts and sessions', () => {
  it('normalizes unique email, hashes with separate salts and only creates users', async () => {
    const email = nextEmail();
    expect((await register(email, { role: 'admin' })).statusCode).toBe(400);
    expect((await register(email, { balance: 1000 })).statusCode).toBe(400);
    expect((await register(email, { publicName: 42 })).statusCode).toBe(400);
    expect((await register(email, { password: 'short' })).statusCode).toBe(400);
    expect((await register('invalid-email')).statusCode).toBe(400);

    const results = await Promise.all([
      register('  ' + email.toUpperCase() + '  '),
      register(email),
    ]);
    expect(results.map(({ statusCode }) => statusCode).sort()).toEqual([
      201, 409,
    ]);
    const created = results.find(({ statusCode }) => statusCode === 201)!;
    const duplicate = results.find(({ statusCode }) => statusCode === 409)!;
    const { id } = created.json<{ id: string }>();
    expect(typeof id).toBe('string');
    expect(created.json()).toEqual({ id, publicName: 'Участник' });
    expect(created.headers['set-cookie']).toBeUndefined();
    expect(created.headers['cache-control']).toBe('no-store');
    expect(duplicate.json()).toMatchObject({ error: 'EMAIL_TAKEN' });

    const otherEmail = nextEmail();
    expect((await register(otherEmail)).statusCode).toBe(201);
    const { rows } = await pool.query(
      'SELECT email, role, avatar_key, password_hash FROM app.users WHERE email = ANY($1::text[])',
      [[email, otherEmail]],
    );
    expect(rows).toHaveLength(2);
    for (const row of rows) {
      expect(row).toMatchObject({ role: 'user', avatar_key: null });
      expect(row.password_hash).toMatch(/^\$argon2id\$/);
      expect(row.password_hash).not.toContain(password);
    }
    expect(rows[0]!.password_hash).not.toBe(rows[1]!.password_hash);
    expect(
      (await pool.query('SELECT 1 FROM app.sessions WHERE user_id = $1', [id]))
        .rowCount,
    ).toBe(0);
  });

  it('uses identical login errors and checks Origin on cookie operations', async () => {
    const email = nextEmail();
    expect((await register(email)).statusCode).toBe(201);
    const unknown = await login(nextEmail());
    const wrong = await login(email, 'wrong password');
    expect(unknown.statusCode).toBe(401);
    expect(wrong.statusCode).toBe(401);
    expect(wrong.json()).toEqual(unknown.json());
    expect(wrong.headers['set-cookie']).toBeUndefined();

    for (const route of ['login', 'refresh', 'logout']) {
      for (const headers of [{}, { origin: 'https://other.example.test' }]) {
        const denied = await app.inject({
          method: 'POST',
          url: '/api/auth/' + route,
          headers,
          payload: route === 'login' ? { email, password } : undefined,
        });
        expect(denied.statusCode).toBe(403);
        expect(denied.headers['set-cookie']).toBeUndefined();
      }
    }
  });

  it('rotates once, revokes access immediately and keeps other sessions active', async () => {
    const email = nextEmail();
    const { id } = (await register(email)).json<{ id: string }>();
    const firstLogin = await login('  ' + email.toUpperCase());
    const secondLogin = await login(email);
    expect(firstLogin.statusCode).toBe(200);
    expect(secondLogin.statusCode).toBe(200);
    expect(firstLogin.headers['cache-control']).toBe('no-store');
    const firstToken = firstLogin.json<AccessResponse>();
    const secondToken = secondLogin.json<AccessResponse>();
    expect(firstToken.expiresIn).toBe(900);
    const firstCookie = readCookie(firstLogin);

    const actor = (await protectedRequest(firstToken.accessToken)).json<{
      userId: string;
      sessionId: string;
    }>();
    expect(actor.userId).toBe(id);
    expect((await protectedRequest()).statusCode).toBe(401);
    expect(
      (await protectedRequest(firstToken.accessToken + 'x')).statusCode,
    ).toBe(401);
    const mismatchedToken = app.jwt.sign({
      sub: (BigInt(id) + 1n).toString(),
      sid: actor.sessionId,
      exp: Math.floor(Date.now() / 1000) + 900,
    });
    expect((await protectedRequest(mismatchedToken)).statusCode).toBe(401);

    const readSession = async () =>
      (
        await pool.query<{ refresh_token_hash: string; expires_at: Date }>(
          'SELECT refresh_token_hash, expires_at FROM app.sessions WHERE id = $1',
          [actor.sessionId],
        )
      ).rows[0]!;
    const before = await readSession();
    const hash = (value: string) =>
      createHash('sha256').update(value).digest('hex');
    expect(before.refresh_token_hash).toBe(hash(firstLogin.cookies[0]!.value));
    expect(before.expires_at.getTime() - Date.now()).toBeGreaterThan(604790000);
    expect(before.expires_at.getTime() - Date.now()).toBeLessThanOrEqual(
      604800000,
    );

    const parallel = await Promise.all([
      cookieRequest('refresh', firstCookie),
      cookieRequest('refresh', firstCookie),
    ]);
    expect(parallel.map(({ statusCode }) => statusCode).sort()).toEqual([
      200, 401,
    ]);
    const renewed = parallel.find(({ statusCode }) => statusCode === 200)!;
    const stale = parallel.find(({ statusCode }) => statusCode === 401)!;
    expect(stale.headers['set-cookie']).toBeUndefined();
    expect(renewed.headers['cache-control']).toBe('no-store');
    const newCookie = readCookie(renewed);
    expect(newCookie).not.toBe(firstCookie);
    const after = await readSession();
    expect(after).toEqual({
      refresh_token_hash: hash(renewed.cookies[0]!.value),
      expires_at: before.expires_at,
    });
    expect((await cookieRequest('refresh', firstCookie)).statusCode).toBe(401);

    const logout = await cookieRequest('logout', newCookie);
    expect(logout.statusCode).toBe(204);
    expect(logout.body).toBe('');
    expect(logout.headers['set-cookie']).toContain('Max-Age=0');
    expect(logout.headers['set-cookie']).toContain('Path=/api/auth');
    expect((await cookieRequest('logout', newCookie)).statusCode).toBe(204);
    expect((await cookieRequest('logout')).statusCode).toBe(204);
    expect((await cookieRequest('refresh', newCookie)).statusCode).toBe(401);
    expect((await protectedRequest(firstToken.accessToken)).statusCode).toBe(
      401,
    );
    expect(
      (await protectedRequest(renewed.json<AccessResponse>().accessToken))
        .statusCode,
    ).toBe(401);
    expect((await protectedRequest(secondToken.accessToken)).statusCode).toBe(
      200,
    );
  });

  it('bounds access token expiry by the session and rejects expired access and refresh', async () => {
    const email = nextEmail();
    await register(email);
    const signedIn = await login(email);
    const { accessToken } = signedIn.json<AccessResponse>();
    const { sessionId, userId } = (await protectedRequest(accessToken)).json<{
      sessionId: string;
      userId: string;
    }>();
    await pool.query(
      "UPDATE app.sessions SET expires_at = clock_timestamp() + interval '60 seconds' WHERE id = $1",
      [sessionId],
    );
    const refreshed = await cookieRequest('refresh', readCookie(signedIn));
    expect(refreshed.statusCode).toBe(200);
    expect(refreshed.json<AccessResponse>().expiresIn).toBeGreaterThan(0);
    expect(refreshed.json<AccessResponse>().expiresIn).toBeLessThanOrEqual(60);
    const expiredJwt = app.jwt.sign({
      sub: userId,
      sid: sessionId,
      iat: Math.floor(Date.now() / 1000) - 10,
      exp: Math.floor(Date.now() / 1000) - 1,
    });
    expect((await protectedRequest(expiredJwt)).statusCode).toBe(401);

    await pool.query(
      "UPDATE app.sessions SET expires_at = clock_timestamp() - interval '1 second' WHERE id = $1",
      [sessionId],
    );
    const denied = await cookieRequest('refresh', readCookie(refreshed));
    expect(denied.statusCode).toBe(401);
    expect(denied.headers['set-cookie']).toBeUndefined();
    expect((await protectedRequest(accessToken)).statusCode).toBe(401);
  });
});
