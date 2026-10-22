import { ALLOW, Rule, RuleResult, runRuleChain } from './rule';

const reject = (code: string): RuleResult => ({
  kind: 'reject',
  code,
  detail: code,
});

describe('runRuleChain', () => {
  it('allows when there are no rules', async () => {
    await expect(runRuleChain([], {})).resolves.toEqual(ALLOW);
  });

  it('returns the first non-allow result and skips later rules', async () => {
    const evaluateLater = jest.fn(() => ALLOW);
    const later: Rule<object> = { evaluate: evaluateLater };
    const result = await runRuleChain(
      [
        { evaluate: () => ALLOW },
        { evaluate: () => Promise.resolve(reject('FIRST')) },
        later,
      ],
      {},
    );
    expect(result).toEqual(reject('FIRST'));
    expect(evaluateLater).not.toHaveBeenCalled();
  });

  it('merges cascade requests when every rule allows', async () => {
    const result = await runRuleChain<object>(
      [
        { evaluate: () => ({ kind: 'allow', cascadeTaskIds: ['a', 'b'] }) },
        { evaluate: () => ({ kind: 'allow', cascadeTaskIds: ['b', 'c'] }) },
      ],
      {},
    );
    expect(result).toEqual({ kind: 'allow', cascadeTaskIds: ['a', 'b', 'c'] });
  });

  it('drops cascade requests when a later rule rejects', async () => {
    const result = await runRuleChain<object>(
      [
        { evaluate: () => ({ kind: 'allow', cascadeTaskIds: ['a'] }) },
        { evaluate: () => reject('NO') },
      ],
      {},
    );
    expect(result).toEqual(reject('NO'));
  });
});
