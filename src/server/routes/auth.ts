/**
 * @file src/server/routes/auth.ts
 * REST API аутентификации.
 *
 * POST /api/auth/register — регистрация нового пользователя
 * POST /api/auth/login    — вход, возвращает JWT
 * GET  /api/auth/me       — данные текущего пользователя (требует JWT)
 */

import type { FastifyInstance } from 'fastify';
import { getDb, queryOne, execute, newId } from '../services/database.js';
import { generateSalt, hashPassword, verifyPassword, signJwt } from '../services/auth.js';
import { authenticate } from '../middleware/authenticate.js';
import type { LoginDto, RegisterDto, AuthResponse, UserPublic } from '../../../shared/types.js';

interface DbUser {
  id: string;
  email: string;
  password_hash: string;
  salt: string;
  name: string;
  role: string;
  created_at: string;
  updated_at: string;
}

export default async function authRoutes(app: FastifyInstance) {
  const db = getDb();

  // ── POST /api/auth/register ───────────────────────────────────
  app.post<{ Body: RegisterDto }>('/api/auth/register', async (req, reply) => {
    const { email, password, name } = req.body ?? {};

    if (!email?.trim())       return reply.status(400).send({ ok: false, error: 'Email обязателен' });
    if (!name?.trim())        return reply.status(400).send({ ok: false, error: 'Имя обязательно' });
    if (!password || password.length < 6) {
      return reply.status(400).send({ ok: false, error: 'Пароль должен быть не менее 6 символов' });
    }

    const exists = queryOne<{ id: string }>(db, 'SELECT id FROM users WHERE email = ?', [email.toLowerCase()]);
    if (exists) return reply.status(409).send({ ok: false, error: 'Пользователь с таким email уже существует' });

    const salt = generateSalt();
    const hash = hashPassword(password, salt);
    const id   = newId();

    // Первый зарегистрированный пользователь получает роль admin
    const usersCount = (queryOne<{ cnt: number }>(db, 'SELECT COUNT(*) as cnt FROM users', []) ?? { cnt: 0 }).cnt;
    const role = usersCount === 0 ? 'admin' : 'employee';

    execute(db,
      `INSERT INTO users (id, email, password_hash, salt, name, role) VALUES (?, ?, ?, ?, ?, ?)`,
      [id, email.toLowerCase(), hash, salt, name.trim(), role],
    );

    const user = queryOne<DbUser>(db, 'SELECT * FROM users WHERE id = ?', [id])!;
    const token = await signJwt({ sub: user.id, email: user.email, name: user.name, role: user.role });

    const response: AuthResponse = {
      token,
      user: { id: user.id, email: user.email, name: user.name, role: user.role as UserPublic['role'], created_at: user.created_at },
    };

    return reply.status(201).send({ ok: true, data: response });
  });

  // ── POST /api/auth/login ──────────────────────────────────────
  app.post<{ Body: LoginDto }>('/api/auth/login', async (req, reply) => {
    const { email, password } = req.body ?? {};

    if (!email || !password) {
      return reply.status(400).send({ ok: false, error: 'Email и пароль обязательны' });
    }

    const user = queryOne<DbUser>(db, 'SELECT * FROM users WHERE email = ?', [email.toLowerCase()]);

    // Одинаковое сообщение для несуществующего email и неверного пароля — защита от перебора
    if (!user || !verifyPassword(password, user.password_hash, user.salt)) {
      return reply.status(401).send({ ok: false, error: 'Неверный email или пароль' });
    }

    const token = await signJwt({ sub: user.id, email: user.email, name: user.name, role: user.role });

    const response: AuthResponse = {
      token,
      user: { id: user.id, email: user.email, name: user.name, role: user.role as UserPublic['role'], created_at: user.created_at },
    };

    return reply.send({ ok: true, data: response });
  });

  // ── GET /api/auth/me ──────────────────────────────────────────
  app.get('/api/auth/me', { preHandler: authenticate }, async (req, reply) => {
    const user = queryOne<DbUser>(db, 'SELECT * FROM users WHERE id = ?', [req.user!.sub]);
    if (!user) return reply.status(404).send({ ok: false, error: 'Пользователь не найден' });

    const userPublic: UserPublic = {
      id:         user.id,
      email:      user.email,
      name:       user.name,
      role:       user.role as UserPublic['role'],
      created_at: user.created_at,
    };

    return reply.send({ ok: true, data: userPublic });
  });

  // ── PATCH /api/auth/me ────────────────────────────────────────
  app.patch<{ Body: { name?: string; password?: string; old_password?: string } }>(
    '/api/auth/me',
    { preHandler: authenticate },
    async (req, reply) => {
      const user = queryOne<DbUser>(db, 'SELECT * FROM users WHERE id = ?', [req.user!.sub]);
      if (!user) return reply.status(404).send({ ok: false, error: 'Пользователь не найден' });

      const { name, password, old_password } = req.body ?? {};
      const updates: string[] = [];
      const values: unknown[] = [];

      if (name?.trim()) {
        updates.push('name = ?');
        values.push(name.trim());
      }

      if (password) {
        if (!old_password) {
          return reply.status(400).send({ ok: false, error: 'Укажите старый пароль для смены' });
        }
        if (!verifyPassword(old_password, user.password_hash, user.salt)) {
          return reply.status(401).send({ ok: false, error: 'Старый пароль неверен' });
        }
        if (password.length < 6) {
          return reply.status(400).send({ ok: false, error: 'Новый пароль должен быть не менее 6 символов' });
        }
        const salt = generateSalt();
        const hash = hashPassword(password, salt);
        updates.push('password_hash = ?', 'salt = ?');
        values.push(hash, salt);
      }

      if (updates.length === 0) {
        return reply.status(400).send({ ok: false, error: 'Нет данных для обновления' });
      }

      updates.push('updated_at = ?');
      values.push(new Date().toISOString(), user.id);

      execute(db, `UPDATE users SET ${updates.join(', ')} WHERE id = ?`, values);

      const updated = queryOne<DbUser>(db, 'SELECT * FROM users WHERE id = ?', [user.id])!;
      return reply.send({
        ok: true,
        data: { id: updated.id, email: updated.email, name: updated.name, role: updated.role, created_at: updated.created_at },
      });
    },
  );
}
