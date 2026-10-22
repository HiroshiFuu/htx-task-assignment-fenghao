import { byName } from '../common/dto/summaries.dto';
import { TaskNodeDto } from './dto/task-node.dto';
import type { TaskRow } from './tasks.repository';

export function toTaskNode(row: TaskRow): TaskNodeDto {
  return {
    id: row.id,
    title: row.title,
    status: row.status,
    skills: row.skills
      .map(({ skill }) => ({ id: skill.id, name: skill.name }))
      .sort(byName),
    // Persisted from Phase P5 (skill_source column); user-supplied until then.
    skillSource: 'USER',
    assignee: row.assignee,
    // Persisted from Phase P4 (parent_id column); every task is top-level until then.
    parentId: null,
    subtasks: [],
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
