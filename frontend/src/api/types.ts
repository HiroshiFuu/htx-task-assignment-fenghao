// Mirrors the backend DTOs (see Swagger at /api/docs). Hand-written for v1;
// generating them from OpenAPI is on the roadmap.

export const TASK_STATUSES = ['TODO', 'IN_PROGRESS', 'DONE'] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export type SkillSource = 'USER' | 'LLM' | 'FALLBACK';

export interface SkillSummary {
  id: string;
  name: string;
}

export interface DeveloperSummary {
  id: string;
  name: string;
}

export interface TaskSummary {
  id: string;
  title: string;
  status: TaskStatus;
}

export interface Skill extends SkillSummary {
  developers: DeveloperSummary[];
}

export interface Developer extends DeveloperSummary {
  skills: SkillSummary[];
  tasks: TaskSummary[];
}

export interface TaskNode {
  id: string;
  title: string;
  status: TaskStatus;
  skills: SkillSummary[];
  skillSource: SkillSource;
  assignee: DeveloperSummary | null;
  parentId: string | null;
  subtasks: TaskNode[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateTaskInput {
  title: string;
  skillIds?: string[];
}

export interface UpdateStatusResult {
  task: TaskNode;
  cascadedTaskIds: string[];
}

export interface FieldError {
  field: string;
  messages: string[];
}

/** RFC 7807 body returned by every API error. */
export interface ProblemDetails {
  type: string;
  title: string;
  status: number;
  detail: string;
  code?: string;
  errors?: FieldError[];
}
