import type { AuthData } from '../types';

const TOKEN_KEY = 'ypt_token';
const EXPIRES_KEY = 'ypt_expires_at';

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function saveAuth(data: AuthData): void {
  localStorage.setItem(TOKEN_KEY, data.token);
  localStorage.setItem(EXPIRES_KEY, data.expiresAt);
}

export function clearAuth(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(EXPIRES_KEY);
}

export function isTokenExpired(): boolean {
  const exp = localStorage.getItem(EXPIRES_KEY);
  if (!exp) return true;
  return new Date(exp).getTime() <= Date.now();
}

interface RequestOptions {
  method?: string;
  body?: unknown;
}

interface ApiEnvelope<T> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<ApiEnvelope<T>> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(path, {
    method: options.method ?? 'GET',
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

  let json: ApiEnvelope<T>;
  try {
    json = (await res.json()) as ApiEnvelope<T>;
  } catch {
    json = { success: false, error: 'Respuesta no válida del servidor.' };
  }

  if (!res.ok || json.success === false) {
    if (res.status === 401 && path !== '/api/auth/login') {
      clearAuth();
    }
    throw new ApiError(json.error ?? `Error ${res.status}`, res.status);
  }
  return json;
}

export const api = {
  get<T>(path: string): Promise<ApiEnvelope<T>> {
    return request<T>(path);
  },
  post<T>(path: string, body?: unknown): Promise<ApiEnvelope<T>> {
    return request<T>(path, { method: 'POST', body });
  },
  patch<T>(path: string, body?: unknown): Promise<ApiEnvelope<T>> {
    return request<T>(path, { method: 'PATCH', body });
  },
  delete<T>(path: string): Promise<ApiEnvelope<T>> {
    return request<T>(path, { method: 'DELETE' });
  },
};