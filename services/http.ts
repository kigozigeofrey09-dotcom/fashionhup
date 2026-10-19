export class ApiError extends Error {
  constructor(
    message: string,
    readonly code: 'not-connected' | 'unauthorized' | 'forbidden' | 'not-found' | 'validation' | 'server',
    readonly status?: number,
    readonly details?: Record<string, string>,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

const configuredBase = import.meta.env.VITE_API_BASE_URL as string | undefined;
export const apiBaseUrl = configuredBase?.replace(/\/$/, '') || '/api';

export async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const isGet = !init.method || init.method === 'GET';
  const cacheKey = `fh_cache_${path}`;
  let response: Response;
  try {
    response = await fetch(`${apiBaseUrl}${path}`, { ...init, credentials: 'include', headers: { Accept: 'application/json', ...init.headers } });
    if (response.ok && isGet) {
      const cloned = response.clone();
      cloned.json().then((data) => {
        try { localStorage.setItem(cacheKey, JSON.stringify({ data, timestamp: Date.now() })); } catch {}
      }).catch(() => {});
    }
  } catch {
    if (isGet) {
      try {
        const cached = localStorage.getItem(cacheKey);
        if (cached) {
          const parsed = JSON.parse(cached);
          return parsed.data as T;
        }
      } catch {}
    }
    throw new ApiError(`API not connected yet: ${path}`, 'not-connected');
  }
  if (response.status === 204) return undefined as T;
  const contentType = response.headers.get('content-type') ?? '';
  if (!contentType.includes('application/json')) throw new ApiError(`API not connected yet: ${path}`, 'not-connected', response.status);
  const payload: unknown = await response.json().catch(() => undefined);
  if (payload === undefined) throw new ApiError(`API not connected yet: ${path}`, 'not-connected', response.status);
  if (!response.ok) {
    const body = payload && typeof payload === 'object' ? payload as { message?: unknown; details?: Record<string, string> } : undefined;
    const message = body?.message ? String(body.message) : `Request failed (${response.status}).`;
    const code = response.status === 401 ? 'unauthorized' : response.status === 403 ? 'forbidden' : response.status === 404 ? 'not-found' : response.status === 400 || response.status === 422 ? 'validation' : 'server';
    throw new ApiError(message, code, response.status, body?.details);
  }
  return payload as T;
}

export const postJson = (body: unknown): RequestInit => ({ method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
export const putJson = (body: unknown): RequestInit => ({ method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
export const patchJson = (body: unknown): RequestInit => ({ method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

export function errorMessage(error: unknown): string {
  if (error instanceof Error && !(error instanceof ApiError) && error.message) return error.message;
  if (error instanceof ApiError) {
    if (error.code === 'not-connected') return 'FashionHub’s backend is offline. Offline-cached data loaded if available.';
    if (error.code === 'unauthorized') return error.message || 'Please sign in to continue.';
    if (error.code === 'forbidden') return error.message || 'Your account role does not have access to this page.';
    if (error.code === 'not-found') return error.message || 'This API route or record is not available yet. Check the backend endpoint and resource ID.';
    return error.message;
  }
  return 'Something went wrong. Please try again.';
}
