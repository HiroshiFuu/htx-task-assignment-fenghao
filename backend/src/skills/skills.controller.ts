import { Controller, Get, Param, ParseUUIDPipe } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { ProblemDetailsDto } from '../common/problem-details/problem-details.dto';
import { SkillDto } from './skill.dto';
import { SkillsService } from './skills.service';

@ApiTags('skills')
@Controller('skills')
export class SkillsController {
  constructor(private readonly skills: SkillsService) {}

  @Get()
  @ApiOperation({ summary: 'List skills with the developers who have them' })
  @ApiOkResponse({ type: [SkillDto] })
  list(): Promise<SkillDto[]> {
    return this.skills.list();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get one skill' })
  @ApiOkResponse({ type: SkillDto })
  @ApiBadRequestResponse({
    type: ProblemDetailsDto,
    description: 'id is not a UUID',
  })
  @ApiNotFoundResponse({ type: ProblemDetailsDto })
  get(@Param('id', ParseUUIDPipe) id: string): Promise<SkillDto> {
    return this.skills.get(id);
  }
}
