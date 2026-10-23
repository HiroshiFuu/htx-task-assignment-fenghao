import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import type { App } from 'supertest/types';
import type { PrismaClient } from '../src/generated/prisma/client';
import { createPrismaClient } from '../src/common/prisma/prisma-client.factory';
import {
  Classification,
  ClassificationItem,
  SkillClassifier,
} from '../src/skill-inference/skill-classifier';
import { seed } from '../prisma/seed';
import { SEED_SKILLS } from '../prisma/seed-data';
import { createTestApp } from './utils/test-app';

interface TaskNode {
  id: string;
  title: string;
  skills: Array<{ name: string }>;
  skillSource: string;
  subtasks: TaskNode[];
}

const names = (task: TaskNode) => task.skills.map((s) => s.name).sort();

/** The three acceptance examples from the brief (PLAN §5). */
const EXAMPLES = [
  {
    title:
      'As a visitor, I want to see a responsive homepage so that I can easily navigate on both desktop and mobile devices.',
    skills: ['Frontend'],
  },
  {
    title:
      'As a system administrator, I want audit logs of all data access and modifications so that I can ensure compliance with data protection regulations and investigate any security incidents.',
    skills: ['Backend'],
  },
  {
    title:
      'As a logged-in user, I want to update my profile information and upload a profile picture so that my account details are accurate and personalized.',
    skills: ['Backend', 'Frontend'],
  },
];

/** Stands in for Gemini: answers Frontend for everything and records each batch. */
class RecordingLlm extends SkillClassifier {
  readonly batches: ClassificationItem[][] = [];
  classifyBatch(items: readonly ClassificationItem[]) {
    this.batches.push([...items]);
    return Promise.resolve(
      new Map<string, Classification>(
        items.map((item) => [
          item.ref,
          { skills: ['Frontend'], source: 'LLM' },
        ]),
      ),
    );
  }
}

describe('Skill inference (e2e)', () => {
  let prisma: PrismaClient;
  const createdIds: string[] = [];
  const savedCreateLimit = process.env.THROTTLE_CREATE_TASK_LIMIT;

  async function create(http: App, body: object): Promise<TaskNode> {
    const response = await request(http)
      .post('/api/tasks')
      .send(body)
      .expect(201);
    const task = response.body as TaskNode;
    createdIds.push(task.id);
    return task;
  }

  beforeAll(async () => {
    process.env.THROTTLE_CREATE_TASK_LIMIT = '1000';
    prisma = createPrismaClient();
    await seed(prisma);
  });

  afterAll(async () => {
    process.env.THROTTLE_CREATE_TASK_LIMIT = savedCreateLimit;
    await prisma.task.deleteMany({ where: { id: { in: createdIds } } });
    await prisma.$disconnect();
  });

  describe('without an LLM (keyword fallback, no GEMINI_API_KEY)', () => {
    let app: NestExpressApplication;
    let http: App;

    beforeAll(async () => {
      app = await createTestApp();
      http = app.getHttpServer();
    });

    afterAll(async () => {
      await app.close();
    });

    it.each(EXAMPLES)(
      'infers $skills for a brief example and marks it FALLBACK',
      async ({ title, skills }) => {
        const task = await create(http, { title });
        expect(names(task)).toEqual(skills);
        expect(task.skillSource).toBe('FALLBACK');

        // Persisted, not just computed for the response.
        const reread = await request(http)
          .get(`/api/tasks/${task.id}`)
          .expect(200);
        expect((reread.body as TaskNode).skillSource).toBe('FALLBACK');
      },
    );

    it('keeps user-chosen skills as USER', async () => {
      const task = await create(http, {
        title: 'Audit logging',
        skillIds: [SEED_SKILLS.frontend.id],
      });
      expect(names(task)).toEqual(['Frontend']);
      expect(task.skillSource).toBe('USER');
    });
  });

  describe('with an LLM', () => {
    let app: NestExpressApplication;
    let http: App;
    const llm = new RecordingLlm();

    beforeAll(async () => {
      app = await createTestApp({ classifier: llm });
      http = app.getHttpServer();
    });

    afterAll(async () => {
      await app.close();
    });

    it('classifies only tasks without skills, in a single call for the whole tree', async () => {
      llm.batches.length = 0;
      const root = await create(http, {
        title: 'Profile feature',
        skillIds: [SEED_SKILLS.backend.id],
        subtasks: [
          { title: 'Page layout', subtasks: [{ title: 'Avatar widget' }] },
          { title: 'Upload API', skillIds: [SEED_SKILLS.backend.id] },
        ],
      });

      expect(llm.batches).toEqual([
        [
          { ref: '0.0', title: 'Page layout' },
          { ref: '0.0.0', title: 'Avatar widget' },
        ],
      ]);
      const [layout, upload] = root.subtasks;
      expect([
        root.skillSource,
        layout.skillSource,
        layout.subtasks[0].skillSource,
        upload.skillSource,
      ]).toEqual(['USER', 'LLM', 'LLM', 'USER']);
      expect(names(layout)).toEqual(['Frontend']);
      expect(names(root)).toEqual(['Backend']);
    });

    it('does not call the LLM when every task has skills', async () => {
      llm.batches.length = 0;
      await create(http, {
        title: 'Manual',
        skillIds: [SEED_SKILLS.frontend.id],
      });
      expect(llm.batches).toHaveLength(0);
    });

    it('does not call the LLM when a user skill id is unknown (fails fast with 422)', async () => {
      llm.batches.length = 0;
      await request(http)
        .post('/api/tasks')
        .send({
          title: 'x',
          skillIds: ['00000000-0000-4000-8000-000000000000'],
          subtasks: [{ title: 'needs inference' }],
        })
        .expect(422);
      expect(llm.batches).toHaveLength(0);
    });
  });
});
