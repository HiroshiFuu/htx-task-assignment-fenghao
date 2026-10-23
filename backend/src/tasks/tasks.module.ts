import {
  MiddlewareConsumer,
  Module,
  NestModule,
  RequestMethod,
} from '@nestjs/common';
import { DevelopersModule } from '../developers/developers.module';
import { SkillInferenceModule } from '../skill-inference/skill-inference.module';
import { SkillsModule } from '../skills/skills.module';
import { AllDescendantsDoneRule } from './rules/all-descendants-done.rule';
import { AncestorRollbackRule } from './rules/ancestor-rollback.rule';
import { ASSIGNMENT_RULES, AssignmentRule } from './rules/assignment-rule';
import { SkillMatchRule } from './rules/skill-match.rule';
import {
  STATUS_TRANSITION_RULES,
  StatusTransitionRule,
} from './rules/status-transition-rule';
import { TasksController } from './tasks.controller';
import { TasksRepository } from './tasks.repository';
import { TasksService } from './tasks.service';
import { TreeLimitsMiddleware } from './tree-limits.middleware';

@Module({
  imports: [SkillsModule, DevelopersModule, SkillInferenceModule],
  controllers: [TasksController],
  providers: [
    TasksService,
    TasksRepository,
    {
      provide: ASSIGNMENT_RULES,
      useFactory: (): AssignmentRule[] => [new SkillMatchRule()],
    },
    {
      // Order matters: a request that is invalid outright (open subtasks) is rejected
      // before one that merely needs confirmation.
      provide: STATUS_TRANSITION_RULES,
      useFactory: (): StatusTransitionRule[] => [
        new AllDescendantsDoneRule(),
        new AncestorRollbackRule(),
      ],
    },
  ],
})
export class TasksModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer
      .apply(TreeLimitsMiddleware)
      .forRoutes({ path: 'tasks', method: RequestMethod.POST });
  }
}
