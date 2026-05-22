/**
 * @file src/server/services/aiPoller.ts
 * Фоновый воркер: периодически опрашивает KIE.AI для задач в статусе 'processing'
 * и обновляет БД. При смене статуса вещает событие через WebSocket.
 *
 * Заменяет синхронный опрос на каждый запрос клиента — теперь сервер сам
 * поддерживает БД актуальной, а клиенты читают только из БД.
 */

import { getDb, queryAll, execute } from './database.js';
import { getTaskStatus, getMusicStatus } from './kie.js';
import { Config } from '../config.js';
import type { AiJob } from '../../../shared/types.js';

interface PollerOptions {
  intervalMs: number;
  broadcast?: (event: { type: string; payload: unknown }) => void;
}

let _timer: NodeJS.Timeout | null = null;
let _running = false;

async function pollOnce(broadcast?: PollerOptions['broadcast']): Promise<void> {
  if (_running) return;
  if (!Config.KIE_API_KEY) return;

  _running = true;
  try {
    const db = getDb();
    const jobs = queryAll<AiJob>(
      db,
      `SELECT * FROM ai_jobs
       WHERE status IN ('queued','processing') AND kie_task_id IS NOT NULL
       LIMIT 50`,
    );

    for (const job of jobs) {
      if (!job.kie_task_id) continue;
      try {
        const result = job.type === 'text-to-music'
          ? await getMusicStatus(job.kie_task_id)
          : await getTaskStatus(job.kie_task_id);

        if (result.status === job.status && result.resultUrl === job.result_url) continue;

        execute(db,
          `UPDATE ai_jobs SET status = ?, result_url = ?, error = ?, updated_at = datetime('now') WHERE id = ?`,
          [result.status, result.resultUrl, result.error, job.id],
        );

        broadcast?.({
          type: 'ai_job:update',
          payload: { id: job.id, status: result.status, result_url: result.resultUrl, error: result.error },
        });
      } catch {
        // Сетевая ошибка / KIE недоступен — пропускаем эту задачу до следующего цикла.
      }
    }
  } finally {
    _running = false;
  }
}

export function startAiPoller(opts: PollerOptions): void {
  if (_timer) return;
  const { intervalMs, broadcast } = opts;
  _timer = setInterval(() => { void pollOnce(broadcast); }, intervalMs);
  // Не блокируем выход процесса
  _timer.unref?.();
}

export function stopAiPoller(): void {
  if (_timer) {
    clearInterval(_timer);
    _timer = null;
  }
}
