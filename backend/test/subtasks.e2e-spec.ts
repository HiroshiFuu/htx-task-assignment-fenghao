import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import type { App } from 'supertest/types';
import type { PrismaClient } from '../src/generated/prisma/client';
import { createPrismaClient } from '../src/common/prisma/prisma-client.factory';
import { seed } from '../prisma/seed';
import { SEED_SKILLS } from '../prisma/seed-data';
import { createTestApp, expectProblem } from './utils/test-app';

interface TaskNode {
  id: string;
  title: string;
  status: string;
  parentId: string | null;
  skills: Array<{ id: string; name: string }>;
  subtasks: TaskNode[];
}

const UNKNOWN_ID = '00000000-0000-4000-8000-000000000000';

/** Wireframe 3: 1 / 1.1 / 1.1.1 / 1.1.2 */
const WIREFRAME_TREE = {
  title: '1 Profile feature',
  skillIds: [SEED_SKILLS.frontend.id],
  subtasks: [
    {
      title: '1.1 Profile API',
      skillIds: [SEED_SKILLS.backend.id],
      subtasks: [
        { title: '1.1.1 Upload endpoint' },
        { title: '1.1.2 Validate image', skillIds: [SEED_SKILLS.backend.id] },
      ],
    },
  ],
};

function chain(depth: number): object {
  let node: object = { title: `level ${String(depth)}` };
  for (let level = depth - 1; level >= 1; level -= 1) {
    node = { title: `level ${String(level)}`, subtasks: [node] };
  }
  return node;
}

const shape = (node: TaskNode): unknown => ({
  title: node.title,
  subtasks: node.subtasks.map(shape),
});

describe('Subtasks (e2e)', () => {
  let app: NestExpressApplication;
  let http: App;
  let prisma: PrismaClient;
  const rootIds: string[] = [];
  const savedCreateLimit = process.env.THROTTLE_CREATE_TASK_LIMIT;

  async function createTree(body: object): Promise<TaskNode> {
    const response = await request(http).post('/api/tasks').send(body);
    expect(response.status).toBe(201);
    const root = response.body as TaskNode;
    rootIds.push(root.id);
    return root;
  }

  const setStatus = (id: string, body: object) =>
    request(http).patch(`/api/tasks/${id}/status`).send(body);

  async function statusesOf(root: TaskNode): Promise<Record<string, string>> {
    const response = await request(http)
      .get(`/api/tasks/${root.id}`)
      .expect(200);
    const result: Record<string, string> = {};
    const visit = (node: TaskNode) => {
      result[node.title] = node.status;
      node.subtasks.forEach(visit);
    };
    visit(response.body as TaskNode);
    return result;
  }

  beforeAll(async () => {
    process.env.THROTTLE_CREATE_TASK_LIMIT = '1000';
    prisma = createPrismaClient();
    await seed(prisma);
    app = await createTestApp();
    http = app.getHttpServer();
  });

  afterAll(async () => {
    process.env.THROTTLE_CREATE_TASK_LIMIT = savedCreateLimit;
    // Subtasks are removed by ON DELETE CASCADE.
    await prisma.task.deleteMany({ where: { id: { in: rootIds } } });
    await prisma.$disconnect();
    await app.close();
  });

  describe('creating a tree', () => {
    it('saves the wireframe tree in one request and returns it nested in order', async () => {
      const root = await createTree(WIREFRAME_TREE);
      expect(shape(root)).toEqual({
        title: '1 Profile feature',
        subtasks: [
          {
            title: '1.1 Profile API',
            subtasks: [
              { title: '1.1.1 Upload endpoint', subtasks: [] },
              { title: '1.1.2 Validate image', subtasks: [] },
            ],
          },
        ],
      });
      const [child] = root.subtasks;
      expect(root.parentId).toBeNull();
      expect(child.parentId).toBe(root.id);
      expect(child.subtasks[0].parentId).toBe(child.id);
      // Decision D8: each subtask keeps its own skills.
      expect(root.skills.map((s) => s.name)).toEqual(['Frontend']);
      expect(child.skills.map((s) => s.name)).toEqual(['Backend']);
      expect(child.subtasks[0].skills).toEqual([]);
    });

    it('lists only top-level tasks, with subtasks nested', async () => {
      const root = await createTree(WIREFRAME_TREE);
      const response = await request(http).get('/api/tasks').expect(200);
      const tasks = response.body as TaskNode[];
      expect(tasks.every((t) => t.parentId === null)).toBe(true);
      const listed = tasks.find((t) => t.id === root.id);
      expect(listed && shape(listed)).toEqual(shape(root));
    });

    it('returns a subtree for GET /tasks/:id of a subtask', async () => {
      const root = await createTree(WIREFRAME_TREE);
      const child = root.subtasks[0];
      const response = await request(http)
        .get(`/api/tasks/${child.id}`)
        .expect(200);
      expect(shape(response.body as TaskNode)).toEqual(shape(child));
    });

    it('accepts 5 levels and rejects 6 with 400', async () => {
      await createTree(chain(5));
      const response = await request(http).post('/api/tasks').send(chain(6));
      expectProblem(response, 400, 'VALIDATION_FAILED');
      expect(response.body).toMatchObject({
        errors: [
          {
            field: 'subtasks',
            messages: ['Subtasks can be nested at most 5 levels deep.'],
          },
        ],
      });
    });

    it('accepts 50 tasks and rejects 51 with 400', async () => {
      const tree = (n: number) => ({
        title: 'root',
        subtasks: Array.from({ length: n - 1 }, (_, i) => ({
          title: `child ${String(i)}`,
        })),
      });
      const root = await createTree(tree(50));
      expect(root.subtasks).toHaveLength(49);
      expect(root.subtasks.map((s) => s.title).slice(0, 3)).toEqual([
        'child 0',
        'child 1',
        'child 2',
      ]);
      expectProblem(
        await request(http).post('/api/tasks').send(tree(51)),
        400,
        'VALIDATION_FAILED',
      );
    });

    it('rejects a pathologically deep body (still under 100kb) with 400, not 500', async () => {
      // Built as a string: supertest's own serializer would overflow on this object.
      const depth = 3500;
      const body =
        '{"title":"x","subtasks":['.repeat(depth) +
        '{"title":"x"}' +
        ']}'.repeat(depth);
      expect(body.length).toBeLessThan(100 * 1024);
      const response = await request(http)
        .post('/api/tasks')
        .set('Content-Type', 'application/json')
        .send(body);
      // Stopped by the global JSON depth guard before any DTO work.
      expectProblem(response, 400);
      expect((response.body as { detail: string }).detail).toBe(
        'Request body is nested too deeply.',
      );
    });

    it('validates nested titles and reports the nested field path', async () => {
      const response = await request(http)
        .post('/api/tasks')
        .send({ title: 'ok', subtasks: [{ title: 'ok' }, { title: '   ' }] });
      expectProblem(response, 400, 'VALIDATION_FAILED');
      const fields = (
        response.body as { errors: Array<{ field: string }> }
      ).errors.map((e) => e.field);
      expect(fields).toContain('subtasks.1.title');
    });

    it('rejects unknown fields inside subtasks', async () => {
      expectProblem(
        await request(http)
          .post('/api/tasks')
          .send({ title: 'ok', subtasks: [{ title: 'x', status: 'DONE' }] }),
        400,
        'VALIDATION_FAILED',
      );
    });

    it('rejects an unknown skill anywhere in the tree with 422 and writes nothing', async () => {
      const before = await prisma.task.count();
      expectProblem(
        await request(http)
          .post('/api/tasks')
          .send({
            title: 'ok',
            subtasks: [{ title: 'x', skillIds: [UNKNOWN_ID] }],
          }),
        422,
        'UNKNOWN_SKILL',
      );
      expect(await prisma.task.count()).toBe(before);
    });
  });

  describe('Done rule (decision D4)', () => {
    it('rejects Done on a parent while a grandchild is open, with 422 SUBTASKS_NOT_DONE', async () => {
      const root = await createTree(WIREFRAME_TREE);
      const child = root.subtasks[0];
      await setStatus(child.subtasks[0].id, { status: 'DONE' }).expect(200);
      // child.subtasks[1] (1.1.2) is still TODO, two levels below the root.
      const response = await setStatus(root.id, { status: 'DONE' });
      expectProblem(response, 422, 'SUBTASKS_NOT_DONE');
      expect(response.body).toMatchObject({
        openSubtasks: expect.arrayContaining([
          expect.objectContaining({ title: '1.1 Profile API' }),
          expect.objectContaining({ title: '1.1.2 Validate image' }),
        ]) as unknown,
      });
      expect((await statusesOf(root))['1 Profile feature']).toBe('TODO');
    });

    it('allows Done bottom-up once every descendant is Done', async () => {
      const root = await createTree(WIREFRAME_TREE);
      const child = root.subtasks[0];
      for (const id of [
        child.subtasks[0].id,
        child.subtasks[1].id,
        child.id,
        root.id,
      ]) {
        await setStatus(id, { status: 'DONE' }).expect(200);
      }
      expect(Object.values(await statusesOf(root))).toEqual([
        'DONE',
        'DONE',
        'DONE',
        'DONE',
      ]);
    });
  });

  describe('cascade rollback (decision D5)', () => {
    async function allDoneTree(): Promise<TaskNode> {
      const root = await createTree(WIREFRAME_TREE);
      const child = root.subtasks[0];
      for (const id of [
        child.subtasks[0].id,
        child.subtasks[1].id,
        child.id,
        root.id,
      ]) {
        await setStatus(id, { status: 'DONE' }).expect(200);
      }
      return root;
    }

    it('returns 409 listing Done ancestors nearest first, and changes nothing', async () => {
      const root = await allDoneTree();
      const leaf = root.subtasks[0].subtasks[0];

      const response = await setStatus(leaf.id, { status: 'TODO' });
      expectProblem(response, 409, 'CASCADE_CONFIRMATION_REQUIRED');
      expect(response.body).toMatchObject({
        detail:
          'Reopening "1.1.1 Upload endpoint" will move 2 completed parent task(s) back to In Progress.',
        affectedTasks: [
          { id: root.subtasks[0].id, title: '1.1 Profile API', status: 'DONE' },
          { id: root.id, title: '1 Profile feature', status: 'DONE' },
        ],
      });
      expect(Object.values(await statusesOf(root))).toEqual([
        'DONE',
        'DONE',
        'DONE',
        'DONE',
      ]);
    });

    it('with confirmCascade rolls the ancestors back to IN_PROGRESS in the same request', async () => {
      const root = await allDoneTree();
      const child = root.subtasks[0];
      const leaf = child.subtasks[0];

      const response = await setStatus(leaf.id, {
        status: 'TODO',
        confirmCascade: true,
      }).expect(200);
      const body = response.body as {
        task: TaskNode;
        cascadedTaskIds: string[];
      };
      expect(body.task).toMatchObject({ id: leaf.id, status: 'TODO' });
      expect([...body.cascadedTaskIds].sort()).toEqual(
        [root.id, child.id].sort(),
      );

      expect(await statusesOf(root)).toEqual({
        '1 Profile feature': 'IN_PROGRESS',
        '1.1 Profile API': 'IN_PROGRESS',
        '1.1.1 Upload endpoint': 'TODO',
        // The sibling keeps its own status.
        '1.1.2 Validate image': 'DONE',
      });
    });

    it('needs no confirmation when no ancestor is Done', async () => {
      const root = await createTree(WIREFRAME_TREE);
      const leaf = root.subtasks[0].subtasks[0];
      await setStatus(leaf.id, { status: 'DONE' }).expect(200);
      const response = await setStatus(leaf.id, {
        status: 'IN_PROGRESS',
      }).expect(200);
      expect(
        (response.body as { cascadedTaskIds: string[] }).cascadedTaskIds,
      ).toEqual([]);
    });
  });

  it('returns the subtree after assigning a parent task', async () => {
    const root = await createTree(WIREFRAME_TREE);
    const child = root.subtasks[0];
    const response = await request(http)
      .patch(`/api/tasks/${child.id}/assignee`)
      .send({ developerId: 'a0000000-0000-4000-8000-000000000002' })
      .expect(200);
    expect(shape(response.body as TaskNode)).toEqual(shape(child));
  });
});
