import { Injectable } from '@nestjs/common';
import { byName } from '../common/dto/summaries.dto';
import { ResourceNotFound } from '../common/errors/domain-error';
import { SkillDto } from './skill.dto';
import { SkillsRepository } from './skills.repository';

type SkillRow = NonNullable<Awaited<ReturnType<SkillsRepository['findById']>>>;

function toSkillDto(row: SkillRow): SkillDto {
  return {
    id: row.id,
    name: row.name,
    developers: row.developers
      .map(({ developer }) => ({ id: developer.id, name: developer.name }))
      .sort(byName),
  };
}

@Injectable()
export class SkillsService {
  constructor(private readonly skills: SkillsRepository) {}

  async list(): Promise<SkillDto[]> {
    return (await this.skills.findAll()).map(toSkillDto);
  }

  async get(id: string): Promise<SkillDto> {
    const row = await this.skills.findById(id);
    if (!row) {
      throw new ResourceNotFound('Skill', id);
    }
    return toSkillDto(row);
  }
}
