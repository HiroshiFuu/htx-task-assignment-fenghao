import { Inject, Injectable } from '@nestjs/common';
import {
  BusinessRuleViolation,
  ConfirmationRequired,
  ResourceNotFound,
} from '../common/errors/domain-error';
import { DbClient } from '../common/prisma/db-client';
import { PrismaService } from '../common/prisma/prisma.service';
import { RowLockStrategy } from '../common/prisma/row-lock.strategy';
import { DevelopersRepository } from '../developers/developers.repository';
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
import { toTaskNode } from './task.mapper';
import { TaskRow, TasksRepository } from './tasks.repository';

/**
 * Facade: the controller sees one method per use case; transactions, locking,
 * rule chains and persistence stay behind it.
 */
@Injectable()
export class TasksService {
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
  ) {}

  async list(): Promise<TaskNodeDto[]> {
    return (await this.tasks.findAll()).map(toTaskNode);
  }

  async get(id: string): Promise<TaskNodeDto> {
    const row = await this.tasks.findById(id);
    if (!row) {
      throw new ResourceNotFound('Task', id);
    }
    return toTaskNode(row);
  }

  async create(dto: CreateTaskDto): Promise<TaskNodeDto> {
    const skillIds = dto.skillIds ?? [];
    const row = await this.prisma.client.$transaction(async (tx) => {
      await this.assertSkillsExist(skillIds, tx);
      return this.tasks.create({ title: dto.title, skillIds }, tx);
    });
    return toTaskNode(row);
  }

  async updateStatus(
    id: string,
    dto: UpdateTaskStatusDto,
  ): Promise<UpdateTaskStatusResultDto> {
    const row = await this.prisma.client.$transaction(async (tx) => {
      const task = await this.lockAndLoad(id, tx);
      const verdict = await runRuleChain(this.statusRules, {
        tx,
        task,
        targetStatus: dto.status,
        confirmCascade: dto.confirmCascade ?? false,
      });
      throwIfBlocked(verdict);
      return this.tasks.updateStatus(id, dto.status, tx);
    });
    return { task: toTaskNode(row), cascadedTaskIds: [] };
  }

  async updateAssignee(
    id: string,
    { developerId }: UpdateTaskAssigneeDto,
  ): Promise<TaskNodeDto> {
    const row = await this.prisma.client.$transaction(async (tx) => {
      const task = await this.lockAndLoad(id, tx);
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
        const verdict = await runRuleChain(this.assignmentRules, {
          task: { id: task.id, skills: task.skills.map(({ skill }) => skill) },
          developer,
        });
        throwIfBlocked(verdict);
      }
      return this.tasks.updateAssignee(id, developerId, tx);
    });
    return toTaskNode(row);
  }

  /** Lock first, then read, so rule checks see the state the write will apply to. */
  private async lockAndLoad(id: string, tx: DbClient): Promise<TaskRow> {
    await this.rowLock.lockTasks(tx, [id]);
    const task = await this.tasks.findById(id, tx);
    if (!task) {
      throw new ResourceNotFound('Task', id);
    }
    return task;
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

function throwIfBlocked(verdict: RuleResult): void {
  switch (verdict.kind) {
    case 'allow':
      return;
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
