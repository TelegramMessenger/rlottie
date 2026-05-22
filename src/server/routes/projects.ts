/**
 * @file src/server/routes/projects.ts
 * REST API для управления проектами.
 *
 * GET    /api/projects           — список всех проектов
 * GET    /api/projects/:id       — один проект + задачи + команда
 * POST   /api/projects           — создать проект
 * PATCH  /api/projects/:id       — обновить проект
 * DELETE /api/projects/:id       — удалить проект
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { getDb, queryAll, queryOne, execute, withTransaction, newId } from '../services/database.js';
import type { Project, CreateProjectDto, UpdateProjectDto } from '../../../shared/types.js';

/** Инициализирует поля icon_bg/icon_color по умолчанию */
const DEFAULT_COLORS = {
  icon_bg:      'rgba(170,255,71,.15)',
  icon_color:   'var(--accent)',
  accent_color: 'var(--accent)',
};

export default async function projectRoutes(app: FastifyInstance) {
  const db = getDb();

  // ── GET /api/projects ─────────────────────────────────────────
  app.get('/api/projects', async (_req: FastifyRequest, reply: FastifyReply) => {
    const projects = queryAll<Project>(
      db,
      `SELECT p.*,
              COUNT(DISTINCT pm.employee_id) AS team_count,
              COUNT(DISTINCT t.id)           AS task_count
       FROM projects p
       LEFT JOIN project_members pm ON pm.project_id = p.id
       LEFT JOIN tasks t            ON t.project_id = p.id
       WHERE p.status != 'archived'
       GROUP BY p.id
       ORDER BY p.updated_at DESC`,
    );
    return reply.send({ ok: true, data: projects });
  });

  // ── GET /api/projects/:id ─────────────────────────────────────
  app.get<{ Params: { id: string } }>(
    '/api/projects/:id',
    async (req, reply) => {
      const project = queryOne<Project>(
        db,
        'SELECT * FROM projects WHERE id = ?',
        [req.params.id],
      );

      if (!project) {
        return reply.status(404).send({ ok: false, error: 'Проект не найден' });
      }

      // Задачи по колонкам Kanban
      const tasks = queryAll(
        db,
        'SELECT * FROM tasks WHERE project_id = ? ORDER BY created_at DESC',
        [req.params.id],
      );

      // Команда проекта
      const team = queryAll(
        db,
        `SELECT e.* FROM employees e
         JOIN project_members pm ON pm.employee_id = e.id
         WHERE pm.project_id = ?
         ORDER BY e.name`,
        [req.params.id],
      );

      // Финансы проекта
      const finance = queryAll(
        db,
        'SELECT * FROM finance WHERE project_id = ? ORDER BY date DESC',
        [req.params.id],
      );

      return reply.send({ ok: true, data: { ...project, tasks, team, finance } });
    },
  );

  // ── POST /api/projects ────────────────────────────────────────
  app.post<{ Body: CreateProjectDto }>(
    '/api/projects',
    async (req, reply) => {
      const { name, description = '', icon = '📁', budget = 0 } = req.body;

      if (!name?.trim()) {
        return reply.status(400).send({ ok: false, error: 'Название проекта обязательно' });
      }

      const id = newId();

      execute(db,
        `INSERT INTO projects (id, name, description, icon, icon_bg, icon_color, accent_color, budget)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, name.trim(), description, icon, DEFAULT_COLORS.icon_bg, DEFAULT_COLORS.icon_color, DEFAULT_COLORS.accent_color, budget],
      );

      const project = queryOne<Project>(db, 'SELECT * FROM projects WHERE id = ?', [id]);
      return reply.status(201).send({ ok: true, data: project });
    },
  );

  // ── PATCH /api/projects/:id ───────────────────────────────────
  app.patch<{ Params: { id: string }; Body: UpdateProjectDto }>(
    '/api/projects/:id',
    async (req, reply) => {
      const project = queryOne<Project>(db, 'SELECT * FROM projects WHERE id = ?', [req.params.id]);
      if (!project) {
        return reply.status(404).send({ ok: false, error: 'Проект не найден' });
      }

      const allowed = ['name', 'description', 'icon', 'status', 'budget'] as const;
      const updates: string[] = [];
      const values: unknown[] = [];

      for (const field of allowed) {
        if (req.body[field] !== undefined) {
          updates.push(`${field} = ?`);
          values.push(req.body[field]);
        }
      }

      if (updates.length === 0) {
        return reply.status(400).send({ ok: false, error: 'Нет полей для обновления' });
      }

      updates.push('updated_at = datetime(\'now\')');
      values.push(req.params.id);

      execute(db, `UPDATE projects SET ${updates.join(', ')} WHERE id = ?`, values);

      const updated = queryOne<Project>(db, 'SELECT * FROM projects WHERE id = ?', [req.params.id]);
      return reply.send({ ok: true, data: updated });
    },
  );

  // ── DELETE /api/projects/:id ──────────────────────────────────
  app.delete<{ Params: { id: string } }>(
    '/api/projects/:id',
    async (req, reply) => {
      const project = queryOne(db, 'SELECT id FROM projects WHERE id = ?', [req.params.id]);
      if (!project) {
        return reply.status(404).send({ ok: false, error: 'Проект не найден' });
      }

      // Каскадное удаление через foreign keys (tasks, members, finance, messages)
      execute(db, 'DELETE FROM projects WHERE id = ?', [req.params.id]);
      return reply.send({ ok: true, data: { id: req.params.id } });
    },
  );

  // ── POST /api/projects/:id/members ───────────────────────────
  app.post<{ Params: { id: string }; Body: { employee_id: string } }>(
    '/api/projects/:id/members',
    async (req, reply) => {
      const { employee_id } = req.body;

      withTransaction(db, () => {
        execute(db,
          'INSERT OR IGNORE INTO project_members (project_id, employee_id) VALUES (?, ?)',
          [req.params.id, employee_id],
        );
        execute(db,
          "UPDATE projects SET updated_at = datetime('now') WHERE id = ?",
          [req.params.id],
        );
      });

      return reply.status(201).send({ ok: true, data: { project_id: req.params.id, employee_id } });
    },
  );
}
