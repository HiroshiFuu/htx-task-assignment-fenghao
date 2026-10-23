import { ValidationPipe } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { translateBodyParserErrors } from './problem-details/body-parser-errors';
import { rejectDeepJson } from './problem-details/json-depth';
import { ProblemDetailsFilter } from './problem-details/problem-details.filter';
import { validationExceptionFactory } from './problem-details/validation-problem.exception';

export const API_PREFIX = 'api';
export const SWAGGER_PATH = `${API_PREFIX}/docs`;

/** Swagger is on by default except in production, where it must be opted into. */
export function isSwaggerEnabled(): boolean {
  const flag = process.env.ENABLE_SWAGGER;
  if (flag !== undefined && flag !== '') {
    return flag === 'true';
  }
  return process.env.NODE_ENV !== 'production';
}

/**
 * Number of reverse proxies in front of the API (1 behind the nginx container).
 * Rate limiting keys on req.ip, which must be the client, not the proxy. Default 0:
 * trusting X-Forwarded-For without a proxy would let clients spoof their IP.
 */
export function trustedProxyHops(): number {
  const hops = Number.parseInt(process.env.TRUST_PROXY_HOPS ?? '', 10);
  return Number.isInteger(hops) && hops > 0 ? hops : 0;
}

/**
 * Shared by main.ts and the e2e tests so tests exercise the exact production
 * pipeline (prefix, security headers, body limit, validation, error format).
 */
export function configureApp(app: NestExpressApplication): void {
  const hops = trustedProxyHops();
  if (hops > 0) {
    app.set('trust proxy', hops);
  }
  app.setGlobalPrefix(API_PREFIX);
  app.use(helmet());
  app.useBodyParser('json', { limit: '100kb' });
  app.use(translateBodyParserErrors);
  app.use(rejectDeepJson);
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      exceptionFactory: validationExceptionFactory,
    }),
  );
  app.useGlobalFilters(new ProblemDetailsFilter());

  if (isSwaggerEnabled()) {
    const config = new DocumentBuilder()
      .setTitle('Task Assignment API')
      .setDescription(
        'Developers, skills and tasks. Errors use RFC 7807 application/problem+json.',
      )
      .setVersion('1.0')
      .build();
    SwaggerModule.setup(
      SWAGGER_PATH,
      app,
      SwaggerModule.createDocument(app, config),
    );
  }
}
