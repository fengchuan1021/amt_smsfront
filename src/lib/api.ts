const API_BASE = (import.meta.env.VITE_API_BASE as string | undefined) || '/api';
const TOKEN_KEY = 'ant_sms_token';

export class ApiError extends Error {
  status: number;
  code?: string;
  details?: unknown;

  constructor(message: string, status: number, code?: string, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
}

interface ApiEnvelope<T> {
  ok: boolean;
  data?: T;
  error?: { code?: string; message?: string; details?: unknown };
}

export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = {};
  if (options.body !== undefined) headers['Content-Type'] = 'application/json';
  const token = localStorage.getItem(TOKEN_KEY);
  if (token) headers['Authorization'] = `Bearer ${token}`;

  let response: Response;
  try {
    response = await fetch(API_BASE + path, {
      method: options.method ?? 'GET',
      headers,
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    });
  } catch {
    throw new ApiError('网络请求失败，请确认后端服务已启动', 0);
  }

  let payload: ApiEnvelope<T> | null = null;
  try {
    payload = (await response.json()) as ApiEnvelope<T>;
  } catch {
    /* non-json response */
  }

  if (response.status === 401) {
    window.dispatchEvent(new CustomEvent('auth:expired'));
  }

  if (!response.ok || !payload || payload.ok === false) {
    const message = payload?.error?.message || `请求失败 (${response.status})`;
    throw new ApiError(message, response.status, payload?.error?.code, payload?.error?.details);
  }

  return payload.data as T;
}
