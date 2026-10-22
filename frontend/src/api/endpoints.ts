import { apiRequest } from './client';
import type {
  CreateTaskInput,
  Developer,
  Skill,
  TaskNode,
  TaskStatus,
  UpdateStatusResult,
} from './types';

const taskPath = (id: string, suffix = '') =>
  `/tasks/${encodeURIComponent(id)}${suffix}`;

export const api = {
  listTasks: () => apiRequest<TaskNode[]>('/tasks'),
  listDevelopers: () => apiRequest<Developer[]>('/developers'),
  listSkills: () => apiRequest<Skill[]>('/skills'),

  createTask: (input: CreateTaskInput) =>
    apiRequest<TaskNode>('/tasks', { method: 'POST', body: input }),

  updateTaskStatus: (id: string, status: TaskStatus) =>
    apiRequest<UpdateStatusResult>(taskPath(id, '/status'), {
      method: 'PATCH',
      body: { status },
    }),

  updateTaskAssignee: (id: string, developerId: string | null) =>
    apiRequest<TaskNode>(taskPath(id, '/assignee'), {
      method: 'PATCH',
      body: { developerId },
    }),
};
