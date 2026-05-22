/**
 * @file src/server/middleware/authenticate.ts
 * Fastify preHandler — проверяет JWT из заголовка Authorization: Bearer <token>.
 * При успехе добавляет req.user; при ошибке — 401.
 */

import type { FastifyRequest, FastifyReply } from 'fastify';
import { verifyJwt, type JwtPayload } from '../services/auth.js';

// Расширяем типы Fastify чтобы req.user был доступен везде
declare module 'fastify' {
  interface FastifyRequest {
    user?: JwtPayload;
  }
}

/** Требует валидный JWT. Используется как preHandler на защищённых маршрутах. */
export async function authenticate(req: FastifyRequest, reply: FastifyReply): Promise<void> {
  const header = req.headers['authorization'];
  if (!header?.startsWith('Bearer ')) {
    return reply.status(401).send({ ok: false, error: 'Требуется авторизация' });
  }

  const token   = header.slice(7);
  const payload = await verifyJwt(token);

  if (!payload) {
    return reply.status(401).send({ ok: false, error: 'Токен недействителен или истёк' });
  }

  req.user = payload;
}

/** Опциональная авторизация — не блокирует, но заполняет req.user если токен есть. */
export async function optionalAuth(req: FastifyRequest): Promise<void> {
  const header = req.headers['authorization'];
  if (!header?.startsWith('Bearer ')) return;
  const payload = await verifyJwt(header.slice(7));
  if (payload) req.user = payload;
}
