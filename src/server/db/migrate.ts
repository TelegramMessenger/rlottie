/**
 * @file src/server/db/migrate.ts
 * Инициализация / миграция базы данных.
 *
 * Запуск: npm run db:init
 *
 * Применяет schema.sql (CREATE TABLE IF NOT EXISTS — безопасно повторять).
 * В будущем сюда можно добавить версионированные миграции через
 * таблицу schema_migrations.
 */

import { getDb } from '../services/database.js';

console.log('🗄️  Инициализация базы данных...');

try {
  const db = getDb();

  // Проверяем что БД создалась корректно
  const tables = db.prepare(
    "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name",
  ).all() as Array<{ name: string }>;

  console.log(`\n✅ База данных готова: ${tables.length} таблиц`);
  tables.forEach(t => console.log(`   • ${t.name}`));
  console.log();
} catch (err) {
  console.error('❌ Ошибка инициализации БД:', err);
  process.exit(1);
}

process.exit(0);
