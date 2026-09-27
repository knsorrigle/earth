import { describe, expect, it } from 'vitest';
import { createInverter, NO_DATA } from './inverter';
import { deltaE, rgbToLab } from './lab';
import type { Colormap } from './colormap';

const cmap: Colormap = {
  title: 't',
  units: 'u',
  entries: [
    { rgb: [0, 0, 255], min: 0, max: 1, value: 0.5, label: '0-1', nodata: false, transparent: false },
    { rgb: [0, 255, 0], min: 1, max: 2, value: 1.5, label: '1-2', nodata: false, transparent: false },
    { rgb: [255, 0, 0], min: 2, max: 3, value: 2.5, label: '2-3', nodata: false, transparent: false },
  ],
  nodata: [
    { rgb: [0, 0, 0], min: NaN, max: NaN, value: NaN, label: 'No Data', nodata: true, transparent: true },
    { rgb: [128, 128, 128], min: NaN, max: NaN, value: NaN, label: 'Land', nodata: true, transparent: false },
  ],
};

describe('lab', () => {
  it('white is L=100, black is L=0', () => {
    expect(rgbToLab(255, 255, 255)[0]).toBeCloseTo(100, 1);
    expect(rgbToLab(0, 0, 0)[0]).toBeCloseTo(0, 5);
  });
  it('deltaE is zero for identical colours', () => {
    expect(deltaE(rgbToLab(10, 20, 30), rgbToLab(10, 20, 30))).toBe(0);
  });
});

describe('createInverter', () => {
  const inv = createInverter(cmap);
  it('exact matches', () => {
    expect(inv(0, 0, 255)).toBe(0);
    expect(inv(255, 0, 0)).toBe(2);
  });
  it('transparent pixels are no-data', () => {
    expect(inv(255, 0, 0, 0)).toBe(NO_DATA);
  });
  it('opaque no-data colours (land) are no-data', () => {
    expect(inv(128, 128, 128)).toBe(NO_DATA);
    expect(inv(130, 128, 127)).toBe(NO_DATA); // near the land colour
  });
  it('slightly off colours snap to the nearest entry in LAB', () => {
    expect(inv(250, 4, 3)).toBe(2);
    expect(inv(3, 250, 6)).toBe(1);
  });
  it('colours far from every entry are no-data', () => {
    expect(inv(255, 255, 255)).toBe(NO_DATA);
  });
});
