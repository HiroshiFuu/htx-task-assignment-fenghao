// Read on every request (throttler accepts resolvers) so limits follow the
// environment without a restart-time snapshot; tests rely on this too.
function intFromEnv(name: string, fallback: number): number {
  const value = Number.parseInt(process.env[name] ?? '', 10);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

export const throttleTtlMs = (): number =>
  intFromEnv('THROTTLE_TTL_MS', 60_000);

export const throttleLimit = (): number => intFromEnv('THROTTLE_LIMIT', 100);

/** POST /api/tasks may call the LLM (cost and latency), so it gets a tighter budget. */
export const createTaskThrottleLimit = (): number =>
  intFromEnv('THROTTLE_CREATE_TASK_LIMIT', 10);
