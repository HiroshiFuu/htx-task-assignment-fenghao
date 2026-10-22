import type { FieldError, ProblemDetails } from './types';

export class ApiError extends Error {
  readonly status: number;
  readonly code: string | undefined;
  readonly fieldErrors: FieldError[];

  constructor(problem: ProblemDetails) {
    super(problem.detail);
    this.name = 'ApiError';
    this.status = problem.status;
    this.code = problem.code;
    this.fieldErrors = problem.errors ?? [];
  }
}

const NETWORK_PROBLEM: ProblemDetails = {
  type: 'about:blank',
  title: 'Network error',
  status: 0,
  detail: 'Could not reach the server. Check your connection and try again.',
};

/** Messages the user can act on; the backend's detail text is used otherwise. */
const FRIENDLY_DETAIL_BY_STATUS: Readonly<Partial<Record<number, string>>> = {
  429: 'Too many requests. Please wait a moment and try again.',
};

function isProblemDetails(value: unknown): value is ProblemDetails {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const candidate = value as Partial<ProblemDetails>;
  return (
    typeof candidate.status === 'number' && typeof candidate.detail === 'string'
  );
}

async function readProblem(response: Response): Promise<ProblemDetails> {
  const friendly = FRIENDLY_DETAIL_BY_STATUS[response.status];
  try {
    const body: unknown = await response.json();
    if (isProblemDetails(body)) {
      return friendly ? { ...body, detail: friendly } : body;
    }
  } catch {
    // Non-JSON error bodies (e.g. a proxy error page) fall through to a generic problem.
  }
  return {
    type: 'about:blank',
    title: response.statusText || 'Error',
    status: response.status,
    detail: friendly ?? `Request failed (HTTP ${String(response.status)}).`,
  };
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH';
  body?: unknown;
}

/** fetch wrapper for same-origin /api calls; throws ApiError for any failure. */
export async function apiRequest<T>(
  path: string,
  { method = 'GET', body }: RequestOptions = {},
): Promise<T> {
  const headers: Record<string, string> = {
    Accept: 'application/json, application/problem+json',
  };
  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }

  let response: Response;
  try {
    response = await fetch(`/api${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(NETWORK_PROBLEM);
  }

  if (!response.ok) {
    throw new ApiError(await readProblem(response));
  }
  try {
    return (await response.json()) as T;
  } catch {
    // e.g. an HTML page from a misconfigured proxy answering 200.
    throw new ApiError({
      type: 'about:blank',
      title: 'Invalid response',
      status: response.status,
      detail: 'The server sent an unexpected response. Please try again.',
    });
  }
}

export function errorMessage(error: unknown): string {
  return error instanceof ApiError
    ? error.message
    : 'Something went wrong. Please try again.';
}
