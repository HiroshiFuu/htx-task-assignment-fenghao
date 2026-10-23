import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import type { Response } from 'supertest';
import { AppModule } from '../../src/app.module';
import { configureApp } from '../../src/common/app-setup';
import { KeywordClassifier } from '../../src/skill-inference/keyword-classifier';
import { SkillClassifier } from '../../src/skill-inference/skill-classifier';

/**
 * Builds the app exactly like main.ts does (prefix, helmet, pipes, filter, Swagger).
 * The skill classifier is always replaced, by default with the deterministic keyword
 * rules, so a GEMINI_API_KEY in .env can never make tests call the real API.
 */
export async function createTestApp(
  options: { classifier?: SkillClassifier } = {},
): Promise<NestExpressApplication> {
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  })
    .overrideProvider(SkillClassifier)
    .useValue(options.classifier ?? new KeywordClassifier())
    .compile();
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
