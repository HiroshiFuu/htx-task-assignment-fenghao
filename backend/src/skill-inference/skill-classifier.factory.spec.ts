import { KeywordClassifier } from './keyword-classifier';
import { ResilientClassifier } from './resilient-classifier';
import {
  createSkillClassifier,
  DEFAULT_GEMINI_MODEL,
} from './skill-classifier.factory';

const logger = () => ({ log: jest.fn(), warn: jest.fn() });

describe('createSkillClassifier', () => {
  it.each([[{}], [{ GEMINI_API_KEY: '' }], [{ GEMINI_API_KEY: '   ' }]])(
    'uses keyword rules with a warning when there is no key (%j)',
    (env) => {
      const log = logger();
      expect(createSkillClassifier(env, log)).toBeInstanceOf(KeywordClassifier);
      expect(log.warn).toHaveBeenCalledWith(
        expect.stringContaining('GEMINI_API_KEY is not set'),
      );
    },
  );

  it('wraps Gemini in the resilience decorator when a key is set, without logging the key', () => {
    const log = logger();
    const classifier = createSkillClassifier(
      { GEMINI_API_KEY: 'test-key-123', GEMINI_MODEL: 'gemini-x' },
      log,
    );
    expect(classifier).toBeInstanceOf(ResilientClassifier);
    expect(log.log).toHaveBeenCalledWith(expect.stringContaining('gemini-x'));
    const logged = JSON.stringify([log.log.mock.calls, log.warn.mock.calls]);
    expect(logged).not.toContain('test-key-123');
  });

  it(`defaults the model to ${DEFAULT_GEMINI_MODEL}`, () => {
    const log = logger();
    createSkillClassifier({ GEMINI_API_KEY: 'k' }, log);
    expect(log.log).toHaveBeenCalledWith(
      expect.stringContaining(DEFAULT_GEMINI_MODEL),
    );
  });
});
