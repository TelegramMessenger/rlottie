/**
 * @file src/server/routes/admin.ts
 * Admin panel — database inspection & management API.
 *
 * All routes require a valid JWT *and* role === 'admin'.
 * Table names and column names are whitelisted via sqlite_master /
 * PRAGMA table_info before being interpolated into SQL — no raw
 * user-supplied identifiers ever reach the query engine.
 *
 * GET  /api/admin/db/stats           — DB file size + per-table stats
 * GET  /api/admin/db/tables          — all tables with column info
 * GET  /api/admin/db/:table          — paginated rows (page, limit, q)
 * GET  /api/admin/db/:table/:id      — single row by id
 * PATCH /api/admin/db/:table/:id     — update arbitrary columns
 * DELETE /api/admin/db/:table/:id    — delete row
 * GET  /api/admin/audit              — paginated audit_log (newest first)
 */

import fs from 'fs';
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { getDb, queryAll, queryOne, execute, newId } from '../services/database.js';
import { authenticate } from '../middleware/authenticate.js';
import { Config } from '../config.js';

// ── Types ─────────────────────────────────────────────────────────

interface ColumnInfo {
  cid: number;
  name: string;
  type: string;
  notnull: number;
  dflt_value: unknown;
  pk: number;
}

interface SqliteMasterRow {
  name: string;
}

interface TableStatRow {
  cnt: number;
  last_created: string | null;
}

interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  pages: number;
}

// ── Helpers ───────────────────────────────────────────────────────

/** Returns the set of user-facing table names from sqlite_master. */
function getAllowedTables(db: ReturnType<typeof getDb>): Set<string> {
  const rows = queryAll<SqliteMasterRow>(
    db,
    `SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'`,
  );
  return new Set(rows.map(r => r.name));
}

/** Returns column metadata for a table (whitelisted). */
function getColumnInfo(db: ReturnType<typeof getDb>, table: string): ColumnInfo[] {
  // table name already validated against allowedTables — safe to interpolate
  return queryAll<ColumnInfo>(db, `PRAGMA table_info("${table}")`);
}

/** Admin guard — call after authenticate. Returns true if the handler should continue. */
async function requireAdmin(req: FastifyRequest, reply: FastifyReply): Promise<boolean> {
  if (req.user?.role !== 'admin') {
    await reply.status(403).send({ ok: false, error: 'Доступ только для администраторов' });
    return false;
  }
  return true;
}

/** Clamp & parse pagination params. */
function parsePagination(query: Record<string, string | undefined>): { page: number; limit: number; offset: number } {
  const page  = Math.max(1, parseInt(query['page']  ?? '1',  10) || 1);
  const limit = Math.min(200, Math.max(1, parseInt(query['limit'] ?? '50', 10) || 50));
  return { page, limit, offset: (page - 1) * limit };
}

/** Columns that must never be updated via the admin API. */
const FORBIDDEN_COLUMNS = new Set(['password_hash', 'salt']);

/** Insert a row into audit_log. Silently swallows errors so auditing never breaks the main op. */
function writeAuditLog(
  db: ReturnType<typeof getDb>,
  tableName: string,
  action: 'create' | 'update' | 'delete',
  rowId: string,
  changedBy: string,
  oldData: unknown,
  newData: unknown,
): void {
  try {
    execute(db,
      `INSERT INTO audit_log (id, table_name, action, row_id, changed_by, old_data, new_data)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        newId(),
        tableName,
        action,
        rowId,
        changedBy,
        oldData != null ? JSON.stringify(oldData) : null,
        newData != null ? JSON.stringify(newData) : null,
      ],
    );
  } catch {
    // Auditing must not break admin operations — log silently
  }
}

// ── Route plugin ──────────────────────────────────────────────────

export default async function adminRoutes(app: FastifyInstance): Promise<void> {
  const db = getDb();

  // ── GET /api/admin/db/stats ──────────────────────────────────────
  // Returns: DB file size in bytes + per-table { rows, last_created_at }
  app.get(
    '/api/admin/db/stats',
    { preHandler: authenticate },
    async (req, reply) => {
      if (!(await requireAdmin(req, reply))) return;

      let fileSize = 0;
      try {
        fileSize = fs.statSync(Config.DB_PATH).size;
      } catch {
        // DB file may not exist yet (in-memory / first run)
      }

      const tables = getAllowedTables(db);
      const tableStats: Record<string, { rows: number; last_created_at: string | null }> = {};

      for (const table of tables) {
        // Check whether the table has a created_at column
        const cols = getColumnInfo(db, table);
        const hasCreatedAt = cols.some(c => c.name === 'created_at');

        const selectLastCreated = hasCreatedAt
          ? `MAX(created_at)`
          : `NULL`;

        const row = queryOne<TableStatRow>(
          db,
          `SELECT COUNT(*) as cnt, ${selectLastCreated} as last_created FROM "${table}"`,
        );

        tableStats[table] = {
          rows: row?.cnt ?? 0,
          last_created_at: row?.last_created ?? null,
        };
      }

      return reply.send({
        ok: true,
        data: {
          file_size_bytes: fileSize,
          tables: tableStats,
        },
      });
    },
  );

  // ── GET /api/admin/db/tables ─────────────────────────────────────
  // Returns list of all tables + PRAGMA table_info for each
  app.get(
    '/api/admin/db/tables',
    { preHandler: authenticate },
    async (req, reply) => {
      if (!(await requireAdmin(req, reply))) return;

      const tables = getAllowedTables(db);
      const result = Array.from(tables).map(table => ({
        name:    table,
        columns: getColumnInfo(db, table),
      }));

      return reply.send({ ok: true, data: result });
    },
  );

  // ── GET /api/admin/db/:table ─────────────────────────────────────
  // Paginated rows with optional full-text search across TEXT columns
  app.get<{
    Params: { table: string };
    Querystring: { page?: string; limit?: string; q?: string };
  }>(
    '/api/admin/db/:table',
    { preHandler: authenticate },
    async (req, reply) => {
      if (!(await requireAdmin(req, reply))) return;

      const { table } = req.params;
      const allowedTables = getAllowedTables(db);
      if (!allowedTables.has(table)) {
        return reply.status(404).send({ ok: false, error: `Таблица не найдена: ${table}` });
      }

      const { page, limit, offset } = parsePagination(req.query as Record<string, string | undefined>);
      const q = req.query.q?.trim();

      // Build WHERE clause: search across all TEXT columns
      let where = '1=1';
      const params: unknown[] = [];

      if (q) {
        const cols = getColumnInfo(db, table);
        const textCols = cols.filter(c =>
          c.type.toUpperCase().includes('TEXT') ||
          c.type.toUpperCase().includes('CHAR') ||
          c.type === '',
        );

        if (textCols.length > 0) {
          const conditions = textCols.map(c => `"${c.name}" LIKE ?`).join(' OR ');
          where = `(${conditions})`;
          const likeVal = `%${q}%`;
          for (let i = 0; i < textCols.length; i++) params.push(likeVal);
        }
      }

      const countRow = queryOne<{ cnt: number }>(
        db,
        `SELECT COUNT(*) as cnt FROM "${table}" WHERE ${where}`,
        params,
      );
      const total = countRow?.cnt ?? 0;

      const rows = queryAll<Record<string, unknown>>(
        db,
        `SELECT * FROM "${table}" WHERE ${where} LIMIT ? OFFSET ?`,
        [...params, limit, offset],
      );

      const meta: PaginationMeta = {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit),
      };

      return reply.send({ ok: true, data: rows, meta });
    },
  );

  // ── GET /api/admin/db/:table/:id ─────────────────────────────────
  // Single row lookup by primary key column 'id'
  app.get<{
    Params: { table: string; id: string };
  }>(
    '/api/admin/db/:table/:id',
    { preHandler: authenticate },
    async (req, reply) => {
      if (!(await requireAdmin(req, reply))) return;

      const { table, id } = req.params;
      const allowedTables = getAllowedTables(db);
      if (!allowedTables.has(table)) {
        return reply.status(404).send({ ok: false, error: `Таблица не найдена: ${table}` });
      }

      const row = queryOne<Record<string, unknown>>(
        db,
        `SELECT * FROM "${table}" WHERE id = ?`,
        [id],
      );

      if (!row) {
        return reply.status(404).send({ ok: false, error: 'Запись не найдена' });
      }

      return reply.send({ ok: true, data: row });
    },
  );

  // ── PATCH /api/admin/db/:table/:id ───────────────────────────────
  // Update arbitrary columns; password_hash/salt are silently skipped
  app.patch<{
    Params: { table: string; id: string };
    Body: Record<string, unknown>;
  }>(
    '/api/admin/db/:table/:id',
    { preHandler: authenticate },
    async (req, reply) => {
      if (!(await requireAdmin(req, reply))) return;

      const { table, id } = req.params;
      const allowedTables = getAllowedTables(db);
      if (!allowedTables.has(table)) {
        return reply.status(404).send({ ok: false, error: `Таблица не найдена: ${table}` });
      }

      // Fetch existing row (404 guard + old_data for audit)
      const existing = queryOne<Record<string, unknown>>(
        db,
        `SELECT * FROM "${table}" WHERE id = ?`,
        [id],
      );
      if (!existing) {
        return reply.status(404).send({ ok: false, error: 'Запись не найдена' });
      }

      // Whitelist columns via PRAGMA
      const colInfos  = getColumnInfo(db, table);
      const allowedCols = new Set(colInfos.map(c => c.name));

      const body = req.body ?? {};
      const setClauses: string[] = [];
      const values: unknown[]   = [];

      for (const [field, value] of Object.entries(body)) {
        if (FORBIDDEN_COLUMNS.has(field)) continue;     // silently skip
        if (!allowedCols.has(field))       continue;    // silently skip unknown cols
        setClauses.push(`"${field}" = ?`);
        values.push(value);
      }

      if (setClauses.length === 0) {
        return reply.status(400).send({ ok: false, error: 'Нет допустимых полей для обновления' });
      }

      values.push(id);
      execute(db, `UPDATE "${table}" SET ${setClauses.join(', ')} WHERE id = ?`, values);

      const updated = queryOne<Record<string, unknown>>(
        db,
        `SELECT * FROM "${table}" WHERE id = ?`,
        [id],
      );

      writeAuditLog(db, table, 'update', id, req.user!.sub, existing, updated);

      return reply.send({ ok: true, data: updated });
    },
  );

  // ── DELETE /api/admin/db/:table/:id ──────────────────────────────
  app.delete<{
    Params: { table: string; id: string };
  }>(
    '/api/admin/db/:table/:id',
    { preHandler: authenticate },
    async (req, reply) => {
      if (!(await requireAdmin(req, reply))) return;

      const { table, id } = req.params;
      const allowedTables = getAllowedTables(db);
      if (!allowedTables.has(table)) {
        return reply.status(404).send({ ok: false, error: `Таблица не найдена: ${table}` });
      }

      const existing = queryOne<Record<string, unknown>>(
        db,
        `SELECT * FROM "${table}" WHERE id = ?`,
        [id],
      );
      if (!existing) {
        return reply.status(404).send({ ok: false, error: 'Запись не найдена' });
      }

      execute(db, `DELETE FROM "${table}" WHERE id = ?`, [id]);

      writeAuditLog(db, table, 'delete', id, req.user!.sub, existing, null);

      return reply.send({ ok: true, data: { id } });
    },
  );

  // ── GET /api/admin/audit ─────────────────────────────────────────
  // Paginated audit_log entries, newest first
  app.get<{
    Querystring: { page?: string; limit?: string };
  }>(
    '/api/admin/audit',
    { preHandler: authenticate },
    async (req, reply) => {
      if (!(await requireAdmin(req, reply))) return;

      const { page, limit, offset } = parsePagination(req.query as Record<string, string | undefined>);

      const countRow = queryOne<{ cnt: number }>(db, `SELECT COUNT(*) as cnt FROM audit_log`);
      const total    = countRow?.cnt ?? 0;

      const rows = queryAll<Record<string, unknown>>(
        db,
        `SELECT * FROM audit_log ORDER BY created_at DESC LIMIT ? OFFSET ?`,
        [limit, offset],
      );

      const meta: PaginationMeta = {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit),
      };

      return reply.send({ ok: true, data: rows, meta });
    },
  );
}
