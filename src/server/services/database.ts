/**
 * @file src/server/services/database.ts
 * Сервис работы с базой данных SQLite через встроенный node:sqlite.
 *
 * node:sqlite (Node.js 22+) — синхронный драйвер без нативной компиляции.
 * Не требует build tools, работает на любой платформе "из коробки".
 */

import { DatabaseSync, type StatementResultingChanges } from 'node:sqlite';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { Config } from '../config.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

const SCHEMA_PATH = resolve(__dirname, '../db/schema.sql');

export type RunResult = StatementResultingChanges;

let _db: DatabaseSync | null = null;
let _closed = false;

function closeDb(): void {
  if (_db && !_closed) {
    _closed = true;
    try { _db.close(); } catch { /* already closed */ }
  }
}

export function getDb(): DatabaseSync {
  if (!_db) {
    _db = new DatabaseSync(Config.DB_PATH);

    // Wait up to 5s on SQLITE_BUSY before throwing. SQLite is single-writer,
    // so concurrent writes can briefly block; this avoids spurious errors under load.
    _db.exec('PRAGMA busy_timeout = 5000');

    const schema = readFileSync(SCHEMA_PATH, 'utf-8');
    _db.exec(schema);

    process.on('exit',    closeDb);
    process.on('SIGINT',  () => { closeDb(); process.exit(0); });
    process.on('SIGTERM', () => { closeDb(); process.exit(0); });
  }
  return _db;
}

export function queryAll<T>(
  db: DatabaseSync,
  sql: string,
  params: readonly unknown[] = [],
): T[] {
  // Cast needed: node:sqlite types params as SQLInputValue[], our helpers accept unknown[]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return db.prepare(sql).all(...(params as any[])) as T[];
}

export function queryOne<T>(
  db: DatabaseSync,
  sql: string,
  params: readonly unknown[] = [],
): T | undefined {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return db.prepare(sql).get(...(params as any[])) as T | undefined;
}

export function execute(
  db: DatabaseSync,
  sql: string,
  params: readonly unknown[] = [],
): RunResult {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return db.prepare(sql).run(...(params as any[]));
}

/**
 * Выполняет несколько операций в одной транзакции.
 * node:sqlite не имеет transaction() — используем ручной BEGIN/COMMIT/ROLLBACK.
 */
export function withTransaction<T>(db: DatabaseSync, fn: () => T): T {
  db.exec('BEGIN');
  try {
    const result = fn();
    db.exec('COMMIT');
    return result;
  } catch (err) {
    try { db.exec('ROLLBACK'); } catch { /* ignore */ }
    throw err;
  }
}

export function newId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  const hex = Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;
}
