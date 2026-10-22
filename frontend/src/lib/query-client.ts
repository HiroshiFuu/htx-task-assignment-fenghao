import { QueryClient } from '@tanstack/react-query';
import { ApiError } from '../api/client';

const MAX_QUERY_RETRIES = 2;

/** Retry only failures that might succeed later: network errors and 5xx, never 4xx. */
function shouldRetry(failureCount: number, error: unknown): boolean {
  if (error instanceof ApiError && error.status >= 400 && error.status < 500) {
    return false;
  }
  return failureCount < MAX_QUERY_RETRIES;
}

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { staleTime: 30_000, retry: shouldRetry },
      // Mutations are not idempotent from the user's point of view; never auto-retry.
      mutations: { retry: false },
    },
  });
}
