import { describe, expect, it, vi } from 'vitest';
import { buildApp } from '../src/app.js';

vi.hoisted(() => {
  process.env.DATABASE_URL ??= 'postgresql://localhost/predictify';
  process.env.AUTH_ACCESS_TOKEN_SECRET = 'ca'.repeat(32);
  process.env.AUTH_APP_ORIGIN = 'http://127.0.0.1:5173';
});

describe('health endpoints', () => {
  it('returns healthy status', async () => {
    const app = buildApp();
    const response = await app.inject({ method: 'GET', url: '/api/health' });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: 'ok' });
    await app.close();
  });
});
