import 'dotenv/config';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import {
  configureApp,
  isSwaggerEnabled,
  SWAGGER_PATH,
} from './common/app-setup';

async function bootstrap() {
  // bodyParser is registered by configureApp() with an explicit size limit.
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bodyParser: false,
  });
  configureApp(app);
  // Runs onModuleDestroy (Prisma $disconnect) on SIGTERM/SIGINT, e.g. `docker stop`.
  app.enableShutdownHooks();

  const port = Number(process.env.PORT ?? 3000);
  await app.listen(port);
  const logger = new Logger('Bootstrap');
  logger.log(`API listening on http://localhost:${port}/api`);
  if (isSwaggerEnabled()) {
    logger.log(`Swagger UI on http://localhost:${port}/${SWAGGER_PATH}`);
  }
}
void bootstrap();
