import { describe, expect, it } from 'vitest';
import { hudSummary, normaliseHeights, shortLegend, type HudState } from './hudModel';
import type { MappingConfig } from '../../mapping/types';

const cfg: MappingConfig = {
  domain: [0, 1],
  midiRange: [50, 79],
  scale: 'minorPentatonic',
  root: 57,
  referenceYear: 1979,
  higherMeans: 'warmer water',
  lowerMeans: 'colder water',
};

describe('hudSummary', () => {
  it('reads every corner in order', () => {
    const h: HudState = {
      mode: 'Explore',
      dataset: 'Sea Surface Temperature',
      date: '2026-09-01',
      source: 'live from NASA GIBS',
      values: [{ value: '28.9', unit: '°C', spoken: 'about 28.9 degrees Celsius' }],
      place: '9.3° N, 113.7° W',
      placeSpoken: '9.3 degrees north, 113.7 degrees west',
      legend: ['higher pitch = warmer water'],
      scrub: null,
    };
    expect(hudSummary(h)).toBe(
      'Explore. Sea Surface Temperature. Date: 2026-09-01, live from NASA GIBS. about 28.9 degrees Celsius. ' +
        'Place: 9.3 degrees north, 113.7 degrees west. Legend: higher pitch = warmer water.',
    );
  });
  it('labels multiple values and deltas', () => {
    const h: HudState = {
      mode: 'Duet',
      dataset: 'A & B',
      date: '2012',
      values: [
        { label: 'A', value: '1', unit: 'u', spoken: '1 unit', delta: '+1 vs 1959' },
        { label: 'B', value: '2', unit: 'u', spoken: '2 units' },
      ],
      place: '',
      legend: [],
      scrub: null,
    };
    expect(hudSummary(h)).toBe('Duet. A & B. Date: 2012. A: 1 unit, +1 vs 1959. B: 2 units.');
  });
});

describe('shortLegend', () => {
  it('uses the dataset meaning in plain words', () => {
    expect(shortLegend('explore', cfg)[0]).toBe('higher pitch = warmer water');
    expect(shortLegend('timeline', cfg, { refLabel: '1979' })).toContain('hum = 1979');
    expect(shortLegend('explore', cfg, { presence: true })[0]).toBe('crackle = fire nearby');
    expect(shortLegend('duet', null, { titleA: 'CO₂', titleB: 'Temp' })[0]).toBe('mallet · left = CO₂');
  });
});

describe('normaliseHeights', () => {
  it('maps to 0..1, flat -> 0.5', () => {
    expect(normaliseHeights([2, 4, 3])).toEqual([0, 1, 0.5]);
    expect(normaliseHeights([5, 5])).toEqual([0.5, 0.5]);
    expect(normaliseHeights([])).toEqual([]);
  });
});
