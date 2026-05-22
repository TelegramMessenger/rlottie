/**
 * @file src/server/routes/employees.ts
 * REST API для управления сотрудниками.
 *
 * GET    /api/employees          — список (с поиском по name/role/department)
 * GET    /api/employees/:id      — один сотрудник
 * POST   /api/employees          — добавить сотрудника
 * PATCH  /api/employees/:id      — обновить данные / KPI / онлайн-статус
 * DELETE /api/employees/:id      — удалить
 */

import type { FastifyInstance, FastifyRequest } from 'fastify';
import { getDb, queryAll, queryOne, execute, newId } from '../services/database.js';
import type { Employee, CreateEmployeeDto, UpdateEmployeeDto } from '../../../shared/types.js';

/** Генерирует инициалы из полного имени */
function initials(name: string): string {
  return name.split(' ').map(w => w[0] ?? '').join('').toUpperCase().slice(0, 2);
}

/** Цвет аватара по порядковому номеру */
const AVATAR_COLORS = [
  { bg: 'rgba(170,255,71,.15)',  color: 'var(--accent)' },
  { bg: 'rgba(200,71,255,.15)',  color: '#C847FF' },
  { bg: 'rgba(71,200,255,.15)',  color: '#47C8FF' },
  { bg: 'rgba(255,209,102,.15)', color: 'var(--yellow)' },
  { bg: 'rgba(255,159,71,.15)',  color: '#FF9F47' },
];

export default async function employeeRoutes(app: FastifyInstance) {
  const db = getDb();

  // ── GET /api/employees ────────────────────────────────────────
  app.get(
    '/api/employees',
    async (req: FastifyRequest<{ Querystring: { q?: string; department?: string; limit?: string; offset?: string } }>, reply) => {
      const { q, department } = req.query;
      const limit  = Math.min(500, Math.max(1, parseInt(req.query.limit  ?? '100', 10) || 100));
      const offset = Math.max(0,  parseInt(req.query.offset ?? '0', 10) || 0);

      let where = '1=1';
      const params: unknown[] = [];
      if (q) {
        where += ' AND (name LIKE ? OR role LIKE ? OR email LIKE ?)';
        const like = `%${q}%`;
        params.push(like, like, like);
      }
      if (department) {
        where += ' AND department = ?';
        params.push(department);
      }

      const total = (queryOne<{ cnt: number }>(db, `SELECT COUNT(*) as cnt FROM employees WHERE ${where}`, params) ?? { cnt: 0 }).cnt;
      const employees = queryAll<Employee>(
        db,
        `SELECT * FROM employees WHERE ${where} ORDER BY name ASC LIMIT ? OFFSET ?`,
        [...params, limit, offset],
      );
      return reply.send({ ok: true, data: employees, meta: { total, limit, offset } });
    },
  );

  // ── GET /api/employees/:id ────────────────────────────────────
  app.get<{ Params: { id: string } }>('/api/employees/:id', async (req, reply) => {
    const employee = queryOne<Employee>(db, 'SELECT * FROM employees WHERE id = ?', [req.params.id]);
    if (!employee) return reply.status(404).send({ ok: false, error: 'Сотрудник не найден' });
    return reply.send({ ok: true, data: employee });
  });

  // ── POST /api/employees ───────────────────────────────────────
  app.post<{ Body: CreateEmployeeDto }>('/api/employees', async (req, reply) => {
    const { name, role, email, department = 'engineering', salary = 0 } = req.body;

    if (!name?.trim())  return reply.status(400).send({ ok: false, error: 'Имя обязательно' });
    if (!email?.trim()) return reply.status(400).send({ ok: false, error: 'Email обязателен' });

    // Проверить уникальность email
    const exists = queryOne(db, 'SELECT id FROM employees WHERE email = ?', [email.toLowerCase()]);
    if (exists) return reply.status(409).send({ ok: false, error: 'Сотрудник с таким email уже существует' });

    const count  = (queryOne<{ cnt: number }>(db, 'SELECT COUNT(*) as cnt FROM employees', []) ?? { cnt: 0 }).cnt;
    const colors = AVATAR_COLORS[count % AVATAR_COLORS.length]!;
    const id     = newId();

    execute(db,
      `INSERT INTO employees (id, name, role, email, avatar_initials, avatar_bg, avatar_color, salary, department)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, name.trim(), role, email.toLowerCase(), initials(name), colors.bg, colors.color, salary, department],
    );

    return reply.status(201).send({ ok: true, data: queryOne<Employee>(db, 'SELECT * FROM employees WHERE id = ?', [id]) });
  });

  // ── PATCH /api/employees/:id ──────────────────────────────────
  app.patch<{ Params: { id: string }; Body: UpdateEmployeeDto }>(
    '/api/employees/:id',
    async (req, reply) => {
      const employee = queryOne(db, 'SELECT id FROM employees WHERE id = ?', [req.params.id]);
      if (!employee) return reply.status(404).send({ ok: false, error: 'Сотрудник не найден' });

      const allowed = ['name', 'role', 'email', 'department', 'salary', 'kpi', 'is_online'] as const;
      const updates: string[] = [];
      const values: unknown[] = [];

      for (const field of allowed) {
        if (req.body[field] !== undefined) {
          updates.push(`${field} = ?`);
          values.push(field === 'is_online' ? (req.body[field] ? 1 : 0) : req.body[field]);
        }
      }

      if (updates.length > 0) {
        values.push(req.params.id);
        execute(db, `UPDATE employees SET ${updates.join(', ')} WHERE id = ?`, values);
      }

      return reply.send({ ok: true, data: queryOne<Employee>(db, 'SELECT * FROM employees WHERE id = ?', [req.params.id]) });
    },
  );

  // ── DELETE /api/employees/:id ─────────────────────────────────
  app.delete<{ Params: { id: string } }>('/api/employees/:id', async (req, reply) => {
    const employee = queryOne(db, 'SELECT id FROM employees WHERE id = ?', [req.params.id]);
    if (!employee) return reply.status(404).send({ ok: false, error: 'Сотрудник не найден' });
    execute(db, 'DELETE FROM employees WHERE id = ?', [req.params.id]);
    return reply.send({ ok: true, data: { id: req.params.id } });
  });
}
