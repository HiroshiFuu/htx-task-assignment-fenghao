import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import {
  ApiOkResponse,
  ApiOperation,
  ApiServiceUnavailableResponse,
  ApiTags,
} from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { ProblemDetailsDto } from '../problem-details/problem-details.dto';
import { PrismaService } from '../prisma/prisma.service';
import { HealthDto } from './health.dto';

@ApiTags('health')
@Controller('health')
@SkipThrottle()
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @ApiOperation({ summary: 'Liveness + database connectivity probe' })
  @ApiOkResponse({ type: HealthDto })
  @ApiServiceUnavailableResponse({ type: ProblemDetailsDto })
  async check(): Promise<HealthDto> {
    try {
      await this.prisma.client.$queryRaw`SELECT 1`;
    } catch {
      throw new ServiceUnavailableException('Database is unavailable.');
    }
    return { status: 'ok' };
  }
}
