import { Controller, Get, Param, ParseUUIDPipe } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { ProblemDetailsDto } from '../common/problem-details/problem-details.dto';
import { DeveloperDto } from './developer.dto';
import { DevelopersService } from './developers.service';

@ApiTags('developers')
@Controller('developers')
export class DevelopersController {
  constructor(private readonly developers: DevelopersService) {}

  @Get()
  @ApiOperation({
    summary: 'List developers with their skills and assigned tasks',
  })
  @ApiOkResponse({ type: [DeveloperDto] })
  list(): Promise<DeveloperDto[]> {
    return this.developers.list();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get one developer' })
  @ApiOkResponse({ type: DeveloperDto })
  @ApiBadRequestResponse({
    type: ProblemDetailsDto,
    description: 'id is not a UUID',
  })
  @ApiNotFoundResponse({ type: ProblemDetailsDto })
  get(@Param('id', ParseUUIDPipe) id: string): Promise<DeveloperDto> {
    return this.developers.get(id);
  }
}
