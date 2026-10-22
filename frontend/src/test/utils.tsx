import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import type { ReactElement } from 'react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { vi } from 'vitest';

export interface MockRequest {
  method: string;
  path: string;
  body: unknown;
}

export type MockHandler = (
  request: MockRequest,
) => Response | Promise<Response> | undefined;

export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type':
        status >= 400 ? 'application/problem+json' : 'application/json',
    },
  });
}

export function problem(
  status: number,
  detail: string,
  extra: Record<string, unknown> = {},
): Response {
  return jsonResponse(
    { type: 'about:blank', title: 'Error', status, detail, ...extra },
    status,
  );
}

/** Replaces global fetch; unhandled requests fail the test loudly with a 500. */
export function mockFetch(handler: MockHandler) {
  const requests: MockRequest[] = [];
  const fetchMock = vi.fn(
    async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(
        input instanceof Request ? input.url : String(input),
        'http://localhost',
      );
      const rawBody = init?.body;
      const request: MockRequest = {
        method: init?.method ?? 'GET',
        path: url.pathname,
        body:
          typeof rawBody === 'string'
            ? (JSON.parse(rawBody) as unknown)
            : undefined,
      };
      requests.push(request);
      return (
        (await handler(request)) ??
        problem(500, `Unhandled ${request.method} ${request.path}`)
      );
    },
  );
  vi.stubGlobal('fetch', fetchMock);
  return { requests, fetchMock };
}

export function renderWithProviders(
  ui: ReactElement,
  {
    path = '/',
    initialEntry = path,
    otherRoutes = {},
  }: {
    path?: string;
    initialEntry?: string;
    otherRoutes?: Record<string, ReactElement>;
  } = {},
) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialEntry]}>
        <Routes>
          <Route path={path} element={ui} />
          {Object.entries(otherRoutes).map(([routePath, element]) => (
            <Route key={routePath} path={routePath} element={element} />
          ))}
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

export interface Deferred<T> {
  promise: Promise<T>;
  resolve: (value: T) => void;
}

export function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}
