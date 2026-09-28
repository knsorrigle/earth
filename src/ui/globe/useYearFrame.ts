import { useEffect, useState } from 'react';
import type { Dataset } from '../../data/types';
import { buildWmsGetMapUrl, fetchRgba } from '../../sampling/gibs';
import { getBasemap } from '../map/useGibsFrame';

/** Globe textures for years don't need the analysis grid resolution. */
const W = 1024;
const H = 512;
const MAX_CACHED = 14;
const PREFETCH = 2;

const cache = new Map<string, Promise<ImageBitmap | null>>();

function key(layer: string, date: string) {
  return `${layer}/${date}`;
}

function load(layer: string, date: string): Promise<ImageBitmap | null> {
  const k = key(layer, date);
  const hit = cache.get(k);
  if (hit) {
    cache.delete(k);
    cache.set(k, hit); // most recently used
    return hit;
  }
  const p = fetchRgba(buildWmsGetMapUrl({ layer, date, width: W, height: H, bbox: [-180, -90, 180, 90] }))
    .then((f) => f.bitmap)
    .catch(() => null);
  cache.set(k, p);
  while (cache.size > MAX_CACHED) {
    const [oldKey, old] = cache.entries().next().value as [string, Promise<ImageBitmap | null>];
    cache.delete(oldKey);
    void old.then((b) => b?.close());
  }
  return p;
}

export interface YearFrame {
  bitmap: ImageBitmap | null;
  underlay: ImageBitmap | null;
  /** The year actually shown (clamped to the layer's range). */
  year: number;
  date: string;
  /** True when the record's year is outside the layer's years. */
  clamped: boolean;
}

/**
 * The globe texture for a time series at a given year: a live GIBS frame for
 * that year's date, with the next years prefetched so playback can morph
 * through them. Keeps showing the last frame until the next one arrives.
 */
export function useYearFrame(dataset: Dataset | null, year: number | null): YearFrame | null {
  const cfg = dataset?.globeYears;
  const [frame, setFrame] = useState<YearFrame | null>(null);

  useEffect(() => {
    if (!cfg || year === null) {
      setFrame(null);
      return;
    }
    let cancelled = false;
    const y = Math.max(cfg.firstYear, Math.min(cfg.lastYear, year));
    const date = `${y}-${cfg.monthDay}`;
    void (async () => {
      const [bitmap, basemap] = await Promise.all([load(cfg.layer, date), cfg.underlay ? getBasemap(cfg.underlay) : Promise.resolve(null)]);
      if (cancelled || !bitmap) return;
      setFrame({ bitmap, underlay: basemap?.bitmap ?? null, year: y, date, clamped: y !== year });
    })();
    for (let i = 1; i <= PREFETCH; i++) if (y + i <= cfg.lastYear) void load(cfg.layer, `${y + i}-${cfg.monthDay}`);
    return () => {
      cancelled = true;
    };
  }, [cfg, year]);

  return cfg ? frame : null;
}
