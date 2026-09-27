import { describe, expect, it } from 'vitest';
import { columnAt, describeColumn, latBands, planScan } from './scan';
import { buildValueGrid } from './grid';
import { createInverter } from './inverter';
import type { Colormap } from './colormap';

const cmap: Colormap = {
  title: 't',
  units: '°C',
  entries: [
    { rgb: [0, 0, 255], min: 0, max: 10, value: 5, label: '', nodata: false, transparent: false },
    { rgb: [255, 0, 0], min: 20, max: 30, value: 25, label: '', nodata: false, transparent: false },
  ],
  nodata: [],
};
const BLUE = [0, 0, 255, 255];
const RED = [255, 0, 0, 255];
const LAND = [0, 0, 0, 0];

/** 8x4 globe. Top half blue, bottom half red, left 2 columns land. */
function grid() {
  const px: number[] = [];
  for (let y = 0; y < 4; y++) for (let x = 0; x < 8; x++) px.push(...(x < 2 ? LAND : y < 2 ? BLUE : RED));
  return buildValueGrid(px, 8, 4, [-180, -90, 180, 90], cmap, createInverter(cmap));
}

describe('latBands', () => {
  it('splits north to south with readable names', () => {
    const b = latBands(4);
    expect(b.map((x) => [x.north, x.south])).toEqual([[90, 45], [45, 0], [0, -45], [-45, -90]]);
    expect(b[0].name).toBe('90° N to 45° N');
    expect(b[1].name).toBe('45° N to 0°');
  });
});

describe('planScan', () => {
  const plan = planScan(grid(), 4, 2);
  it('makes one column per step with centre longitudes', () => {
    expect(plan.columns.map((c) => c.lon)).toEqual([-135, -45, 45, 135]);
  });
  it('land columns have no data', () => {
    expect(plan.columns[0].cells).toEqual([{ mean: null, coverage: 0 }, { mean: null, coverage: 0 }]);
  });
  it('band means and coverage', () => {
    expect(plan.columns[1].cells[0]).toEqual({ mean: 5, coverage: 1 });
    expect(plan.columns[1].cells[1]).toEqual({ mean: 25, coverage: 1 });
  });
  it('band ranges across the frame', () => {
    expect(plan.bandRanges).toEqual([{ min: 5, max: 5 }, { min: 25, max: 25 }]);
  });
  it('columnAt wraps longitudes', () => {
    expect(columnAt(plan, -180)).toBe(0);
    expect(columnAt(plan, 0)).toBe(2);
    expect(columnAt(plan, 179.9)).toBe(3);
    expect(columnAt(plan, 180)).toBe(0);
  });
});

describe('describeColumn', () => {
  it('speaks every band, with land and partial coverage', () => {
    const p = planScan(grid(), 4, 2);
    expect(describeColumn(p, 0, 'degrees Celsius', 1)).toBe(
      'At 135 degrees west. 90° N to 0°: land or no data. 0° to 90° S: land or no data.',
    );
    expect(describeColumn(p, 1, 'degrees Celsius', 1)).toBe(
      'At 45 degrees west. 90° N to 0°: 5.0 degrees Celsius. 0° to 90° S: 25.0 degrees Celsius.',
    );
    p.columns[1].cells[0] = { mean: 5, coverage: 0.5 };
    expect(describeColumn(p, 1, 'degrees Celsius', 1)).toContain('5.0 degrees Celsius, 50 percent ocean');
  });
});
