import {
  ApiError,
  apiRequest,
  type ApiRequestOptions,
} from '../../shared/api/apiRequest';

type TokenResponse = { accessToken: string; expiresIn: number };
type Access = { token: string; expiresAt: number };
type Status =
  'checking' | 'guest' | 'signed-in' | 'signing-out' | 'unavailable';

function sessionExpired(): ApiError {
  return new ApiError('http', 'Сессия завершена. Войдите снова.', 401);
}

function withCookieLock<T>(action: () => Promise<T>): Promise<T> {
  const locks = globalThis.navigator?.locks;
  return locks ? locks.request('predictify.auth.cookie', action) : action();
}

export function createSession() {
  const listeners = new Set<() => void>();
  let status: Status = 'checking';
  let access: Access | null = null;
  let refreshing: Promise<Access | null> | undefined;
  let signingOut: Promise<void> | undefined;

  function setStatus(next: Status) {
    if (status === next) return;
    status = next;
    listeners.forEach((listener) => listener());
  }

  function saveAccess(response: TokenResponse): Access {
    access = {
      token: response.accessToken,
      expiresAt: Date.now() + response.expiresIn * 1000,
    };
    if (!signingOut) setStatus('signed-in');
    return access;
  }

  function refresh(): Promise<Access | null> {
    if (signingOut) return Promise.resolve(null);
    if (refreshing) return refreshing;
    refreshing = withCookieLock(() =>
      apiRequest<TokenResponse>('/auth/refresh', {
        method: 'POST',
        credentials: 'same-origin',
      }),
    )
      .then(saveAccess)
      .catch((error: unknown) => {
        if (error instanceof ApiError && error.status === 401) {
          access = null;
          if (!signingOut) setStatus('guest');
          return null;
        }
        if (!signingOut && (!access || access.expiresAt <= Date.now())) {
          access = null;
          setStatus('unavailable');
        }
        throw error;
      })
      .finally(() => {
        refreshing = undefined;
      });
    return refreshing;
  }

  return {
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    getStatus: () => status,

    async restore() {
      if (access && access.expiresAt > Date.now()) return;
      await refresh().catch(() => undefined);
    },

    async signIn(email: string, password: string) {
      await refreshing?.catch(() => undefined);
      const response = await withCookieLock(() =>
        apiRequest<TokenResponse>('/auth/login', {
          method: 'POST',
          credentials: 'same-origin',
          json: { email, password },
        }),
      );
      saveAccess(response);
    },

    signOut(): Promise<void> {
      if (signingOut) return signingOut;
      signingOut = (async () => {
        await refreshing?.catch(() => undefined);
        await withCookieLock(() =>
          apiRequest('/auth/logout', {
            method: 'POST',
            credentials: 'same-origin',
          }),
        );
        access = null;
        setStatus('guest');
      })()
        .catch((error: unknown) => {
          setStatus(access ? 'signed-in' : 'unavailable');
          throw error;
        })
        .finally(() => {
          signingOut = undefined;
        });
      setStatus('signing-out');
      return signingOut;
    },

    async request<T>(
      path: string,
      options: ApiRequestOptions = {},
    ): Promise<T> {
      const current =
        access && access.expiresAt > Date.now() + 5000
          ? access
          : await refresh();
      if (!current || signingOut) throw sessionExpired();

      function send(credentials: Access) {
        const headers = new Headers(options.headers);
        headers.set('Authorization', 'Bearer ' + credentials.token);
        return apiRequest<T>(path, { ...options, headers });
      }

      try {
        return await send(current);
      } catch (error) {
        if (!(error instanceof ApiError) || error.status !== 401) throw error;

        const renewed = access && access !== current ? access : await refresh();
        if (!renewed || signingOut) throw sessionExpired();
        return send(renewed);
      }
    },
  };
}

export const session = createSession();
