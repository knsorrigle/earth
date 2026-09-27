import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseColormapXml, parseInterval, representativeValue } from './colormap';

const xml = readFileSync(new URL('../../public/colormaps/GHRSST_Sea_Surface_Temperature.xml', import.meta.url), 'utf8');

describe('parseInterval', () => {
  it('handles closed, open and single intervals', () => {
    expect(parseInterval('[0.15,0.30)')).toEqual({ min: 0.15, max: 0.3 });
    expect(parseInterval('[-INF,0.00)')).toEqual({ min: -Infinity, max: 0 });
    expect(parseInterval('[32.00,+INF]')).toEqual({ min: 32, max: Infinity });
    expect(parseInterval('[5]')).toEqual({ min: 5, max: 5 });
  });
  it('representative value uses the finite edge for open bins', () => {
    expect(representativeValue(1, 2)).toBe(1.5);
    expect(representativeValue(-Infinity, 0)).toBe(0);
    expect(representativeValue(32, Infinity)).toBe(32);
  });
});

describe('parseColormapXml (GIBS GHRSST SST, v1.3)', () => {
  const cmap = parseColormapXml(xml);

  it('reads title and units from the data colormap, not the No Data one', () => {
    expect(cmap.title).toBe('Sea Surface Temperature');
    expect(cmap.units).toBe('°C');
  });

  it('separates no-data from data entries', () => {
    expect(cmap.nodata).toHaveLength(1);
    expect(cmap.nodata[0]).toMatchObject({ transparent: true, nodata: true });
    expect(cmap.entries).toHaveLength(215);
  });

  it('entries are ascending with legend labels', () => {
    expect(cmap.entries[0]).toMatchObject({ rgb: [43, 0, 26], min: -Infinity, max: 0, label: '< 0.00' });
    expect(cmap.entries[1]).toMatchObject({ rgb: [45, 0, 28], min: 0, max: 0.15 });
    expect(cmap.entries[1].value).toBeCloseTo(0.075);
    const last = cmap.entries[cmap.entries.length - 1];
    expect(last.min).toBe(32);
    expect(last.label).toBe('≥ 32.00');
    for (let i = 1; i < cmap.entries.length; i++) expect(cmap.entries[i].value).toBeGreaterThan(cmap.entries[i - 1].value);
  });

  it('every data colour is unique (inversion is well defined)', () => {
    const keys = new Set(cmap.entries.map((e) => e.rgb.join(',')));
    expect(keys.size).toBe(cmap.entries.length);
  });
});
