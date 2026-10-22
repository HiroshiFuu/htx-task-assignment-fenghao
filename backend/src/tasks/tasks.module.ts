import { Module } from '@nestjs/common';
import { DevelopersModule } from '../developers/developers.module';
import { SkillsModule } from '../skills/skills.module';
import { ASSIGNMENT_RULES, AssignmentRule } from './rules/assignment-rule';
import { SkillMatchRule } from './rules/skill-match.rule';
import {
  STATUS_TRANSITION_RULES,
  StatusTransitionRule,
} from './rules/status-transition-rule';
import { TasksController } from './tasks.controller';
import { TasksRepository } from './tasks.repository';
import { TasksService } from './tasks.service';

@Module({
  imports: [SkillsModule, DevelopersModule],
  controllers: [TasksController],
  providers: [
    TasksService,
    TasksRepository,
    {
      provide: ASSIGNMENT_RULES,
      useFactory: (): AssignmentRule[] => [new SkillMatchRule()],
    },
    {
      // Phase P4 adds AllDescendantsDoneRule and AncestorRollbackRule.
      provide: STATUS_TRANSITION_RULES,
      useFactory: (): StatusTransitionRule[] => [],
    },
  ],
})
export class TasksModule {}
