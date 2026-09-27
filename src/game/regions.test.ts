import { describe, expect, it } from 'vitest';
import { OCEAN_REGIONS, regionMean } from './regions';
import { buildValueGrid } from '../sampling/grid';
import { createInverter } from '../sampling/inverter';
import type { Colormap } from '../sampling/colormap';

const cmap: Colormap = {
  title: 't',
  units: '°C',
  entries: [
    { rgb: [0, 0, 255], min: 0, max: 10, value: 5, label: '', nodata: false, transparent: false },
    { rgb: [255, 0, 0], min: 20, max: 30, value: 25, label: '', nodata: false, transparent: false },
  ],
  nodata: [],
};

/** 36x18 (10° pixels): west half cold, east half warm, one land pixel. */
function grid() {
  const px: number[] = [];
  for (let y = 0; y < 18; y++)
    for (let x = 0; x < 36; x++) px.push(...(y === 8 && x === 20 ? [0, 0, 0, 0] : x < 18 ? [0, 0, 255, 255] : [255, 0, 0, 255]));
  return buildValueGrid(px, 36, 18, [-180, -90, 180, 90], cmap, createInverter(cmap));
}

describe('regionMean', () => {
  const g = grid();
  it('averages only data pixels inside the box', () => {
    expect(regionMean(g, [-60, -10, -40, 10])?.mean).toBe(5);
    expect(regionMean(g, [20, -10, 40, 10])?.mean).toBe(25);
    expect(regionMean(g, [20, -10, 40, 10])?.coverage).toBeLessThan(1); // the land pixel
  });
  it('returns null for all-land boxes', () => {
    expect(regionMean(g, [20, 0, 30, 10])).toBeNull();
  });
  it('every predefined region has a valid box', () => {
    for (const r of OCEAN_REGIONS) {
      const [w, s, e, n] = r.box;
      expect(w).toBeLessThan(e);
      expect(s).toBeLessThan(n);
      expect(w).toBeGreaterThanOrEqual(-180);
      expect(e).toBeLessThanOrEqual(180);
    }
  });
});
