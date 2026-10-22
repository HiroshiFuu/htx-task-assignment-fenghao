import { exceedsJsonDepth, MAX_JSON_DEPTH } from './json-depth';

function nested(depth: number, key = 'x'): unknown {
  let value: unknown = 'leaf';
  for (let i = 0; i < depth; i += 1) {
    value = { [key]: value };
  }
  return value;
}

describe('exceedsJsonDepth', () => {
  it('counts object and array levels', () => {
    expect(exceedsJsonDepth({ a: [{ b: 1 }] }, 3)).toBe(false);
    expect(exceedsJsonDepth({ a: [{ b: {} }] }, 3)).toBe(true);
  });

  it(`allows ${String(MAX_JSON_DEPTH)} levels and rejects more`, () => {
    expect(exceedsJsonDepth(nested(MAX_JSON_DEPTH), MAX_JSON_DEPTH)).toBe(
      false,
    );
    expect(exceedsJsonDepth(nested(MAX_JSON_DEPTH + 1), MAX_JSON_DEPTH)).toBe(
      true,
    );
  });

  it('handles very deep input without overflowing the stack', () => {
    expect(exceedsJsonDepth(nested(200_000), MAX_JSON_DEPTH)).toBe(true);
  });

  it('ignores primitives and empty bodies', () => {
    expect(exceedsJsonDepth(undefined, 1)).toBe(false);
    expect(exceedsJsonDepth('text', 1)).toBe(false);
    expect(exceedsJsonDepth({}, 1)).toBe(false);
  });
});
