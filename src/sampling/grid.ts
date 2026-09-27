import type { Colormap, ColormapEntry } from './colormap';
import { NO_DATA, type Inverter } from './inverter';

/** [west, south, east, north] in degrees, equirectangular (EPSG:4326). */
export type BBox = [number, number, number, number];

export interface ValueGrid {
  width: number;
  height: number;
  bbox: BBox;
  colormap: Colormap;
  /** Colormap entry index per pixel, NO_DATA (-1) where there is no data. */
  bins: Int16Array;
}

export interface Sample {
  lat: number;
  lon: number;
  x: number;
  y: number;
  /** null = land / no data */
  entry: ColormapEntry | null;
  bin: number;
}

/** RGBA pixels (row-major, top row = north) -> value grid. */
export function buildValueGrid(
  rgba: ArrayLike<number>,
  width: number,
  height: number,
  bbox: BBox,
  colormap: Colormap,
  invert: Inverter,
): ValueGrid {
  const bins = new Int16Array(width * height);
  for (let i = 0, p = 0; i < bins.length; i++, p += 4) {
    bins[i] = invert(rgba[p], rgba[p + 1], rgba[p + 2], rgba[p + 3]);
  }
  return { width, height, bbox, colormap, bins };
}

/** Wrap longitude into [-180, 180). */
export function wrapLon(lon: number): number {
  return ((((lon + 180) % 360) + 360) % 360) - 180;
}

export function clampLat(lat: number): number {
  return Math.max(-90, Math.min(90, lat));
}

export function latLonToPixel(g: Pick<ValueGrid, 'width' | 'height' | 'bbox'>, lat: number, lon: number) {
  const [w, s, e, n] = g.bbox;
  const x = Math.floor(((wrapLon(lon) - w) / (e - w)) * g.width);
  const y = Math.floor(((n - clampLat(lat)) / (n - s)) * g.height);
  return { x: Math.max(0, Math.min(g.width - 1, x)), y: Math.max(0, Math.min(g.height - 1, y)) };
}

/** Centre of pixel (x, y). */
export function pixelToLatLon(g: Pick<ValueGrid, 'width' | 'height' | 'bbox'>, x: number, y: number) {
  const [w, s, e, n] = g.bbox;
  return { lon: w + ((x + 0.5) / g.width) * (e - w), lat: n - ((y + 0.5) / g.height) * (n - s) };
}

export function sampleGrid(g: ValueGrid, lat: number, lon: number): Sample {
  const { x, y } = latLonToPixel(g, lat, lon);
  const bin = g.bins[y * g.width + x];
  return { lat: clampLat(lat), lon: wrapLon(lon), x, y, bin, entry: bin === NO_DATA ? null : g.colormap.entries[bin] };
}

export interface GridStats {
  /** Fraction of the Earth's surface (area-weighted) with data. */
  coverage: number;
  mean: number;
  min: { entry: ColormapEntry; lat: number; lon: number } | null;
  max: { entry: ColormapEntry; lat: number; lon: number } | null;
  /** Area-weighted means for latitude zones, NaN if empty. */
  zones: { name: string; south: number; north: number; mean: number }[];
}

const ZONES = [
  { name: 'Arctic (north of 60° N)', south: 60, north: 90 },
  { name: 'Northern mid-latitudes (23° to 60° N)', south: 23.5, north: 60 },
  { name: 'Tropics (23° S to 23° N)', south: -23.5, north: 23.5 },
  { name: 'Southern mid-latitudes (23° to 60° S)', south: -60, north: -23.5 },
  { name: 'Southern Ocean (south of 60° S)', south: -90, north: -60 },
];

/** Area-weighted statistics (cos latitude) so polar pixels don't dominate. */
export function gridStats(g: ValueGrid): GridStats {
  let wSum = 0;
  let wData = 0;
  let vSum = 0;
  let minBin = Infinity;
  let maxBin = -Infinity;
  let minAt = { x: 0, y: 0 };
  let maxAt = { x: 0, y: 0 };
  const zoneAcc = ZONES.map(() => ({ w: 0, v: 0 }));
  for (let y = 0; y < g.height; y++) {
    const { lat } = pixelToLatLon(g, 0, y);
    const w = Math.cos((lat * Math.PI) / 180);
    const zi = ZONES.findIndex((z) => lat >= z.south && lat < z.north);
    for (let x = 0; x < g.width; x++) {
      wSum += w;
      const bin = g.bins[y * g.width + x];
      if (bin === NO_DATA) continue;
      const v = g.colormap.entries[bin].value;
      wData += w;
      vSum += v * w;
      if (zi >= 0) {
        zoneAcc[zi].w += w;
        zoneAcc[zi].v += v * w;
      }
      if (bin < minBin) {
        minBin = bin;
        minAt = { x, y };
      }
      if (bin > maxBin) {
        maxBin = bin;
        maxAt = { x, y };
      }
    }
  }
  const at = (bin: number, p: { x: number; y: number }) =>
    Number.isFinite(bin) ? { entry: g.colormap.entries[bin], ...pixelToLatLon(g, p.x, p.y) } : null;
  return {
    coverage: wSum ? wData / wSum : 0,
    mean: wData ? vSum / wData : NaN,
    min: at(minBin, minAt),
    max: at(maxBin, maxAt),
    zones: ZONES.map((z, i) => ({ ...z, mean: zoneAcc[i].w ? zoneAcc[i].v / zoneAcc[i].w : NaN })),
  };
}
