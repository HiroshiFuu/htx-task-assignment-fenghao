import { ApiProperty } from '@nestjs/swagger';
import {
  DeveloperSummaryDto,
  SkillSummaryDto,
  TaskSummaryDto,
} from '../common/dto/summaries.dto';

export class DeveloperDto extends DeveloperSummaryDto {
  @ApiProperty({ type: [SkillSummaryDto] })
  skills!: SkillSummaryDto[];

  @ApiProperty({
    type: [TaskSummaryDto],
    description: 'Tasks assigned to this developer',
  })
  tasks!: TaskSummaryDto[];
}
