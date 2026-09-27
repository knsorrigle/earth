import { describe, expect, it } from 'vitest';
import { buildTimeline, referenceTone } from './timeline';
import { deviationToVelocity, bpmToSecondsPerStep } from './dynamics';
import { describeMapping } from './legend';
import type { MappingConfig } from './types';

const cfg: MappingConfig = {
  domain: [3, 8],
  midiRange: [50, 79],
  scale: 'minorPentatonic',
  root: 57,
  referenceYear: 1979,
  higherMeans: 'more sea ice',
  lowerMeans: 'less sea ice',
};

const series = [
  { year: 1979, value: 7.05 },
  { year: 1980, value: 7.67 },
  { year: 2012, value: 3.57 },
];

describe('referenceTone', () => {
  it('uses the reference year', () => {
    expect(referenceTone(series, cfg)).toMatchObject({ year: 1979, value: 7.05 });
  });
  it('falls back to the first point', () => {
    expect(referenceTone(series.slice(1), cfg).year).toBe(1980);
  });
});

describe('buildTimeline', () => {
  it('makes one event per point with deviation from reference', () => {
    const events = buildTimeline(series, cfg);
    expect(events).toHaveLength(3);
    expect(events[0].deviation).toBe(0);
    expect(events[2].deviation).toBeCloseTo(3.57 - 7.05);
    expect(events[2].midi).toBeLessThan(events[0].midi);
    expect(events[1].midi).toBeGreaterThanOrEqual(events[0].midi);
  });
  it('reference note is the softest', () => {
    const events = buildTimeline(series, cfg);
    expect(events[0].velocity).toBeLessThan(events[2].velocity);
  });
  it('empty series -> no events', () => {
    expect(buildTimeline([], cfg)).toEqual([]);
  });
});

describe('dynamics', () => {
  it('velocity stays in band', () => {
    expect(deviationToVelocity(5, 5, [3, 8])).toBeCloseTo(0.35);
    expect(deviationToVelocity(100, 5, [3, 8])).toBeCloseTo(0.8);
  });
  it('bpm to seconds', () => {
    expect(bpmToSecondsPerStep(120)).toBe(0.5);
  });
});

describe('describeMapping', () => {
  it('explains in plain words', () => {
    const lines = describeMapping(cfg);
    expect(lines.join(' ')).toContain('Higher pitch means more sea ice');
    expect(lines.join(' ')).toContain('1979');
  });
  it('respects invert', () => {
    expect(describeMapping({ ...cfg, invert: true }).join(' ')).toContain('Higher pitch means less sea ice');
  });
});
