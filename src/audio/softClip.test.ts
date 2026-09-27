import { describe, expect, it } from 'vitest';
import { OUTPUT_CEILING, softClip } from './engine';

describe('softClip', () => {
  it('is nearly transparent at normal playback levels (≈ -15 dBFS)', () => {
    const x = 0.18;
    expect(Math.abs(softClip(x) - x) / x).toBeLessThan(0.03);
  });
  it('never exceeds the ceiling, however hot the input', () => {
    for (const x of [0.5, 1, 1.5, 4, 100]) {
      expect(softClip(x)).toBeLessThanOrEqual(OUTPUT_CEILING);
      expect(softClip(-x)).toBeGreaterThanOrEqual(-OUTPUT_CEILING);
    }
  });
  it('ceiling is -1 dBFS', () => {
    expect(20 * Math.log10(OUTPUT_CEILING)).toBeCloseTo(-1);
  });
});
