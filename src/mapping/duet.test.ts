import { describe, expect, it } from 'vitest';
import { buildDuet, correlation, describeCorrelation, describeDuetMapping, DUET_RANGES, sharedYears } from './duet';
import type { MappingConfig } from './types';

const cfg = (higherMeans: string): MappingConfig => ({
  domain: [0, 10],
  midiRange: [50, 79],
  scale: 'minorPentatonic',
  root: 57,
  referenceYear: 2000,
  higherMeans,
  lowerMeans: 'less',
});

const a = [2000, 2001, 2002, 2003].map((year, i) => ({ year, value: 2 + i * 2 }));
const b = [1999, 2001, 2002, 2003, 2004].map((year, i) => ({ year, value: 9 - i }));

describe('duet', () => {
  it('shared years only', () => {
    expect(sharedYears(a, b)).toEqual([2001, 2002, 2003]);
  });
  it('correlation', () => {
    expect(correlation([1, 2, 3, 4], [2, 4, 6, 8])).toBeCloseTo(1);
    expect(correlation([1, 2, 3, 4], [8, 6, 4, 2])).toBeCloseTo(-1);
    expect(Number.isNaN(correlation([1, 2], [1, 2]))).toBe(true);
  });
  it('builds steps with each voice in its own register', () => {
    const d = buildDuet(a, cfg('more A'), b, cfg('more B'));
    expect(d.steps.map((s) => s.year)).toEqual([2001, 2002, 2003]);
    for (const s of d.steps) {
      expect(s.a.midi).toBeGreaterThanOrEqual(DUET_RANGES.a[0]);
      expect(s.a.midi).toBeLessThanOrEqual(DUET_RANGES.a[1]);
      expect(s.b.midi).toBeGreaterThanOrEqual(DUET_RANGES.b[0]);
      expect(s.b.midi).toBeLessThanOrEqual(DUET_RANGES.b[1]);
    }
    expect(d.correlation).toBeCloseTo(-1); // A rises, B falls
  });
  it('describes the relationship in plain words', () => {
    expect(describeCorrelation(0.95)).toBe('rise and fall closely together');
    expect(describeCorrelation(-0.6)).toBe('move fairly closely in opposite directions');
    expect(describeCorrelation(0.1)).toBe('show little relationship');
    const d = buildDuet(a, cfg('more A'), b, cfg('more B'));
    const text = describeDuetMapping('A', cfg('more A'), 'B', cfg('more B'), d).join(' ');
    expect(text).toContain('2001 to 2003');
    expect(text).toContain('left ear');
    expect(text).toContain('opposite directions');
  });
});
