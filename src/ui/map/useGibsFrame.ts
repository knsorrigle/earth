import { useEffect, useMemo, useState } from 'react';
import type { Dataset } from '../../data/types';
import type { Colormap } from '../../sampling/colormap';
import { describeFrame, type ValueWords } from '../../sampling/describe';
import { fetchRgba, loadColormap, loadFrame } from '../../sampling/gibs';
import { buildValueGrid, gridStats, type ValueGrid } from '../../sampling/grid';
import { createInverter } from '../../sampling/inverter';
import { buildLandMask, createPresenceInverter, describePresenceFrame, presenceColormap } from '../../sampling/presence';
import { usePlayerStore } from '../../state/playerStore';

interface LoadedFrame {
  grid: ValueGrid;
  bitmap: ImageBitmap;
  basemap: Basemap | null;
  date: string;
  source: 'live' | 'cache';
  notice?: string;
}

// Module-level caches so switching between Explore and Scanner doesn't refetch.
const colormaps = new Map<string, Promise<Colormap>>();
const frames = new Map<string, LoadedFrame>();
const basemaps = new Map<string, Promise<Basemap>>();

export interface Basemap {
  /** Recoloured for display: dark land, darker sea. */
  bitmap: ImageBitmap;
  /** 1 = land. Same grid as the frames. */
  land: Uint8Array;
}

const LAND_RGB = [42, 52, 68];
const SEA_RGB = [9, 14, 22];

/** Load a static land/water basemap once, derive the land mask and a dark display version. */
export function getBasemap(path: string): Promise<Basemap> {
  let p = basemaps.get(path);
  if (!p) {
    p = (async () => {
      const img = await fetchRgba(import.meta.env.BASE_URL + path);
      const land = buildLandMask(img.rgba, img.width, img.height);
      const out = new ImageData(img.width, img.height);
      for (let i = 0, q = 0; i < land.length; i++, q += 4) {
        const c = land[i] ? LAND_RGB : SEA_RGB;
        out.data[q] = c[0];
        out.data[q + 1] = c[1];
        out.data[q + 2] = c[2];
        out.data[q + 3] = 255;
      }
      img.bitmap.close();
      return { land, bitmap: await createImageBitmap(out) };
    })();
    basemaps.set(path, p);
    p.catch(() => basemaps.delete(path));
  }
  return p;
}
const MAX_FRAMES = 4;

function remember(key: string, f: LoadedFrame) {
  frames.delete(key);
  frames.set(key, f);
  while (frames.size > MAX_FRAMES) {
    const [oldKey, old] = frames.entries().next().value as [string, LoadedFrame];
    frames.delete(oldKey);
    old.bitmap.close();
  }
}

function getColormap(dataset: Dataset, signal: AbortSignal): Promise<Colormap> {
  const url = dataset.colormap!;
  let p = colormaps.get(url);
  if (!p) {
    p = loadColormap(url, import.meta.env.BASE_URL + dataset.frame!.colormapFallback, signal);
    colormaps.set(url, p);
    p.catch(() => colormaps.delete(url));
  }
  return p;
}

/**
 * Loads the GIBS frame for the selected date (shared by Explore and Scanner):
 * colormap, image, value grid, statistics and a spoken description.
 */
/** readyHint: spoken after the map loads; null keeps loading silent (e.g. behind the Ear Test). */
export function useGibsFrame(dataset: Dataset, readyHint: string | null) {
  const spec = dataset.frame!;
  const layer = dataset.gibsLayerId!;
  const date = usePlayerStore((s) => s.explore.date);
  const setExplore = usePlayerStore((s) => s.setExplore);
  const [frame, setFrame] = useState<LoadedFrame | null>(null);

  useEffect(() => {
    const key = `${layer}/${date}`;
    const announce = readyHint === null ? () => {} : usePlayerStore.getState().announce;
    const done = (f: LoadedFrame, fromMemory: boolean) => {
      setFrame(f);
      setExplore({ status: 'ready', source: f.source, shownDate: f.date, notice: f.notice ?? '' });
      announce(
        `${dataset.title} map ${fromMemory ? '' : 'ready '}for ${f.date}. ${f.notice ? f.notice + ' ' : ''}${readyHint}`,
      );
    };
    const hit = frames.get(key);
    if (hit) {
      done(hit, true);
      return;
    }

    const ac = new AbortController();
    setExplore({ status: 'loading', notice: '' });
    announce(`Loading ${dataset.title} for ${date}`);
    (async () => {
      const presence = spec.encoding === 'presence';
      const basemapP = spec.basemap ? getBasemap(spec.basemap) : Promise.resolve(null);
      // Colormap fetch is shared across mounts, so don't tie it to this effect's abort signal.
      const cmap = presence ? presenceColormap(dataset.title) : await getColormap(dataset, new AbortController().signal);
      const img = await loadFrame(
        { layer, date, width: spec.width, height: spec.height, bbox: spec.bbox, style: spec.wmsStyle },
        { baseUrl: import.meta.env.BASE_URL, cachedDates: spec.cachedDates, signal: ac.signal, allowSparse: presence },
      );
      const invert = presence ? createPresenceInverter(spec.presenceRgb!) : createInverter(cmap);
      const grid = buildValueGrid(img.rgba, img.width, img.height, spec.bbox, cmap, invert);
      const basemap = await basemapP;
      const loaded: LoadedFrame = { grid, bitmap: img.bitmap, basemap, date: img.date, source: img.source, notice: img.notice };
      remember(key, loaded);
      if (!ac.signal.aborted) done(loaded, false);
    })().catch((err: unknown) => {
      if (ac.signal.aborted) return;
      const msg = err instanceof Error ? err.message : String(err);
      setExplore({ status: 'error', notice: msg });
      announce(`Could not load the map. ${msg}`);
    });
    return () => ac.abort();
  }, [date, dataset, spec, layer, setExplore, readyHint]);

  const grid = frame?.grid ?? null;
  const presence = spec.encoding === 'presence';
  const stats = useMemo(() => (grid && !presence ? gridStats(grid) : null), [grid, presence]);
  const words: ValueWords = useMemo(
    () => ({ unitSpoken: dataset.unitSpoken, decimals: dataset.decimals, belowRangeMeans: spec.belowRangeMeans }),
    [dataset, spec],
  );
  const description = useMemo(() => {
    if (!frame) return dataset.altText;
    if (presence) return describePresenceFrame(frame.grid, dataset.title, frame.date, frame.basemap?.land);
    return stats ? describeFrame(stats, dataset.title, frame.date, words) : dataset.altText;
  }, [stats, frame, dataset, words, presence]);

  return {
    grid,
    bitmap: frame?.bitmap ?? null,
    underlay: frame?.basemap?.bitmap ?? null,
    land: frame?.basemap?.land ?? null,
    presence,
    stats,
    words,
    description,
  };
}

export type GibsFrame = ReturnType<typeof useGibsFrame>;
