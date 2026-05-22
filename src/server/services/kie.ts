/**
 * @file src/server/services/kie.ts
 * Сервис интеграции с KIE.AI API.
 *
 * БЕЗОПАСНОСТЬ: API-ключ читается из Config.KIE_API_KEY (переменная окружения).
 * Ключ НИКОГДА не уходит в браузер — все запросы проксируются через этот сервис.
 *
 * Схема работы:
 *   1. Клиент → POST /api/ai/image (наш backend)
 *   2. Наш backend → POST https://api.kie.ai/... (с API ключом из .env)
 *   3. KIE.AI возвращает taskId
 *   4. Клиент polling → GET /api/ai/job/:id (наш backend)
 *   5. Наш backend → GET https://api.kie.ai/... → статус/результат
 */

import { Config } from '../config.js';
import type {
  KieImageRequest,
  KieVideoRequest,
  KieMusicRequest,
  KieChatRequest,
} from '../../../shared/types.js';

/** Базовые заголовки для всех запросов к KIE.AI */
function kieHeaders(): Record<string, string> {
  return {
    'Authorization': `Bearer ${Config.KIE_API_KEY}`,
    'Content-Type': 'application/json',
  };
}

/**
 * Общий fetch-обёртка с обработкой ошибок KIE.AI.
 * Бросает KieError при HTTP ошибках.
 */
async function kieFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);

  if (!res.ok) {
    let message = `HTTP ${res.status} от KIE.AI`;
    try {
      const body = await res.json() as { message?: string; error?: string };
      message = body.message ?? body.error ?? message;
    } catch { /* игнорируем ошибку парсинга */ }
    throw new KieError(message, res.status);
  }

  return res.json() as Promise<T>;
}

/** Ошибка KIE.AI с HTTP-статусом */
export class KieError extends Error {
  constructor(message: string, public readonly statusCode: number) {
    super(message);
    this.name = 'KieError';
  }
}

// ── Ответы KIE.AI ────────────────────────────────────────────────

interface KieTaskResponse {
  data: {
    taskId: string;
    status?: string;
  };
}

interface KieTaskStatusResponse {
  data: {
    taskId: string;
    status: 'queued' | 'processing' | 'success' | 'failed';
    output?: {
      imageUrl?: string;
      videoUrl?: string;
    };
    error?: string;
  };
}

interface KieMusicStatusResponse {
  data: {
    taskId: string;
    status: 'text' | 'first' | 'complete' | 'failed';
    audio_url?: string;
    error?: string;
  };
}

interface KieChatResponse {
  choices: Array<{
    message: { role: string; content: string };
  }>;
}

// ── Генерация изображений ────────────────────────────────────────

/**
 * Запускает генерацию изображения через Flux-2 Pro.
 * @returns taskId для последующего polling
 */
export async function generateImage(req: KieImageRequest): Promise<string> {
  const webhookUrl = `${Config.WEBHOOK_BASE_URL}/api/ai/callback?token=${encodeURIComponent(Config.WEBHOOK_SECRET)}`;

  const response = await kieFetch<KieTaskResponse>(
    `${Config.KIE_BASE_URL}/market/flux2/pro-text-to-image`,
    {
      method: 'POST',
      headers: kieHeaders(),
      body: JSON.stringify({
        prompt:      req.prompt,
        width:       req.width  ?? 1024,
        height:      req.height ?? 1024,
        callBackUrl: req.callBackUrl ?? webhookUrl,
      }),
    },
  );

  return response.data.taskId;
}

// ── Генерация видео ──────────────────────────────────────────────

/**
 * Запускает генерацию видео через Kling 2.6.
 * @returns taskId
 */
export async function generateVideo(req: KieVideoRequest): Promise<string> {
  const webhookUrl = `${Config.WEBHOOK_BASE_URL}/api/ai/callback?token=${encodeURIComponent(Config.WEBHOOK_SECRET)}`;

  const response = await kieFetch<KieTaskResponse>(
    `${Config.KIE_BASE_URL}/market/kling/text-to-video`,
    {
      method: 'POST',
      headers: kieHeaders(),
      body: JSON.stringify({
        prompt:      req.prompt,
        duration:    req.duration    ?? 5,
        ratio:       req.ratio       ?? '16:9',
        callBackUrl: req.callBackUrl ?? webhookUrl,
      }),
    },
  );

  return response.data.taskId;
}

// ── Генерация музыки (Suno via KIE) ─────────────────────────────

/**
 * Запускает генерацию трека через Suno API.
 * @returns taskId
 */
export async function generateMusic(req: KieMusicRequest): Promise<string> {
  const webhookUrl = `${Config.WEBHOOK_BASE_URL}/api/ai/callback?token=${encodeURIComponent(Config.WEBHOOK_SECRET)}`;

  const response = await kieFetch<KieTaskResponse>(
    `${Config.KIE_BASE_URL}/generate`,
    {
      method: 'POST',
      headers: kieHeaders(),
      body: JSON.stringify({
        prompt:       req.prompt,
        customMode:   req.customMode   ?? true,
        instrumental: req.instrumental ?? false,
        style:        req.style,
        title:        req.title,
        model:        req.model        ?? 'V4_5',
        vocalGender:  req.vocalGender  ?? 'f',
        negativeTags: req.negativeTags,
        callBackUrl:  req.callBackUrl  ?? webhookUrl,
      }),
    },
  );

  return response.data.taskId;
}

// ── Polling статуса задачи ───────────────────────────────────────

/**
 * Получает статус и результат image/video задачи.
 */
export async function getTaskStatus(kieTaskId: string): Promise<{
  status: 'queued' | 'processing' | 'success' | 'failed';
  resultUrl: string | null;
  error: string | null;
}> {
  const response = await kieFetch<KieTaskStatusResponse>(
    `${Config.KIE_BASE_URL}/market/task?taskId=${encodeURIComponent(kieTaskId)}`,
    { headers: kieHeaders() },
  );

  const { status, output, error } = response.data;
  const resultUrl = output?.imageUrl ?? output?.videoUrl ?? null;

  return { status, resultUrl, error: error ?? null };
}

/**
 * Получает статус музыкальной задачи (другой endpoint у Suno).
 */
export async function getMusicStatus(kieTaskId: string): Promise<{
  status: 'queued' | 'processing' | 'success' | 'failed';
  resultUrl: string | null;
  error: string | null;
}> {
  const response = await kieFetch<KieMusicStatusResponse>(
    `${Config.KIE_BASE_URL}/music/${encodeURIComponent(kieTaskId)}`,
    { headers: kieHeaders() },
  );

  const { status: kieStatus, audio_url, error } = response.data;

  // Маппинг статусов Suno → наши статусы
  const statusMap: Record<string, 'queued' | 'processing' | 'success' | 'failed'> = {
    text:     'processing',
    first:    'processing',
    complete: 'success',
    failed:   'failed',
  };

  return {
    status:    statusMap[kieStatus] ?? 'processing',
    resultUrl: audio_url ?? null,
    error:     error ?? null,
  };
}

// ── Чат ─────────────────────────────────────────────────────────

/**
 * Отправляет сообщение в KIE.AI Chat (OpenAI-совместимый формат).
 * Поддерживает GPT-4o-mini, Claude, Gemini в зависимости от модели.
 *
 * @returns Текст ответа ассистента
 */
export async function chat(req: KieChatRequest): Promise<string> {
  const response = await kieFetch<KieChatResponse>(
    // KIE.AI предоставляет OpenAI-совместимый эндпоинт
    `${Config.KIE_BASE_URL}/chat/completions`,
    {
      method: 'POST',
      headers: kieHeaders(),
      body: JSON.stringify({
        model:       req.model       ?? 'gpt-4o-mini',
        messages:    req.messages,
        max_tokens:  req.max_tokens  ?? 1024,
        temperature: req.temperature ?? 0.7,
      }),
    },
  );

  const content = response.choices[0]?.message?.content;
  if (!content) throw new KieError('Пустой ответ от модели', 500);
  return content;
}

// ── Webhook callback ─────────────────────────────────────────────

/** Тип callback-тела от KIE.AI */
export interface KieCallbackBody {
  taskId: string;
  status: string;
  data?: {
    audio_url?: string;
    imageUrl?:  string;
    videoUrl?:  string;
  };
}
