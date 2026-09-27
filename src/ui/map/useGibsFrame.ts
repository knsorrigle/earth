import { useEffect, useMemo, useState } from 'react';
import type { Dataset } from '../../data/types';
import type { Colormap } from '../../sampling/colormap';
import { describeFrame, type ValueWords } from '../../sampling/describe';
import { loadColormap, loadFrame } from '../../sampling/gibs';
import { buildValueGrid, gridStats, type ValueGrid } from '../../sampling/grid';
import { createInverter } from '../../sampling/inverter';
import { usePlayerStore } from '../../state/playerStore';

interface LoadedFrame {
  grid: ValueGrid;
  bitmap: ImageBitmap;
  date: string;
  source: 'live' | 'cache';
  notice?: string;
}

// Module-level caches so switching between Explore and Scanner doesn't refetch.
const colormaps = new Map<string, Promise<Colormap>>();
const frames = new Map<string, LoadedFrame>();
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
export function useGibsFrame(dataset: Dataset, readyHint: string) {
  const spec = dataset.frame!;
  const layer = dataset.gibsLayerId!;
  const date = usePlayerStore((s) => s.explore.date);
  const setExplore = usePlayerStore((s) => s.setExplore);
  const [frame, setFrame] = useState<LoadedFrame | null>(null);

  useEffect(() => {
    const key = `${layer}/${date}`;
    const announce = usePlayerStore.getState().announce;
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
      // Colormap fetch is shared across mounts, so don't tie it to this effect's abort signal.
      const cmap = await getColormap(dataset, new AbortController().signal);
      const img = await loadFrame(
        { layer, date, width: spec.width, height: spec.height, bbox: spec.bbox },
        { baseUrl: import.meta.env.BASE_URL, cachedDates: spec.cachedDates, signal: ac.signal },
      );
      const grid = buildValueGrid(img.rgba, img.width, img.height, spec.bbox, cmap, createInverter(cmap));
      const loaded: LoadedFrame = { grid, bitmap: img.bitmap, date: img.date, source: img.source, notice: img.notice };
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
  const stats = useMemo(() => (grid ? gridStats(grid) : null), [grid]);
  const words: ValueWords = useMemo(
    () => ({ unitSpoken: dataset.unitSpoken, decimals: dataset.decimals, belowRangeMeans: spec.belowRangeMeans }),
    [dataset, spec],
  );
  const description = useMemo(
    () => (stats && frame ? describeFrame(stats, dataset.title, frame.date, words) : dataset.altText),
    [stats, frame, dataset, words],
  );

  return { grid, bitmap: frame?.bitmap ?? null, stats, words, description };
}

export type GibsFrame = ReturnType<typeof useGibsFrame>;
