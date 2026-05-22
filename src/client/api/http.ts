/**
 * @file src/client/api/http.ts
 * Типобезопасный HTTP-клиент для работы с BAZZAR API.
 *
 * Все запросы к KIE.AI идут через /api/ai/* (бэкенд-прокси).
 * API-ключ НИКОГДА не используется на клиенте.
 *
 * @example
 * const projects = await api.get<Project[]>('/api/projects');
 * const task = await api.post<Task>('/api/tasks', { project_id, title });
 */

import type { ApiResponse } from '@shared/types';
import { getToken, logout } from '../auth/auth';

/** Базовый URL API. В dev Vite проксирует /api → localhost:3000 */
const BASE_URL = '';

class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly code?: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/**
 * Базовая функция fetch с:
 * - автоматическим JSON-разбором
 * - JWT-авторизацией (Bearer token из localStorage)
 * - автоматическим logout при 401
 * - нормализованными ошибками
 */
async function request<T>(
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
  path: string,
  body?: unknown,
): Promise<T> {
  const url = `${BASE_URL}${path}`;

  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const token = getToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(url, {
    method,
    headers,
    ...(body !== undefined && { body: JSON.stringify(body) }),
  });

  // Токен истёк или недействителен → разлогинить
  if (res.status === 401 && !path.startsWith('/api/auth/')) {
    logout();
    window.location.href = '/login';
    throw new ApiError(401, 'Сессия истекла');
  }

  const json = await res.json() as ApiResponse<T>;

  if (!json.ok) {
    throw new ApiError(res.status, json.error, json.code);
  }

  return json.data;
}

/** Типобезопасный API-клиент */
export const api = {
  get:    <T>(path: string)                  => request<T>('GET',    path),
  post:   <T>(path: string, body: unknown)   => request<T>('POST',   path, body),
  patch:  <T>(path: string, body: unknown)   => request<T>('PATCH',  path, body),
  delete: <T>(path: string)                  => request<T>('DELETE', path),
};

export { ApiError };

// ── Специализированные методы ────────────────────────────────────

import type {
  Project, Task, Employee, FinanceRecord, AiJob,
  CreateProjectDto, UpdateProjectDto,
  CreateTaskDto, UpdateTaskDto,
  CreateEmployeeDto, UpdateEmployeeDto,
  CreateFinanceRecordDto,
  KieImageRequest, KieVideoRequest, KieMusicRequest, KieChatRequest,
} from '@shared/types';

export const Projects = {
  list:   ()                       => api.get<Project[]>('/api/projects'),
  get:    (id: string)             => api.get<Project & { tasks: Task[]; team: Employee[]; finance: FinanceRecord[] }>(`/api/projects/${id}`),
  create: (dto: CreateProjectDto)  => api.post<Project>('/api/projects', dto),
  update: (id: string, dto: UpdateProjectDto) => api.patch<Project>(`/api/projects/${id}`, dto),
  delete: (id: string)             => api.delete<{ id: string }>(`/api/projects/${id}`),
};

export const Tasks = {
  list:   (params?: { project_id?: string; status?: string }) => {
    const qs = params ? '?' + new URLSearchParams(params as Record<string, string>).toString() : '';
    return api.get<Task[]>(`/api/tasks${qs}`);
  },
  get:    (id: string)            => api.get<Task>(`/api/tasks/${id}`),
  create: (dto: CreateTaskDto)    => api.post<Task>('/api/tasks', dto),
  update: (id: string, dto: UpdateTaskDto) => api.patch<Task>(`/api/tasks/${id}`, dto),
  delete: (id: string)            => api.delete<{ id: string }>(`/api/tasks/${id}`),
};

export const Employees = {
  list:   (params?: { q?: string; department?: string }) => {
    const qs = params ? '?' + new URLSearchParams(params as Record<string, string>).toString() : '';
    return api.get<Employee[]>(`/api/employees${qs}`);
  },
  get:    (id: string)            => api.get<Employee>(`/api/employees/${id}`),
  create: (dto: CreateEmployeeDto)=> api.post<Employee>('/api/employees', dto),
  update: (id: string, dto: UpdateEmployeeDto) => api.patch<Employee>(`/api/employees/${id}`, dto),
  delete: (id: string)            => api.delete<{ id: string }>(`/api/employees/${id}`),
};

export const Finance = {
  list:    (params?: { project_id?: string; status?: string }) => {
    const qs = params ? '?' + new URLSearchParams(params as Record<string, string>).toString() : '';
    return api.get<FinanceRecord[]>(`/api/finance${qs}`);
  },
  summary: (project_id?: string) => {
    const qs = project_id ? `?project_id=${project_id}` : '';
    return api.get<{ total: number; paid: number; pending: number; count: number }>(`/api/finance/summary${qs}`);
  },
  create: (dto: CreateFinanceRecordDto) => api.post<FinanceRecord>('/api/finance', dto),
  update: (id: string, dto: Partial<CreateFinanceRecordDto>) => api.patch<FinanceRecord>(`/api/finance/${id}`, dto),
  delete: (id: string) => api.delete<{ id: string }>(`/api/finance/${id}`),
};

export const AI = {
  /** Запустить генерацию изображения. Вернёт job.id для polling. */
  generateImage: (req: KieImageRequest)  => api.post<AiJob>('/api/ai/image', req),
  /** Запустить генерацию видео. */
  generateVideo: (req: KieVideoRequest)  => api.post<AiJob>('/api/ai/video', req),
  /** Запустить генерацию музыки. */
  generateMusic: (req: KieMusicRequest)  => api.post<AiJob>('/api/ai/music', req),
  /** Отправить сообщение в чат и получить ответ синхронно. */
  chat:          (req: KieChatRequest)   => api.post<{ content: string }>('/api/ai/chat', req),
  /** Получить статус AI задачи по её ID. */
  getJob:        (id: string)            => api.get<AiJob>(`/api/ai/job/${id}`),
  /** История всех AI задач. */
  listJobs:      ()                      => api.get<AiJob[]>('/api/ai/jobs'),
};

// ── WebSocket helper ─────────────────────────────────────────────

/**
 * Подключается к BAZZAR WebSocket и вызывает callback при событиях.
 * Автоматически переподключается при разрыве соединения (3 сек).
 *
 * @example
 * const ws = connectWs((event) => {
 *   if (event.type === 'ai_job:update') renderJobResult(event.payload);
 * });
 * // Для отключения:
 * ws.close();
 */
export function connectWs(onEvent: (event: { type: string; payload: unknown }) => void): WebSocket {
  const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
  const ws = new WebSocket(`${protocol}//${location.host}/ws`);

  ws.onmessage = (e) => {
    try {
      const data = JSON.parse(e.data as string) as { type: string; payload: unknown };
      onEvent(data);
    } catch { /* игнорируем невалидный JSON */ }
  };

  ws.onclose = () => {
    setTimeout(() => connectWs(onEvent), 3000);
  };

  return ws;
}
