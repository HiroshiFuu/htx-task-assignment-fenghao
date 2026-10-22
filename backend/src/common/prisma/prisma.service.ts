import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import type { PrismaClient } from '../../generated/prisma/client';
import {
  createPrismaClient,
  DatabaseDialect,
  detectDialect,
} from './prisma-client.factory';

/**
 * Singleton owner of the Prisma client. Composition rather than `extends PrismaClient`
 * because the driver adapter is chosen at runtime by createPrismaClient().
 */
@Injectable()
export class PrismaService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  readonly client: PrismaClient = createPrismaClient();
  readonly dialect: DatabaseDialect = detectDialect();

  async onModuleInit(): Promise<void> {
    await this.client.$connect();
    this.logger.log(`Connected to ${this.dialect}`);
  }

  async onModuleDestroy(): Promise<void> {
    await this.client.$disconnect();
  }
}
