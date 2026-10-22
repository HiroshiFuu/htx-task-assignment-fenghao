import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { HealthController } from './common/health/health.controller';
import { PrismaModule } from './common/prisma/prisma.module';
import {
  throttleLimit,
  throttleTtlMs,
} from './common/throttle/throttle.config';
import { DevelopersModule } from './developers/developers.module';
import { SkillsModule } from './skills/skills.module';
import { TasksModule } from './tasks/tasks.module';

@Module({
  imports: [
    PrismaModule,
    ThrottlerModule.forRoot({
      throttlers: [
        { name: 'default', ttl: throttleTtlMs, limit: throttleLimit },
      ],
    }),
    SkillsModule,
    DevelopersModule,
    TasksModule,
  ],
  controllers: [HealthController],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
