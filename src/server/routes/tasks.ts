/**
 * @file src/server/routes/tasks.ts
 * REST API для задач (Kanban).
 *
 * GET    /api/tasks              — все задачи (с фильтрацией)
 * GET    /api/tasks/:id          — одна задача
 * POST   /api/tasks              — создать задачу
 * PATCH  /api/tasks/:id          — обновить (в т.ч. переместить колонку)
 * DELETE /api/tasks/:id          — удалить
 */

import type { FastifyInstance, FastifyRequest } from 'fastify';
import { getDb, queryAll, queryOne, execute, newId } from '../services/database.js';
import type { Task, CreateTaskDto, UpdateTaskDto, TaskStatus } from '../../../shared/types.js';

const VALID_STATUSES: TaskStatus[] = ['backlog', 'in_progress', 'review', 'done'];

export default async function taskRoutes(app: FastifyInstance) {
  const db = getDb();

  // ── GET /api/tasks ────────────────────────────────────────────
  // Query params: project_id, status, limit (default 100, max 500), offset
  app.get(
    '/api/tasks',
    async (req: FastifyRequest<{ Querystring: { project_id?: string; status?: string; limit?: string; offset?: string } }>, reply) => {
      const { project_id, status } = req.query;
      const limit  = Math.min(500, Math.max(1, parseInt(req.query.limit  ?? '100', 10) || 100));
      const offset = Math.max(0,  parseInt(req.query.offset ?? '0', 10) || 0);

      let where = '1=1';
      const params: unknown[] = [];
      if (project_id) { where += ' AND t.project_id = ?'; params.push(project_id); }
      if (status)     { where += ' AND t.status = ?';     params.push(status); }

      const total = (queryOne<{ cnt: number }>(db, `SELECT COUNT(*) as cnt FROM tasks t WHERE ${where}`, params) ?? { cnt: 0 }).cnt;
      const tasks = queryAll<Task>(
        db,
        `SELECT t.*, e.name AS assignee_name FROM tasks t LEFT JOIN employees e ON e.id = t.assignee_id
         WHERE ${where} ORDER BY t.created_at DESC LIMIT ? OFFSET ?`,
        [...params, limit, offset],
      );

      return reply.send({ ok: true, data: tasks, meta: { total, limit, offset } });
    },
  );

  // ── GET /api/tasks/:id ────────────────────────────────────────
  app.get<{ Params: { id: string } }>('/api/tasks/:id', async (req, reply) => {
    const task = queryOne<Task>(
      db,
      'SELECT t.*, e.name AS assignee_name FROM tasks t LEFT JOIN employees e ON e.id = t.assignee_id WHERE t.id = ?',
      [req.params.id],
    );
    if (!task) return reply.status(404).send({ ok: false, error: 'Задача не найдена' });
    return reply.send({ ok: true, data: task });
  });

  // ── POST /api/tasks ───────────────────────────────────────────
  app.post<{ Body: CreateTaskDto }>('/api/tasks', async (req, reply) => {
    const { project_id, title, description = '', status = 'backlog', tag = 'dev', assignee_id, due_date } = req.body;

    if (!project_id) return reply.status(400).send({ ok: false, error: 'project_id обязателен' });
    if (!title?.trim()) return reply.status(400).send({ ok: false, error: 'Название задачи обязательно' });

    const id = newId();
    execute(db,
      `INSERT INTO tasks (id, project_id, title, description, status, tag, assignee_id, due_date)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, project_id, title.trim(), description, status, tag, assignee_id ?? null, due_date ?? null],
    );

    // Обновить updated_at проекта
    execute(db, "UPDATE projects SET updated_at = datetime('now') WHERE id = ?", [project_id]);

    return reply.status(201).send({ ok: true, data: queryOne<Task>(db, 'SELECT * FROM tasks WHERE id = ?', [id]) });
  });

  // ── PATCH /api/tasks/:id ──────────────────────────────────────
  app.patch<{ Params: { id: string }; Body: UpdateTaskDto & { status?: TaskStatus } }>(
    '/api/tasks/:id',
    async (req, reply) => {
      const task = queryOne<Task>(db, 'SELECT * FROM tasks WHERE id = ?', [req.params.id]);
      if (!task) return reply.status(404).send({ ok: false, error: 'Задача не найдена' });

      if (req.body.status && !VALID_STATUSES.includes(req.body.status)) {
        return reply.status(400).send({ ok: false, error: `Недопустимый статус: ${req.body.status}` });
      }

      const allowed = ['title', 'description', 'status', 'tag', 'assignee_id', 'due_date'] as const;
      const updates: string[] = [];
      const values: unknown[] = [];

      for (const field of allowed) {
        if (req.body[field] !== undefined) {
          updates.push(`${field} = ?`);
          values.push(req.body[field]);
        }
      }

      if (updates.length > 0) {
        updates.push("updated_at = datetime('now')");
        values.push(req.params.id);
        execute(db, `UPDATE tasks SET ${updates.join(', ')} WHERE id = ?`, values);
      }

      return reply.send({ ok: true, data: queryOne<Task>(db, 'SELECT * FROM tasks WHERE id = ?', [req.params.id]) });
    },
  );

  // ── DELETE /api/tasks/:id ─────────────────────────────────────
  app.delete<{ Params: { id: string } }>('/api/tasks/:id', async (req, reply) => {
    const task = queryOne(db, 'SELECT id FROM tasks WHERE id = ?', [req.params.id]);
    if (!task) return reply.status(404).send({ ok: false, error: 'Задача не найдена' });
    execute(db, 'DELETE FROM tasks WHERE id = ?', [req.params.id]);
    return reply.send({ ok: true, data: { id: req.params.id } });
  });
}
