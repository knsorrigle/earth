import { describe, expect, it } from 'vitest';
import { colormapColor, hexToRgb, paletteColor } from './colors';
import type { Colormap } from '../sampling/colormap';

describe('palette colours', () => {
  it('parses hex', () => {
    expect(hexToRgb('#ff0000')).toEqual([1, 0, 0]);
    expect(hexToRgb('#0f0')).toEqual([0, 1, 0]);
  });
  it('interpolates positioned stops and clamps', () => {
    const stops = [
      { t: 0, color: '#000000' },
      { t: 0.25, color: '#ffffff' },
      { t: 1, color: '#ff0000' },
    ];
    expect(paletteColor(stops, 0.125)).toEqual([0.5, 0.5, 0.5]);
    expect(paletteColor(stops, 0.25)).toEqual([1, 1, 1]);
    expect(paletteColor(stops, -3)).toEqual([0, 0, 0]);
    expect(paletteColor(stops, 9)).toEqual([1, 0, 0]);
  });
});

describe('colormapColor', () => {
  const cmap: Colormap = {
    title: '',
    units: '',
    entries: [
      { rgb: [0, 0, 255], min: -Infinity, max: 0, value: 0, label: '', nodata: false, transparent: false },
      { rgb: [0, 255, 0], min: 0, max: 10, value: 5, label: '', nodata: false, transparent: false },
      { rgb: [255, 0, 0], min: 10, max: Infinity, value: 10, label: '', nodata: false, transparent: false },
    ],
    nodata: [],
  };
  it('picks the bin containing the value', () => {
    expect(colormapColor(cmap, -5)).toEqual([0, 0, 1]);
    expect(colormapColor(cmap, 3)).toEqual([0, 1, 0]);
    expect(colormapColor(cmap, 10)).toEqual([1, 0, 0]);
    expect(colormapColor(cmap, 99)).toEqual([1, 0, 0]);
  });
});
