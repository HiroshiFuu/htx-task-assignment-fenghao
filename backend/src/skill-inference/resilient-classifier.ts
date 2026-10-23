import { Logger } from '@nestjs/common';
import {
  Classification,
  ClassificationItem,
  ClassifierError,
  SkillClassifier,
} from './skill-classifier';

export interface ResilienceOptions {
  timeoutMs: number;
  /** Extra attempts after the first, only for retryable errors (429 / 5xx / network). */
  maxRetries: number;
  retryDelayMs: number;
}

export const DEFAULT_RESILIENCE: ResilienceOptions = {
  timeoutMs: 10_000,
  maxRetries: 1,
  retryDelayMs: 500,
};

const sleep = (ms: number) =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });

/**
 * Decorator: adds a timeout and limited retries around the primary classifier, and
 * falls back to the secondary for anything the primary could not label, so task
 * creation never fails because the LLM is down (decision D6).
 */
export class ResilientClassifier extends SkillClassifier {
  private readonly logger = new Logger('SkillInference');

  constructor(
    private readonly primary: SkillClassifier,
    private readonly fallback: SkillClassifier,
    private readonly options: ResilienceOptions = DEFAULT_RESILIENCE,
    private readonly wait: (ms: number) => Promise<void> = sleep,
  ) {
    super();
  }

  async classifyBatch(
    items: readonly ClassificationItem[],
    allowedSkills: readonly string[],
  ): Promise<Map<string, Classification>> {
    if (items.length === 0) {
      return new Map();
    }

    let primaryResult = new Map<string, Classification>();
    try {
      primaryResult = await this.withRetries(items, allowedSkills);
    } catch (error) {
      const reason =
        error instanceof ClassifierError ? error.message : 'unexpected error';
      this.logger.warn(
        `LLM skill inference failed (${reason}); using keyword fallback for ${String(items.length)} task(s)`,
      );
    }

    const unlabelled = items.filter(
      (item) => !primaryResult.get(item.ref)?.skills.length,
    );
    if (unlabelled.length === 0) {
      return primaryResult;
    }
    if (unlabelled.length < items.length) {
      this.logger.warn(
        `LLM left ${String(unlabelled.length)} task(s) unlabelled; using keyword fallback for them`,
      );
    }
    const fallbackResult = await this.fallback.classifyBatch(
      unlabelled,
      allowedSkills,
    );
    // Only fill the gaps: the LLM's labels win, and its empty answers don't count.
    const merged = new Map(primaryResult);
    for (const { ref } of unlabelled) {
      const classification = fallbackResult.get(ref);
      if (classification) {
        merged.set(ref, classification);
      } else {
        merged.delete(ref);
      }
    }
    return merged;
  }

  private async withRetries(
    items: readonly ClassificationItem[],
    allowedSkills: readonly string[],
  ): Promise<Map<string, Classification>> {
    for (let attempt = 0; ; attempt += 1) {
      try {
        return await this.withTimeout(items, allowedSkills);
      } catch (error) {
        const retryable = error instanceof ClassifierError && error.retryable;
        if (!retryable || attempt >= this.options.maxRetries) {
          throw error;
        }
        await this.wait(this.options.retryDelayMs * 2 ** attempt);
      }
    }
  }

  private async withTimeout(
    items: readonly ClassificationItem[],
    allowedSkills: readonly string[],
  ): Promise<Map<string, Classification>> {
    const controller = new AbortController();
    let timer: NodeJS.Timeout | undefined;
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        controller.abort();
        // Not retried: a retry would double the latency of task creation.
        reject(new ClassifierError('LLM request timed out', false));
      }, this.options.timeoutMs);
    });
    try {
      return await Promise.race([
        this.primary.classifyBatch(items, allowedSkills, controller.signal),
        timeout,
      ]);
    } finally {
      clearTimeout(timer);
    }
  }
}
