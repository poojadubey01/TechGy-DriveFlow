import { API_URL } from './config';

/** An error from the API (or the network), with a message written to be shown as is. */
export class ApiError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly status: number,
    readonly fields?: Record<string, string>,
  ) {
    super(message);
  }
}

let token: string | null = null;
let onUnauthorized: (() => void) | null = null;

export function setToken(next: string | null) {
  token = next;
}

export function hasToken() {
  return token !== null;
}

/** Called once when a signed-in request comes back 401 (session expired or revoked elsewhere). */
export function setUnauthorizedHandler(handler: (() => void) | null) {
  onUnauthorized = handler;
}

type Options = { method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE'; body?: unknown; timeoutMs?: number };

const OFFLINE = 'Can’t reach DriveFlow. Check your connection and try again.';

/** Calls the API. Resolves with the JSON body (undefined for 204); throws ApiError otherwise. */
export async function api<T = unknown>(path: string, opts: Options = {}): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? 20_000);
  const sentWithToken = token;
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      method: opts.method ?? 'GET',
      headers: {
        Accept: 'application/json',
        ...(opts.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(sentWithToken ? { Authorization: `Bearer ${sentWithToken}` } : {}),
      },
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
      signal: controller.signal,
    });
  } catch {
    throw new ApiError(OFFLINE, 'network', 0);
  } finally {
    clearTimeout(timer);
  }
  if (res.status === 204) return undefined as T;
  const data = (await res.json().catch(() => null)) as { error?: { code?: string; message?: string; fields?: Record<string, string> } } | null;
  if (!res.ok) {
    const err = data?.error;
    if (res.status === 401 && sentWithToken && sentWithToken === token) onUnauthorized?.();
    throw new ApiError(err?.message ?? 'Something went wrong. Please try again.', err?.code ?? 'server_error', res.status, err?.fields);
  }
  return data as T;
}

/** The message to show for any error. */
export function errorMessage(e: unknown, fallback = 'Something went wrong. Please try again.') {
  return e instanceof ApiError ? e.message : fallback;
}
