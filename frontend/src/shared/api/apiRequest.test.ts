import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError, apiRequest } from './apiRequest';

const fetchMock = vi.fn<typeof fetch>();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
  vi.stubEnv('VITE_API_BASE_URL', undefined);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('apiRequest', () => {
  it('uses the default prefix and reads JSON', async () => {
    fetchMock.mockResolvedValueOnce(Response.json([{ id: '1' }]));

    await expect(
      apiRequest<{ id: string }[]>('/events?limit=1'),
    ).resolves.toEqual([{ id: '1' }]);
    const [[url, init]] = fetchMock.mock.calls;
    expect(url).toBe('/api/events?limit=1');
    expect(new Headers(init?.headers).get('Accept')).toBe('application/json');
  });

  it('uses a configured base URL and retains caller headers when sending JSON', async () => {
    vi.stubEnv('VITE_API_BASE_URL', 'https://backend.example.test/v1/');
    const headers = new Headers({
      'X-Request-Id': 'test-id',
      Accept: 'application/problem+json',
    });
    fetchMock.mockResolvedValueOnce(
      Response.json({ id: '1' }, { status: 201 }),
    );

    await expect(
      apiRequest<{ id: string }>('/events', {
        method: 'POST',
        json: { title: 'Event' },
        headers,
      }),
    ).resolves.toEqual({ id: '1' });

    const [[url, init]] = fetchMock.mock.calls;
    const sentHeaders = new Headers(init?.headers);
    expect(url).toBe('https://backend.example.test/v1/events');
    expect(init?.method).toBe('POST');
    expect(init?.body).toBe('{"title":"Event"}');
    expect(sentHeaders.get('X-Request-Id')).toBe('test-id');
    expect(sentHeaders.get('Accept')).toBe('application/problem+json');
    expect(sentHeaders.get('Content-Type')).toBe('application/json');
    expect(headers.has('Content-Type')).toBe(false);
  });

  it('passes FormData to fetch and resolves a no-content response', async () => {
    const body = new FormData();
    body.set(
      'avatar',
      new Blob(['image'], { type: 'image/png' }),
      'avatar.png',
    );
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }));

    await expect(
      apiRequest<void>('/profile/avatar', { method: 'PUT', body }),
    ).resolves.toBeUndefined();
    const [[, init]] = fetchMock.mock.calls;
    expect(init?.body).toBe(body);
    expect(new Headers(init?.headers).has('Content-Type')).toBe(false);
  });

  it('preserves status and response details for HTTP errors', async () => {
    fetchMock.mockResolvedValueOnce(
      Response.json({ code: 'access_denied' }, { status: 403 }),
    );

    await expect(apiRequest('/events')).rejects.toMatchObject({
      name: ApiError.name,
      kind: 'http',
      status: 403,
      details: { code: 'access_denied' },
    });
  });

  it('classifies a plain-text HTTP error as HTTP', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response('Unavailable', { status: 503 }),
    );

    await expect(apiRequest('/events')).rejects.toMatchObject({
      kind: 'http',
      status: 503,
      details: 'Unavailable',
    });
  });

  it('distinguishes network failures from malformed JSON', async () => {
    const cause = new TypeError('Failed to fetch');
    fetchMock.mockRejectedValueOnce(cause);
    fetchMock.mockResolvedValueOnce(new Response('<html>'));

    await expect(apiRequest('/events')).rejects.toMatchObject({
      kind: 'network',
      cause,
    });
    await expect(apiRequest('/events')).rejects.toMatchObject({
      kind: 'invalid-json',
      status: 200,
    });
  });

  it('forwards AbortSignal and leaves the cancellation reason intact', async () => {
    const controller = new AbortController();
    const reason = new Error('Request cancelled');
    fetchMock.mockImplementationOnce(async (_url, init) => {
      expect(init?.signal).toBe(controller.signal);
      controller.abort(reason);
      init?.signal?.throwIfAborted();
      return Response.json([]);
    });

    await expect(
      apiRequest('/events', { signal: controller.signal }),
    ).rejects.toBe(reason);
  });

  it('rejects an absolute URL before calling fetch', async () => {
    await expect(
      apiRequest('https://example.test/events'),
    ).rejects.toBeInstanceOf(TypeError);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
