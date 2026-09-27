import { describe, expect, it } from 'vitest';
import { hapticPattern, lonToPan } from './spatial';

describe('lonToPan', () => {
  it('maps west to left, east to right, scaled', () => {
    expect(lonToPan(0)).toBe(0);
    expect(lonToPan(-180)).toBeCloseTo(-0.8);
    expect(lonToPan(90)).toBeCloseTo(0.4);
    expect(lonToPan(400)).toBeCloseTo(0.8);
  });
});

describe('hapticPattern', () => {
  it('longer pulses for higher values, clamped', () => {
    expect(hapticPattern(0)).toEqual([8]);
    expect(hapticPattern(1)).toEqual([50]);
    expect(hapticPattern(5)).toEqual([50]);
    expect(hapticPattern(0.5)[0]).toBeGreaterThan(hapticPattern(0.2)[0]);
  });
});
