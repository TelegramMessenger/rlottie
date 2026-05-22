/**
 * @file shared/types.ts
 * Общие TypeScript-типы для frontend и backend.
 * Изменение этого файла требует обновления обеих сторон.
 */

// ── Утилиты ──────────────────────────────────────────────────────

/** ISO 8601 строка даты-времени */
export type ISODateTime = string;

/** UUID v4 */
export type UUID = string;

// ── Авторизация ───────────────────────────────────────────────────

/** Публичные данные пользователя (без хэша пароля) */
export interface UserPublic {
  id: UUID;
  email: string;
  name: string;
  role: 'admin' | 'manager' | 'employee';
  created_at: ISODateTime;
}

/** DTO для входа */
export interface LoginDto {
  email: string;
  password: string;
}

/** DTO для регистрации */
export interface RegisterDto {
  email: string;
  password: string;
  name: string;
}

/** Ответ сервера на /api/auth/login и /api/auth/register */
export interface AuthResponse {
  token: string;
  user:  UserPublic;
}

/** Статус задачи */
export type TaskStatus = 'backlog' | 'in_progress' | 'review' | 'done';

/** Тег задачи */
export type TaskTag = 'dev' | 'design' | 'ops' | 'bug' | 'marketing';

/** Статус транзакции */
export type FinanceStatus = 'paid' | 'pending' | 'cancelled';

/** Статус AI задачи в очереди KIE.AI */
export type AiJobStatus = 'queued' | 'processing' | 'success' | 'failed';

/** Тип AI операции */
export type AiJobType =
  | 'text-to-image'
  | 'image-to-image'
  | 'image-editing'
  | 'text-to-video'
  | 'image-to-video'
  | 'video-to-video'
  | 'video-editing'
  | 'speech-to-video'
  | 'lip-sync'
  | 'text-to-music'
  | 'speech-to-text'
  | 'text-to-speech'
  | 'audio-to-audio'
  | 'chat';

// ── Проекты ──────────────────────────────────────────────────────

export interface Project {
  id: UUID;
  name: string;
  description: string;
  icon: string;
  icon_bg: string;
  icon_color: string;
  accent_color: string;
  status: 'active' | 'archived' | 'paused';
  budget: number;
  created_at: ISODateTime;
  updated_at: ISODateTime;
}

export interface CreateProjectDto {
  name: string;
  description: string;
  icon?: string;
  budget?: number;
}

export interface UpdateProjectDto extends Partial<CreateProjectDto> {
  status?: Project['status'];
}

// ── Задачи ───────────────────────────────────────────────────────

export interface Task {
  id: UUID;
  project_id: UUID;
  title: string;
  description: string;
  status: TaskStatus;
  tag: TaskTag;
  assignee_id: UUID | null;
  due_date: ISODateTime | null;
  created_at: ISODateTime;
  updated_at: ISODateTime;
}

export interface CreateTaskDto {
  project_id: UUID;
  title: string;
  description?: string;
  status?: TaskStatus;
  tag?: TaskTag;
  assignee_id?: UUID;
  due_date?: ISODateTime;
}

export interface UpdateTaskDto extends Partial<Omit<CreateTaskDto, 'project_id'>> {}

// ── Сотрудники ───────────────────────────────────────────────────

export interface Employee {
  id: UUID;
  name: string;
  role: string;
  email: string;
  avatar_initials: string;
  avatar_bg: string;
  avatar_color: string;
  kpi: number;        // 0–100
  salary: number;
  is_online: boolean;
  department: string;
  created_at: ISODateTime;
}

export interface CreateEmployeeDto {
  name: string;
  role: string;
  email: string;
  department: string;
  salary: number;
}

export interface UpdateEmployeeDto extends Partial<CreateEmployeeDto> {
  kpi?: number;
  is_online?: boolean;
}

// ── Финансы ──────────────────────────────────────────────────────

export interface FinanceRecord {
  id: UUID;
  project_id: UUID | null;
  description: string;
  category: TaskTag | 'salary';
  amount: number;
  status: FinanceStatus;
  date: ISODateTime;
  created_at: ISODateTime;
}

export interface CreateFinanceRecordDto {
  project_id?: UUID;
  description: string;
  category: FinanceRecord['category'];
  amount: number;
  status?: FinanceStatus;
  date?: ISODateTime;
}

// ── Сообщения ────────────────────────────────────────────────────

export interface Message {
  id: UUID;
  project_id: UUID | null;
  channel: string;
  author_id: UUID;
  author_name: string;
  content: string;
  created_at: ISODateTime;
}

export interface SendMessageDto {
  project_id?: UUID;
  channel: string;
  content: string;
}

// ── AI Jobs ──────────────────────────────────────────────────────

export interface AiJob {
  id: UUID;
  type: AiJobType;
  status: AiJobStatus;
  prompt: string;
  /** Внешний taskId от KIE.AI */
  kie_task_id: string | null;
  result_url: string | null;
  error: string | null;
  created_at: ISODateTime;
  updated_at: ISODateTime;
}

// ── API Response helpers ─────────────────────────────────────────

export interface ApiSuccess<T> {
  ok: true;
  data: T;
}

export interface ApiError {
  ok: false;
  error: string;
  code?: string;
}

export type ApiResponse<T> = ApiSuccess<T> | ApiError;

// ── KIE.AI — запросы/ответы ──────────────────────────────────────

export interface KieImageRequest {
  prompt: string;
  width?: number;
  height?: number;
  callBackUrl?: string;
}

export interface KieVideoRequest {
  prompt: string;
  duration?: 5 | 10;
  ratio?: '16:9' | '9:16' | '1:1';
  callBackUrl?: string;
}

export interface KieMusicRequest {
  prompt: string;
  customMode?: boolean;
  instrumental?: boolean;
  style?: string;
  title?: string;
  model?: 'V4' | 'V4_5' | 'V4_5PLUS' | 'V5' | 'V5_5';
  vocalGender?: 'm' | 'f';
  negativeTags?: string;
  callBackUrl?: string;
}

export interface KieChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface KieChatRequest {
  messages: KieChatMessage[];
  model?: string;
  temperature?: number;
  max_tokens?: number;
}

// ── WebSocket Events ─────────────────────────────────────────────

export interface WsEvent<T = unknown> {
  type: string;
  payload: T;
}

export interface WsMessageEvent extends WsEvent<Message> {
  type: 'message:new';
}

export interface WsAiJobEvent extends WsEvent<Pick<AiJob, 'id' | 'status' | 'result_url' | 'error'>> {
  type: 'ai_job:update';
}
