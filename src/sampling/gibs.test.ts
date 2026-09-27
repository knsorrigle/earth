import { describe, expect, it } from 'vitest';
import { buildWmsGetMapUrl, cachedFrameUrl, nearestDate, opaqueFraction } from './gibs';

describe('gibs', () => {
  it('builds a WMS 1.3.0 GetMap URL with lat,lon axis order', () => {
    const url = new URL(
      buildWmsGetMapUrl({
        layer: 'GHRSST_L4_MUR25_Sea_Surface_Temperature',
        date: '2026-09-01',
        width: 1440,
        height: 720,
        bbox: [-180, -90, 180, 90],
      }),
    );
    expect(url.origin + url.pathname).toBe('https://gibs.earthdata.nasa.gov/wms/epsg4326/best/wms.cgi');
    expect(url.searchParams.get('BBOX')).toBe('-90,-180,90,180');
    expect(url.searchParams.get('CRS')).toBe('EPSG:4326');
    expect(url.searchParams.get('TIME')).toBe('2026-09-01');
    expect(url.searchParams.get('LAYERS')).toBe('GHRSST_L4_MUR25_Sea_Surface_Temperature');
  });
  it('passes a WMS style when given', () => {
    const url = new URL(buildWmsGetMapUrl({ layer: 'L', date: '2026-09-01', width: 2, height: 1, bbox: [-180, -90, 180, 90], style: 'size5' }));
    expect(url.searchParams.get('STYLES')).toBe('size5');
  });
  it('cached frame path', () => {
    expect(cachedFrameUrl('/', 'L', '2026-09-01')).toBe('/frames/L/2026-09-01.png');
  });
  it('nearest cached date', () => {
    expect(nearestDate(['2025-09-01', '2026-03-01', '2026-09-01'], '2026-08-15')).toBe('2026-09-01');
    expect(nearestDate(['2025-09-01', '2026-03-01'], '2020-01-01')).toBe('2025-09-01');
    expect(nearestDate([], '2020-01-01')).toBeUndefined();
  });
  it('opaque fraction', () => {
    expect(opaqueFraction([0, 0, 0, 255, 0, 0, 0, 0, 0, 0, 0, 200, 0, 0, 0, 10])).toBe(0.5);
  });
});
