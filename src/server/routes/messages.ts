/**
 * @file src/server/routes/messages.ts
 * REST API для сообщений (каналы команды).
 *
 * GET    /api/messages?channel=...     — последние 100 сообщений канала
 * POST   /api/messages                 — отправить сообщение (broadcast по WS)
 * DELETE /api/messages/:id             — удалить сообщение
 */

import type { FastifyInstance } from 'fastify';
import { getDb, queryAll, queryOne, execute, newId } from '../services/database.js';
import { broadcastWs } from '../index.js';
import type { Message, SendMessageDto, Employee } from '../../../shared/types.js';

export default async function messageRoutes(app: FastifyInstance) {
  const db = getDb();

  // ── GET /api/messages ──────────────────────────────────────────
  app.get<{ Querystring: { channel?: string; project_id?: string } }>(
    '/api/messages',
    async (req, reply) => {
      const { channel = 'general', project_id } = req.query;

      const where: string[] = ['channel = ?'];
      const params: unknown[] = [channel];

      if (project_id) {
        where.push('project_id = ?');
        params.push(project_id);
      }

      const messages = queryAll<Message>(
        db,
        `SELECT * FROM messages
         WHERE ${where.join(' AND ')}
         ORDER BY created_at ASC
         LIMIT 100`,
        params,
      );

      return reply.send({ ok: true, data: messages });
    },
  );

  // ── POST /api/messages ─────────────────────────────────────────
  app.post<{ Body: SendMessageDto }>(
    '/api/messages',
    async (req, reply) => {
      const { channel = 'general', content, project_id } = req.body;

      if (!content?.trim()) {
        return reply.status(400).send({ ok: false, error: 'Сообщение не может быть пустым' });
      }

      // Берём первого сотрудника как "автора" — в реальном приложении это был бы текущий пользователь из сессии
      const author = queryOne<Employee>(db, 'SELECT id, name FROM employees ORDER BY created_at LIMIT 1');
      if (!author) {
        return reply.status(400).send({ ok: false, error: 'Нет сотрудников для отправки сообщения' });
      }

      const id = newId();

      execute(
        db,
        `INSERT INTO messages (id, project_id, channel, author_id, author_name, content)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [id, project_id ?? null, channel, author.id, author.name, content.trim()],
      );

      const message = queryOne<Message>(db, 'SELECT * FROM messages WHERE id = ?', [id]);

      // Broadcast по WebSocket всем подключённым клиентам
      if (message) {
        broadcastWs({ type: 'message:new', payload: message });
      }

      return reply.status(201).send({ ok: true, data: message });
    },
  );

  // ── DELETE /api/messages/:id ───────────────────────────────────
  app.delete<{ Params: { id: string } }>(
    '/api/messages/:id',
    async (req, reply) => {
      const msg = queryOne(db, 'SELECT id FROM messages WHERE id = ?', [req.params.id]);
      if (!msg) {
        return reply.status(404).send({ ok: false, error: 'Сообщение не найдено' });
      }

      execute(db, 'DELETE FROM messages WHERE id = ?', [req.params.id]);
      return reply.send({ ok: true, data: { id: req.params.id } });
    },
  );
}
