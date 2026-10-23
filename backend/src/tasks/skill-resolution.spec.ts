import {
  Classification,
  ClassificationItem,
  SkillClassifier,
} from '../skill-inference/skill-classifier';
import type { CreateTaskDto } from './dto/create-task.dto';
import { resolveTreeSkills } from './skill-resolution';

const SKILLS = [
  { id: 'id-backend', name: 'Backend' },
  { id: 'id-frontend', name: 'Frontend' },
];

class RecordingClassifier extends SkillClassifier {
  readonly batches: Array<{ items: ClassificationItem[]; allowed: string[] }> =
    [];
  constructor(private readonly answers: Record<string, Classification>) {
    super();
  }
  classifyBatch(
    items: readonly ClassificationItem[],
    allowed: readonly string[],
  ) {
    this.batches.push({ items: [...items], allowed: [...allowed] });
    return Promise.resolve(new Map(Object.entries(this.answers)));
  }
}

const tree: CreateTaskDto = {
  title: 'Root',
  skillIds: ['id-frontend'],
  subtasks: [
    {
      title: 'Child',
      subtasks: [
        { title: 'Grandchild', skillIds: ['id-backend'] },
        { title: 'Leaf' },
      ],
    },
  ],
};

describe('resolveTreeSkills', () => {
  it('sends only tasks without skills, in one batch, and keeps user skills as USER', async () => {
    const classifier = new RecordingClassifier({
      '0.0': { skills: ['Backend'], source: 'LLM' },
      '0.0.1': { skills: ['Frontend', 'Backend'], source: 'FALLBACK' },
    });

    const resolved = await resolveTreeSkills(tree, SKILLS, classifier);

    expect(classifier.batches).toEqual([
      {
        items: [
          { ref: '0.0', title: 'Child' },
          { ref: '0.0.1', title: 'Leaf' },
        ],
        allowed: ['Backend', 'Frontend'],
      },
    ]);
    expect(resolved).toEqual({
      title: 'Root',
      skillIds: ['id-frontend'],
      skillSource: 'USER',
      subtasks: [
        {
          title: 'Child',
          skillIds: ['id-backend'],
          skillSource: 'LLM',
          subtasks: [
            {
              title: 'Grandchild',
              skillIds: ['id-backend'],
              skillSource: 'USER',
              subtasks: [],
            },
            {
              title: 'Leaf',
              skillIds: ['id-frontend', 'id-backend'],
              skillSource: 'FALLBACK',
              subtasks: [],
            },
          ],
        },
      ],
    });
  });

  it('does not call the classifier when every task has skills', async () => {
    const classifier = new RecordingClassifier({});
    await resolveTreeSkills(
      { title: 'Only', skillIds: ['id-backend'] },
      SKILLS,
      classifier,
    );
    expect(classifier.batches).toHaveLength(0);
  });

  it('leaves a task unlabelled (FALLBACK) when there are no skills to choose from', async () => {
    const classifier = new RecordingClassifier({});
    const resolved = await resolveTreeSkills({ title: 'X' }, [], classifier);
    expect(classifier.batches).toHaveLength(0);
    expect(resolved).toMatchObject({ skillIds: [], skillSource: 'FALLBACK' });
  });
});
