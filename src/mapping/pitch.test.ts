import { describe, expect, it } from 'vitest';
import {
  isInScale,
  midiToFreq,
  midiToNoteName,
  normalize,
  quantizeToScale,
  scaleNotesInRange,
  valueToMidi,
} from './pitch';

describe('normalize', () => {
  it('maps and clamps', () => {
    expect(normalize(5, [0, 10])).toBe(0.5);
    expect(normalize(-3, [0, 10])).toBe(0);
    expect(normalize(30, [0, 10])).toBe(1);
  });
  it('handles a degenerate domain', () => {
    expect(normalize(4, [4, 4])).toBe(0.5);
  });
});

describe('scales', () => {
  it('A minor pentatonic contains A C D E G', () => {
    expect(scaleNotesInRange([57, 69], 57, 'minorPentatonic')).toEqual([57, 60, 62, 64, 67, 69]);
  });
  it('root pitch class works in any octave', () => {
    expect(isInScale(45, 57, 'minorPentatonic')).toBe(true); // A2
    expect(isInScale(46, 57, 'minorPentatonic')).toBe(false);
  });
  it('quantizes to the nearest scale note, ties down', () => {
    expect(quantizeToScale(58, 57, 'minorPentatonic')).toBe(57);
    expect(quantizeToScale(59, 57, 'minorPentatonic')).toBe(60);
    expect(quantizeToScale(61, 57, 'minorPentatonic')).toBe(60); // tie between 60 and 62
    expect(quantizeToScale(63.4, 57, 'minorPentatonic')).toBe(64);
  });
});

describe('valueToMidi', () => {
  const cfg = { domain: [3, 8] as [number, number], midiRange: [50, 79] as [number, number], root: 57, scale: 'minorPentatonic' as const };

  it('always returns an in-scale note within range', () => {
    for (let v = 0; v <= 10; v += 0.05) {
      const m = valueToMidi(v, cfg);
      expect(m).toBeGreaterThanOrEqual(50);
      expect(m).toBeLessThanOrEqual(79);
      expect(isInScale(m, 57, 'minorPentatonic')).toBe(true);
    }
  });

  it('is monotonic non-decreasing', () => {
    let prev = -Infinity;
    for (let v = 3; v <= 8; v += 0.01) {
      const m = valueToMidi(v, cfg);
      expect(m).toBeGreaterThanOrEqual(prev);
      prev = m;
    }
  });

  it('hits the range ends at the domain ends and clamps beyond', () => {
    const notes = scaleNotesInRange(cfg.midiRange, 57, 'minorPentatonic');
    expect(valueToMidi(3, cfg)).toBe(notes[0]);
    expect(valueToMidi(8, cfg)).toBe(notes[notes.length - 1]);
    expect(valueToMidi(-100, cfg)).toBe(notes[0]);
    expect(valueToMidi(100, cfg)).toBe(notes[notes.length - 1]);
  });

  it('invert flips direction', () => {
    expect(valueToMidi(3, { ...cfg, invert: true })).toBe(valueToMidi(8, cfg));
  });

  it('distinguishes the 1979 and 2012 sea ice values by several steps', () => {
    const notes = scaleNotesInRange(cfg.midiRange, 57, 'minorPentatonic');
    const i1979 = notes.indexOf(valueToMidi(7.05, cfg));
    const i2012 = notes.indexOf(valueToMidi(3.57, cfg));
    expect(i1979 - i2012).toBeGreaterThanOrEqual(6);
  });
});

describe('midi helpers', () => {
  it('A4 = 440 Hz', () => {
    expect(midiToFreq(69)).toBeCloseTo(440);
    expect(midiToFreq(57)).toBeCloseTo(220);
  });
  it('names notes', () => {
    expect(midiToNoteName(69)).toBe('A4');
    expect(midiToNoteName(60)).toBe('C4');
    expect(midiToNoteName(61)).toBe('C♯4');
  });
});
