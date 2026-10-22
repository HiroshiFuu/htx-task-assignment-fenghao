import { describe, expect, it } from 'vitest';
import {
  ALICE,
  BACKEND,
  BOB,
  CAROL,
  DAVE,
  developers,
  FRONTEND,
} from '../../test/fixtures';
import { eligibleDevelopers, isEligible } from './eligibility';

describe('eligibility (decision D3: developer skills ⊇ task skills)', () => {
  it('only Alice and Carol can take a Frontend task', () => {
    expect(eligibleDevelopers(developers, [FRONTEND])).toEqual([ALICE, CAROL]);
  });

  it('Bob, Carol and Dave can take a Backend task', () => {
    expect(eligibleDevelopers(developers, [BACKEND])).toEqual([
      BOB,
      CAROL,
      DAVE,
    ]);
  });

  it('only Carol can take a task needing Frontend and Backend', () => {
    expect(isEligible(CAROL, [FRONTEND, BACKEND])).toBe(true);
    expect(isEligible(ALICE, [FRONTEND, BACKEND])).toBe(false);
    expect(eligibleDevelopers(developers, [FRONTEND, BACKEND])).toEqual([
      CAROL,
    ]);
  });

  it('everyone can take a task without required skills', () => {
    expect(eligibleDevelopers(developers, [])).toEqual(developers);
  });
});
