import { GeminiClassifier, type GenerateContent } from './gemini-classifier';
import { ClassifierError } from './skill-classifier';

const ALLOWED = ['Backend', 'Frontend'];
const ITEMS = [
  { ref: '0', title: 'Build the landing page' },
  { ref: '0.0', title: 'Store uploads in the database' },
];

type Request = Parameters<GenerateContent>[0];

function fakeGenerate(response: { text: string | undefined } | Error) {
  const calls: Request[] = [];
  const generate: GenerateContent = (request) => {
    calls.push(request);
    return response instanceof Error
      ? Promise.reject(response)
      : Promise.resolve(response);
  };
  return { generate, calls };
}

const json = (value: unknown) => ({ text: JSON.stringify(value) });

async function caught(promise: Promise<unknown>): Promise<ClassifierError> {
  try {
    await promise;
  } catch (error) {
    if (error instanceof ClassifierError) return error;
    throw error;
  }
  throw new Error('expected a ClassifierError');
}

describe('GeminiClassifier', () => {
  it('sends titles only as JSON data, with a schema limited to the allowed skills', async () => {
    const { generate, calls } = fakeGenerate(json({ results: [] }));
    await new GeminiClassifier(generate, 'test-model').classifyBatch(
      ITEMS,
      ALLOWED,
    );

    const [request] = calls;
    expect(request.model).toBe('test-model');
    expect(JSON.parse(request.contents)).toEqual({
      tasks: [
        { id: '0', title: 'Build the landing page' },
        { id: '0.0', title: 'Store uploads in the database' },
      ],
    });
    expect(request.config.systemInstruction).not.toContain('landing page');
    expect(request.config.systemInstruction).toMatch(/untrusted/i);
    expect(request.config.responseMimeType).toBe('application/json');
    expect(request.config.temperature).toBe(0);
    expect(request.config.maxOutputTokens).toBeGreaterThan(0);
    expect(request.config.systemInstruction).toMatch(/only its own task/i);
    expect(
      request.config.responseSchema.properties?.results.items?.properties
        ?.skills.items?.enum,
    ).toEqual(ALLOWED);
  });

  it('maps results by id and marks them LLM', async () => {
    const { generate } = fakeGenerate(
      json({
        results: [
          { id: '0', skills: ['Frontend'] },
          { id: '0.0', skills: ['Backend', 'Backend'] },
        ],
      }),
    );
    const result = await new GeminiClassifier(generate, 'm').classifyBatch(
      ITEMS,
      ALLOWED,
    );
    expect(Object.fromEntries(result)).toEqual({
      '0': { skills: ['Frontend'], source: 'LLM' },
      '0.0': { skills: ['Backend'], source: 'LLM' },
    });
  });

  it('drops unknown skill names, unknown ids and empty answers', async () => {
    const { generate } = fakeGenerate(
      json({
        results: [
          // e.g. a prompt-injected title talking the model into a fake skill
          { id: '0', skills: ['Admin', 'Frontend'] },
          { id: '0.0', skills: [] },
          { id: 'not-requested', skills: ['Backend'] },
        ],
      }),
    );
    const result = await new GeminiClassifier(generate, 'm').classifyBatch(
      ITEMS,
      ALLOWED,
    );
    expect(Object.fromEntries(result)).toEqual({
      '0': { skills: ['Frontend'], source: 'LLM' },
    });
  });

  it.each([
    ['invalid JSON', { text: 'Sure! Here are the skills: Frontend' }],
    ['an unexpected shape', json({ answer: 'Frontend' })],
    ['an empty response', { text: undefined }],
    [
      'a runaway number of results',
      json({
        results: Array.from({ length: 10 }, (_, i) => ({
          id: String(i),
          skills: ['Backend'],
        })),
      }),
    ],
  ])('rejects %s without retrying', async (_label, response) => {
    const { generate } = fakeGenerate(response);
    const error = await caught(
      new GeminiClassifier(generate, 'm').classifyBatch(ITEMS, ALLOWED),
    );
    expect(error.retryable).toBe(false);
  });

  it.each([
    [429, true],
    [503, true],
    [400, false],
    [403, false],
  ])('treats HTTP %i as retryable=%s', async (status, retryable) => {
    const sdkError = Object.assign(new Error('API key AIza-secret invalid'), {
      status,
    });
    const { generate } = fakeGenerate(sdkError);
    const error = await caught(
      new GeminiClassifier(generate, 'm').classifyBatch(ITEMS, ALLOWED),
    );
    expect(error.retryable).toBe(retryable);
    // SDK messages are not propagated: they may echo request details.
    expect(error.message).toBe(
      `Gemini request failed (HTTP ${String(status)})`,
    );
  });

  it('treats network errors (no status) as retryable', async () => {
    const { generate } = fakeGenerate(new TypeError('fetch failed'));
    const error = await caught(
      new GeminiClassifier(generate, 'm').classifyBatch(ITEMS, ALLOWED),
    );
    expect(error.retryable).toBe(true);
  });

  it('does not call the API when there is nothing to classify', async () => {
    const { generate, calls } = fakeGenerate(json({ results: [] }));
    const classifier = new GeminiClassifier(generate, 'm');
    await classifier.classifyBatch([], ALLOWED);
    await classifier.classifyBatch(ITEMS, []);
    expect(calls).toHaveLength(0);
  });
});
