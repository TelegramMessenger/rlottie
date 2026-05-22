/**
 * @file src/server/routes/finance.ts
 * REST API для финансовых операций.
 *
 * GET    /api/finance             — список транзакций (с фильтрами)
 * GET    /api/finance/summary     — сводка: итого, оплачено, в ожидании
 * POST   /api/finance             — добавить транзакцию
 * PATCH  /api/finance/:id         — обновить (статус, сумма и т.д.)
 * DELETE /api/finance/:id         — удалить
 */

import type { FastifyInstance, FastifyRequest } from 'fastify';
import { getDb, queryAll, queryOne, execute, newId } from '../services/database.js';
import type { FinanceRecord, CreateFinanceRecordDto } from '../../../shared/types.js';

export default async function financeRoutes(app: FastifyInstance) {
  const db = getDb();

  // ── GET /api/finance/summary ──────────────────────────────────
  // Важно: роут /summary должен быть ДО /api/finance/:id
  app.get(
    '/api/finance/summary',
    async (req: FastifyRequest<{ Querystring: { project_id?: string } }>, reply) => {
      const { project_id } = req.query;

      const where  = project_id ? 'WHERE project_id = ?' : '';
      const params = project_id ? [project_id] : [];

      const row = queryOne<{
        total: number;
        paid: number;
        pending: number;
        count: number;
      }>(
        db,
        `SELECT
           SUM(amount)                                         AS total,
           SUM(CASE WHEN status = 'paid'    THEN amount END)  AS paid,
           SUM(CASE WHEN status = 'pending' THEN amount END)  AS pending,
           COUNT(*)                                            AS count
         FROM finance ${where}`,
        params,
      );

      return reply.send({
        ok: true,
        data: {
          total:   row?.total   ?? 0,
          paid:    row?.paid    ?? 0,
          pending: row?.pending ?? 0,
          count:   row?.count   ?? 0,
        },
      });
    },
  );

  // ── GET /api/finance ──────────────────────────────────────────
  app.get(
    '/api/finance',
    async (req: FastifyRequest<{ Querystring: { project_id?: string; status?: string; category?: string; limit?: string; offset?: string } }>, reply) => {
      const { project_id, status, category } = req.query;
      const limit  = Math.min(500, Math.max(1, parseInt(req.query.limit  ?? '100', 10) || 100));
      const offset = Math.max(0,  parseInt(req.query.offset ?? '0', 10) || 0);

      let where = '1=1';
      const params: unknown[] = [];
      if (project_id) { where += ' AND project_id = ?'; params.push(project_id); }
      if (status)     { where += ' AND status = ?';     params.push(status); }
      if (category)   { where += ' AND category = ?';   params.push(category); }

      const total = (queryOne<{ cnt: number }>(db, `SELECT COUNT(*) as cnt FROM finance WHERE ${where}`, params) ?? { cnt: 0 }).cnt;
      const records = queryAll<FinanceRecord>(
        db,
        `SELECT * FROM finance WHERE ${where} ORDER BY date DESC, created_at DESC LIMIT ? OFFSET ?`,
        [...params, limit, offset],
      );

      return reply.send({ ok: true, data: records, meta: { total, limit, offset } });
    },
  );

  // ── GET /api/finance/:id ──────────────────────────────────────
  app.get<{ Params: { id: string } }>('/api/finance/:id', async (req, reply) => {
    const record = queryOne<FinanceRecord>(db, 'SELECT * FROM finance WHERE id = ?', [req.params.id]);
    if (!record) return reply.status(404).send({ ok: false, error: 'Запись не найдена' });
    return reply.send({ ok: true, data: record });
  });

  // ── POST /api/finance ─────────────────────────────────────────
  app.post<{ Body: CreateFinanceRecordDto }>('/api/finance', async (req, reply) => {
    const {
      project_id,
      description,
      category = 'dev',
      amount,
      status = 'pending',
      date,
    } = req.body;

    if (!description?.trim()) return reply.status(400).send({ ok: false, error: 'Описание обязательно' });
    if (!amount || amount <= 0) return reply.status(400).send({ ok: false, error: 'Сумма должна быть > 0' });

    const id = newId();
    execute(db,
      `INSERT INTO finance (id, project_id, description, category, amount, status, date)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [id, project_id ?? null, description.trim(), category, amount, status, date ?? new Date().toISOString().split('T')[0]],
    );

    return reply.status(201).send({ ok: true, data: queryOne<FinanceRecord>(db, 'SELECT * FROM finance WHERE id = ?', [id]) });
  });

  // ── PATCH /api/finance/:id ────────────────────────────────────
  app.patch<{ Params: { id: string }; Body: Partial<CreateFinanceRecordDto> }>(
    '/api/finance/:id',
    async (req, reply) => {
      const record = queryOne(db, 'SELECT id FROM finance WHERE id = ?', [req.params.id]);
      if (!record) return reply.status(404).send({ ok: false, error: 'Запись не найдена' });

      const allowed = ['description', 'category', 'amount', 'status', 'date'] as const;
      const updates: string[] = [];
      const values: unknown[] = [];

      for (const field of allowed) {
        if (req.body[field] !== undefined) {
          updates.push(`${field} = ?`);
          values.push(req.body[field]);
        }
      }

      if (updates.length > 0) {
        values.push(req.params.id);
        execute(db, `UPDATE finance SET ${updates.join(', ')} WHERE id = ?`, values);
      }

      return reply.send({ ok: true, data: queryOne<FinanceRecord>(db, 'SELECT * FROM finance WHERE id = ?', [req.params.id]) });
    },
  );

  // ── DELETE /api/finance/:id ───────────────────────────────────
  app.delete<{ Params: { id: string } }>('/api/finance/:id', async (req, reply) => {
    const record = queryOne(db, 'SELECT id FROM finance WHERE id = ?', [req.params.id]);
    if (!record) return reply.status(404).send({ ok: false, error: 'Запись не найдена' });
    execute(db, 'DELETE FROM finance WHERE id = ?', [req.params.id]);
    return reply.send({ ok: true, data: { id: req.params.id } });
  });
}
