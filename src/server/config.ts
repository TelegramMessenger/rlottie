/**
 * @file src/server/config.ts
 * Конфигурация сервера из переменных окружения.
 *
 * Всегда читай из process.env — никогда не хардкодь секреты в коде.
 * Скопируй .env.example → .env и заполни перед запуском.
 */

import { config as loadDotenv } from 'dotenv';

// Загружаем .env только вне production (в prod переменные задаёт хостинг)
if (process.env['NODE_ENV'] !== 'production') {
  loadDotenv();
}

function required(name: string): string {
  const val = process.env[name];
  if (!val) {
    throw new Error(`Переменная окружения ${name} обязательна, но не задана. Проверь .env файл.`);
  }
  return val;
}

function optional(name: string, fallback: string): string {
  return process.env[name] ?? fallback;
}

function optionalInt(name: string, fallback: number): number {
  const val = process.env[name];
  if (!val) return fallback;
  const n = parseInt(val, 10);
  if (isNaN(n)) throw new Error(`Переменная ${name} должна быть числом, получено: "${val}"`);
  return n;
}

export const Config = {
  // ── Сервер ────────────────────────────────────────────────────
  PORT:     optionalInt('PORT', 3000),
  HOST:     optional('HOST', '0.0.0.0'),
  NODE_ENV: optional('NODE_ENV', 'development'),

  get IS_DEV()  { return this.NODE_ENV === 'development'; },
  get IS_PROD() { return this.NODE_ENV === 'production'; },

  // ── База данных ───────────────────────────────────────────────
  DB_PATH: optional('DB_PATH', './data/bazzar.db'),

  // ── KIE.AI ───────────────────────────────────────────────────
  // Ключ обязателен для работы AI-инструментов
  get KIE_API_KEY() {
    const key = process.env['KIE_API_KEY'];
    if (!key || key === 'your_kie_api_key_here') {
      console.warn('[config] KIE_API_KEY не задан — AI-функции будут недоступны');
      return '';
    }
    return key;
  },
  KIE_BASE_URL: 'https://api.kie.ai/api/v1',

  // ── Webhook ───────────────────────────────────────────────────
  WEBHOOK_BASE_URL: optional('WEBHOOK_BASE_URL', 'http://localhost:3000'),
  /** Секрет для верификации webhook-вызовов от KIE.AI. Передаётся в callBackUrl как ?token=… */
  get WEBHOOK_SECRET() {
    if (this.IS_PROD) return required('WEBHOOK_SECRET');
    return optional('WEBHOOK_SECRET', 'dev-webhook-secret-change-me');
  },

  // ── Auth ──────────────────────────────────────────────────────
  get JWT_SECRET() {
    if (this.IS_PROD) return required('JWT_SECRET');
    return optional('JWT_SECRET', 'dev-secret-change-in-production');
  },

  // ── CORS ──────────────────────────────────────────────────────
  get CORS_ORIGINS(): string[] {
    const raw = optional('CORS_ORIGINS', 'http://localhost:3000,http://localhost:5173');
    return raw.split(',').map(s => s.trim()).filter(Boolean);
  },
} as const;
