import {
  Classification,
  ClassificationItem,
  SkillClassifier,
} from './skill-classifier';

/** Keyed by lower-case skill name; only rules for skills that exist are used. */
const SKILL_KEYWORDS: Readonly<Record<string, RegExp>> = {
  frontend:
    /\b(ui|ux|page|pages|homepage|screen|screens|responsive|layout|button|buttons|form|forms|navigate|navigation|desktop|mobile|css|style|styling|display|visual|frontend|front-end)\b/,
  backend:
    /\b(api|apis|endpoint|endpoints|database|server|logs?|logging|audit|auth|authentication|authorization|compliance|security|data|storage|persist|migration|backend|back-end)\b/,
};

/** Work that typically spans both (e.g. uploading a profile picture needs UI and storage). */
const FULL_STACK = /\b(upload|uploads|uploading|profile)\b/;

/**
 * Deterministic fallback used when no LLM is configured or the LLM fails. It never
 * returns an empty result (decision D6): a title that matches nothing requires every
 * skill, the conservative choice, since it restricts assignment rather than loosening it.
 */
export class KeywordClassifier extends SkillClassifier {
  classifyBatch(
    items: readonly ClassificationItem[],
    allowedSkills: readonly string[],
  ): Promise<Map<string, Classification>> {
    return Promise.resolve(
      new Map(
        items.map((item) => [
          item.ref,
          {
            skills: this.classify(item.title, allowedSkills),
            source: 'FALLBACK',
          },
        ]),
      ),
    );
  }

  private classify(title: string, allowedSkills: readonly string[]): string[] {
    const text = title.toLowerCase();
    const fullStack = FULL_STACK.test(text);
    const matched = allowedSkills.filter((skill) => {
      const key = skill.toLowerCase();
      const rule = SKILL_KEYWORDS[key] as RegExp | undefined;
      return (
        (fullStack && (key === 'frontend' || key === 'backend')) ||
        (rule?.test(text) ?? false)
      );
    });
    return matched.length > 0 ? matched : [...allowedSkills];
  }
}
