/** A task title to classify; `ref` is chosen by the caller and echoed back. */
export interface ClassificationItem {
  ref: string;
  title: string;
}

export type InferredSkillSource = 'LLM' | 'FALLBACK';

export interface Classification {
  /** Skill names, always a subset of the allowed names. */
  skills: string[];
  source: InferredSkillSource;
}

/**
 * Strategy: how skills are inferred from a title (Gemini, keyword rules, or a test
 * double). This module's public surface uses only these plain types, so the Gemini
 * SDK never leaks out of it.
 */
export abstract class SkillClassifier {
  /**
   * Classifies all items in one call (one LLM request per task tree). Items the
   * classifier could not label are simply absent from the result.
   */
  abstract classifyBatch(
    items: readonly ClassificationItem[],
    allowedSkills: readonly string[],
    signal?: AbortSignal,
  ): Promise<Map<string, Classification>>;
}

export class ClassifierError extends Error {
  constructor(
    message: string,
    /** True for failures worth retrying: rate limits, 5xx, network errors. */
    readonly retryable: boolean,
  ) {
    super(message);
    this.name = 'ClassifierError';
  }
}
