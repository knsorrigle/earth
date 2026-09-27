import { describe, expect, it } from 'vitest';
import { niceTicks } from './ticks';

describe('niceTicks', () => {
  it('gives a handful of round ticks for any range', () => {
    expect(niceTicks(3, 8)).toEqual([3, 4, 5, 6, 7, 8]);
    expect(niceTicks(305, 435)).toEqual([325, 350, 375, 400, 425]);
    expect(niceTicks(-0.6, 1.4)).toEqual([-0.5, 0, 0.5, 1]);
    for (const [lo, hi] of [[0, 1], [310, 430], [-2, 32]]) expect(niceTicks(lo, hi).length).toBeLessThanOrEqual(6);
  });
});
