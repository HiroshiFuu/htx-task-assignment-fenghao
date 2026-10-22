import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import {
  PostgresRowLockStrategy,
  RowLockStrategy,
  SqliteRowLockStrategy,
} from './row-lock.strategy';

@Global()
@Module({
  providers: [
    PrismaService,
    {
      provide: RowLockStrategy,
      inject: [PrismaService],
      useFactory: (prisma: PrismaService): RowLockStrategy =>
        prisma.dialect === 'postgresql'
          ? new PostgresRowLockStrategy()
          : new SqliteRowLockStrategy(),
    },
  ],
  exports: [PrismaService, RowLockStrategy],
})
export class PrismaModule {}
