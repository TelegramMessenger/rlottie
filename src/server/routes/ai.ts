/**
 * @file src/server/routes/ai.ts
 * Безопасный прокси к KIE.AI API.
 *
 * Безопасность:
 *  - API-ключ KIE.AI читается только из process.env, никогда не уходит в браузер
 *  - Все POST /api/ai/* требуют JWT (общий хук в server/index.ts) + rate-limit
 *  - Callback /api/ai/callback защищён общим секретом WEBHOOK_SECRET (?token=…)
 *
 * Изменения статусов:
 *  - Не синхронный опрос: GET /api/ai/job/:id просто читает из БД
 *  - Фоновый воркер (services/aiPoller.ts) обновляет статусы из KIE раз в 10s
 *  - Webhook от KIE и поллер вещают `ai_job:update` через WebSocket
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { getDb, queryAll, queryOne, execute, newId } from '../services/database.js';
import {
  generateImage,
  generateVideo,
  generateMusic,
  chat,
  KieError,
  type KieCallbackBody,
} from '../services/kie.js';
import { broadcastWs } from '../index.js';
import { Config } from '../config.js';
import type {
  AiJob,
  KieImageRequest,
  KieVideoRequest,
  KieMusicRequest,
  KieChatRequest,
} from '../../../shared/types.js';

/** preHandler: возвращает 503 если KIE_API_KEY не настроен. */
async function requireKieKey(_req: FastifyRequest, reply: FastifyReply): Promise<void> {
  if (!Config.KIE_API_KEY) {
    return reply.status(503).send({
      ok: false,
      error: 'AI-функции недоступны: KIE_API_KEY не настроен на сервере',
    });
  }
}

/** Конфиг rate-limit для AI-эндпоинтов: 10 запросов/мин на IP. */
const AI_RATE_LIMIT = {
  config: {
    rateLimit: {
      max: 10,
      timeWindow: '1 minute',
    },
  },
  preHandler: requireKieKey,
};

/** Оборачивает вызов KIE.AI: создаёт job в БД, запускает генерацию */
async function startJob(
  db: ReturnType<typeof getDb>,
  userId: string,
  type: AiJob['type'],
  prompt: string,
  options: Record<string, unknown>,
  kieTaskIdPromise: Promise<string>,
): Promise<AiJob> {
  const id = newId();

  execute(db,
    "INSERT INTO ai_jobs (id, user_id, type, status, prompt, options) VALUES (?, ?, ?, 'queued', ?, ?)",
    [id, userId, type, prompt, JSON.stringify(options)],
  );

  kieTaskIdPromise
    .then(kieTaskId => {
      execute(db,
        "UPDATE ai_jobs SET kie_task_id = ?, status = 'processing', updated_at = datetime('now') WHERE id = ?",
        [kieTaskId, id],
      );
      broadcastWs({ type: 'ai_job:update', payload: { id, status: 'processing', result_url: null, error: null } });
    })
    .catch((err: Error) => {
      execute(db,
        "UPDATE ai_jobs SET status = 'failed', error = ?, updated_at = datetime('now') WHERE id = ?",
        [err.message, id],
      );
      broadcastWs({ type: 'ai_job:update', payload: { id, status: 'failed', result_url: null, error: err.message } });
    });

  return queryOne<AiJob>(db, 'SELECT * FROM ai_jobs WHERE id = ?', [id])!;
}

export default async function aiRoutes(app: FastifyInstance) {
  const db = getDb();

  // ── POST /api/ai/image ────────────────────────────────────────
  app.post<{ Body: KieImageRequest }>(
    '/api/ai/image',
    AI_RATE_LIMIT,
    async (req, reply) => {
      const { prompt, width = 1024, height = 1024 } = req.body;
      if (!prompt?.trim()) return reply.status(400).send({ ok: false, error: 'Промпт обязателен' });

      try {
        const job = await startJob(
          db, req.user!.sub, 'text-to-image', prompt, { width, height },
          generateImage({ prompt, width, height }),
        );
        return reply.status(202).send({ ok: true, data: job });
      } catch (err) {
        if (err instanceof KieError) {
          return reply.status(err.statusCode).send({ ok: false, error: err.message });
        }
        throw err;
      }
    },
  );

  // ── POST /api/ai/video ────────────────────────────────────────
  app.post<{ Body: KieVideoRequest }>(
    '/api/ai/video',
    AI_RATE_LIMIT,
    async (req, reply) => {
      const { prompt, duration = 5, ratio = '16:9' } = req.body;
      if (!prompt?.trim()) return reply.status(400).send({ ok: false, error: 'Промпт обязателен' });

      try {
        const job = await startJob(
          db, req.user!.sub, 'text-to-video', prompt, { duration, ratio },
          generateVideo({ prompt, duration, ratio }),
        );
        return reply.status(202).send({ ok: true, data: job });
      } catch (err) {
        if (err instanceof KieError) {
          return reply.status(err.statusCode).send({ ok: false, error: err.message });
        }
        throw err;
      }
    },
  );

  // ── POST /api/ai/music ────────────────────────────────────────
  app.post<{ Body: KieMusicRequest }>(
    '/api/ai/music',
    AI_RATE_LIMIT,
    async (req, reply) => {
      const { prompt, ...rest } = req.body;
      if (!prompt?.trim()) return reply.status(400).send({ ok: false, error: 'Промпт обязателен' });

      try {
        const job = await startJob(
          db, req.user!.sub, 'text-to-music', prompt, rest as Record<string, unknown>,
          generateMusic({ prompt, ...rest }),
        );
        return reply.status(202).send({ ok: true, data: job });
      } catch (err) {
        if (err instanceof KieError) {
          return reply.status(err.statusCode).send({ ok: false, error: err.message });
        }
        throw err;
      }
    },
  );

  // ── POST /api/ai/chat ─────────────────────────────────────────
  app.post<{ Body: KieChatRequest }>(
    '/api/ai/chat',
    AI_RATE_LIMIT,
    async (req, reply) => {
      const { messages, model, temperature, max_tokens } = req.body;
      if (!messages?.length) return reply.status(400).send({ ok: false, error: 'Сообщения обязательны' });

      try {
        const chatReq: KieChatRequest = { messages };
        if (model !== undefined)       chatReq.model       = model;
        if (temperature !== undefined) chatReq.temperature = temperature;
        if (max_tokens !== undefined)  chatReq.max_tokens  = max_tokens;

        const content = await chat(chatReq);
        return reply.send({ ok: true, data: { content } });
      } catch (err) {
        if (err instanceof KieError) {
          return reply.status(502).send({ ok: false, error: err.message });
        }
        throw err;
      }
    },
  );

  // ── GET /api/ai/job/:id ───────────────────────────────────────
  // Просто читаем из БД. Поллер (aiPoller.ts) поддерживает её актуальной.
  app.get<{ Params: { id: string } }>('/api/ai/job/:id', async (req, reply) => {
    const job = queryOne<AiJob>(db, 'SELECT * FROM ai_jobs WHERE id = ?', [req.params.id]);
    if (!job) return reply.status(404).send({ ok: false, error: 'Задача не найдена' });
    return reply.send({ ok: true, data: job });
  });

  // ── GET /api/ai/jobs ──────────────────────────────────────────
  // Возвращаем только задачи текущего пользователя (или все, если admin).
  app.get<{ Querystring: { limit?: string; offset?: string } }>(
    '/api/ai/jobs',
    async (req, reply) => {
      const limit  = Math.min(200, Math.max(1, parseInt(req.query.limit  ?? '50', 10) || 50));
      const offset = Math.max(0,  parseInt(req.query.offset ?? '0',  10) || 0);

      const isAdmin = req.user!.role === 'admin';
      const sql = isAdmin
        ? 'SELECT * FROM ai_jobs ORDER BY created_at DESC LIMIT ? OFFSET ?'
        : 'SELECT * FROM ai_jobs WHERE user_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?';
      const params = isAdmin ? [limit, offset] : [req.user!.sub, limit, offset];

      const jobs = queryAll<AiJob>(db, sql, params);
      return reply.send({ ok: true, data: jobs });
    },
  );

  // ── POST /api/ai/callback ─────────────────────────────────────
  // Webhook от KIE.AI. Защищён общим секретом в query: ?token=WEBHOOK_SECRET.
  // Маршрут — в PUBLIC_API_PATHS (без JWT), потому что вызывается извне.
  app.post<{
    Body: KieCallbackBody;
    Querystring: { token?: string };
  }>(
    '/api/ai/callback',
    async (req, reply) => {
      if (req.query.token !== Config.WEBHOOK_SECRET) {
        return reply.status(401).send({ ok: false, error: 'Недействительный webhook-секрет' });
      }

      const { taskId, status, data } = req.body;
      const fileUrl = data?.audio_url ?? data?.imageUrl ?? data?.videoUrl ?? null;
      const internalStatus = (status === 'complete' || status === 'success')
        ? 'success'
        : status === 'failed' ? 'failed' : 'processing';

      execute(db,
        "UPDATE ai_jobs SET status = ?, result_url = ?, updated_at = datetime('now') WHERE kie_task_id = ?",
        [internalStatus, fileUrl, taskId],
      );

      const job = queryOne<AiJob>(db, 'SELECT * FROM ai_jobs WHERE kie_task_id = ?', [taskId]);
      if (job) {
        broadcastWs({
          type: 'ai_job:update',
          payload: { id: job.id, status: internalStatus, result_url: fileUrl, error: job.error },
        });
      }

      return reply.send({ ok: true });
    },
  );
}
