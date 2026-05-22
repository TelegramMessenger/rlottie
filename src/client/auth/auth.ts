/**
 * @file src/client/auth/auth.ts
 * Клиентская авторизация через JWT.
 *
 * Токен хранится в localStorage под ключом 'bazzar_token'.
 * Данные пользователя кэшируются в 'bazzar_user'.
 * Все защищённые API-запросы должны передавать заголовок Authorization: Bearer <token>.
 */

import type { UserPublic, LoginDto, RegisterDto, AuthResponse, ApiResponse } from '../../../shared/types';

const TOKEN_KEY = 'bazzar_token';
const USER_KEY  = 'bazzar_user';

// ── Хранилище ─────────────────────────────────────────────────────

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function getAuthUser(): UserPublic | null {
  try {
    const raw = localStorage.getItem(USER_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as UserPublic;
  } catch {
    return null;
  }
}

export function isAuthenticated(): boolean {
  return getToken() !== null && getAuthUser() !== null;
}

function saveSession(token: string, user: UserPublic): void {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function logout(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

// ── API ──────────────────────────────────────────────────────────

async function authRequest<T>(
  url: string,
  body: object,
): Promise<T> {
  const res = await fetch(url, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(body),
  });

  const json = await res.json() as ApiResponse<T>;

  if (!json.ok) {
    throw new Error(json.error ?? 'Ошибка сервера');
  }

  return json.data;
}

export async function login(email: string, password: string): Promise<UserPublic> {
  const dto: LoginDto = { email, password };
  const result = await authRequest<AuthResponse>('/api/auth/login', dto);
  saveSession(result.token, result.user);
  return result.user;
}

export async function register(email: string, password: string, name: string): Promise<UserPublic> {
  const dto: RegisterDto = { email, password, name };
  const result = await authRequest<AuthResponse>('/api/auth/register', dto);
  saveSession(result.token, result.user);
  return result.user;
}

/** Заголовок для защищённых API-запросов */
export function authHeader(): Record<string, string> {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/** Обновляет кэш пользователя с сервера (вызывать при старте приложения) */
export async function refreshUser(): Promise<void> {
  const token = getToken();
  if (!token) return;

  try {
    const res = await fetch('/api/auth/me', {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (res.status === 401) {
      logout();
      return;
    }

    const json = await res.json() as ApiResponse<UserPublic>;
    if (json.ok) {
      localStorage.setItem(USER_KEY, JSON.stringify(json.data));
    }
  } catch {
    // Сеть недоступна — оставляем кэшированные данные
  }
}
