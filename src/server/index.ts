/**
 * @file src/server/index.ts
 * Точка входа Fastify-сервера BAZZAR.
 *
 * Запуск в dev-режиме:  npm run dev:server
 * Запуск в prod:        npm start  (после npm run build)
 *
 * Архитектура:
 *   ├── /api/*       — REST API маршруты
 *   ├── /ws          — WebSocket (real-time чат / AI-события)
 *   └── /*           — Статические файлы (HTML/CSS/JS фронтенда)
 */

import Fastify from 'fastify';
import cors from '@fastify/cors';
import staticFiles from '@fastify/static';
import websocket, { type SocketStream } from '@fastify/websocket';
import rateLimit from '@fastify/rate-limit';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

import { Config } from './config.js';
import { verifyJwt } from './services/auth.js';
import { startAiPoller } from './services/aiPoller.js';
import authRoutes     from './routes/auth.js';
import adminRoutes    from './routes/admin.js';
import projectRoutes  from './routes/projects.js';
import taskRoutes     from './routes/tasks.js';
import employeeRoutes from './routes/employees.js';
import financeRoutes  from './routes/finance.js';
import aiRoutes       from './routes/ai.js';
import messageRoutes  from './routes/messages.js';

/** Эндпоинты, доступные без JWT (login/register/health/webhook). */
const PUBLIC_API_PATHS = new Set<string>([
  '/api/auth/login',
  '/api/auth/register',
  '/api/health',
  '/api/ai/callback',  // защищён собственным секретом в URL (?token=…)
]);

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── Создаём Fastify инстанс ──────────────────────────────────────
// Pino logger: в dev красивый вывод, в prod JSON
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const loggerConfig: any = Config.IS_DEV
  ? { level: 'debug', transport: { target: 'pino-pretty', options: { colorize: true, translateTime: 'HH:MM:ss' } } }
  : { level: 'info' };

const app = Fastify({ logger: loggerConfig });

// ── Плагины ─────────────────────────────────────────────────────

// CORS — разрешаем запросы от Vite dev-сервера и самого сайта
await app.register(cors, {
  origin: Config.CORS_ORIGINS,
  credentials: true,
});

// WebSocket поддержка
await app.register(websocket);

// Rate limiting — защищаем /api/ai/* от перебора (KIE.AI кредиты).
// 10 запросов/минуту на IP для AI; 100/мин для остальных /api.
await app.register(rateLimit, {
  global: false, // включаем избирательно через config на маршрутах
  max:    100,
  timeWindow: '1 minute',
  keyGenerator: (req) => req.ip,
});

// ── Глобальный JWT preHandler для /api/* ────────────────────────
// Любой эндпоинт /api/*, кроме PUBLIC_API_PATHS, требует валидный Bearer-токен.
app.addHook('onRequest', async (req, reply) => {
  if (!req.url.startsWith('/api/')) return;

  // Берём path без query-string
  const pathOnly = req.url.split('?')[0] ?? req.url;
  if (PUBLIC_API_PATHS.has(pathOnly)) return;

  const header = req.headers['authorization'];
  if (!header?.startsWith('Bearer ')) {
    return reply.status(401).send({ ok: false, error: 'Требуется авторизация' });
  }

  const payload = await verifyJwt(header.slice(7));
  if (!payload) {
    return reply.status(401).send({ ok: false, error: 'Токен недействителен или истёк' });
  }

  req.user = payload;
});

// Статические файлы: только в production. В dev фронтенд обслуживает Vite (порт 5173),
// а Fastify (порт 3000) отдаёт только /api/* и /ws.
if (Config.IS_PROD) {
  await app.register(staticFiles, {
    root: resolve(__dirname, '../../dist/client'),
    prefix: '/',
    decorateReply: false,
  });
}

// ── API маршруты ─────────────────────────────────────────────────
await app.register(authRoutes);
await app.register(adminRoutes);
await app.register(projectRoutes);
await app.register(taskRoutes);
await app.register(employeeRoutes);
await app.register(financeRoutes);
await app.register(aiRoutes);
await app.register(messageRoutes);

// ── Health check ─────────────────────────────────────────────────
app.get('/api/health', async () => ({
  status: 'ok',
  version: '1.0.0',
  env: Config.NODE_ENV,
  timestamp: new Date().toISOString(),
}));

// ── WebSocket для real-time событий ─────────────────────────────
// Клиент подключается к /ws и получает события: новые сообщения, AI-задачи

/** Множество активных WS-соединений (SocketStream.socket — это нативный ws.WebSocket) */
const wsClients = new Set<SocketStream>();

app.get('/ws', { websocket: true }, (socket: SocketStream) => {
  wsClients.add(socket);
  app.log.info(`[WS] Клиент подключился. Всего: ${wsClients.size}`);

  socket.socket.send(JSON.stringify({ type: 'connected', payload: { message: 'BAZZAR WS подключён' } }));

  socket.socket.on('close', () => {
    wsClients.delete(socket);
    app.log.info(`[WS] Клиент отключился. Всего: ${wsClients.size}`);
  });

  socket.socket.on('error', (err: Error) => {
    app.log.error(err, '[WS] Ошибка соединения');
    wsClients.delete(socket);
  });
});

/**
 * Отправляет событие всем подключённым WebSocket-клиентам.
 * Используется из AI callback и message routes.
 */
export function broadcastWs(event: { type: string; payload: unknown }): void {
  const data = JSON.stringify(event);
  for (const client of wsClients) {
    if (client.socket.readyState === 1 /* OPEN */) {
      client.socket.send(data);
    }
  }
}

// ── Обработка 404 для SPA ────────────────────────────────────────
// API → 404 JSON. Прочее → index.html (только в prod, в dev этим занимается Vite).
app.setNotFoundHandler(async (req, reply) => {
  if (req.url.startsWith('/api/') || req.url.startsWith('/ws')) {
    return reply.status(404).send({ ok: false, error: 'Маршрут не найден' });
  }
  if (Config.IS_PROD) {
    return reply.sendFile('index.html');
  }
  return reply.status(404).send({ ok: false, error: 'Запустите Vite dev server: npm run dev:client' });
});

// ── Глобальная обработка ошибок ──────────────────────────────────
app.setErrorHandler(async (error, req, reply) => {
  app.log.error(error, `[${req.method}] ${req.url}`);

  if (reply.sent) return;

  const statusCode = error.statusCode ?? 500;
  return reply.status(statusCode).send({
    ok: false,
    error: Config.IS_DEV ? error.message : 'Внутренняя ошибка сервера',
    ...(Config.IS_DEV && { stack: error.stack }),
  });
});

// ── Запуск ───────────────────────────────────────────────────────
try {
  await app.listen({ port: Config.PORT, host: Config.HOST });
  console.log(`\n✅ BAZZAR сервер запущен: http://${Config.HOST}:${Config.PORT}`);
  console.log(`   Среда: ${Config.NODE_ENV}`);
  console.log(`   БД:    ${Config.DB_PATH}\n`);

  // Фоновый поллер AI-задач: опрашивает KIE.AI каждые 10s и обновляет статусы в БД,
  // вещая события через WS. Заменяет синхронный опрос на каждый запрос клиента.
  startAiPoller({ intervalMs: 10_000, broadcast: broadcastWs });
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
