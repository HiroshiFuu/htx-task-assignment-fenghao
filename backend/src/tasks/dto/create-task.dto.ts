import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
  ValidateNested,
} from 'class-validator';
import { MAX_TREE_DEPTH, MAX_TREE_NODES } from '../tree-limits';

export const TITLE_MAX_LENGTH = 500;
export const MAX_SKILLS_PER_TASK = 20;

// PostgreSQL rejects NUL in text columns (→ 500) while SQLite accepts it, so control
// characters are refused up front to keep both dialects and the UI consistent.
// eslint-disable-next-line no-control-regex
const NO_CONTROL_CHARACTERS = /^[^\u0000-\u001F\u007F]*$/;

const trimString = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

// Ids are compared as strings and PostgreSQL returns lowercase UUIDs.
const normalizeIds = ({ value }: { value: unknown }): unknown =>
  Array.isArray(value)
    ? [
        ...new Set(
          (value as unknown[]).map((v) =>
            typeof v === 'string' ? v.toLowerCase() : v,
          ),
        ),
      ]
    : value;

export class CreateTaskDto {
  @ApiProperty({
    minLength: 1,
    maxLength: TITLE_MAX_LENGTH,
    example:
      'As a visitor, I want to see a responsive homepage so that I can easily navigate on both desktop and mobile devices.',
    description: 'Trimmed; must be 1–500 characters after trimming.',
  })
  @Transform(trimString)
  @IsString()
  @Length(1, TITLE_MAX_LENGTH)
  @Matches(NO_CONTROL_CHARACTERS, {
    message: 'title must not contain control characters',
  })
  title!: string;

  @ApiPropertyOptional({
    type: [String],
    format: 'uuid',
    maxItems: MAX_SKILLS_PER_TASK,
    description:
      'Required skill ids (duplicates removed). Leave empty to let the backend infer skills (Phase P5).',
  })
  @IsOptional()
  @Transform(normalizeIds)
  @IsArray()
  @ArrayMaxSize(MAX_SKILLS_PER_TASK)
  @IsUUID('all', { each: true })
  skillIds?: string[];

  @ApiPropertyOptional({
    type: () => [CreateTaskDto],
    description: `Nested subtasks (Composite). At most ${String(MAX_TREE_DEPTH)} levels including this task and ${String(MAX_TREE_NODES)} tasks per request. Each subtask has its own skills (decision D8).`,
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_TREE_NODES)
  @ValidateNested({ each: true })
  @Type(() => CreateTaskDto)
  subtasks?: CreateTaskDto[];
}
