/**
 * @file src/client/api/adminApi.ts
 * Типизированный клиент для admin DB API.
 * Отдельный модуль, т.к. paginated-ответы возвращают data + meta одновременно.
 */

import { getToken, logout } from '../auth/auth';

export interface ColumnInfo {
  cid: number;
  name: string;
  type: string;
  notnull: number;
  dflt_value: unknown;
  pk: number;
}

export interface TableSchema {
  name: string;
  columns: ColumnInfo[];
}

export interface TableStats {
  file_size_bytes: number;
  tables: Record<string, { rows: number; last_created_at: string | null }>;
}

export interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  pages: number;
}

export interface PaginatedResult<T> {
  data: T[];
  meta: PaginationMeta;
}

export interface AuditEntry {
  id: string;
  table_name: string;
  action: 'create' | 'update' | 'delete';
  row_id: string;
  changed_by: string | null;
  old_data: string | null;
  new_data: string | null;
  created_at: string;
}

async function adminFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  const res = await fetch(path, { ...init, headers: { ...headers, ...(init?.headers ?? {}) } });

  if (res.status === 401) {
    logout();
    window.location.href = '/login';
    throw new Error('Сессия истекла');
  }

  const json = await res.json() as { ok: boolean; error?: string; data?: unknown; meta?: PaginationMeta };
  if (!json.ok) throw new Error(json.error ?? 'Ошибка сервера');
  return json as T;
}

export const adminApi = {
  stats: () =>
    adminFetch<{ ok: true; data: TableStats }>('/api/admin/db/stats')
      .then(r => r.data),

  tables: () =>
    adminFetch<{ ok: true; data: TableSchema[] }>('/api/admin/db/tables')
      .then(r => r.data),

  rows: (table: string, params: { page?: number; limit?: number; q?: string }) => {
    const qs = new URLSearchParams();
    if (params.page)  qs.set('page',  String(params.page));
    if (params.limit) qs.set('limit', String(params.limit));
    if (params.q)     qs.set('q',     params.q);
    return adminFetch<{ ok: true; data: Record<string, unknown>[]; meta: PaginationMeta }>(
      `/api/admin/db/${table}?${qs}`,
    ).then(r => ({ data: r.data, meta: r.meta }));
  },

  updateRow: (table: string, id: string, body: Record<string, unknown>) =>
    adminFetch<{ ok: true; data: Record<string, unknown> }>(
      `/api/admin/db/${table}/${id}`,
      { method: 'PATCH', body: JSON.stringify(body) },
    ).then(r => r.data),

  deleteRow: (table: string, id: string) =>
    adminFetch<{ ok: true; data: { id: string } }>(
      `/api/admin/db/${table}/${id}`,
      { method: 'DELETE' },
    ).then(r => r.data),

  auditLog: (params: { page?: number; limit?: number }) => {
    const qs = new URLSearchParams();
    if (params.page)  qs.set('page',  String(params.page));
    if (params.limit) qs.set('limit', String(params.limit));
    return adminFetch<{ ok: true; data: AuditEntry[]; meta: PaginationMeta }>(
      `/api/admin/audit?${qs}`,
    ).then(r => ({ data: r.data, meta: r.meta }));
  },
};
