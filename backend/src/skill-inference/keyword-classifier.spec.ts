import { KeywordClassifier } from './keyword-classifier';

const ALL = ['Backend', 'Frontend'];

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

async function classify(title: string, allowed: readonly string[] = ALL) {
  const result = await new KeywordClassifier().classifyBatch(
    [{ ref: 'r', title }],
    allowed,
  );
  return result.get('r');
}

describe('KeywordClassifier', () => {
  it.each(EXAMPLES)('classifies "$title"', async ({ title, skills }) => {
    expect(await classify(title)).toEqual({ skills, source: 'FALLBACK' });
  });

  it('classifies every item of a batch under its own ref', async () => {
    const result = await new KeywordClassifier().classifyBatch(
      EXAMPLES.map(({ title }, i) => ({ ref: String(i), title })),
      ALL,
    );
    expect([...result.keys()]).toEqual(['0', '1', '2']);
    expect(result.get('1')?.skills).toEqual(['Backend']);
  });

  it('never returns no skills: an unmatched title requires every skill (D6)', async () => {
    expect((await classify('Do the thing'))?.skills).toEqual(ALL);
  });

  it('only answers with skills that exist, matching names case-insensitively', async () => {
    expect((await classify(EXAMPLES[2].title, ['backend']))?.skills).toEqual([
      'backend',
    ]);
    expect((await classify('Fix the CSS layout', ['Ops']))?.skills).toEqual([
      'Ops',
    ]);
  });

  it('matches whole words only', async () => {
    // "paged" and "databases?" style near-misses must not count as keywords.
    expect((await classify('Rapidly upgrade dependencies'))?.skills).toEqual(
      ALL,
    );
  });
});
