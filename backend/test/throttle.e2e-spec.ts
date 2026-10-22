import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import type { App } from 'supertest/types';
import { createPrismaClient } from '../src/common/prisma/prisma-client.factory';
import { createTestApp, expectProblem } from './utils/test-app';

describe('POST /api/tasks rate limit (e2e)', () => {
  let app: NestExpressApplication;
  const createdIds: string[] = [];
  const saved = process.env.THROTTLE_CREATE_TASK_LIMIT;

  beforeAll(async () => {
    process.env.THROTTLE_CREATE_TASK_LIMIT = '2';
    app = await createTestApp();
  });

  afterAll(async () => {
    process.env.THROTTLE_CREATE_TASK_LIMIT = saved;
    const prisma = createPrismaClient();
    await prisma.task.deleteMany({ where: { id: { in: createdIds } } });
    await prisma.$disconnect();
    await app.close();
  });

  it('returns 429 problem+json once the stricter create limit is exceeded', async () => {
    const http = app.getHttpServer() as App;
    for (let i = 0; i < 2; i += 1) {
      const response = await request(http)
        .post('/api/tasks')
        .send({ title: `Throttle ${i}` })
        .expect(201);
      createdIds.push((response.body as { id: string }).id);
    }

    expectProblem(
      await request(http).post('/api/tasks').send({ title: 'Throttle 2' }),
      429,
    );
    // Reads use the separate, larger global budget.
    await request(http).get('/api/tasks').expect(200);
  });
});
