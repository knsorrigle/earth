import type { Colormap } from './colormap';
import { deltaE, rgbToLab } from './lab';

export const NO_DATA = -1;

export interface InverterOptions {
  /** Pixels with alpha below this are no-data. */
  alphaThreshold?: number;
  /** Colours further than this (CIE76) from every entry are treated as no-data. */
  maxDeltaE?: number;
}

/**
 * Pixel colour -> colormap entry index (or NO_DATA).
 * Exact RGB matches are a hash lookup; anything else (resampling, colour
 * management) falls back to the nearest entry in LAB space, cached per colour.
 */
export function createInverter(cmap: Colormap, opts: InverterOptions = {}) {
  const { alphaThreshold = 128, maxDeltaE = 12 } = opts;
  const key = (r: number, g: number, b: number) => (r << 16) | (g << 8) | b;

  const exact = new Map<number, number>();
  cmap.entries.forEach((e, i) => exact.set(key(...e.rgb), i));
  // Opaque no-data colours (some layers use a colour, not transparency, for land).
  for (const nd of cmap.nodata) if (!nd.transparent) exact.set(key(...nd.rgb), NO_DATA);

  const labs = cmap.entries.map((e) => rgbToLab(...e.rgb));
  const ndLabs = cmap.nodata.filter((n) => !n.transparent).map((n) => rgbToLab(...n.rgb));
  const nearestCache = new Map<number, number>();

  function nearest(r: number, g: number, b: number): number {
    const lab = rgbToLab(r, g, b);
    let best = NO_DATA;
    let bestD = maxDeltaE;
    for (let i = 0; i < labs.length; i++) {
      const d = deltaE(lab, labs[i]);
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    }
    for (const nl of ndLabs) if (deltaE(lab, nl) < bestD) return NO_DATA;
    return best;
  }

  return function lookup(r: number, g: number, b: number, a = 255): number {
    if (a < alphaThreshold) return NO_DATA;
    const k = key(r, g, b);
    const hit = exact.get(k);
    if (hit !== undefined) return hit;
    let n = nearestCache.get(k);
    if (n === undefined) {
      n = nearest(r, g, b);
      nearestCache.set(k, n);
    }
    return n;
  };
}

export type Inverter = ReturnType<typeof createInverter>;
