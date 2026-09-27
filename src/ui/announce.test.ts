import { describe, expect, it } from 'vitest';
import { detailedAnnouncement, pointAnnouncement, relationToReference, shouldAnnounce } from './announce';
import type { NoteEvent, ReferenceTone } from '../mapping/types';

const u = { unitSpoken: 'million square kilometres', decimals: 2 };
const ref: ReferenceTone = { year: 1979, phrase: '1979', label: '1979', value: 7.05, midi: 74, freq: 587, noteName: 'D5' };
const ev: NoteEvent = { index: 33, year: 2012, value: 3.57, midi: 52, freq: 164, noteName: 'E3', velocity: 0.6, deviation: 3.57 - 7.05 };

describe('announcements', () => {
  it('formats a point', () => {
    expect(pointAnnouncement(ev, u)).toBe('Year 2012, 3.57 million square kilometres');
  });
  it('relates to the reference', () => {
    expect(relationToReference(ev, ref, 2)).toBe('3.48 below 1979');
    expect(relationToReference({ deviation: 0.62 }, ref, 2)).toBe('0.62 above 1979');
    expect(relationToReference({ deviation: 0.001 }, ref, 2)).toBe('same as 1979');
  });
  it('detailed form', () => {
    expect(detailedAnnouncement(ev, ref, u)).toBe('Year 2012, 3.57 million square kilometres, 3.48 below 1979');
  });
});

describe('shouldAnnounce', () => {
  it('always announces first and last', () => {
    expect(shouldAnnounce({ index: 0, year: 1979 }, 0, 47)).toBe(true);
    expect(shouldAnnounce({ index: 46, year: 2025 }, 0, 47)).toBe(true);
  });
  it('respects the interval on round years', () => {
    expect(shouldAnnounce({ index: 1, year: 1980 }, 5, 47)).toBe(true);
    expect(shouldAnnounce({ index: 2, year: 1981 }, 5, 47)).toBe(false);
    expect(shouldAnnounce({ index: 2, year: 1981 }, 1, 47)).toBe(true);
    expect(shouldAnnounce({ index: 2, year: 1990 }, 0, 47)).toBe(false);
  });
});

describe('baseline references', () => {
  it('uses the baseline phrase', () => {
    const base: ReferenceTone = { year: NaN, phrase: 'the 1951–1980 average', label: '1951–1980 average', value: 0, midi: 60, freq: 261, noteName: 'C4' };
    expect(relationToReference({ deviation: 1.29 }, base, 2)).toBe('1.29 above the 1951–1980 average');
  });
});
