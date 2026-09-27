import type { Colormap } from './colormap';
import { deltaE, rgbToLab } from './lab';
import { pixelToLatLon, type ValueGrid } from './grid';
import { speakLatLon } from './geo';

/**
 * Presence layers (e.g. fire detections) draw every detection in one marker
 * colour. They are represented as a two-bin grid: 0 = nothing detected,
 * 1 = detected. Every pixel has data, so "no fire" is a real zero.
 */
export const ABSENT = 0;
export const PRESENT = 1;

export function presenceColormap(label: string): Colormap {
  return {
    title: label,
    units: '',
    entries: [
      { rgb: [0, 0, 0], min: 0, max: 0, value: 0, label: 'none detected', nodata: false, transparent: true },
      { rgb: [255, 255, 255], min: 1, max: 1, value: 1, label, nodata: false, transparent: false },
    ],
    nodata: [],
  };
}

/** Pixel -> PRESENT if it is (close to) the marker colour and mostly opaque. */
export function createPresenceInverter(rgb: [number, number, number], { alphaThreshold = 96, maxDeltaE = 30 } = {}) {
  const target = rgbToLab(...rgb);
  const cache = new Map<number, number>();
  return (r: number, g: number, b: number, a = 255): number => {
    if (a < alphaThreshold) return ABSENT;
    const k = (r << 16) | (g << 8) | b;
    let v = cache.get(k);
    if (v === undefined) {
      v = deltaE(rgbToLab(r, g, b), target) <= maxDeltaE ? PRESENT : ABSENT;
      cache.set(k, v);
    }
    return v;
  };
}

/**
 * Land mask from the GIBS OSM_Land_Water_Map basemap: land is dark grey
 * (~75), water light grey (~128). 1 = land.
 */
export function buildLandMask(rgba: ArrayLike<number>, width: number, height: number, threshold = 100): Uint8Array {
  const mask = new Uint8Array(width * height);
  for (let i = 0, p = 0; i < mask.length; i++, p += 4) {
    mask[i] = rgba[p + 3] > 0 && rgba[p] < threshold ? 1 : 0;
  }
  return mask;
}

export interface Neighbourhood {
  /** Area-weighted share of the window (land only, if a mask is given) marked as present. */
  fraction: number;
  /** Share of the window that is land (1 if no mask). */
  landShare: number;
  /** Whether the pixel under the cursor itself is land. */
  onLand: boolean;
}

/** Share of the area within radiusKm of (lat, lon) that is marked present. */
export function neighbourhood(grid: ValueGrid, lat: number, lon: number, radiusKm: number, land?: Uint8Array | null): Neighbourhood {
  const { width, height } = grid;
  const degPerPxY = 180 / height;
  const degPerPxX = 360 / width;
  const radiusDeg = radiusKm / 111.32;
  const cy = Math.min(height - 1, Math.max(0, Math.floor(((90 - lat) / 180) * height)));
  const cx = Math.min(width - 1, Math.max(0, Math.floor(((lon + 180) / 360) * width)));
  const ry = Math.ceil(radiusDeg / degPerPxY);
  let wAll = 0;
  let wLand = 0;
  let wHit = 0;
  for (let dy = -ry; dy <= ry; dy++) {
    const y = cy + dy;
    if (y < 0 || y >= height) continue;
    const rowLat = pixelToLatLon(grid, 0, y).lat;
    const cos = Math.max(0.05, Math.cos((rowLat * Math.PI) / 180));
    const rx = Math.min(width / 2, Math.ceil(radiusDeg / cos / degPerPxX));
    for (let dx = -rx; dx <= rx; dx++) {
      // Circular window in kilometres.
      const km = Math.hypot(dy * degPerPxY, dx * degPerPxX * cos) * 111.32;
      if (km > radiusKm) continue;
      const x = (((cx + dx) % width) + width) % width;
      const i = y * width + x;
      wAll += cos;
      const isLand = land ? land[i] === 1 : true;
      if (isLand) wLand += cos;
      if (grid.bins[i] === PRESENT && isLand) wHit += cos;
      else if (grid.bins[i] === PRESENT && !land) wHit += cos;
    }
  }
  const idx = cy * width + cx;
  return {
    fraction: wLand > 0 ? wHit / wLand : 0,
    landShare: wAll > 0 ? wLand / wAll : 0,
    onLand: land ? land[idx] === 1 : true,
  };
}

/** Words for a fire-activity fraction. */
export function activityWord(fraction: number): string {
  if (fraction <= 0) return 'no fires detected';
  if (fraction < 0.01) return 'a few fire detections';
  if (fraction < 0.05) return 'some fire activity';
  if (fraction < 0.25) return 'a lot of fire activity';
  return 'intense fire activity';
}

export interface Hotspot {
  lat: number;
  lon: number;
  fraction: number;
}

/** Area-weighted presence fraction per cellDeg × cellDeg cell; the top n cells. */
export function hotspots(grid: ValueGrid, cellDeg: number, n: number): Hotspot[] {
  const cols = Math.round(360 / cellDeg);
  const rows = Math.round(180 / cellDeg);
  const hit = new Float64Array(cols * rows);
  const all = new Float64Array(cols * rows);
  for (let y = 0; y < grid.height; y++) {
    const { lat } = pixelToLatLon(grid, 0, y);
    const w = Math.cos((lat * Math.PI) / 180);
    const r = Math.min(rows - 1, Math.floor(((90 - lat) / 180) * rows));
    for (let x = 0; x < grid.width; x++) {
      const c = Math.min(cols - 1, Math.floor((x / grid.width) * cols));
      all[r * cols + c] += w;
      if (grid.bins[y * grid.width + x] === PRESENT) hit[r * cols + c] += w;
    }
  }
  const out: Hotspot[] = [];
  for (let i = 0; i < hit.length; i++) {
    if (hit[i] <= 0) continue;
    const r = Math.floor(i / cols);
    const c = i % cols;
    out.push({ lat: 90 - (r + 0.5) * cellDeg, lon: -180 + (c + 0.5) * cellDeg, fraction: hit[i] / all[i] });
  }
  return out.sort((a, b) => b.fraction - a.fraction).slice(0, n);
}

/** "Describe this map" for a presence layer. */
export function describePresenceFrame(grid: ValueGrid, what: string, date: string, land?: Uint8Array | null): string {
  let wLand = 0;
  let wHit = 0;
  for (let y = 0; y < grid.height; y++) {
    const w = Math.cos((pixelToLatLon(grid, 0, y).lat * Math.PI) / 180);
    for (let x = 0; x < grid.width; x++) {
      const i = y * grid.width + x;
      if (land && land[i] !== 1) continue;
      wLand += w;
      if (grid.bins[i] === PRESENT) wHit += w;
    }
  }
  const pct = wLand > 0 ? (100 * wHit) / wLand : 0;
  const top = hotspots(grid, 5, 3);
  const parts = [`${what} on ${date}.`];
  if (top.length === 0) {
    parts.push('No fire detections on this day.');
  } else {
    parts.push(
      `Fire markers cover ${pct.toFixed(1)} percent of the ${land ? 'land' : 'area'} on this map — a relative measure of fire activity, not burned area.`,
    );
    parts.push(`Busiest areas: ${top.map((h) => `near ${speakLatLon(h.lat, h.lon, 0)}`).join('; ')}.`);
  }
  return parts.join(' ');
}
