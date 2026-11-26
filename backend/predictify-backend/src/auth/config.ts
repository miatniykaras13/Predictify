export function readAuthConfig() {
  const appOrigin = process.env.AUTH_APP_ORIGIN ?? 'http://127.0.0.1:5173';
  const url = URL.parse(appOrigin);
  if (
    !url ||
    !['http:', 'https:'].includes(url.protocol) ||
    url.origin !== appOrigin
  ) {
    throw new Error('AUTH_APP_ORIGIN must be a canonical HTTP or HTTPS origin');
  }

  const secret = process.env.AUTH_ACCESS_TOKEN_SECRET ?? '';
  if (!/^[a-f0-9]{64}$/i.test(secret)) {
    throw new Error('AUTH_ACCESS_TOKEN_SECRET must be a 32-byte hex key');
  }

  return {
    appOrigin,
    secureCookie: url.protocol === 'https:',
    accessTokenKey: Buffer.from(secret, 'hex'),
  };
}

export type AuthConfig = ReturnType<typeof readAuthConfig>;
