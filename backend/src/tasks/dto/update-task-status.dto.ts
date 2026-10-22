import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsEnum, IsOptional } from 'class-validator';
import { TaskStatus } from '../../generated/prisma/client';

export class UpdateTaskStatusDto {
  @ApiProperty({ enum: TaskStatus, enumName: 'TaskStatus' })
  @IsEnum(TaskStatus)
  status!: TaskStatus;

  @ApiPropertyOptional({
    description:
      'Set to true to confirm rolling completed parent tasks back to IN_PROGRESS (decision D5, Phase P4).',
  })
  @IsOptional()
  @IsBoolean()
  confirmCascade?: boolean;
}
