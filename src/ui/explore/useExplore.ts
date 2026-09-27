import { useCallback, useEffect, useRef } from 'react';
import { engine } from '../../audio/engine';
import type { Dataset } from '../../data/types';
import { describeExploreMapping } from '../../mapping/legend';
import { midiToFreq, midiToNoteName, normalize, valueToMidi } from '../../mapping/pitch';
import { hapticPattern, LAND_HAPTIC, lonToPan } from '../../mapping/spatial';
import { displayEntry, speakEntry } from '../../sampling/describe';
import { formatLatLon, speakLatLon } from '../../sampling/geo';
import { clampLat, sampleGrid, wrapLon, type Sample } from '../../sampling/grid';
import { usePlayerStore } from '../../state/playerStore';
import type { GibsFrame } from '../map/useGibsFrame';

export type { InputSource } from '../map/MapCanvas';
import type { InputSource } from '../map/MapCanvas';

/** How long the tone sustains after the cursor stops moving. */
const IDLE_FADE_MS = 1400;
/** Pointer announcements wait for the cursor to rest this long. */
const POINTER_ANNOUNCE_MS = 450;

/**
 * Explore mode controller: sonifies and announces the value under a movable
 * cursor on an already-loaded frame.
 */
export function useExplore(dataset: Dataset, frame: GibsFrame) {
  const { grid, words } = frame;

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

  const describe = useCallback(() => usePlayerStore.getState().announce(frame.description), [frame.description]);

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

  return { moveTo, moveBy, leave, speakHere, describe, speakLegend, activate };
}

export type ExploreApi = ReturnType<typeof useExplore>;
