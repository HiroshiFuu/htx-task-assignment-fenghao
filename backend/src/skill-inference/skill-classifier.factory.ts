import { Logger } from '@nestjs/common';
import { GeminiClassifier, sdkGenerateContent } from './gemini-classifier';
import { KeywordClassifier } from './keyword-classifier';
import {
  DEFAULT_RESILIENCE,
  ResilientClassifier,
} from './resilient-classifier';
import { SkillClassifier } from './skill-classifier';

/** Decision D12: overridable with GEMINI_MODEL. */
export const DEFAULT_GEMINI_MODEL = 'gemini-3.1-flash-lite';

/**
 * With GEMINI_API_KEY: Gemini wrapped in the resilience decorator, falling back to
 * keyword rules. Without it the app still works on keyword rules alone, with a
 * warning (CLAUDE.md §8). The key is never logged.
 */
export function createSkillClassifier(
  env: NodeJS.ProcessEnv = process.env,
  logger: Pick<Logger, 'log' | 'warn'> = new Logger('SkillInference'),
): SkillClassifier {
  const keywords = new KeywordClassifier();
  const apiKey = env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    logger.warn(
      'GEMINI_API_KEY is not set: skills will be inferred with keyword rules only.',
    );
    return keywords;
  }
  const model = env.GEMINI_MODEL?.trim() || DEFAULT_GEMINI_MODEL;
  logger.log(`Skill inference uses Gemini (${model}) with a keyword fallback.`);
  return new ResilientClassifier(
    new GeminiClassifier(sdkGenerateContent(apiKey), model),
    keywords,
    DEFAULT_RESILIENCE,
  );
}
