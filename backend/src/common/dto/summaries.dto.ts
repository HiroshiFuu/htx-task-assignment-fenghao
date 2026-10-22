import { ApiProperty } from '@nestjs/swagger';
import { TaskStatus } from '../../generated/prisma/client';

export class SkillSummaryDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'Frontend' })
  name!: string;
}

export class DeveloperSummaryDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'Alice' })
  name!: string;
}

export class TaskSummaryDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'Build the landing page' })
  title!: string;

  @ApiProperty({ enum: TaskStatus, enumName: 'TaskStatus' })
  status!: TaskStatus;
}

export const byName = <T extends { name: string }>(a: T, b: T): number =>
  a.name.localeCompare(b.name);
