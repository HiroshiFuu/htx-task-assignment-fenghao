import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import type { App } from 'supertest/types';
import { createPrismaClient } from '../src/common/prisma/prisma-client.factory';
import { createTestApp, expectProblem } from './utils/test-app';

describe('POST /api/tasks rate limit (e2e)', () => {
  const createdIds: string[] = [];
  const saved = {
    limit: process.env.THROTTLE_CREATE_TASK_LIMIT,
    hops: process.env.TRUST_PROXY_HOPS,
  };

  beforeAll(() => {
    process.env.THROTTLE_CREATE_TASK_LIMIT = '2';
  });

  afterAll(async () => {
    process.env.THROTTLE_CREATE_TASK_LIMIT = saved.limit;
    process.env.TRUST_PROXY_HOPS = saved.hops;
    const prisma = createPrismaClient();
    await prisma.task.deleteMany({ where: { id: { in: createdIds } } });
    await prisma.$disconnect();
  });

  async function create(http: App, forwardedFor?: string) {
    const req = request(http).post('/api/tasks');
    if (forwardedFor) req.set('X-Forwarded-For', forwardedFor);
    const response = await req.send({ title: 'Throttled task' });
    if (response.status === 201) {
      createdIds.push((response.body as { id: string }).id);
    }
    return response;
  }

  describe('direct (no proxy)', () => {
    let app: NestExpressApplication;

    beforeAll(async () => {
      delete process.env.TRUST_PROXY_HOPS;
      app = await createTestApp();
    });

    afterAll(async () => {
      await app.close();
    });

    it('returns 429 problem+json once the stricter create limit is exceeded', async () => {
      const http = app.getHttpServer() as App;
      for (let i = 0; i < 2; i += 1) {
        expect((await create(http)).status).toBe(201);
      }
      expectProblem(await create(http), 429);
      // Reads use the separate, larger global budget.
      await request(http).get('/api/tasks').expect(200);
    });

    it('ignores a spoofed X-Forwarded-For, so it cannot reset the budget', async () => {
      const http = app.getHttpServer() as App;
      expectProblem(await create(http, '198.51.100.7'), 429);
    });
  });

  describe('behind one trusted proxy (TRUST_PROXY_HOPS=1, as in Docker)', () => {
    let app: NestExpressApplication;

    beforeAll(async () => {
      process.env.TRUST_PROXY_HOPS = '1';
      app = await createTestApp();
    });

    afterAll(async () => {
      await app.close();
    });

    it('limits each client separately instead of everyone behind the proxy together', async () => {
      const http = app.getHttpServer() as App;
      for (let i = 0; i < 2; i += 1) {
        expect((await create(http, '203.0.113.1')).status).toBe(201);
      }
      expectProblem(await create(http, '203.0.113.1'), 429);
      // Another client still has its own budget.
      expect((await create(http, '203.0.113.2')).status).toBe(201);
    });
  });
});
