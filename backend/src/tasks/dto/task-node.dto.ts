import { ApiProperty } from '@nestjs/swagger';
import {
  DeveloperSummaryDto,
  SkillSummaryDto,
} from '../../common/dto/summaries.dto';
import { TaskStatus } from '../../generated/prisma/client';

export const SKILL_SOURCES = ['USER', 'LLM', 'FALLBACK'] as const;
export type SkillSource = (typeof SKILL_SOURCES)[number];

export class TaskNodeDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty()
  title!: string;

  @ApiProperty({ enum: TaskStatus, enumName: 'TaskStatus' })
  status!: TaskStatus;

  @ApiProperty({ type: [SkillSummaryDto] })
  skills!: SkillSummaryDto[];

  @ApiProperty({
    enum: SKILL_SOURCES,
    enumName: 'SkillSource',
    description:
      'Where the skills came from: USER (chosen when creating), LLM (inferred by Gemini) or FALLBACK (inferred by keyword rules because no LLM was configured or it failed).',
  })
  skillSource!: SkillSource;

  @ApiProperty({ type: DeveloperSummaryDto, nullable: true })
  assignee!: DeveloperSummaryDto | null;

  @ApiProperty({
    type: String,
    format: 'uuid',
    nullable: true,
    description: 'Always null until subtasks arrive in Phase P4.',
  })
  parentId!: string | null;

  @ApiProperty({
    type: () => [TaskNodeDto],
    description: 'Always empty until subtasks arrive in Phase P4.',
  })
  subtasks!: TaskNodeDto[];

  @ApiProperty({ format: 'date-time' })
  createdAt!: string;

  @ApiProperty({ format: 'date-time' })
  updatedAt!: string;
}

export class UpdateTaskStatusResultDto {
  @ApiProperty({ type: TaskNodeDto })
  task!: TaskNodeDto;

  @ApiProperty({
    type: [String],
    format: 'uuid',
    description:
      'Ancestor tasks rolled back to IN_PROGRESS (Phase P4); empty otherwise.',
  })
  cascadedTaskIds!: string[];
}
