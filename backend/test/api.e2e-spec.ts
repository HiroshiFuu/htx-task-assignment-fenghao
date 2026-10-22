import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import type { App } from 'supertest/types';
import { createPrismaClient } from '../src/common/prisma/prisma-client.factory';
import { seed } from '../prisma/seed';
import { SEED_DEVELOPERS, SEED_SKILLS } from '../prisma/seed-data';
import { createTestApp, expectProblem } from './utils/test-app';

const UNKNOWN_ID = '00000000-0000-4000-8000-000000000000';

describe('API platform, skills and developers (e2e)', () => {
  let app: NestExpressApplication;
  let http: App;

  beforeAll(async () => {
    const prisma = createPrismaClient();
    await seed(prisma);
    await prisma.$disconnect();

    app = await createTestApp();
    http = app.getHttpServer();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('platform', () => {
    it('GET /api/health reports ok with a reachable database', async () => {
      const response = await request(http).get('/api/health').expect(200);
      expect(response.body).toEqual({ status: 'ok' });
    });

    it('sets helmet security headers and hides the framework', async () => {
      const response = await request(http).get('/api/health');
      expect(response.headers['x-content-type-options']).toBe('nosniff');
      expect(response.headers['content-security-policy']).toBeDefined();
      expect(response.headers['x-powered-by']).toBeUndefined();
    });

    it('serves the OpenAPI document', async () => {
      const response = await request(http).get('/api/docs-json').expect(200);
      const paths = Object.keys((response.body as { paths: object }).paths);
      expect(paths).toEqual(
        expect.arrayContaining([
          '/api/tasks',
          '/api/tasks/{id}/status',
          '/api/tasks/{id}/assignee',
          '/api/skills',
          '/api/developers',
        ]),
      );
    });

    it('returns problem+json for unknown routes', async () => {
      expectProblem(await request(http).get('/api/nope'), 404);
    });

    it('returns problem+json for malformed JSON without parser internals', async () => {
      const response = await request(http)
        .post('/api/tasks')
        .set('Content-Type', 'application/json')
        .send('{"title": ');
      expectProblem(response, 400);
      expect((response.body as { detail: string }).detail).toBe(
        'Request body could not be parsed.',
      );
    });

    it('rejects an unsupported Content-Encoding with 415 instead of 500', async () => {
      const response = await request(http)
        .post('/api/tasks')
        .set('Content-Type', 'application/json')
        .set('Content-Encoding', 'foo')
        .send('{"title":"x"}');
      expectProblem(response, 415);
    });

    it('rejects bodies over 100kb with 413', async () => {
      const response = await request(http)
        .post('/api/tasks')
        .send({ title: 'x'.repeat(101 * 1024) });
      expectProblem(response, 413);
    });
  });

  describe('skills', () => {
    it('lists skills with the developers who have them', async () => {
      const response = await request(http).get('/api/skills').expect(200);
      const body = response.body as Array<{
        name: string;
        developers: Array<{ name: string }>;
      }>;
      const frontend = body.find((s) => s.name === 'Frontend');
      expect(frontend?.developers.map((d) => d.name)).toEqual([
        'Alice',
        'Carol',
      ]);
      const backend = body.find((s) => s.name === 'Backend');
      expect(backend?.developers.map((d) => d.name)).toEqual([
        'Bob',
        'Carol',
        'Dave',
      ]);
    });

    it('gets one skill', async () => {
      const response = await request(http)
        .get(`/api/skills/${SEED_SKILLS.frontend.id}`)
        .expect(200);
      expect(response.body).toMatchObject({ name: 'Frontend' });
    });

    it('returns 400 for a non-UUID id and 404 for an unknown one', async () => {
      expectProblem(await request(http).get('/api/skills/not-a-uuid'), 400);
      expectProblem(
        await request(http).get(`/api/skills/${UNKNOWN_ID}`),
        404,
        'NOT_FOUND',
      );
    });
  });

  describe('developers', () => {
    it('lists developers with their skills and assigned tasks', async () => {
      const response = await request(http).get('/api/developers').expect(200);
      const body = response.body as Array<{
        name: string;
        skills: Array<{ name: string }>;
        tasks: unknown[];
      }>;
      const carol = body.find((d) => d.name === 'Carol');
      expect(carol?.skills.map((s) => s.name)).toEqual(['Backend', 'Frontend']);
      expect(Array.isArray(carol?.tasks)).toBe(true);
    });

    it('gets one developer', async () => {
      const bob = SEED_DEVELOPERS[1];
      const response = await request(http)
        .get(`/api/developers/${bob.id}`)
        .expect(200);
      expect(response.body).toMatchObject({
        name: 'Bob',
        skills: [{ name: 'Backend' }],
      });
    });

    it('returns 400 for a non-UUID id and 404 for an unknown one', async () => {
      expectProblem(await request(http).get('/api/developers/123'), 400);
      expectProblem(
        await request(http).get(`/api/developers/${UNKNOWN_ID}`),
        404,
        'NOT_FOUND',
      );
    });
  });
});
