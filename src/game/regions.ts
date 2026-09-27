import { NO_DATA } from '../sampling/inverter';
import type { BBox, ValueGrid } from '../sampling/grid';

export interface OceanRegion {
  id: string;
  name: string;
  /** [west, south, east, north] in degrees. Approximate boxes over open water. */
  box: BBox;
}

/**
 * Well-known ocean regions for "which is warmer?" questions. Boxes are
 * approximate; only ocean pixels inside them are averaged.
 */
export const OCEAN_REGIONS: OceanRegion[] = [
  { id: 'gulf-of-mexico', name: 'the Gulf of Mexico', box: [-97, 19, -82, 29] },
  { id: 'caribbean', name: 'the Caribbean Sea', box: [-84, 11, -62, 20] },
  { id: 'sargasso', name: 'the Sargasso Sea', box: [-70, 25, -55, 35] },
  { id: 'labrador', name: 'the Labrador Sea', box: [-60, 53, -48, 62] },
  { id: 'north-sea', name: 'the North Sea', box: [-2, 51, 8, 60] },
  { id: 'east-med', name: 'the eastern Mediterranean', box: [18, 31, 33, 37] },
  { id: 'red-sea', name: 'the Red Sea', box: [34, 15, 42, 27] },
  { id: 'arabian', name: 'the Arabian Sea', box: [55, 8, 70, 20] },
  { id: 'bengal', name: 'the Bay of Bengal', box: [80, 8, 93, 20] },
  { id: 'south-china', name: 'the South China Sea', box: [110, 5, 120, 18] },
  { id: 'warm-pool', name: 'the western Pacific warm pool', box: [130, -5, 150, 10] },
  { id: 'coral', name: 'the Coral Sea', box: [150, -25, 160, -12] },
  { id: 'tasman', name: 'the Tasman Sea', box: [155, -45, 170, -35] },
  { id: 'nino34', name: 'the equatorial Pacific (Niño 3.4 region)', box: [-170, -5, -120, 5] },
  { id: 'humboldt', name: 'the Humboldt Current off Peru', box: [-80, -16, -74, -8] },
  { id: 'benguela', name: 'the Benguela Current off Namibia', box: [8, -30, 14, -18] },
  { id: 'gulf-of-alaska', name: 'the Gulf of Alaska', box: [-155, 52, -140, 58] },
  { id: 'bering', name: 'the Bering Sea', box: [-178, 54, -165, 62] },
  { id: 'hudson', name: 'Hudson Bay', box: [-92, 55, -78, 63] },
  { id: 'barents', name: 'the Barents Sea', box: [20, 70, 50, 78] },
  { id: 'southern-africa', name: 'the Southern Ocean south of Africa', box: [10, -60, 30, -50] },
  { id: 'weddell', name: 'the Weddell Sea', box: [-50, -70, -30, -62] },
];

/**
 * Area-weighted mean over data pixels inside a box, with the share of the
 * box that has data. null if (almost) nothing in the box has data.
 */
export function regionMean(grid: ValueGrid, box: BBox, minCoverage = 0.2): { mean: number; coverage: number } | null {
  const [w, s, e, n] = box;
  const [gw, gs, ge, gn] = grid.bbox;
  const x0 = Math.max(0, Math.floor(((w - gw) / (ge - gw)) * grid.width));
  const x1 = Math.min(grid.width, Math.ceil(((e - gw) / (ge - gw)) * grid.width));
  const y0 = Math.max(0, Math.floor(((gn - n) / (gn - gs)) * grid.height));
  const y1 = Math.min(grid.height, Math.ceil(((gn - s) / (gn - gs)) * grid.height));
  let wAll = 0;
  let wData = 0;
  let sum = 0;
  for (let y = y0; y < y1; y++) {
    const lat = gn - ((y + 0.5) / grid.height) * (gn - gs);
    const wt = Math.cos((lat * Math.PI) / 180);
    for (let x = x0; x < x1; x++) {
      wAll += wt;
      const bin = grid.bins[y * grid.width + x];
      if (bin === NO_DATA) continue;
      wData += wt;
      sum += grid.colormap.entries[bin].value * wt;
    }
  }
  if (wAll === 0 || wData / wAll < minCoverage) return null;
  return { mean: sum / wData, coverage: wData / wAll };
}
