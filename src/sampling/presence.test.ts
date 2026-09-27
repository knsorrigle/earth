import { describe, expect, it } from 'vitest';
import { buildValueGrid } from './grid';
import {
  ABSENT,
  activityWord,
  buildLandMask,
  createPresenceInverter,
  describePresenceFrame,
  hotspots,
  neighbourhood,
  presenceColormap,
  PRESENT,
} from './presence';

const FIRE: [number, number, number] = [236, 98, 16];

describe('presence inverter', () => {
  const inv = createPresenceInverter(FIRE);
  it('detects the marker colour, including slightly antialiased edges', () => {
    expect(inv(236, 98, 16, 255)).toBe(PRESENT);
    expect(inv(234, 97, 15, 246)).toBe(PRESENT);
  });
  it('ignores transparent and other colours', () => {
    expect(inv(236, 98, 16, 2)).toBe(ABSENT);
    expect(inv(0, 0, 255, 255)).toBe(ABSENT);
    expect(inv(0, 0, 0, 0)).toBe(ABSENT);
  });
});

describe('land mask', () => {
  it('dark grey is land, light grey is water', () => {
    expect([...buildLandMask([75, 75, 75, 255, 128, 128, 128, 255, 0, 0, 0, 0], 3, 1)]).toEqual([1, 0, 0]);
  });
});

/** 36 x 18 globe (10° pixels), all land, with a 2x2 block of fire around 5° N 5° E. */
function fireGrid() {
  const w = 36;
  const h = 18;
  const px: number[] = [];
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) px.push(...((y === 8 || y === 9) && (x === 18 || x === 19) ? [...FIRE, 255] : [0, 0, 0, 0]));
  return buildValueGrid(px, w, h, [-180, -90, 180, 90], presenceColormap('fire'), createPresenceInverter(FIRE));
}

describe('neighbourhood', () => {
  const g = fireGrid();
  it('is high near fire and zero far away', () => {
    const near = neighbourhood(g, 0, 0, 1500);
    const far = neighbourhood(g, 60, -120, 1500);
    expect(near.fraction).toBeGreaterThan(0.3);
    expect(far.fraction).toBe(0);
  });
  it('only counts land when a mask is given', () => {
    const allWater = new Uint8Array(36 * 18);
    const n = neighbourhood(g, 0, 0, 1500, allWater);
    expect(n.fraction).toBe(0);
    expect(n.landShare).toBe(0);
    expect(n.onLand).toBe(false);
  });
});

describe('hotspots and description', () => {
  const g = fireGrid();
  it('finds the busiest cells', () => {
    const top = hotspots(g, 20, 2);
    expect(top).toHaveLength(1);
    expect(top[0].lat).toBe(0);
    expect(top[0].lon).toBe(10);
  });
  it('describes in plain words', () => {
    const text = describePresenceFrame(g, 'Active fires', '2026-09-01');
    expect(text).toContain('Active fires on 2026-09-01.');
    // 5° cells over a 10° test grid: centres land on 2.5° offsets, spoken rounded.
    expect(text).toMatch(/Busiest areas: near \d+ degrees (north|south), \d+ degrees east/);
    expect(text).toContain('percent of the area on this map — a relative measure');
  });
  it('activity words', () => {
    expect(activityWord(0)).toBe('no fires detected');
    expect(activityWord(0.02)).toBe('some fire activity');
    expect(activityWord(0.1)).toBe('a lot of fire activity');
    expect(activityWord(0.6)).toBe('intense fire activity');
  });
});
