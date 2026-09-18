const BASE_URL = import.meta.env.VITE_API_URL || '/api/v1';

export interface ApiErrorShape {
  code: string;
  message: string;
  details?: Record<string, string>;
}

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  /** Field-level messages from the server, keyed by field name. */
  readonly details?: Record<string, string>;

  constructor(status: number, payload: ApiErrorShape) {
    super(payload.message);
    this.name = 'ApiError';
    this.status = status;
    this.code = payload.code;
    this.details = payload.details;
  }
}

interface Envelope<T> {
  success: boolean;
  data: T;
  pagination?: { page: number; limit: number; total: number; totalPages: number };
  error?: ApiErrorShape;
}

export interface Paginated<T> {
  items: T[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}

/**
 * Only one refresh may be in flight at a time.
 *
 * A dashboard fires several queries at once; when the 15-minute access token
 * expires they would all get a 401 and all call /auth/refresh. Because refresh
 * tokens rotate, the second call would present a token that was just replaced
 * and trip the reuse detection, signing the user out. Sharing one promise means
 * every waiting request resumes after a single rotation.
 */
let refreshPromise: Promise<boolean> | null = null;

async function attemptRefresh(): Promise<boolean> {
  refreshPromise ??= fetch(`${BASE_URL}/auth/refresh`, {
    method: 'POST',
    credentials: 'include',
  })
    .then((response) => response.ok)
    .catch(() => false)
    .finally(() => {
      refreshPromise = null;
    });

  return refreshPromise;
}

interface RequestOptions extends Omit<RequestInit, 'body'> {
  body?: unknown;
  /** Internal: prevents an endless refresh loop. */
  _retry?: boolean;
}

export async function request<T>(path: string, options: RequestOptions = {}): Promise<Envelope<T>> {
  const { body, _retry, headers, ...rest } = options;

  const response = await fetch(`${BASE_URL}${path}`, {
    ...rest,
    // Every call carries the auth cookies; none of them touch localStorage.
    credentials: 'include',
    headers: {
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...headers,
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });

  if (response.status === 204) {
    return { success: true, data: undefined as T };
  }

  let payload: Envelope<T>;
  try {
    payload = (await response.json()) as Envelope<T>;
  } catch {
    throw new ApiError(response.status, { code: 'NETWORK', message: 'The server sent an unreadable response' });
  }

  if (!response.ok) {
    const error = payload.error ?? { code: 'ERROR', message: 'Something went wrong' };

    // An expired access token is recoverable: refresh once, then replay.
    if (response.status === 401 && error.code === 'ACCESS_EXPIRED' && !_retry) {
      const refreshed = await attemptRefresh();
      if (refreshed) return request<T>(path, { ...options, _retry: true });
    }

    throw new ApiError(response.status, error);
  }

  return payload;
}

export const api = {
  get: <T>(path: string) => request<T>(path).then((r) => r.data),
  getPage: <T>(path: string) =>
    request<T[]>(path).then((r) => ({
      items: r.data,
      pagination: r.pagination ?? { page: 1, limit: r.data.length, total: r.data.length, totalPages: 1 },
    })) as Promise<Paginated<T>>,
  post: <T>(path: string, body?: unknown) => request<T>(path, { method: 'POST', body }).then((r) => r.data),
  patch: <T>(path: string, body?: unknown) => request<T>(path, { method: 'PATCH', body }).then((r) => r.data),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }).then((r) => r.data),
};
