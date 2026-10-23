import { ResilientClassifier } from './resilient-classifier';
import {
  Classification,
  ClassificationItem,
  ClassifierError,
  SkillClassifier,
} from './skill-classifier';

const ALLOWED = ['Backend', 'Frontend'];
const ITEMS: ClassificationItem[] = [
  { ref: 'a', title: 'A' },
  { ref: 'b', title: 'B' },
];
const OPTIONS = { timeoutMs: 50, maxRetries: 1, retryDelayMs: 100 };

const llm = (skills: string[]): Classification => ({ skills, source: 'LLM' });

class ScriptedClassifier extends SkillClassifier {
  readonly calls: Array<{ refs: string[]; signal?: AbortSignal }> = [];
  constructor(
    private readonly script: Array<() => Promise<Map<string, Classification>>>,
  ) {
    super();
  }
  classifyBatch(
    items: readonly ClassificationItem[],
    _allowed: readonly string[],
    signal?: AbortSignal,
  ) {
    this.calls.push({ refs: items.map((i) => i.ref), signal });
    const next =
      this.script[Math.min(this.calls.length - 1, this.script.length - 1)];
    return next();
  }
}

const fallbackFor = () =>
  new ScriptedClassifier([
    () =>
      Promise.resolve(
        new Map<string, Classification>([
          ['a', { skills: ['Backend', 'Frontend'], source: 'FALLBACK' }],
          ['b', { skills: ['Backend', 'Frontend'], source: 'FALLBACK' }],
        ]),
      ),
  ]);

function setup(script: Array<() => Promise<Map<string, Classification>>>) {
  const primary = new ScriptedClassifier(script);
  const fallback = fallbackFor();
  const waits: number[] = [];
  const classifier = new ResilientClassifier(
    primary,
    fallback,
    OPTIONS,
    (ms) => {
      waits.push(ms);
      return Promise.resolve();
    },
  );
  return { primary, fallback, waits, classifier };
}

const ok = () =>
  Promise.resolve(
    new Map([
      ['a', llm(['Frontend'])],
      ['b', llm(['Backend'])],
    ]),
  );
const fail = (retryable: boolean) => () =>
  Promise.reject(new ClassifierError('boom', retryable));

describe('ResilientClassifier', () => {
  it('returns the primary result when it labels everything', async () => {
    const { classifier, fallback } = setup([ok]);
    const result = await classifier.classifyBatch(ITEMS, ALLOWED);
    expect(result.get('a')).toEqual(llm(['Frontend']));
    expect(fallback.calls).toHaveLength(0);
  });

  it('retries a retryable error (429/5xx) once with backoff, then succeeds', async () => {
    const { classifier, primary, waits, fallback } = setup([fail(true), ok]);
    const result = await classifier.classifyBatch(ITEMS, ALLOWED);
    expect(primary.calls).toHaveLength(2);
    expect(waits).toEqual([100]);
    expect(result.get('b')?.source).toBe('LLM');
    expect(fallback.calls).toHaveLength(0);
  });

  it('falls back after the retry budget is spent', async () => {
    const { classifier, primary, fallback } = setup([fail(true)]);
    const result = await classifier.classifyBatch(ITEMS, ALLOWED);
    expect(primary.calls).toHaveLength(2);
    expect(fallback.calls).toEqual([{ refs: ['a', 'b'], signal: undefined }]);
    expect(result.get('a')?.source).toBe('FALLBACK');
  });

  it('does not retry a non-retryable error', async () => {
    const { classifier, primary, fallback } = setup([fail(false)]);
    await classifier.classifyBatch(ITEMS, ALLOWED);
    expect(primary.calls).toHaveLength(1);
    expect(fallback.calls).toHaveLength(1);
  });

  it('times out, aborts the request and falls back without retrying', async () => {
    const { classifier, primary, fallback } = setup([
      () => new Promise<never>(() => undefined),
    ]);
    const result = await classifier.classifyBatch(ITEMS, ALLOWED);
    expect(primary.calls).toHaveLength(1);
    expect(primary.calls[0].signal?.aborted).toBe(true);
    expect(fallback.calls).toHaveLength(1);
    expect(result.get('b')?.source).toBe('FALLBACK');
  });

  it('uses the fallback only for items the primary left unlabelled', async () => {
    const { classifier, fallback } = setup([
      () => Promise.resolve(new Map([['a', llm(['Frontend'])]])),
    ]);
    const result = await classifier.classifyBatch(ITEMS, ALLOWED);
    expect(fallback.calls.map((c) => c.refs)).toEqual([['b']]);
    expect(result.get('a')?.source).toBe('LLM');
    expect(result.get('b')?.source).toBe('FALLBACK');
  });

  it('falls back on unexpected (non-classifier) errors too', async () => {
    const { classifier, fallback } = setup([
      () => Promise.reject(new Error('bug')),
    ]);
    await classifier.classifyBatch(ITEMS, ALLOWED);
    expect(fallback.calls).toHaveLength(1);
  });

  it('does nothing for an empty batch', async () => {
    const { classifier, primary } = setup([ok]);
    expect((await classifier.classifyBatch([], ALLOWED)).size).toBe(0);
    expect(primary.calls).toHaveLength(0);
  });
});
