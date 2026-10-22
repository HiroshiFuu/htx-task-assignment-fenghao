import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class FieldErrorDto {
  @ApiProperty({ example: 'title' })
  field!: string;

  @ApiProperty({
    type: [String],
    example: ['title must be shorter than or equal to 500 characters'],
  })
  messages!: string[];
}

/** Swagger model for application/problem+json responses. */
export class ProblemDetailsDto {
  @ApiProperty({ example: '/problems/skill-mismatch' })
  type!: string;

  @ApiProperty({ example: 'Business rule violation' })
  title!: string;

  @ApiProperty({ example: 422 })
  status!: number;

  @ApiProperty({ example: 'Bob lacks the required skill(s): Frontend.' })
  detail!: string;

  @ApiPropertyOptional({ example: '/api/tasks/0b9c.../assignee' })
  instance?: string;

  @ApiPropertyOptional({
    example: 'SKILL_MISMATCH',
    description:
      'Stable machine-readable code: VALIDATION_FAILED, NOT_FOUND, SKILL_MISMATCH, UNKNOWN_SKILL, UNKNOWN_DEVELOPER, …',
  })
  code?: string;

  @ApiPropertyOptional({ type: [FieldErrorDto] })
  errors?: FieldErrorDto[];
}
