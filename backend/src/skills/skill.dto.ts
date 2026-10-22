import { ApiProperty } from '@nestjs/swagger';
import {
  DeveloperSummaryDto,
  SkillSummaryDto,
} from '../common/dto/summaries.dto';

export class SkillDto extends SkillSummaryDto {
  @ApiProperty({ type: [DeveloperSummaryDto] })
  developers!: DeveloperSummaryDto[];
}
