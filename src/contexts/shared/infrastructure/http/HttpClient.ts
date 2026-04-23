import { env } from '../config/env';
import { DomainError } from '../../domain/DomainError';

export class HttpError extends Error {
  constructor(public readonly status: number, message: string, public readonly body?: unknown) {
    super(message);
    this.name = 'HttpError';
  }
}

/**
 * Handler global invocado cuando la API responde 401 (token inválido/expirado).
 * La capa de runtime lo registra para limpiar la sesión y forzar redirect al login.
 */
type UnauthorizedHandler = () => void;
let onUnauthorized: UnauthorizedHandler | null = null;
export function setUnauthorizedHandler(handler: UnauthorizedHandler | null): void {
  onUnauthorized = handler;
}

interface RequestOptions {
  token?: string;
  body?: unknown;
}

async function request<T>(method: string, path: string, opts: RequestOptions = {}, baseUrl: string = env.apiUrl): Promise<T> {
  const url = path.startsWith('http') ? path : `${baseUrl}${path}`;
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (opts.token) headers.Authorization = `Bearer ${opts.token}`;

  const res = await fetch(url, {
    method,
    headers,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });

  const text = await res.text();
  const data = text ? safeJson(text) : null;

  if (!res.ok) {
    if (res.status === 401 && opts.token && onUnauthorized) {
      // Token inválido / expirado: limpiamos sesión. Se ignora en el login
      // inicial (sin token) porque ahí 401 es "credenciales inválidas".
      onUnauthorized();
    }
    if (res.status === 422 && data && typeof data === 'object' && 'message' in data) {
      throw new DomainError((data as { message: string }).message);
    }
    throw new HttpError(res.status, `HTTP ${res.status}`, data);
  }
  return data as T;
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

export const httpClient = {
  get: <T>(path: string, opts?: RequestOptions) => request<T>('GET', path, opts),
  post: <T>(path: string, body: unknown, opts?: RequestOptions) => request<T>('POST', path, { ...opts, body }),
  patch: <T>(path: string, body: unknown, opts?: RequestOptions) => request<T>('PATCH', path, { ...opts, body }),
  del: <T>(path: string, opts?: RequestOptions) => request<T>('DELETE', path, opts),
};

/** Cliente para identity-central (auth de operadores + orgs). */
export const identityClient = {
  get:  <T>(path: string, opts?: RequestOptions) => request<T>('GET', path, opts, env.identityUrl),
  post: <T>(path: string, body: unknown, opts?: RequestOptions) => request<T>('POST', path, { ...opts, body }, env.identityUrl),
  patch: <T>(path: string, body: unknown, opts?: RequestOptions) => request<T>('PATCH', path, { ...opts, body }, env.identityUrl),
  del:  <T>(path: string, opts?: RequestOptions) => request<T>('DELETE', path, opts, env.identityUrl),
};
