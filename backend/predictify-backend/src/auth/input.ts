import { AuthError } from './errors.js';

function readBody<Field extends string>(
  body: unknown,
  fields: readonly Field[],
): Record<Field, string> {
  if (
    typeof body !== 'object' ||
    body === null ||
    Array.isArray(body) ||
    Object.keys(body).length !== fields.length ||
    !fields.every(
      (field) =>
        Object.hasOwn(body, field) &&
        typeof (body as Record<string, unknown>)[field] === 'string',
    )
  ) {
    throw new AuthError(400, 'INVALID_INPUT', 'Invalid request body');
  }

  return body as Record<Field, string>;
}

function normalizeEmail(value: string): string {
  const email = value.trim().toLowerCase();
  if (
    email.length > 254 ||
    !/^[a-z0-9.!#$%&'*+/=?^_\x60{|}~-]+@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)*$/u.test(
      email,
    )
  ) {
    throw new AuthError(400, 'INVALID_EMAIL', 'Invalid email address');
  }
  return email;
}

function checkPassword(password: string, minimum: number): void {
  const length = Array.from(password).length;
  if (
    length < minimum ||
    length > 128 ||
    Buffer.from(password).toString('utf8') !== password
  ) {
    throw new AuthError(
      400,
      'INVALID_PASSWORD',
      'Invalid password length or encoding',
    );
  }
}

export function readRegistration(body: unknown) {
  const input = readBody(body, ['email', 'password', 'publicName']);
  const email = normalizeEmail(input.email);
  const publicName = input.publicName.trim();
  if (
    publicName.length === 0 ||
    Array.from(publicName).length > 80 ||
    publicName.includes('\0')
  ) {
    throw new AuthError(400, 'INVALID_PUBLIC_NAME', 'Invalid public name');
  }

  checkPassword(input.password, 15);
  return { email, password: input.password, publicName };
}

export function readLogin(body: unknown) {
  const { email, password } = readBody(body, ['email', 'password']);
  checkPassword(password, 1);
  return { email: normalizeEmail(email), password };
}
