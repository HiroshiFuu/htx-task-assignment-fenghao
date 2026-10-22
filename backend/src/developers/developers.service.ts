import { Injectable } from '@nestjs/common';
import { byName } from '../common/dto/summaries.dto';
import { ResourceNotFound } from '../common/errors/domain-error';
import { DeveloperDto } from './developer.dto';
import { DevelopersRepository } from './developers.repository';

type DeveloperRow = NonNullable<
  Awaited<ReturnType<DevelopersRepository['findById']>>
>;

function toDeveloperDto(row: DeveloperRow): DeveloperDto {
  return {
    id: row.id,
    name: row.name,
    skills: row.skills
      .map(({ skill }) => ({ id: skill.id, name: skill.name }))
      .sort(byName),
    tasks: row.tasks,
  };
}

@Injectable()
export class DevelopersService {
  constructor(private readonly developers: DevelopersRepository) {}

  async list(): Promise<DeveloperDto[]> {
    return (await this.developers.findAll()).map(toDeveloperDto);
  }

  async get(id: string): Promise<DeveloperDto> {
    const row = await this.developers.findById(id);
    if (!row) {
      throw new ResourceNotFound('Developer', id);
    }
    return toDeveloperDto(row);
  }
}
