import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import type { App } from 'supertest/types';
import type { PrismaClient } from '../src/generated/prisma/client';
import { createPrismaClient } from '../src/common/prisma/prisma-client.factory';
import { seed } from '../prisma/seed';
import { SEED_DEVELOPERS, SEED_SKILLS } from '../prisma/seed-data';
import { createTestApp, expectProblem } from './utils/test-app';

const [ALICE, BOB, CAROL] = SEED_DEVELOPERS;
const FRONTEND = SEED_SKILLS.frontend;
const BACKEND = SEED_SKILLS.backend;
const UNKNOWN_ID = '00000000-0000-4000-8000-000000000000';

interface TaskNode {
  id: string;
  title: string;
  status: string;
  skills: Array<{ id: string; name: string }>;
  skillSource: string;
  assignee: { id: string; name: string } | null;
  parentId: string | null;
  subtasks: TaskNode[];
  createdAt: string;
  updatedAt: string;
}

describe('Tasks API (e2e)', () => {
  let app: NestExpressApplication;
  let http: App;
  let prisma: PrismaClient;
  const createdIds: string[] = [];
  const savedCreateLimit = process.env.THROTTLE_CREATE_TASK_LIMIT;

  async function createTask(body: object): Promise<TaskNode> {
    const response = await request(http)
      .post('/api/tasks')
      .send(body)
      .expect(201);
    const task = response.body as TaskNode;
    createdIds.push(task.id);
    return task;
  }

  beforeAll(async () => {
    // Functional tests create more tasks than the production create limit allows.
    process.env.THROTTLE_CREATE_TASK_LIMIT = '1000';
    prisma = createPrismaClient();
    await seed(prisma);
    app = await createTestApp();
    http = app.getHttpServer();
  });

  afterAll(async () => {
    process.env.THROTTLE_CREATE_TASK_LIMIT = savedCreateLimit;
    await prisma.task.deleteMany({ where: { id: { in: createdIds } } });
    await prisma.$disconnect();
    await app.close();
  });

  describe('POST /api/tasks', () => {
    it('creates an unassigned TODO task with trimmed title and deduplicated skills', async () => {
      const task = await createTask({
        title: '  Build the landing page  ',
        skillIds: [FRONTEND.id, FRONTEND.id],
      });
      expect(task).toMatchObject({
        title: 'Build the landing page',
        status: 'TODO',
        assignee: null,
        skills: [{ id: FRONTEND.id, name: 'Frontend' }],
        skillSource: 'USER',
        parentId: null,
        subtasks: [],
      });
      expect(Date.parse(task.createdAt)).not.toBeNaN();
    });

    it('rejects unknown fields such as status and assigneeId with 400', async () => {
      const response = await request(http)
        .post('/api/tasks')
        .send({ title: 'x', status: 'DONE', assigneeId: ALICE.id });
      expectProblem(response, 400, 'VALIDATION_FAILED');
      const fields = (
        response.body as { errors: Array<{ field: string }> }
      ).errors.map((e) => e.field);
      expect(fields).toEqual(expect.arrayContaining(['status', 'assigneeId']));
    });

    it.each([
      ['a blank title', { title: '   ' }],
      ['a missing title', {}],
      ['a title over 500 characters', { title: 'x'.repeat(501) }],
      ['a non-string title', { title: 42 }],
      ['non-UUID skill ids', { title: 'x', skillIds: ['frontend'] }],
      [
        'too many skill ids',
        {
          title: 'x',
          skillIds: Array.from(
            { length: 21 },
            (_, i) => `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`,
          ),
        },
      ],
    ])('rejects %s with 400', async (_label, body) => {
      expectProblem(
        await request(http).post('/api/tasks').send(body),
        400,
        'VALIDATION_FAILED',
      );
    });

    it('rejects titles with control characters (PG cannot store NUL)', async () => {
      for (const title of ['a\u0000b', 'line\nbreak', 'tab\there']) {
        expectProblem(
          await request(http).post('/api/tasks').send({ title }),
          400,
          'VALIDATION_FAILED',
        );
      }
    });

    it('accepts uppercase skill UUIDs and deduplicates them case-insensitively', async () => {
      const task = await createTask({
        title: 'Uppercase ids',
        skillIds: [FRONTEND.id.toUpperCase(), FRONTEND.id],
      });
      expect(task.skills).toEqual([{ id: FRONTEND.id, name: 'Frontend' }]);
    });

    it('accepts a 500-character title', async () => {
      const task = await createTask({ title: 'y'.repeat(500) });
      expect(task.title).toHaveLength(500);
    });

    it('rejects unknown skill ids with 422 UNKNOWN_SKILL', async () => {
      const response = await request(http)
        .post('/api/tasks')
        .send({ title: 'x', skillIds: [FRONTEND.id, UNKNOWN_ID] });
      expectProblem(response, 422, 'UNKNOWN_SKILL');
      expect(response.body).toMatchObject({ unknownSkillIds: [UNKNOWN_ID] });
    });
  });

  describe('GET /api/tasks', () => {
    it('lists created tasks and gets one by id', async () => {
      const task = await createTask({
        title: 'Listed task',
        skillIds: [BACKEND.id],
      });
      const list = await request(http).get('/api/tasks').expect(200);
      expect((list.body as TaskNode[]).map((t) => t.id)).toContain(task.id);

      const one = await request(http).get(`/api/tasks/${task.id}`).expect(200);
      expect(one.body).toMatchObject({ id: task.id, title: 'Listed task' });
    });

    it('returns 400 for a non-UUID id and 404 for an unknown one', async () => {
      expectProblem(await request(http).get('/api/tasks/abc'), 400);
      expectProblem(
        await request(http).get(`/api/tasks/${UNKNOWN_ID}`),
        404,
        'NOT_FOUND',
      );
    });
  });

  describe('PATCH /api/tasks/:id/assignee', () => {
    let frontendTask: TaskNode;
    let fullStackTask: TaskNode;

    beforeAll(async () => {
      frontendTask = await createTask({
        title: 'Frontend task',
        skillIds: [FRONTEND.id],
      });
      fullStackTask = await createTask({
        title: 'Full-stack task',
        skillIds: [FRONTEND.id, BACKEND.id],
      });
    });

    it('rejects Bob for a Frontend task with 422 SKILL_MISMATCH', async () => {
      const response = await request(http)
        .patch(`/api/tasks/${frontendTask.id}/assignee`)
        .send({ developerId: BOB.id });
      expectProblem(response, 422, 'SKILL_MISMATCH');
      expect(response.body).toMatchObject({
        detail: 'Bob lacks the required skill(s): Frontend.',
        missingSkills: [{ id: FRONTEND.id, name: 'Frontend' }],
      });
    });

    it('assigns Alice to the Frontend task and shows it on her profile', async () => {
      const response = await request(http)
        .patch(`/api/tasks/${frontendTask.id}/assignee`)
        .send({ developerId: ALICE.id })
        .expect(200);
      expect((response.body as TaskNode).assignee).toEqual({
        id: ALICE.id,
        name: 'Alice',
      });

      const alice = await request(http)
        .get(`/api/developers/${ALICE.id}`)
        .expect(200);
      expect(
        (alice.body as { tasks: Array<{ id: string }> }).tasks.map((t) => t.id),
      ).toContain(frontendTask.id);
    });

    it('assigns Carol to a task needing Frontend and Backend, but not Alice', async () => {
      expectProblem(
        await request(http)
          .patch(`/api/tasks/${fullStackTask.id}/assignee`)
          .send({ developerId: ALICE.id }),
        422,
        'SKILL_MISMATCH',
      );
      const response = await request(http)
        .patch(`/api/tasks/${fullStackTask.id}/assignee`)
        .send({ developerId: CAROL.id })
        .expect(200);
      expect((response.body as TaskNode).assignee?.name).toBe('Carol');
    });

    it('unassigns with developerId null', async () => {
      const response = await request(http)
        .patch(`/api/tasks/${frontendTask.id}/assignee`)
        .send({ developerId: null })
        .expect(200);
      expect((response.body as TaskNode).assignee).toBeNull();
    });

    it('rejects a missing or malformed developerId with 400', async () => {
      for (const body of [
        {},
        { developerId: 'alice' },
        { developerId: ALICE.id, extra: 1 },
      ]) {
        expectProblem(
          await request(http)
            .patch(`/api/tasks/${frontendTask.id}/assignee`)
            .send(body),
          400,
          'VALIDATION_FAILED',
        );
      }
    });

    it('rejects an unknown developer with 422 UNKNOWN_DEVELOPER', async () => {
      expectProblem(
        await request(http)
          .patch(`/api/tasks/${frontendTask.id}/assignee`)
          .send({ developerId: UNKNOWN_ID }),
        422,
        'UNKNOWN_DEVELOPER',
      );
    });

    it('returns 404 for an unknown task and 400 for a non-UUID id', async () => {
      expectProblem(
        await request(http)
          .patch(`/api/tasks/${UNKNOWN_ID}/assignee`)
          .send({ developerId: null }),
        404,
        'NOT_FOUND',
      );
      expectProblem(
        await request(http)
          .patch('/api/tasks/1/assignee')
          .send({ developerId: null }),
        400,
      );
    });
  });

  describe('PATCH /api/tasks/:id/status', () => {
    it('moves a task through IN_PROGRESS to DONE and back', async () => {
      const task = await createTask({ title: 'Status task' });
      for (const status of ['IN_PROGRESS', 'DONE', 'TODO']) {
        const response = await request(http)
          .patch(`/api/tasks/${task.id}/status`)
          .send({ status })
          .expect(200);
        expect(response.body).toMatchObject({
          task: { id: task.id, status },
          cascadedTaskIds: [],
        });
      }
    });

    it('rejects an invalid status or confirmCascade type with 400', async () => {
      const task = await createTask({ title: 'Invalid status task' });
      for (const body of [
        { status: 'FINISHED' },
        {},
        { status: 'DONE', confirmCascade: 'yes' },
      ]) {
        expectProblem(
          await request(http).patch(`/api/tasks/${task.id}/status`).send(body),
          400,
          'VALIDATION_FAILED',
        );
      }
    });

    it('returns 404 for an unknown task', async () => {
      expectProblem(
        await request(http)
          .patch(`/api/tasks/${UNKNOWN_ID}/status`)
          .send({ status: 'DONE' }),
        404,
        'NOT_FOUND',
      );
    });
  });
});
