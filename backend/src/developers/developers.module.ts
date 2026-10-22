import { Module } from '@nestjs/common';
import { DevelopersController } from './developers.controller';
import { DevelopersRepository } from './developers.repository';
import { DevelopersService } from './developers.service';

@Module({
  controllers: [DevelopersController],
  providers: [DevelopersService, DevelopersRepository],
  exports: [DevelopersRepository],
})
export class DevelopersModule {}
