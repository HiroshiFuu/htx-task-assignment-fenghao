export const PROBLEM_JSON = 'application/problem+json';

export interface FieldError {
  field: string;
  messages: string[];
}

/** RFC 7807 body. Extension members (e.g. `missingSkills`) are added alongside. */
export interface ProblemDetails {
  type: string;
  title: string;
  status: number;
  detail: string;
  instance?: string;
  code?: string;
  errors?: FieldError[];
  [extension: string]: unknown;
}

/** Relative URI per code, e.g. SKILL_MISMATCH → /problems/skill-mismatch. */
export function problemTypeFor(code: string | undefined): string {
  return code
    ? `/problems/${code.toLowerCase().replace(/_/g, '-')}`
    : 'about:blank';
}
