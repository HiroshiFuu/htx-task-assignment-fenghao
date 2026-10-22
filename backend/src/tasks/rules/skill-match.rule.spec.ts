import { AssignmentContext } from './assignment-rule';
import { SkillMatchRule } from './skill-match.rule';

const FRONTEND = { id: 'skill-frontend', name: 'Frontend' };
const BACKEND = { id: 'skill-backend', name: 'Backend' };

const developers = {
  alice: { id: 'dev-alice', name: 'Alice', skillIds: [FRONTEND.id] },
  bob: { id: 'dev-bob', name: 'Bob', skillIds: [BACKEND.id] },
  carol: {
    id: 'dev-carol',
    name: 'Carol',
    skillIds: [FRONTEND.id, BACKEND.id],
  },
};

function context(
  taskSkills: AssignmentContext['task']['skills'],
  developer: AssignmentContext['developer'],
): AssignmentContext {
  return { task: { id: 'task-1', skills: taskSkills }, developer };
}

describe('SkillMatchRule', () => {
  const rule = new SkillMatchRule();

  it('allows Carol to take a task requiring Frontend and Backend', () => {
    expect(
      rule.evaluate(context([FRONTEND, BACKEND], developers.carol)),
    ).toEqual({
      kind: 'allow',
    });
  });

  it('rejects Alice for a task requiring Frontend and Backend, naming the missing skill', () => {
    expect(
      rule.evaluate(context([FRONTEND, BACKEND], developers.alice)),
    ).toEqual({
      kind: 'reject',
      code: 'SKILL_MISMATCH',
      detail: 'Alice lacks the required skill(s): Backend.',
      extensions: { missingSkills: [BACKEND] },
    });
  });

  it('allows Alice to take a Frontend-only task', () => {
    expect(rule.evaluate(context([FRONTEND], developers.alice)).kind).toBe(
      'allow',
    );
  });

  it('rejects Bob for a Frontend-only task', () => {
    const result = rule.evaluate(context([FRONTEND], developers.bob));
    expect(result).toMatchObject({ kind: 'reject', code: 'SKILL_MISMATCH' });
  });

  it('allows a developer with extra skills (superset semantics, decision D3)', () => {
    expect(rule.evaluate(context([BACKEND], developers.carol)).kind).toBe(
      'allow',
    );
  });

  it('allows anyone when the task requires no skills', () => {
    expect(rule.evaluate(context([], developers.bob)).kind).toBe('allow');
  });

  it('lists every missing skill', () => {
    const noSkills = { id: 'dev-x', name: 'Xavier', skillIds: [] };
    expect(rule.evaluate(context([BACKEND, FRONTEND], noSkills))).toMatchObject(
      {
        detail: 'Xavier lacks the required skill(s): Backend, Frontend.',
        extensions: { missingSkills: [BACKEND, FRONTEND] },
      },
    );
  });
});
