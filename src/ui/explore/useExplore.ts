import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { engine } from '../../audio/engine';
import type { Dataset } from '../../data/types';
import { describeExploreMapping } from '../../mapping/legend';
import { midiToFreq, midiToNoteName, normalize, valueToMidi } from '../../mapping/pitch';
import { hapticPattern, LAND_HAPTIC, lonToPan } from '../../mapping/spatial';
import type { Colormap } from '../../sampling/colormap';
import { describeFrame, displayEntry, speakEntry } from '../../sampling/describe';
import { formatLatLon, speakLatLon } from '../../sampling/geo';
import { loadColormap, loadFrame } from '../../sampling/gibs';
import { buildValueGrid, clampLat, gridStats, sampleGrid, wrapLon, type Sample, type ValueGrid } from '../../sampling/grid';
import { createInverter } from '../../sampling/inverter';
import { usePlayerStore } from '../../state/playerStore';

/** hover = mouse move without a click (not a user gesture, so it can't unlock audio). */
export type InputSource = 'hover' | 'click' | 'touch' | 'keyboard';

/** How long the tone sustains after the cursor stops moving. */
const IDLE_FADE_MS = 1400;
/** Pointer announcements wait for the cursor to rest this long. */
const POINTER_ANNOUNCE_MS = 450;

/**
 * Explore mode controller: loads a GIBS frame, inverts it to a value grid,
 * and sonifies / announces the value under a movable cursor.
 */
export function useExplore(dataset: Dataset) {
  const frameSpec = dataset.frame!;
  const layer = dataset.gibsLayerId!;
  const date = usePlayerStore((s) => s.explore.date);
  const setExplore = usePlayerStore((s) => s.setExplore);

  const [grid, setGrid] = useState<ValueGrid | null>(null);
  const [bitmap, setBitmap] = useState<ImageBitmap | null>(null);
  const colormapRef = useRef<Colormap | null>(null);

  // ── Load colormap + frame whenever the date changes ──
  useEffect(() => {
    const ac = new AbortController();
    setExplore({ status: 'loading', notice: '' });
    usePlayerStore.getState().announce(`Loading ${dataset.title} for ${date}`);
    (async () => {
      const base = import.meta.env.BASE_URL;
      colormapRef.current ??= await loadColormap(dataset.colormap!, base + frameSpec.colormapFallback, ac.signal);
      const cmap = colormapRef.current;
      const frame = await loadFrame(
        { layer, date, width: frameSpec.width, height: frameSpec.height, bbox: frameSpec.bbox },
        { baseUrl: base, cachedDates: frameSpec.cachedDates, signal: ac.signal },
      );
      const g = buildValueGrid(frame.rgba, frame.width, frame.height, frameSpec.bbox, cmap, createInverter(cmap));
      if (ac.signal.aborted) return;
      setGrid(g);
      setBitmap((old) => {
        old?.close();
        return frame.bitmap;
      });
      setExplore({ status: 'ready', source: frame.source, shownDate: frame.date, notice: frame.notice ?? '' });
      usePlayerStore
        .getState()
        .announce(
          `${dataset.title} map ready for ${frame.date}. ` +
            (frame.notice ? frame.notice + ' ' : '') +
            'Use the arrow keys to move, F to describe the map.',
        );
    })().catch((err: unknown) => {
      if (ac.signal.aborted) return;
      const msg = err instanceof Error ? err.message : String(err);
      setExplore({ status: 'error', notice: msg });
      usePlayerStore.getState().announce(`Could not load the map. ${msg}`);
    });
    return () => ac.abort();
  }, [date, dataset, frameSpec, layer, setExplore]);

  const stats = useMemo(() => (grid ? gridStats(grid) : null), [grid]);

  const words = useMemo(
    () => ({ unitSpoken: dataset.unitSpoken, decimals: dataset.decimals, belowRangeMeans: frameSpec.belowRangeMeans }),
    [dataset, frameSpec],
  );

  // ── Cursor → sound, haptics, captions, announcements ──
  const lastBin = useRef<number | null>(null);
  const idleTimer = useRef<number | undefined>(undefined);
  const announceTimer = useRef<number | undefined>(undefined);
  const lastVibrate = useRef(0);
  const moveSeq = useRef(0);

  const spoken = useCallback(
    (smp: Sample) => `${speakEntry(smp.entry, words)}. ${speakLatLon(smp.lat, smp.lon)}`,
    [words],
  );

  const sound = useCallback(
    (smp: Sample) => {
      const pan = lonToPan(smp.lon);
      if (smp.entry) engine.exploreTone(midiToFreq(valueToMidi(smp.entry.value, dataset.mapping)), pan, 0.6);
      else engine.exploreLand(pan);
    },
    [dataset],
  );

  const moveTo = useCallback(
    async (lat: number, lon: number, source: InputSource) => {
      if (!grid) return;
      const seq = ++moveSeq.current;
      const smp = sampleGrid(grid, clampLat(lat), wrapLon(lon));
      const s = usePlayerStore.getState();
      s.setExplore({ cursor: { lat: smp.lat, lon: smp.lon } });

      // Audio needs a user gesture once; keyboard and pointerdown qualify, hover alone does not.
      if (!engine.ready && source !== 'hover') {
        await engine.init();
        if (seq !== moveSeq.current) return; // a newer move happened while audio was starting
      }
      if (engine.ready) sound(smp);
      const midi = smp.entry ? valueToMidi(smp.entry.value, dataset.mapping) : null;

      s.setCaption(
        `${midi !== null ? `♪ ${midiToNoteName(midi)}` : '≈ rushing sound (land / no data)'} · ` +
          `${displayEntry(smp.entry, dataset.decimals)}${smp.entry ? ` ${dataset.unit}` : ''} · ${formatLatLon(smp.lat, smp.lon)}`,
      );

      // Haptics on touch devices, only when crossing into a different value bin.
      if (source === 'touch' && smp.bin !== lastBin.current && 'vibrate' in navigator) {
        const now = performance.now();
        if (now - lastVibrate.current > 90) {
          lastVibrate.current = now;
          navigator.vibrate(smp.entry ? hapticPattern(normalize(smp.entry.value, dataset.mapping.domain)) : LAND_HAPTIC);
        }
      }

      window.clearTimeout(announceTimer.current);
      if (source === 'keyboard' || source === 'click') s.announce(spoken(smp));
      else if (smp.bin !== lastBin.current) {
        announceTimer.current = window.setTimeout(() => usePlayerStore.getState().announce(spoken(smp)), POINTER_ANNOUNCE_MS);
      }
      lastBin.current = smp.bin;

      window.clearTimeout(idleTimer.current);
      idleTimer.current = window.setTimeout(() => engine.exploreStop(), IDLE_FADE_MS);
    },
    [grid, sound, spoken, dataset],
  );

  const moveBy = useCallback(
    (dLat: number, dLon: number) => {
      const { lat, lon } = usePlayerStore.getState().explore.cursor;
      void moveTo(lat + dLat, lon + dLon, 'keyboard');
    },
    [moveTo],
  );

  const leave = useCallback(() => {
    window.clearTimeout(idleTimer.current);
    window.clearTimeout(announceTimer.current);
    lastBin.current = null;
    engine.exploreStop(0.3);
  }, []);

  // Stop sounds when leaving Explore mode.
  useEffect(() => leave, [leave]);

  const speakHere = useCallback(() => {
    if (!grid) return;
    const { lat, lon } = usePlayerStore.getState().explore.cursor;
    usePlayerStore.getState().announce(spoken(sampleGrid(grid, lat, lon)));
  }, [grid, spoken]);

  const frameDescription = useMemo(
    () =>
      stats && grid
        ? describeFrame(stats, dataset.title, usePlayerStore.getState().explore.shownDate ?? date, words)
        : dataset.altText,
    [stats, grid, dataset, date, words],
  );

  const describe = useCallback(() => usePlayerStore.getState().announce(frameDescription), [frameDescription]);

  const speakLegend = useCallback(
    () => usePlayerStore.getState().announce(`${dataset.title}. ${describeExploreMapping(dataset.mapping).join(' ')}`),
    [dataset],
  );

  /** First click / key on the map: unlock audio and sound the current point. */
  const activate = useCallback(async () => {
    const first = !engine.ready;
    await engine.init();
    if (first) {
      const s = usePlayerStore.getState();
      engine.setMasterMuted(s.muted);
      engine.setMasterVolume(s.volumeDb);
    }
  }, []);

  return { grid, bitmap, stats, colormap: colormapRef.current, moveTo, moveBy, leave, speakHere, describe, speakLegend, activate, frameDescription };
}

export type ExploreApi = ReturnType<typeof useExplore>;
