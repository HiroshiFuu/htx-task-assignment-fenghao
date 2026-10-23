import type { SkillSource } from '../generated/prisma/client';
import type {
  Classification,
  ClassificationItem,
  SkillClassifier,
} from '../skill-inference/skill-classifier';
import type { CreateTaskDto } from './dto/create-task.dto';

/** A task tree whose skills are final, ready to be written. */
export interface ResolvedTask {
  title: string;
  skillIds: string[];
  skillSource: SkillSource;
  subtasks: ResolvedTask[];
}

interface SkillSummary {
  id: string;
  name: string;
}

/** Path-like refs ("0", "0.1", …) identify nodes in the single batch request. */
function pendingItems(dto: CreateTaskDto): ClassificationItem[] {
  const items: ClassificationItem[] = [];
  const visit = (node: CreateTaskDto, ref: string) => {
    if (!node.skillIds?.length) {
      items.push({ ref, title: node.title });
    }
    node.subtasks?.forEach((child, index) => {
      visit(child, `${ref}.${String(index)}`);
    });
  };
  visit(dto, '0');
  return items;
}

/**
 * Keeps user-chosen skills (source USER) and infers the rest with one classifier call
 * for the whole tree (decision D8: each task by its own title). Runs before the
 * database transaction, which must not wait on network calls.
 */
export async function resolveTreeSkills(
  dto: CreateTaskDto,
  skills: readonly SkillSummary[],
  classifier: SkillClassifier,
): Promise<ResolvedTask> {
  const pending = pendingItems(dto);
  const classifications =
    pending.length > 0 && skills.length > 0
      ? await classifier.classifyBatch(
          pending,
          skills.map((skill) => skill.name),
        )
      : new Map<string, Classification>();
  const idByName = new Map(skills.map((skill) => [skill.name, skill.id]));

  const build = (node: CreateTaskDto, ref: string): ResolvedTask => {
    const subtasks = (node.subtasks ?? []).map((child, index) =>
      build(child, `${ref}.${String(index)}`),
    );
    if (node.skillIds?.length) {
      return {
        title: node.title,
        skillIds: node.skillIds,
        skillSource: 'USER',
        subtasks,
      };
    }
    const classification = classifications.get(ref);
    return {
      title: node.title,
      skillIds: (classification?.skills ?? []).flatMap((name) => {
        const id = idByName.get(name);
        return id ? [id] : [];
      }),
      skillSource: classification?.source ?? 'FALLBACK',
      subtasks,
    };
  };
  return build(dto, '0');
}
