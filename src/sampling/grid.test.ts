import { describe, expect, it } from 'vitest';
import { buildValueGrid, gridStats, latLonToPixel, pixelToLatLon, sampleGrid, wrapLon, type BBox } from './grid';
import { createInverter } from './inverter';
import type { Colormap } from './colormap';
import { formatLatLon, formatLon, speakLatLon, speakLon } from './geo';

const cmap: Colormap = {
  title: 't',
  units: '°C',
  entries: [
    { rgb: [0, 0, 255], min: 0, max: 10, value: 5, label: '0-10', nodata: false, transparent: false },
    { rgb: [255, 0, 0], min: 20, max: 30, value: 25, label: '20-30', nodata: false, transparent: false },
  ],
  nodata: [],
};
const bbox: BBox = [-180, -90, 180, 90];

/** 4x2 globe: north row cold, south row warm, one transparent (land) pixel. */
function makeGrid() {
  const px = [
    [0, 0, 255, 255], [0, 0, 255, 255], [0, 0, 0, 0], [0, 0, 255, 255],
    [255, 0, 0, 255], [255, 0, 0, 255], [255, 0, 0, 255], [255, 0, 0, 255],
  ].flat();
  return buildValueGrid(px, 4, 2, bbox, cmap, createInverter(cmap));
}

describe('geometry', () => {
  const g = { width: 1440, height: 720, bbox };
  it('wraps longitude', () => {
    expect(wrapLon(190)).toBe(-170);
    expect(wrapLon(-190)).toBe(170);
    expect(wrapLon(180)).toBe(-180);
  });
  it('maps corners and centre', () => {
    expect(latLonToPixel(g, 90, -180)).toEqual({ x: 0, y: 0 });
    expect(latLonToPixel(g, -90, 179.99)).toEqual({ x: 1439, y: 719 });
    expect(latLonToPixel(g, 0, 0)).toEqual({ x: 720, y: 360 });
  });
  it('round-trips pixel centres', () => {
    const { lat, lon } = pixelToLatLon(g, 100, 200);
    expect(latLonToPixel(g, lat, lon)).toEqual({ x: 100, y: 200 });
    expect(lat).toBeCloseTo(90 - 200.5 * 0.25);
    expect(lon).toBeCloseTo(-180 + 100.5 * 0.25);
  });
});

describe('value grid', () => {
  const grid = makeGrid();
  it('samples values and no-data', () => {
    expect(sampleGrid(grid, 45, -170).entry?.value).toBe(5);
    expect(sampleGrid(grid, -45, 100).entry?.value).toBe(25);
    expect(sampleGrid(grid, 45, 45).entry).toBeNull(); // transparent pixel
  });
  it('computes area-weighted stats', () => {
    const s = gridStats(grid);
    expect(s.coverage).toBeCloseTo(7 / 8);
    expect(s.mean).toBeCloseTo((3 * 5 + 4 * 25) / 7);
    expect(s.min?.entry.value).toBe(5);
    expect(s.max?.entry.value).toBe(25);
    expect(s.max!.lat).toBeLessThan(0);
  });
});

describe('geo text', () => {
  it('formats and speaks coordinates', () => {
    expect(formatLatLon(12.5, -140)).toBe('12.5° N, 140.0° W');
    expect(speakLatLon(12.5, -140)).toBe('12.5 degrees north, 140 degrees west');
    expect(speakLatLon(0, 0)).toBe('0 degrees, 0 degrees');
    expect(speakLon(-150)).toBe('150 degrees west');
    expect(speakLon(-180)).toBe('180 degrees');
    expect(speakLon(2.5, 1)).toBe('2.5 degrees east');
    expect(formatLon(-147.5, 1)).toBe('147.5° W');
    expect(formatLon(0)).toBe('0°');
  });
});
