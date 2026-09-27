import { describe, expect, it } from 'vitest';
import { describeFrame, displayEntry, speakEntry } from './describe';
import type { ColormapEntry } from './colormap';

const e = (min: number, max: number, value: number): ColormapEntry => ({
  rgb: [0, 0, 0], min, max, value, label: '', nodata: false, transparent: false,
});
const w = { unitSpoken: 'degrees Celsius', decimals: 1, belowRangeMeans: 'freezing seawater or sea ice' };

describe('speakEntry / displayEntry', () => {
  it('normal bins speak the midpoint', () => {
    expect(speakEntry(e(18.3, 18.45, 18.375), w)).toBe('About 18.4 degrees Celsius');
    expect(displayEntry(e(18.3, 18.45, 18.375), 1)).toBe('18.4');
  });
  it('open bins are honest about the bound', () => {
    expect(speakEntry(e(-Infinity, 0, 0), w)).toBe('Below 0 degrees Celsius, freezing seawater or sea ice');
    expect(speakEntry(e(32, Infinity, 32), w)).toBe('32 degrees Celsius or more');
    expect(displayEntry(e(-Infinity, 0, 0), 1)).toBe('< 0');
    expect(displayEntry(e(32, Infinity, 32), 1)).toBe('≥ 32');
  });
  it('no data', () => {
    expect(speakEntry(null, w)).toBe('Land or no data');
    expect(displayEntry(null, 1)).toBe('—');
  });
});

describe('describeFrame', () => {
  it('summarises coverage, mean, extremes and zones', () => {
    const text = describeFrame(
      {
        coverage: 0.7,
        mean: 18.2,
        max: { entry: e(32, Infinity, 32), lat: 26, lon: 51 },
        min: { entry: e(-Infinity, 0, 0), lat: -70, lon: -40 },
        zones: [
          { name: 'Tropics', south: -23.5, north: 23.5, mean: 28 },
          { name: 'Nowhere', south: 0, north: 0, mean: NaN },
        ],
      },
      'Sea surface temperature',
      '2026-09-01',
      w,
    );
    expect(text).toContain('70 percent');
    expect(text).toContain('Average: 18.2 degrees Celsius');
    expect(text).toContain('Warmest: 32 degrees Celsius or more, near 26 degrees north, 51 degrees east');
    expect(text).toContain('Tropics, 28.0');
    expect(text).not.toContain('Nowhere');
  });
});
