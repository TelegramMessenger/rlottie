/**
 * @file src/client/pages/DatabasePage.tsx
 * Страница администратора: просмотр, редактирование и мониторинг БД.
 * Доступна только пользователям с role === 'admin'.
 */

import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Database, RefreshCw, Search, Edit2, Trash2,
  ChevronLeft, ChevronRight, FileText, AlertTriangle,
  Eye, Clock, Table2, Shield,
} from 'lucide-react';
import { adminApi, type ColumnInfo, type AuditEntry } from '../api/adminApi';
import { Spinner } from '../components/ui/Spinner';
import { Modal } from '../components/ui/Modal';
import { getAuthUser } from '../auth/auth';

// ── Утилиты ───────────────────────────────────────────────────────

function fmtBytes(b: number): string {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1024 / 1024).toFixed(2)} MB`;
}

function fmtDate(s: string | null): string {
  if (!s) return '—';
  return new Date(s).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function cellValue(v: unknown): string {
  if (v === null || v === undefined) return '';
  if (typeof v === 'string' && v.length > 60) return v.slice(0, 60) + '…';
  return String(v);
}

const TABLE_LABELS: Record<string, string> = {
  users: 'Пользователи',
  employees: 'Сотрудники',
  projects: 'Проекты',
  tasks: 'Задачи',
  finance: 'Финансы',
  messages: 'Сообщения',
  ai_jobs: 'AI задачи',
  notifications: 'Уведомления',
  project_members: 'Участники проектов',
  audit_log: 'Журнал аудита',
};

const ACTION_COLOR: Record<string, string> = {
  create: 'var(--accent)',
  update: 'var(--yellow)',
  delete: '#ef4444',
};

// ── Компонент: статистика вверху ──────────────────────────────────

function StatsBar({ onRefresh }: { onRefresh: () => void }) {
  const { data, isFetching } = useQuery({
    queryKey: ['admin', 'stats'],
    queryFn: adminApi.stats,
    staleTime: 10_000,
  });

  const totalRows = data
    ? Object.values(data.tables).reduce((s, t) => s + t.rows, 0)
    : 0;

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24, flexWrap: 'wrap' }}>
      <div className="card" style={{ padding: '10px 18px', display: 'flex', alignItems: 'center', gap: 10, minWidth: 160 }}>
        <Database size={16} style={{ color: 'var(--accent)' }} />
        <div>
          <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>Размер файла</div>
          <div style={{ fontSize: 14, fontWeight: 700 }}>{data ? fmtBytes(data.file_size_bytes) : '—'}</div>
        </div>
      </div>
      <div className="card" style={{ padding: '10px 18px', display: 'flex', alignItems: 'center', gap: 10, minWidth: 140 }}>
        <Table2 size={16} style={{ color: '#47C8FF' }} />
        <div>
          <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>Таблиц</div>
          <div style={{ fontSize: 14, fontWeight: 700 }}>{data ? Object.keys(data.tables).length : '—'}</div>
        </div>
      </div>
      <div className="card" style={{ padding: '10px 18px', display: 'flex', alignItems: 'center', gap: 10, minWidth: 140 }}>
        <FileText size={16} style={{ color: '#C847FF' }} />
        <div>
          <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>Всего записей</div>
          <div style={{ fontSize: 14, fontWeight: 700 }}>{totalRows.toLocaleString('ru-RU')}</div>
        </div>
      </div>
      <button
        className="btn btn-ghost btn-sm"
        onClick={onRefresh}
        style={{ marginLeft: 'auto' }}
        title="Обновить"
      >
        <RefreshCw size={14} style={{ animation: isFetching ? 'spin 1s linear infinite' : undefined }} />
        Обновить
      </button>
    </div>
  );
}

// ── Компонент: список таблиц слева ────────────────────────────────

function TableList({
  selected,
  onSelect,
}: {
  selected: string | null;
  onSelect: (t: string) => void;
}) {
  const { data: stats } = useQuery({
    queryKey: ['admin', 'stats'],
    queryFn: adminApi.stats,
    staleTime: 10_000,
  });

  const tables = stats ? Object.entries(stats.tables) : [];

  return (
    <div className="card" style={{ padding: 0, width: 200, flexShrink: 0, overflow: 'hidden' }}>
      <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--border)', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '.06em' }}>
        ТАБЛИЦЫ
      </div>
      <div style={{ overflow: 'auto', maxHeight: 480 }}>
        {tables.map(([name, info]) => (
          <button
            key={name}
            onClick={() => onSelect(name)}
            style={{
              width: '100%', textAlign: 'left', border: 'none', cursor: 'pointer',
              padding: '9px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              background: selected === name ? 'var(--accent-dim)' : 'transparent',
              color: selected === name ? 'var(--accent)' : 'var(--text-primary)',
              borderLeft: selected === name ? '2px solid var(--accent)' : '2px solid transparent',
              fontSize: 12, fontWeight: selected === name ? 600 : 400,
              transition: 'all .1s',
            }}
          >
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {TABLE_LABELS[name] ?? name}
            </span>
            <span style={{
              fontSize: 10, background: 'var(--bg-card2)', borderRadius: 10,
              padding: '1px 6px', color: 'var(--text-muted)', flexShrink: 0, marginLeft: 4,
            }}>
              {info.rows}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Компонент: модалка редактирования строки ──────────────────────

function RowEditModal({
  table,
  row,
  columns,
  open,
  onClose,
}: {
  table: string;
  row: Record<string, unknown>;
  columns: ColumnInfo[];
  open: boolean;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [values, setValues] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    for (const col of columns) {
      init[col.name] = row[col.name] != null ? String(row[col.name]) : '';
    }
    return init;
  });

  const forbidden = new Set(['password_hash', 'salt', 'id', 'created_at']);
  const editableCols = columns.filter(c => !forbidden.has(c.name));

  const mutation = useMutation({
    mutationFn: () => {
      const body: Record<string, unknown> = {};
      for (const col of editableCols) {
        const v = values[col.name] ?? '';
        const isInt = col.type.toUpperCase().includes('INT');
        body[col.name] = isInt ? (v === '' ? null : Number(v)) : (v === '' ? null : v);
      }
      return adminApi.updateRow(table, String(row['id']), body);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['admin', 'table', table] });
      onClose();
    },
  });

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Редактировать запись`}
      footer={
        <>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>Отмена</button>
          <button
            className="btn btn-primary btn-sm"
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending}
          >
            {mutation.isPending ? <Spinner size={12} /> : 'Сохранить'}
          </button>
        </>
      }
    >
      {/* Readonly info */}
      <div style={{ marginBottom: 16, padding: '8px 12px', background: 'var(--bg-secondary)', borderRadius: 8, fontSize: 11, color: 'var(--text-muted)' }}>
        <span style={{ color: 'var(--text-sub)', fontWeight: 600 }}>ID:</span> {String(row['id'])}
        {row['created_at'] ? (
          <><span style={{ marginLeft: 16, color: 'var(--text-sub)', fontWeight: 600 }}>Создано:</span> {fmtDate(String(row['created_at']))}</>
        ) : null}
      </div>

      {mutation.isError && (
        <div style={{ color: '#ef4444', fontSize: 12, marginBottom: 12, display: 'flex', gap: 6, alignItems: 'center' }}>
          <AlertTriangle size={13} /> {mutation.error.message}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        {editableCols.map(col => {
          const isLong = col.type.toUpperCase() === 'TEXT' && (String(values[col.name] ?? '').length > 60);
          const isInt  = col.type.toUpperCase().includes('INT');
          return (
            <div key={col.name} style={{ gridColumn: isLong ? '1 / -1' : undefined }}>
              <label className="form-label" style={{ fontSize: 10 }}>
                {col.name}
                {col.notnull ? ' *' : ''}
                <span style={{ marginLeft: 4, color: 'var(--text-muted)', fontWeight: 400 }}>{col.type || 'TEXT'}</span>
              </label>
              {isLong ? (
                <textarea
                  className="form-input"
                  rows={3}
                  value={values[col.name] ?? ''}
                  onChange={e => setValues(v => ({ ...v, [col.name]: e.target.value }))}
                  style={{ resize: 'vertical', fontSize: 12 }}
                />
              ) : (
                <input
                  className="form-input"
                  type={isInt ? 'number' : 'text'}
                  value={values[col.name] ?? ''}
                  onChange={e => setValues(v => ({ ...v, [col.name]: e.target.value }))}
                  style={{ fontSize: 12 }}
                />
              )}
            </div>
          );
        })}
      </div>
    </Modal>
  );
}

// ── Компонент: таблица данных ─────────────────────────────────────

function TableDataView({ table, columns }: { table: string; columns: ColumnInfo[] }) {
  const qc = useQueryClient();
  const [page,   setPage]   = useState(1);
  const [search, setSearch] = useState('');
  const [query,  setQuery]  = useState('');
  const [editRow, setEditRow] = useState<Record<string, unknown> | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'table', table, page, query],
    queryFn: () => {
      const params: { page: number; limit: number; q?: string } = { page, limit: 30 };
      if (query) params.q = query;
      return adminApi.rows(table, params);
    },
    staleTime: 5_000,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => adminApi.deleteRow(table, id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['admin', 'table', table] });
      void qc.invalidateQueries({ queryKey: ['admin', 'stats'] });
      setDeleteId(null);
    },
  });

  const visibleCols = columns
    .filter(c => !['password_hash', 'salt'].includes(c.name))
    .slice(0, 8);

  const handleSearch = () => { setPage(1); setQuery(search); };

  return (
    <div className="card" style={{ flex: 1, padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      {/* Шапка */}
      <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ fontSize: 13, fontWeight: 700, flex: 1 }}>
          {TABLE_LABELS[table] ?? table}
          <span style={{ fontWeight: 400, fontSize: 11, color: 'var(--text-muted)', marginLeft: 8 }}>
            {data?.meta ? `${data.meta.total} записей` : ''}
          </span>
        </span>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <div className="field-with-icon" style={{ width: 220 }}>
            <Search size={13} className="field-icon" />
            <input
              className="form-input"
              style={{ height: 30, fontSize: 12, paddingLeft: 30 }}
              placeholder="Поиск..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSearch()}
            />
          </div>
          <button className="btn btn-ghost btn-sm" style={{ height: 30, fontSize: 11 }} onClick={handleSearch}>
            Найти
          </button>
          {query && (
            <button className="btn btn-ghost btn-sm" style={{ height: 30, fontSize: 11, color: 'var(--text-muted)' }}
              onClick={() => { setSearch(''); setQuery(''); setPage(1); }}>
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Таблица */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        {isLoading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}>
            <Spinner size={24} />
          </div>
        ) : !data?.data.length ? (
          <div style={{ textAlign: 'center', padding: 48, color: 'var(--text-muted)', fontSize: 13 }}>
            {query ? 'Ничего не найдено' : 'Таблица пуста'}
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ background: 'var(--bg-secondary)' }}>
                {visibleCols.map(col => (
                  <th key={col.name} style={{
                    padding: '8px 12px', textAlign: 'left', fontWeight: 600, fontSize: 10,
                    color: 'var(--text-muted)', letterSpacing: '.06em', whiteSpace: 'nowrap',
                    borderBottom: '1px solid var(--border)',
                  }}>
                    {col.name.toUpperCase()}
                    {col.pk ? ' 🔑' : ''}
                  </th>
                ))}
                <th style={{ width: 72, borderBottom: '1px solid var(--border)' }} />
              </tr>
            </thead>
            <tbody>
              {data.data.map((row, i) => (
                <tr key={String(row['id'] ?? i)} style={{ borderBottom: '1px solid var(--border)', transition: 'background .1s' }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-secondary)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                  {visibleCols.map(col => (
                    <td key={col.name} style={{ padding: '8px 12px', color: 'var(--text-sub)', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {col.name === 'role' ? (
                        <span style={{
                          fontSize: 10, padding: '2px 7px', borderRadius: 10, fontWeight: 600,
                          background: row[col.name] === 'admin' ? 'rgba(239,68,68,.15)' : row[col.name] === 'manager' ? 'rgba(255,209,102,.15)' : 'var(--bg-card2)',
                          color: row[col.name] === 'admin' ? '#ef4444' : row[col.name] === 'manager' ? 'var(--yellow)' : 'var(--text-muted)',
                        }}>
                          {String(row[col.name] ?? '')}
                        </span>
                      ) : col.name === 'status' ? (
                        <span style={{
                          fontSize: 10, padding: '2px 7px', borderRadius: 10, fontWeight: 600,
                          background: 'var(--accent-dim)', color: 'var(--accent)',
                        }}>
                          {String(row[col.name] ?? '')}
                        </span>
                      ) : (
                        <span title={String(row[col.name] ?? '')}>{cellValue(row[col.name])}</span>
                      )}
                    </td>
                  ))}
                  <td style={{ padding: '6px 10px', whiteSpace: 'nowrap' }}>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button className="btn-icon" title="Редактировать" style={{ width: 26, height: 26 }}
                        onClick={() => setEditRow(row)}>
                        <Edit2 size={12} />
                      </button>
                      <button className="btn-icon" title="Удалить" style={{ width: 26, height: 26, color: '#ef4444' }}
                        onClick={() => setDeleteId(String(row['id']))}>
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Пагинация */}
      {data?.meta && data.meta.pages > 1 && (
        <div style={{ padding: '10px 16px', borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 12, fontSize: 12 }}>
          <button className="btn-icon" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
            <ChevronLeft size={14} />
          </button>
          <span style={{ color: 'var(--text-muted)' }}>
            Страница <strong style={{ color: 'var(--text-primary)' }}>{page}</strong> из {data.meta.pages}
          </span>
          <button className="btn-icon" disabled={page >= data.meta.pages} onClick={() => setPage(p => p + 1)}>
            <ChevronRight size={14} />
          </button>
          <span style={{ marginLeft: 'auto', color: 'var(--text-muted)' }}>
            {data.meta.total} записей
          </span>
        </div>
      )}

      {/* Edit modal */}
      {editRow && (
        <RowEditModal
          table={table}
          row={editRow}
          columns={columns}
          open={!!editRow}
          onClose={() => setEditRow(null)}
        />
      )}

      {/* Delete confirm modal */}
      <Modal
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        title="Удалить запись?"
        footer={
          <>
            <button className="btn btn-ghost btn-sm" onClick={() => setDeleteId(null)}>Отмена</button>
            <button
              className="btn btn-sm"
              style={{ background: '#ef4444', color: '#fff' }}
              onClick={() => deleteId && deleteMutation.mutate(deleteId)}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? <Spinner size={12} /> : 'Удалить'}
            </button>
          </>
        }
      >
        <div style={{ fontSize: 13, color: 'var(--text-sub)' }}>
          Запись <code style={{ background: 'var(--bg-secondary)', padding: '1px 6px', borderRadius: 4, fontSize: 11 }}>{deleteId}</code> будет удалена навсегда. Это действие нельзя отменить.
        </div>
        {deleteMutation.isError && (
          <div style={{ color: '#ef4444', fontSize: 12, marginTop: 8 }}>{deleteMutation.error.message}</div>
        )}
      </Modal>
    </div>
  );
}

// ── Компонент: журнал аудита ─────────────────────────────────────

function AuditLogView() {
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'audit', page],
    queryFn: () => adminApi.auditLog({ page, limit: 40 }),
    staleTime: 5_000,
  });

  function parseJson(s: string | null): string {
    if (!s) return '—';
    try {
      return JSON.stringify(JSON.parse(s), null, 2);
    } catch {
      return s;
    }
  }

  return (
    <div className="card" style={{ flex: 1, padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8 }}>
        <Clock size={14} style={{ color: 'var(--accent)' }} />
        <span style={{ fontSize: 13, fontWeight: 700 }}>
          Журнал аудита
          {data?.meta && <span style={{ fontWeight: 400, fontSize: 11, color: 'var(--text-muted)', marginLeft: 8 }}>{data.meta.total} событий</span>}
        </span>
      </div>

      <div style={{ flex: 1, overflow: 'auto' }}>
        {isLoading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}><Spinner size={24} /></div>
        ) : !data?.data.length ? (
          <div style={{ textAlign: 'center', padding: 48, color: 'var(--text-muted)', fontSize: 13 }}>Нет записей</div>
        ) : (
          <div>
            {data.data.map((entry: AuditEntry) => (
              <div key={entry.id} style={{
                padding: '12px 16px', borderBottom: '1px solid var(--border)',
                display: 'grid', gridTemplateColumns: 'auto auto auto 1fr auto', gap: 12, alignItems: 'start',
              }}>
                <span style={{
                  fontSize: 10, padding: '2px 8px', borderRadius: 10, fontWeight: 700, whiteSpace: 'nowrap',
                  background: `${ACTION_COLOR[entry.action] ?? '#888'}22`,
                  color: ACTION_COLOR[entry.action] ?? '#888',
                }}>
                  {entry.action.toUpperCase()}
                </span>
                <span style={{ fontSize: 11, color: 'var(--accent)', fontWeight: 600, whiteSpace: 'nowrap' }}>
                  {TABLE_LABELS[entry.table_name] ?? entry.table_name}
                </span>
                <span style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'monospace', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 160 }}>
                  {entry.row_id}
                </span>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', overflow: 'hidden' }}>
                  {entry.action === 'update' && entry.new_data && (
                    <details style={{ cursor: 'pointer' }}>
                      <summary style={{ userSelect: 'none', color: 'var(--text-sub)' }}>Изменения</summary>
                      <pre style={{ fontSize: 10, marginTop: 6, background: 'var(--bg-secondary)', padding: 8, borderRadius: 6, overflow: 'auto', maxHeight: 160 }}>
                        {parseJson(entry.new_data)}
                      </pre>
                    </details>
                  )}
                  {entry.action === 'delete' && entry.old_data && (
                    <details style={{ cursor: 'pointer' }}>
                      <summary style={{ userSelect: 'none', color: '#ef4444' }}>Удалённые данные</summary>
                      <pre style={{ fontSize: 10, marginTop: 6, background: 'rgba(239,68,68,.05)', padding: 8, borderRadius: 6, overflow: 'auto', maxHeight: 160 }}>
                        {parseJson(entry.old_data)}
                      </pre>
                    </details>
                  )}
                </div>
                <span style={{ fontSize: 10, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                  {fmtDate(entry.created_at)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {data?.meta && data.meta.pages > 1 && (
        <div style={{ padding: '10px 16px', borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 12, fontSize: 12 }}>
          <button className="btn-icon" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
            <ChevronLeft size={14} />
          </button>
          <span style={{ color: 'var(--text-muted)' }}>
            <strong style={{ color: 'var(--text-primary)' }}>{page}</strong> / {data.meta.pages}
          </span>
          <button className="btn-icon" disabled={page >= data.meta.pages} onClick={() => setPage(p => p + 1)}>
            <ChevronRight size={14} />
          </button>
        </div>
      )}
    </div>
  );
}

// ── Главный компонент страницы ────────────────────────────────────

export default function DatabasePage() {
  const user = getAuthUser();
  const qc   = useQueryClient();

  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const [activeTab, setActiveTab]         = useState<'tables' | 'audit'>('tables');

  const { data: schemas } = useQuery({
    queryKey: ['admin', 'schemas'],
    queryFn: adminApi.tables,
    staleTime: 60_000,
  });

  const selectedSchema = schemas?.find(s => s.name === selectedTable);

  const handleRefresh = () => {
    void qc.invalidateQueries({ queryKey: ['admin'] });
  };

  if (user?.role !== 'admin') {
    return (
      <div style={{ padding: 32 }}>
        <div className="card" style={{ padding: 32, textAlign: 'center' }}>
          <Shield size={40} style={{ color: '#ef4444', margin: '0 auto 12px' }} />
          <h2 style={{ margin: '0 0 8px', fontSize: 16 }}>Доступ запрещён</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>Страница доступна только администраторам.</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: 32 }}>
      {/* Заголовок */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Database size={20} style={{ color: 'var(--accent)' }} />
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>База данных</h1>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>SQLite · Просмотр и редактирование</div>
          </div>
        </div>

        {/* Вкладки */}
        <div style={{ display: 'flex', background: 'var(--bg-secondary)', borderRadius: 8, padding: 3, gap: 2 }}>
          {([
            { id: 'tables', label: 'Таблицы',   icon: <Table2 size={13} /> },
            { id: 'audit',  label: 'Аудит',      icon: <Clock size={13} /> },
          ] as const).map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                border: 'none', cursor: 'pointer', padding: '6px 14px', borderRadius: 6, fontSize: 12, fontWeight: 600,
                background: activeTab === tab.id ? 'var(--bg-card)' : 'transparent',
                color: activeTab === tab.id ? 'var(--text-primary)' : 'var(--text-muted)',
                display: 'flex', alignItems: 'center', gap: 6,
                boxShadow: activeTab === tab.id ? '0 1px 3px rgba(0,0,0,.2)' : 'none',
                transition: 'all .15s',
              }}
            >
              {tab.icon}{tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Статистика */}
      <StatsBar onRefresh={handleRefresh} />

      {activeTab === 'tables' ? (
        <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
          {/* Список таблиц */}
          <TableList
            selected={selectedTable}
            onSelect={t => { setSelectedTable(t); }}
          />

          {/* Данные таблицы / подсказка */}
          {selectedTable && selectedSchema ? (
            <TableDataView
              key={selectedTable}
              table={selectedTable}
              columns={selectedSchema.columns}
            />
          ) : (
            <div className="card" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 300 }}>
              <div style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                <Eye size={32} style={{ margin: '0 auto 12px', opacity: .4 }} />
                <div style={{ fontSize: 13 }}>Выберите таблицу слева</div>
              </div>
            </div>
          )}
        </div>
      ) : (
        <AuditLogView />
      )}
    </div>
  );
}
