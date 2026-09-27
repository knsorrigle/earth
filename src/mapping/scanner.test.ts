import { describe, expect, it } from 'vitest';
import { bandWindow, columnNotes, DEFAULT_SCANNER, stepSeconds } from './scanner';
import { isInScale } from './pitch';
import type { ScanColumn, ScanPlan } from '../sampling/scan';
import { latBands } from '../sampling/scan';

function plan(
  cells: { mean: number | null; coverage: number }[][],
  ranges: { min: number; max: number }[],
  positive = ranges,
): ScanPlan {
  const bands = latBands(ranges.length);
  const columns: ScanColumn[] = cells.map((c, i) => ({ index: i, west: 0, east: 5, lon: 2.5, cells: c }));
  return { bands, columns, bandRanges: ranges, positiveRanges: positive };
}

describe('bandWindow', () => {
  it('north is higher, windows step down', () => {
    const [lo0, hi0] = bandWindow(0, DEFAULT_SCANNER);
    const [lo7, hi7] = bandWindow(7, DEFAULT_SCANNER);
    expect(hi0).toBe(86);
    expect(hi0 - lo0).toBe(12);
    expect(hi7).toBeLessThan(hi0);
    expect(lo7).toBe(86 - 12 - 7 * 5);
  });
});

describe('columnNotes', () => {
  const ranges = [
    { min: 0, max: 10 },
    { min: 20, max: 30 },
    { min: NaN, max: NaN },
  ];
  const p = plan(
    [
      [
        { mean: 10, coverage: 1 },
        { mean: 20, coverage: 0.5 },
        { mean: null, coverage: 0 },
      ],
    ],
    ranges,
  );
  const notes = columnNotes(p.columns[0], p);

  it('silences land cells', () => {
    expect(notes.map((n) => n.band)).toEqual([0, 1]);
  });
  it('pitch is in scale and inside the band register', () => {
    for (const n of notes) {
      const [lo, hi] = bandWindow(n.band, DEFAULT_SCANNER);
      expect(n.midi).toBeGreaterThanOrEqual(lo);
      expect(n.midi).toBeLessThanOrEqual(hi);
      expect(isInScale(n.midi, 60, 'majorPentatonic')).toBe(true);
    }
  });
  it('band max -> top of register, band min -> bottom', () => {
    expect(notes[0].midi).toBe(86); // 10 is band 0's max
    expect(notes[1].midi).toBeLessThanOrEqual(bandWindow(1, DEFAULT_SCANNER)[0] + 2); // 20 is band 1's min
  });
  it('velocity follows coverage; strum offsets increase north to south', () => {
    expect(notes[0].velocity).toBeCloseTo(DEFAULT_SCANNER.velocity[1]);
    expect(notes[1].velocity).toBeLessThan(notes[0].velocity);
    expect(notes[0].offset).toBe(0);
    expect(notes[1].offset).toBeCloseTo(DEFAULT_SCANNER.strumSeconds);
  });
  it('caps voices, keeping the best-covered cells in north-to-south order', () => {
    const cells = Array.from({ length: 6 }, (_, i) => ({ mean: 5, coverage: 0.2 + i * 0.1 }));
    const p6 = plan([cells], cells.map(() => ({ min: 0, max: 10 })));
    const capped = columnNotes(p6.columns[0], p6, { ...DEFAULT_SCANNER, maxVoices: 3 });
    expect(capped.map((n) => n.band)).toEqual([3, 4, 5]);
  });
  it('step seconds', () => {
    expect(stepSeconds(36, 72)).toBe(0.5);
  });
});

describe('columnNotes, logValue (presence layers)', () => {
  const cfg = { ...DEFAULT_SCANNER, magnitude: 'logValue' as const };
  const cells = [
    { mean: 0, coverage: 1 },
    { mean: 0.0001, coverage: 1 },
    { mean: 0.05, coverage: 1 },
  ];
  const p = plan([cells], cells.map(() => ({ min: 0, max: 0.05 })), [
    { min: NaN, max: NaN },
    { min: 0.0001, max: 0.01 },
    { min: 0.001, max: 0.05 },
  ]);
  const notes = columnNotes(p.columns[0], p, cfg);
  it('zero cells are silent even with full coverage', () => {
    expect(notes.map((n) => n.band)).toEqual([1, 2]);
  });
  it('more fire -> louder, and higher within its band', () => {
    expect(notes[1].velocity).toBeGreaterThan(notes[0].velocity);
    expect(notes[1].midi).toBe(bandWindow(2, cfg)[1]); // band max
    expect(notes[0].midi).toBeLessThanOrEqual(bandWindow(1, cfg)[0] + 2); // band min
  });
});
