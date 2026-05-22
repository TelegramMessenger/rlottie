-- ================================================================
-- BAZZAR — схема базы данных SQLite
-- ================================================================
-- Правила:
--   • UUID как TEXT PRIMARY KEY (совместимость с фронтом)
--   • created_at / updated_at — ISO 8601, DEFAULT (datetime('now'))
--   • Каскадное удаление через ON DELETE CASCADE
-- ================================================================

PRAGMA journal_mode = WAL;   -- Write-Ahead Logging: ускоряет конкурентные запросы
PRAGMA foreign_keys = ON;    -- Включить проверку внешних ключей

-- ── Пользователи (аутентификация) ────────────────────────────────
-- Отделены от employees: user = учётная запись, employee = HR-профиль.
-- Связь опциональная: один user может быть привязан к employee (user_id в employees).
CREATE TABLE IF NOT EXISTS users (
  id            TEXT    PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  email         TEXT    NOT NULL UNIQUE COLLATE NOCASE,
  password_hash TEXT    NOT NULL,
  salt          TEXT    NOT NULL,
  name          TEXT    NOT NULL,
  role          TEXT    NOT NULL DEFAULT 'employee'
                        CHECK (role IN ('admin','manager','employee')),
  created_at    TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- ── Проекты ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS projects (
  id           TEXT    PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  name         TEXT    NOT NULL,
  description  TEXT    NOT NULL DEFAULT '',
  icon         TEXT    NOT NULL DEFAULT '📁',
  icon_bg      TEXT    NOT NULL DEFAULT 'rgba(170,255,71,.15)',
  icon_color   TEXT    NOT NULL DEFAULT 'var(--accent)',
  accent_color TEXT    NOT NULL DEFAULT 'var(--accent)',
  status       TEXT    NOT NULL DEFAULT 'active'
                       CHECK (status IN ('active','archived','paused')),
  budget       INTEGER NOT NULL DEFAULT 0,
  created_at   TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at   TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- ── Сотрудники ───────────────────────────────────────────────────
-- user_id — опциональная ссылка на учётную запись сотрудника.
CREATE TABLE IF NOT EXISTS employees (
  id               TEXT    PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  user_id          TEXT    REFERENCES users(id) ON DELETE SET NULL,
  name             TEXT    NOT NULL,
  role             TEXT    NOT NULL,
  email            TEXT    NOT NULL UNIQUE,
  avatar_initials  TEXT    NOT NULL,
  avatar_bg        TEXT    NOT NULL DEFAULT 'rgba(170,255,71,.15)',
  avatar_color     TEXT    NOT NULL DEFAULT 'var(--accent)',
  kpi              INTEGER NOT NULL DEFAULT 80
                           CHECK (kpi BETWEEN 0 AND 100),
  salary           INTEGER NOT NULL DEFAULT 0,
  is_online        INTEGER NOT NULL DEFAULT 0,   -- 0/1 (SQLite bool)
  department       TEXT    NOT NULL DEFAULT 'engineering',
  created_at       TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- ── Привязка сотрудников к проектам (many-to-many) ───────────────
CREATE TABLE IF NOT EXISTS project_members (
  project_id  TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  employee_id TEXT NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  joined_at   TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (project_id, employee_id)
);

-- ── Задачи ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tasks (
  id          TEXT    PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  project_id  TEXT    NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title       TEXT    NOT NULL,
  description TEXT    NOT NULL DEFAULT '',
  status      TEXT    NOT NULL DEFAULT 'backlog'
                      CHECK (status IN ('backlog','in_progress','review','done')),
  tag         TEXT    NOT NULL DEFAULT 'dev'
                      CHECK (tag IN ('dev','design','ops','bug','marketing')),
  assignee_id TEXT    REFERENCES employees(id) ON DELETE SET NULL,
  due_date    TEXT,
  created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- ── Финансы ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS finance (
  id          TEXT    PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  project_id  TEXT    REFERENCES projects(id) ON DELETE SET NULL,
  description TEXT    NOT NULL,
  category    TEXT    NOT NULL DEFAULT 'dev'
                      CHECK (category IN ('dev','design','ops','bug','marketing','salary')),
  amount      INTEGER NOT NULL,
  status      TEXT    NOT NULL DEFAULT 'pending'
                      CHECK (status IN ('paid','pending','cancelled')),
  date        TEXT    NOT NULL DEFAULT (date('now')),
  created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- ── Сообщения (чат по проектам) ──────────────────────────────────
-- author_id ссылается на users(id) — сообщения пишут аутентифицированные пользователи.
CREATE TABLE IF NOT EXISTS messages (
  id          TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  project_id  TEXT REFERENCES projects(id) ON DELETE CASCADE,
  channel     TEXT NOT NULL DEFAULT 'general',
  author_id   TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  author_name TEXT NOT NULL,
  content     TEXT NOT NULL,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ── AI задачи (очередь KIE.AI) ───────────────────────────────────
CREATE TABLE IF NOT EXISTS ai_jobs (
  id          TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  user_id     TEXT REFERENCES users(id) ON DELETE SET NULL,
  type        TEXT NOT NULL,
  status      TEXT NOT NULL DEFAULT 'queued'
                   CHECK (status IN ('queued','processing','success','failed')),
  prompt      TEXT NOT NULL,
  options     TEXT NOT NULL DEFAULT '{}',  -- JSON с доп. параметрами
  kie_task_id TEXT,                        -- taskId от KIE.AI
  result_url  TEXT,                        -- URL результата
  error       TEXT,                        -- сообщение об ошибке
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ── Уведомления ──────────────────────────────────────────────────
-- user_id вместо employee_id: уведомления адресованы пользователю (учётной записи).
CREATE TABLE IF NOT EXISTS notifications (
  id         TEXT    PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  user_id    TEXT    REFERENCES users(id) ON DELETE CASCADE,
  type       TEXT    NOT NULL DEFAULT 'info'
                     CHECK (type IN ('info','success','warning','error')),
  title      TEXT    NOT NULL,
  body       TEXT    NOT NULL DEFAULT '',
  is_read    INTEGER NOT NULL DEFAULT 0,
  created_at TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- ── Журнал аудита (изменения через admin panel) ─────────────────
CREATE TABLE IF NOT EXISTS audit_log (
  id          TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  table_name  TEXT NOT NULL,
  action      TEXT NOT NULL CHECK (action IN ('create','update','delete')),
  row_id      TEXT NOT NULL,
  changed_by  TEXT REFERENCES users(id) ON DELETE SET NULL,
  old_data    TEXT,   -- JSON snapshot before change
  new_data    TEXT,   -- JSON snapshot after change
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ── Индексы для производительности ──────────────────────────────
CREATE INDEX IF NOT EXISTS idx_users_email        ON users(email);
CREATE INDEX IF NOT EXISTS idx_employees_user     ON employees(user_id);
CREATE INDEX IF NOT EXISTS idx_tasks_assignee     ON tasks(assignee_id);
CREATE INDEX IF NOT EXISTS idx_ai_jobs_kie        ON ai_jobs(kie_task_id);
CREATE INDEX IF NOT EXISTS idx_ai_jobs_user       ON ai_jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_table        ON audit_log(table_name, created_at);
CREATE INDEX IF NOT EXISTS idx_audit_user         ON audit_log(changed_by, created_at);
CREATE INDEX IF NOT EXISTS idx_tasks_project      ON tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status       ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_finance_project    ON finance(project_id);
CREATE INDEX IF NOT EXISTS idx_messages_project   ON messages(project_id, channel);
CREATE INDEX IF NOT EXISTS idx_messages_author    ON messages(author_id);
CREATE INDEX IF NOT EXISTS idx_ai_jobs_status     ON ai_jobs(status);
CREATE INDEX IF NOT EXISTS idx_notif_user         ON notifications(user_id, is_read);
