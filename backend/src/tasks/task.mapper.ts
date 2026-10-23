import { byName } from '../common/dto/summaries.dto';
import { TaskNodeDto } from './dto/task-node.dto';
import type { TaskRow } from './tasks.repository';

function toTaskNode(row: TaskRow): TaskNodeDto {
  return {
    id: row.id,
    title: row.title,
    status: row.status,
    skills: row.skills
      .map(({ skill }) => ({ id: skill.id, name: skill.name }))
      .sort(byName),
    skillSource: row.skillSource,
    assignee: row.assignee,
    parentId: row.parentId,
    subtasks: [],
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/**
 * Composite: assembles flat rows (already in tree order) into nodes whose
 * `subtasks` are nodes themselves. A row whose parent is not in the set is a root,
 * so the same function serves the full forest and a single subtree.
 */
export function buildTaskForest(rows: readonly TaskRow[]): TaskNodeDto[] {
  const nodes = new Map(rows.map((row) => [row.id, toTaskNode(row)]));
  const roots: TaskNodeDto[] = [];
  for (const row of rows) {
    const node = nodes.get(row.id) as TaskNodeDto;
    const parent = row.parentId ? nodes.get(row.parentId) : undefined;
    if (parent) {
      parent.subtasks.push(node);
    } else {
      roots.push(node);
    }
  }
  return roots;
}
