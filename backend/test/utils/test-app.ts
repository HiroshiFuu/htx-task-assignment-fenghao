import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import type { Response } from 'supertest';
import { AppModule } from '../../src/app.module';
import { configureApp } from '../../src/common/app-setup';

/** Builds the app exactly like main.ts does (prefix, helmet, pipes, filter, Swagger). */
export async function createTestApp(): Promise<NestExpressApplication> {
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();
  const app = moduleRef.createNestApplication<NestExpressApplication>({
    bodyParser: false,
  });
  configureApp(app);
  await app.init();
  return app;
}

/** Asserts an RFC 7807 response that leaks no internals. */
export function expectProblem(
  response: Response,
  status: number,
  code?: string,
): void {
  expect(response.status).toBe(status);
  expect(response.headers['content-type']).toMatch(
    /^application\/problem\+json/,
  );
  const body = response.body as Record<string, unknown>;
  expect(body.status).toBe(status);
  expect(typeof body.title).toBe('string');
  expect(typeof body.type).toBe('string');
  expect(typeof body.detail).toBe('string');
  if (code) {
    expect(body.code).toBe(code);
  }
  const serialized = JSON.stringify(body);
  expect(serialized).not.toMatch(/\bat .+:\d+:\d+/); // stack frames
  expect(serialized).not.toMatch(/node_modules|prisma|SELECT |\.ts\b/i);
  expect(body).not.toHaveProperty('stack');
}
