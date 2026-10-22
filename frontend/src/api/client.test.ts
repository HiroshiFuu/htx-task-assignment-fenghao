import { describe, expect, it, vi } from 'vitest';
import { jsonResponse, problem } from '../test/utils';
import { ApiError, apiRequest, errorMessage } from './client';

function stubFetch(implementation: () => Promise<Response>) {
  const fetchMock = vi.fn(implementation);
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

async function caught(promise: Promise<unknown>): Promise<ApiError> {
  try {
    await promise;
  } catch (error) {
    if (error instanceof ApiError) return error;
    throw error;
  }
  throw new Error('expected an ApiError');
}

describe('apiRequest', () => {
  it('sends JSON to same-origin /api and returns the parsed body', async () => {
    const fetchMock = stubFetch(() => Promise.resolve(jsonResponse({ ok: 1 })));
    await expect(
      apiRequest('/tasks', { method: 'POST', body: { title: 'x' } }),
    ).resolves.toEqual({ ok: 1 });
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/tasks',
      expect.objectContaining({ method: 'POST', body: '{"title":"x"}' }),
    );
  });

  it('turns problem+json into an ApiError carrying detail, code and field errors', async () => {
    stubFetch(() =>
      Promise.resolve(
        problem(400, 'Request validation failed.', {
          code: 'VALIDATION_FAILED',
          errors: [{ field: 'title', messages: ['too long'] }],
        }),
      ),
    );
    const error = await caught(apiRequest('/tasks'));
    expect(error).toMatchObject({
      status: 400,
      code: 'VALIDATION_FAILED',
      message: 'Request validation failed.',
      fieldErrors: [{ field: 'title', messages: ['too long'] }],
    });
  });

  it('replaces the backend text for 429 with an actionable message', async () => {
    stubFetch(() =>
      Promise.resolve(problem(429, 'ThrottlerException: Too Many Requests')),
    );
    expect((await caught(apiRequest('/tasks'))).message).toBe(
      'Too many requests. Please wait a moment and try again.',
    );
  });

  it('reports network failures without exposing the browser error', async () => {
    stubFetch(() => Promise.reject(new TypeError('Failed to fetch')));
    const error = await caught(apiRequest('/tasks'));
    expect(error.status).toBe(0);
    expect(errorMessage(error)).toBe(
      'Could not reach the server. Check your connection and try again.',
    );
  });

  it('treats a non-JSON error or success body as a generic failure', async () => {
    stubFetch(() =>
      Promise.resolve(
        new Response('<html>Bad Gateway</html>', { status: 502 }),
      ),
    );
    expect((await caught(apiRequest('/tasks'))).message).toBe(
      'Request failed (HTTP 502).',
    );

    stubFetch(() =>
      Promise.resolve(new Response('<html>index</html>', { status: 200 })),
    );
    expect((await caught(apiRequest('/tasks'))).message).toBe(
      'The server sent an unexpected response. Please try again.',
    );
  });
});
