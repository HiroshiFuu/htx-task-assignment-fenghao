import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  BusinessRuleViolation,
  ConfirmationRequired,
  ResourceNotFound,
} from '../common/errors/domain-error';
import { DbClient } from '../common/prisma/db-client';
import { PrismaService } from '../common/prisma/prisma.service';
import { RowLockStrategy } from '../common/prisma/row-lock.strategy';
import { ValidationProblemException } from '../common/problem-details/validation-problem.exception';
import { DevelopersRepository } from '../developers/developers.repository';
import { SkillClassifier } from '../skill-inference/skill-classifier';
import { SkillsRepository } from '../skills/skills.repository';
import { CreateTaskDto } from './dto/create-task.dto';
import { TaskNodeDto, UpdateTaskStatusResultDto } from './dto/task-node.dto';
import { UpdateTaskAssigneeDto } from './dto/update-task-assignee.dto';
import { UpdateTaskStatusDto } from './dto/update-task-status.dto';
import { ASSIGNMENT_RULES, AssignmentRule } from './rules/assignment-rule';
import { RuleResult, runRuleChain } from './rules/rule';
import {
  STATUS_TRANSITION_RULES,
  StatusTransitionRule,
} from './rules/status-transition-rule';
import { resolveTreeSkills } from './skill-resolution';
import { buildTaskForest } from './task.mapper';
import { TasksRepository } from './tasks.repository';
import { checkTreeLimits } from './tree-limits';

function collectSkillIds(dto: CreateTaskDto): string[] {
  const ids = new Set<string>();
  const stack = [dto];
  for (let node = stack.pop(); node; node = stack.pop()) {
    node.skillIds?.forEach((id) => ids.add(id));
    stack.push(...(node.subtasks ?? []));
  }
  return [...ids];
}

/**
 * Facade: the controller sees one method per use case; transactions, locking,
 * rule chains and persistence stay behind it.
 */
@Injectable()
export class TasksService {
  private readonly logger = new Logger(TasksService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly rowLock: RowLockStrategy,
    private readonly tasks: TasksRepository,
    private readonly skills: SkillsRepository,
    private readonly developers: DevelopersRepository,
    @Inject(ASSIGNMENT_RULES)
    private readonly assignmentRules: readonly AssignmentRule[],
    @Inject(STATUS_TRANSITION_RULES)
    private readonly statusRules: readonly StatusTransitionRule[],
    private readonly classifier: SkillClassifier,
  ) {}

  async list(): Promise<TaskNodeDto[]> {
    return buildTaskForest(await this.tasks.findAll());
  }

  /** The task with its whole subtree. */
  async get(
    id: string,
    db: DbClient = this.prisma.client,
  ): Promise<TaskNodeDto> {
    const root = await this.tasks.findRef(id, db);
    if (!root) {
      throw new ResourceNotFound('Task', id);
    }
    const descendants = await this.tasks.findDescendants(id, db);
    const rows = await this.tasks.findByIds(
      [id, ...descendants.map((d) => d.id)],
      db,
    );
    const [tree] = buildTaskForest(rows);
    return tree;
  }

  /**
   * Infers missing skills (one classifier call for the whole tree), then writes the
   * tree in one transaction. The classifier runs first because a transaction must
   * never wait on a network call.
   */
  async create(dto: CreateTaskDto): Promise<TaskNodeDto> {
    // Also enforced by TreeLimitsMiddleware; re-checked here so the limit holds
    // even if that route binding changes (the DTO alone allows 50 per level).
    const violation = checkTreeLimits(dto);
    if (violation) {
      throw new ValidationProblemException([
        { field: violation.field, messages: [violation.message] },
      ]);
    }
    const userSkillIds = collectSkillIds(dto);
    // Fail fast on an unknown skill id, before spending an LLM call.
    await this.assertSkillsExist(userSkillIds, this.prisma.client);
    const skills = await this.skills.findSummaries();
    if (skills.length === 0) {
      // Only on an unseeded database: inferred tasks cannot get skills (decision D6).
      this.logger.warn(
        'No skills exist; tasks without skillIds are stored without skills. Run the seed.',
      );
    }
    const resolved = await resolveTreeSkills(dto, skills, this.classifier);
    return this.prisma.client.$transaction(async (tx) => {
      await this.assertSkillsExist(userSkillIds, tx);
      const rootId = await this.tasks.createTree(resolved, tx);
      return this.get(rootId, tx);
    });
  }

  async updateStatus(
    id: string,
    dto: UpdateTaskStatusDto,
  ): Promise<UpdateTaskStatusResultDto> {
    const cascadedTaskIds = await this.prisma.client.$transaction(
      async (tx) => {
        await this.lockFamily(id, tx);
        // Re-read after locking so the rules see the state the writes apply to.
        const task = await this.tasks.findRef(id, tx);
        if (!task) {
          throw new ResourceNotFound('Task', id);
        }
        const verdict = await runRuleChain(this.statusRules, {
          task,
          descendants: await this.tasks.findDescendants(id, tx),
          ancestors: await this.tasks.findAncestors(id, tx),
          targetStatus: dto.status,
          confirmCascade: dto.confirmCascade ?? false,
        });
        const cascade = allowedCascade(verdict);
        await this.tasks.updateStatus(id, dto.status, tx);
        if (cascade.length > 0) {
          await this.tasks.rollBackToInProgress(cascade, tx);
        }
        return cascade;
      },
    );
    return { task: await this.get(id), cascadedTaskIds: [...cascadedTaskIds] };
  }

  async updateAssignee(
    id: string,
    { developerId }: UpdateTaskAssigneeDto,
  ): Promise<TaskNodeDto> {
    await this.prisma.client.$transaction(async (tx) => {
      await this.rowLock.lockTasks(tx, [id]);
      const task = await this.tasks.findById(id, tx);
      if (!task) {
        throw new ResourceNotFound('Task', id);
      }
      if (developerId !== null) {
        const developer = await this.developers.findForAssignment(
          developerId,
          tx,
        );
        if (!developer) {
          throw new BusinessRuleViolation(
            'UNKNOWN_DEVELOPER',
            `Developer ${developerId} does not exist.`,
          );
        }
        allowedCascade(
          await runRuleChain(this.assignmentRules, {
            task: {
              id: task.id,
              skills: task.skills.map(({ skill }) => skill),
            },
            developer,
          }),
        );
      }
      await this.tasks.updateAssignee(id, developerId, tx);
    });
    return this.get(id);
  }

  /**
   * Locks the task, its ancestors and its descendants. The tree shape never changes
   * after creation (no re-parenting or deletes), so the ids read here stay valid.
   */
  private async lockFamily(id: string, tx: DbClient): Promise<void> {
    // Sequential: an interactive transaction owns a single connection.
    const ancestors = await this.tasks.findAncestors(id, tx);
    const descendants = await this.tasks.findDescendants(id, tx);
    await this.rowLock.lockTasks(tx, [
      id,
      ...ancestors.map((t) => t.id),
      ...descendants.map((t) => t.id),
    ]);
  }

  private async assertSkillsExist(
    skillIds: readonly string[],
    tx: DbClient,
  ): Promise<void> {
    if (skillIds.length === 0) {
      return;
    }
    const existing = new Set(await this.skills.findExistingIds(skillIds, tx));
    const unknownSkillIds = skillIds.filter(
      (skillId) => !existing.has(skillId),
    );
    if (unknownSkillIds.length > 0) {
      throw new BusinessRuleViolation(
        'UNKNOWN_SKILL',
        `Unknown skill id(s): ${unknownSkillIds.join(', ')}.`,
        { unknownSkillIds },
      );
    }
  }
}

/** Throws for a blocking verdict; otherwise returns the ids the rules asked to cascade. */
function allowedCascade(verdict: RuleResult): readonly string[] {
  switch (verdict.kind) {
    case 'allow':
      return verdict.cascadeTaskIds ?? [];
    case 'reject':
      throw new BusinessRuleViolation(
        verdict.code,
        verdict.detail,
        verdict.extensions,
      );
    case 'requireConfirmation':
      throw new ConfirmationRequired(verdict.code, verdict.detail, {
        affectedTasks: verdict.affectedTasks,
      });
  }
}
