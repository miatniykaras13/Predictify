import { argon2, randomBytes, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const derive = promisify(argon2);
const memory = 19456;
const passes = 2;
const parallelism = 1;
const saltLength = 16;
const tagLength = 32;
const format = '$argon2id$v=19$m=19456,t=2,p=1$';

async function deriveTag(password: string, salt: Buffer): Promise<Buffer> {
  return derive('argon2id', {
    message: Buffer.from(password),
    nonce: salt,
    memory,
    passes,
    parallelism,
    tagLength,
  });
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(saltLength);
  const tag = await deriveTag(password, salt);
  const encodedSalt = salt.toString('base64').replace(/=+$/, '');
  const encodedTag = tag.toString('base64').replace(/=+$/, '');
  return format + encodedSalt + '$' + encodedTag;
}

export async function verifyPassword(
  password: string,
  hash: string | undefined,
): Promise<boolean> {
  const [encodedSalt = '', encodedTag = ''] = hash?.startsWith(format)
    ? hash.slice(format.length).split('$')
    : [];
  const salt = Buffer.from(encodedSalt, 'base64');
  const tag = Buffer.from(encodedTag, 'base64');
  if (salt.length !== saltLength || tag.length !== tagLength) {
    // Keep the password verification cost for an unknown account.
    await deriveTag(password, Buffer.alloc(saltLength));
    return false;
  }

  return timingSafeEqual(await deriveTag(password, salt), tag);
}
