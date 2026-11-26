export class AuthError extends Error {
  constructor(
    readonly statusCode: 400 | 401 | 403 | 409,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

export function invalidSession(): AuthError {
  return new AuthError(401, 'INVALID_SESSION', 'Session is invalid or expired');
}
