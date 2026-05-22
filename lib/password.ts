import bcrypt from 'bcryptjs';
import { randomInt } from 'crypto';

const BCRYPT_ROUNDS = 10;
const PASSWORD_CHARS =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

export function generatePassword(length: number): string {
  let password = '';

  for (let i = 0; i < length; i += 1) {
    password += PASSWORD_CHARS[randomInt(PASSWORD_CHARS.length)];
  }

  return password;
}

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_ROUNDS);
}

export async function comparePassword(
  plain: string,
  hash: string,
): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}
