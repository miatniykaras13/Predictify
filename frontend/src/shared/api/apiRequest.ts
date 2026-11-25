type ApiRequestOptions = Omit<RequestInit, 'body'> &
  ({ json?: never; body?: BodyInit | null } | { json: unknown; body?: never });

type ApiErrorKind = 'http' | 'network' | 'invalid-json';

export class ApiError extends Error {
  constructor(
    readonly kind: ApiErrorKind,
    message: string,
    readonly status?: number,
    readonly details?: unknown,
    cause?: unknown,
  ) {
    super(message, { cause });
    this.name = 'ApiError';
  }
}

function parseErrorDetails(body: string): unknown {
  if (!body) {
    return undefined;
  }

  try {
    return JSON.parse(body);
  } catch {
    return body;
  }
}

export async function apiRequest<T>(
  path: string,
  options: ApiRequestOptions = {},
): Promise<T> {
  if (
    !path.startsWith('/') ||
    path.startsWith('//') ||
    path.startsWith('/\\')
  ) {
    throw new TypeError('Укажите путь API, начинающийся с одного символа `/`.');
  }

  const baseUrl = (import.meta.env.VITE_API_BASE_URL?.trim() || '/api').replace(
    /\/+$/,
    '',
  );
  const { json, body, headers: initialHeaders, ...init } = options;
  const headers = new Headers(initialHeaders);
  let requestBody = body;

  if (!headers.has('Accept')) {
    headers.set('Accept', 'application/json');
  }

  if (json !== undefined) {
    requestBody = JSON.stringify(json);
    if (!headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json');
    }
  }

  let response: Response;
  let responseBody: string;

  try {
    response = await fetch(`${baseUrl}${path}`, {
      ...init,
      headers,
      body: requestBody,
    });
    responseBody = await response.text();
  } catch (error) {
    if (
      init.signal?.aborted ||
      (error instanceof DOMException && error.name === 'AbortError')
    ) {
      throw error;
    }

    throw new ApiError(
      'network',
      'Не удалось связаться с сервером.',
      undefined,
      undefined,
      error,
    );
  }

  if (!response.ok) {
    throw new ApiError(
      'http',
      `Сервер вернул ошибку HTTP ${response.status}.`,
      response.status,
      parseErrorDetails(responseBody),
    );
  }

  if (
    response.status === 204 ||
    response.status === 205 ||
    init.method?.toUpperCase() === 'HEAD'
  ) {
    return undefined as T;
  }

  try {
    return JSON.parse(responseBody) as T;
  } catch (error) {
    throw new ApiError(
      'invalid-json',
      'Сервер вернул некорректный JSON.',
      response.status,
      undefined,
      error,
    );
  }
}
