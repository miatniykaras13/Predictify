import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createSession } from './session';

const fetchMock = vi.fn<typeof fetch>();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
  vi.stubEnv('VITE_API_BASE_URL', undefined);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function access(token: string) {
  return Response.json({ accessToken: token, expiresIn: 900 });
}

function pendingResponse() {
  let resolve!: (value: Response) => void;
  const response = new Promise<Response>((complete) => {
    resolve = complete;
  });
  return { response, resolve };
}

function sentRequests() {
  return fetchMock.mock.calls.map(([url, options]) => ({
    url,
    authorization: new Headers(options?.headers).get('Authorization'),
  }));
}

describe('browser session', () => {
  it('restores once and uses the access token for protected requests', async () => {
    const session = createSession();
    const pending = pendingResponse();
    fetchMock.mockReturnValueOnce(pending.response);
    const restoring = [session.restore(), session.restore()];
    expect(session.getStatus()).toBe('checking');
    expect(fetchMock).toHaveBeenCalledTimes(1);

    pending.resolve(access('restored'));
    await Promise.all(restoring);
    expect(session.getStatus()).toBe('signed-in');

    fetchMock.mockResolvedValueOnce(Response.json({ id: '1' }));
    await expect(session.request('/me')).resolves.toEqual({ id: '1' });
    expect(sentRequests()).toEqual([
      { url: '/api/auth/refresh', authorization: null },
      { url: '/api/me', authorization: 'Bearer restored' },
    ]);
  });

  it('waits for an in-flight renewal before signing out and blocks new renewals', async () => {
    const session = createSession();
    const now = vi.spyOn(Date, 'now').mockReturnValue(1);
    fetchMock.mockResolvedValueOnce(access('first'));
    await session.signIn('member@example.test', 'password');
    now.mockReturnValue(900001);

    const pending = pendingResponse();
    fetchMock.mockReturnValueOnce(pending.response);
    const protectedRequest = expect(
      session.request('/me'),
    ).rejects.toMatchObject({ status: 401 });
    const signingOut = session.signOut();
    expect(session.signOut()).toBe(signingOut);
    await session.restore();
    expect(session.getStatus()).toBe('signing-out');
    expect(fetchMock).toHaveBeenCalledTimes(2);

    fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }));
    pending.resolve(access('second'));
    await Promise.all([signingOut, protectedRequest]);
    expect(session.getStatus()).toBe('guest');
    expect(sentRequests().map(({ url }) => url)).toEqual([
      '/api/auth/login',
      '/api/auth/refresh',
      '/api/auth/logout',
    ]);
  });

  it('distinguishes a missing session from a network failure', async () => {
    const session = createSession();
    fetchMock.mockRejectedValueOnce(new TypeError('network unavailable'));
    await session.restore();
    expect(session.getStatus()).toBe('unavailable');

    fetchMock.mockResolvedValueOnce(Response.json({}, { status: 401 }));
    await session.restore();
    expect(session.getStatus()).toBe('guest');
  });

  it('retries a protected request with a renewed token and allows retrying logout', async () => {
    const session = createSession();
    fetchMock.mockResolvedValueOnce(access('first'));
    await session.signIn('member@example.test', 'password');

    fetchMock
      .mockResolvedValueOnce(Response.json({}, { status: 401 }))
      .mockResolvedValueOnce(access('renewed'))
      .mockResolvedValueOnce(Response.json({ id: '1' }));
    await expect(session.request('/me')).resolves.toEqual({ id: '1' });
    expect(sentRequests().slice(1)).toEqual([
      { url: '/api/me', authorization: 'Bearer first' },
      { url: '/api/auth/refresh', authorization: null },
      { url: '/api/me', authorization: 'Bearer renewed' },
    ]);

    fetchMock.mockRejectedValueOnce(new TypeError('offline'));
    await expect(session.signOut()).rejects.toMatchObject({ kind: 'network' });
    expect(session.getStatus()).toBe('signed-in');

    fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }));
    await session.signOut();
    expect(session.getStatus()).toBe('guest');
  });
});
