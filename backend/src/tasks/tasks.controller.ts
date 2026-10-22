import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiTooManyRequestsResponse,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { ProblemDetailsDto } from '../common/problem-details/problem-details.dto';
import {
  createTaskThrottleLimit,
  throttleTtlMs,
} from '../common/throttle/throttle.config';
import { CreateTaskDto } from './dto/create-task.dto';
import { TaskNodeDto, UpdateTaskStatusResultDto } from './dto/task-node.dto';
import { UpdateTaskAssigneeDto } from './dto/update-task-assignee.dto';
import { UpdateTaskStatusDto } from './dto/update-task-status.dto';
import { TasksService } from './tasks.service';

const ID_PARAM_ERROR = {
  type: ProblemDetailsDto,
  description: 'Invalid body or id is not a UUID',
};

@ApiTags('tasks')
@Controller('tasks')
export class TasksController {
  constructor(private readonly tasks: TasksService) {}

  @Get()
  @ApiOperation({
    summary: 'List top-level tasks (subtasks nested from Phase P4)',
  })
  @ApiOkResponse({ type: [TaskNodeDto] })
  list(): Promise<TaskNodeDto[]> {
    return this.tasks.list();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get one task' })
  @ApiOkResponse({ type: TaskNodeDto })
  @ApiBadRequestResponse(ID_PARAM_ERROR)
  @ApiNotFoundResponse({ type: ProblemDetailsDto })
  get(@Param('id', ParseUUIDPipe) id: string): Promise<TaskNodeDto> {
    return this.tasks.get(id);
  }

  @Post()
  @Throttle({ default: { limit: createTaskThrottleLimit, ttl: throttleTtlMs } })
  @ApiOperation({
    summary: 'Create a task',
    description:
      'Creation never assigns or sets status; use the PATCH endpoints. Unknown fields are rejected.',
  })
  @ApiCreatedResponse({ type: TaskNodeDto })
  @ApiBadRequestResponse({ type: ProblemDetailsDto })
  @ApiUnprocessableEntityResponse({
    type: ProblemDetailsDto,
    description: 'UNKNOWN_SKILL',
  })
  @ApiTooManyRequestsResponse({ type: ProblemDetailsDto })
  create(@Body() dto: CreateTaskDto): Promise<TaskNodeDto> {
    return this.tasks.create(dto);
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Change task status' })
  @ApiOkResponse({ type: UpdateTaskStatusResultDto })
  @ApiBadRequestResponse(ID_PARAM_ERROR)
  @ApiNotFoundResponse({ type: ProblemDetailsDto })
  @ApiUnprocessableEntityResponse({
    type: ProblemDetailsDto,
    description: 'SUBTASKS_NOT_DONE (Phase P4)',
  })
  @ApiConflictResponse({
    type: ProblemDetailsDto,
    description: 'CASCADE_CONFIRMATION_REQUIRED (Phase P4)',
  })
  updateStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTaskStatusDto,
  ): Promise<UpdateTaskStatusResultDto> {
    return this.tasks.updateStatus(id, dto);
  }

  @Patch(':id/assignee')
  @ApiOperation({
    summary: 'Assign or unassign a task',
    description:
      "The developer's skills must include every skill the task requires.",
  })
  @ApiOkResponse({ type: TaskNodeDto })
  @ApiBadRequestResponse(ID_PARAM_ERROR)
  @ApiNotFoundResponse({ type: ProblemDetailsDto })
  @ApiUnprocessableEntityResponse({
    type: ProblemDetailsDto,
    description: 'SKILL_MISMATCH or UNKNOWN_DEVELOPER',
  })
  updateAssignee(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTaskAssigneeDto,
  ): Promise<TaskNodeDto> {
    return this.tasks.updateAssignee(id, dto);
  }
}
