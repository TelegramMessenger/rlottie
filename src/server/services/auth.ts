/**
 * @file src/server/services/auth.ts
 * Сервис аутентификации: хэширование паролей + JWT.
 *
 * Пароли: PBKDF2 (Node.js built-in crypto) — без нативной компиляции.
 * JWT:    jose (pure-JS) — HS256 HMAC.
 */

import { pbkdf2Sync, randomBytes } from 'crypto';
import { SignJWT, jwtVerify } from 'jose';
import { Config } from '../config.js';

// ── Пароли ───────────────────────────────────────────────────────

const ITERATIONS = 100_000;
const KEY_LEN    = 64;
const DIGEST     = 'sha512';

export function generateSalt(): string {
  return randomBytes(32).toString('hex');
}

export function hashPassword(password: string, salt: string): string {
  return pbkdf2Sync(password, salt, ITERATIONS, KEY_LEN, DIGEST).toString('hex');
}

export function verifyPassword(password: string, hash: string, salt: string): boolean {
  const candidate = hashPassword(password, salt);
  // Timing-safe compare через XOR длин + каждого байта
  if (candidate.length !== hash.length) return false;
  let diff = 0;
  for (let i = 0; i < candidate.length; i++) {
    diff |= candidate.charCodeAt(i) ^ hash.charCodeAt(i);
  }
  return diff === 0;
}

// ── JWT ──────────────────────────────────────────────────────────

export interface JwtPayload {
  sub: string;   // user id
  email: string;
  name: string;
  role: string;
}

function getSecret(): Uint8Array {
  return new TextEncoder().encode(Config.JWT_SECRET);
}

/** Подписывает JWT с TTL 7 дней */
export async function signJwt(payload: JwtPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(getSecret());
}

/** Верифицирует JWT и возвращает payload, или null если невалидный */
export async function verifyJwt(token: string): Promise<JwtPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    return {
      sub:   payload['sub'] as string,
      email: payload['email'] as string,
      name:  payload['name'] as string,
      role:  payload['role'] as string,
    };
  } catch {
    return null;
  }
}
