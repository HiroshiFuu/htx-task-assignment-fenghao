import { ApiProperty } from '@nestjs/swagger';
import { IsDefined, IsUUID, ValidateIf } from 'class-validator';

export class UpdateTaskAssigneeDto {
  @ApiProperty({
    type: String,
    format: 'uuid',
    nullable: true,
    description: 'Developer to assign, or null to unassign (decision D7).',
  })
  // null is a valid value (unassign); a missing field is not.
  @ValidateIf((_object, value) => value !== null)
  @IsDefined()
  @IsUUID()
  developerId!: string | null;
}
