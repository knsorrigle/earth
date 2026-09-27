import { useCallback, useEffect, useRef } from 'react';
import { engine } from '../../audio/engine';
import type { Dataset } from '../../data/types';
import { describeExploreMapping } from '../../mapping/legend';
import { midiToFreq, midiToNoteName, normalize, valueToMidi } from '../../mapping/pitch';
import { hapticPattern, LAND_HAPTIC, lonToPan } from '../../mapping/spatial';
import { displayEntry, speakEntry } from '../../sampling/describe';
import { formatLatLon, speakLatLon } from '../../sampling/geo';
import { clampLat, sampleGrid, wrapLon } from '../../sampling/grid';
import { activityWord, neighbourhood } from '../../sampling/presence';
import { usePlayerStore } from '../../state/playerStore';
import type { GibsFrame } from '../map/useGibsFrame';

export type { InputSource } from '../map/MapCanvas';
import type { InputSource } from '../map/MapCanvas';

/** How long the sound sustains after the cursor stops moving. */
const IDLE_FADE_MS = 1400;
/** Pointer announcements wait for the cursor to rest this long. */
const POINTER_ANNOUNCE_MS = 450;
/** Presence layers (fire) are sonified as density within this radius. */
export const PRESENCE_RADIUS_KM = 250;

/** Everything the UI needs about one cursor position. */
export interface Reading {
  lat: number;
  lon: number;
  /** Changes when the reading changes enough to re-announce / re-vibrate. */
  key: string;
  spoken: string;
  caption: string;
  /** Short value for the big readout, and its unit (may be empty). */
  display: string;
  unit: string;
  /** 0..1 position within the data range, or null when off the data (land / ocean). */
  level: number | null;
  /** Value to mark on the colour bar, if any. */
  marker: number | null;
  play: () => void;
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/**
 * Explore mode controller: sonifies and announces the data under a movable
 * cursor on an already-loaded frame.
 */
export function useExplore(dataset: Dataset, frame: GibsFrame) {
  const { grid, words, land, presence } = frame;

  const readingAt = useCallback(
    (latIn: number, lonIn: number): Reading | null => {
      if (!grid) return null;
      const lat = clampLat(latIn);
      const lon = wrapLon(lonIn);
      const pan = lonToPan(lon);
      const where = speakLatLon(lat, lon);

      if (presence) {
        const nb = neighbourhood(grid, lat, lon, PRESENCE_RADIUS_KM, land);
        const f = nb.fraction;
        const t = f > 0 ? normalize(Math.log10(f), dataset.mapping.domain) : 0;
        const ocean = !nb.onLand && f === 0;
        const word = activityWord(f);
        return {
          lat,
          lon,
          key: `${word}|${ocean}`,
          spoken:
            (ocean ? 'Ocean. ' : '') +
            `${cap(word)} within ${PRESENCE_RADIUS_KM} kilometres` +
            (f > 0 ? `, fire marked on ${(f * 100).toFixed(2)} percent of nearby land` : '') +
            `. ${where}`,
          caption:
            (f > 0 ? `≋ crackle · ${word}` : ocean ? '≈ ocean wash' : '· quiet land') +
            ` · ${(f * 100).toFixed(2)}% of land within ${PRESENCE_RADIUS_KM} km · ${formatLatLon(lat, lon)}`,
          display: ocean ? '—' : `${(f * 100).toFixed(2)}`,
          unit: ocean ? '' : '%',
          level: f > 0 ? t : null,
          marker: null,
          play: () => {
            if (f > 0) {
              engine.exploreQuiet();
              engine.setCrackle(3 + 27 * t, t, pan);
            } else {
              engine.setCrackle(0, 0, pan);
              if (ocean) engine.exploreLand(pan);
              else engine.exploreQuiet();
            }
          },
        };
      }

      const smp = sampleGrid(grid, lat, lon);
      const midi = smp.entry ? valueToMidi(smp.entry.value, dataset.mapping) : null;
      return {
        lat: smp.lat,
        lon: smp.lon,
        key: String(smp.bin),
        spoken: `${speakEntry(smp.entry, words)}. ${where}`,
        caption:
          `${midi !== null ? `♪ ${midiToNoteName(midi)}` : '≈ rushing sound (land / no data)'} · ` +
          `${displayEntry(smp.entry, dataset.decimals)}${smp.entry ? ` ${dataset.unit}` : ''} · ${formatLatLon(smp.lat, smp.lon)}`,
        display: displayEntry(smp.entry, dataset.decimals),
        unit: smp.entry ? dataset.unit : '',
        level: smp.entry ? normalize(smp.entry.value, dataset.mapping.domain) : null,
        marker: smp.entry?.value ?? null,
        play: () => {
          if (midi !== null) engine.exploreTone(midiToFreq(midi), pan, 0.6);
          else engine.exploreLand(pan);
        },
      };
    },
    [grid, land, presence, dataset, words],
  );

  const lastKey = useRef<string | null>(null);
  const idleTimer = useRef<number | undefined>(undefined);
  const announceTimer = useRef<number | undefined>(undefined);
  const lastVibrate = useRef(0);
  const moveSeq = useRef(0);

  const moveTo = useCallback(
    async (lat: number, lon: number, source: InputSource) => {
      const r = readingAt(lat, lon);
      if (!r) return;
      const seq = ++moveSeq.current;
      const s = usePlayerStore.getState();
      s.setExplore({ cursor: { lat: r.lat, lon: r.lon } });

      // Audio needs a user gesture once; keyboard and pointerdown qualify, hover alone does not.
      if (!engine.ready && source !== 'hover') {
        await engine.init();
        if (seq !== moveSeq.current) return; // a newer move happened while audio was starting
      }
      if (engine.ready) r.play();
      s.setCaption(r.caption);

      // Haptics on touch devices, only when the reading changes.
      if (source === 'touch' && r.key !== lastKey.current && 'vibrate' in navigator) {
        const now = performance.now();
        if (now - lastVibrate.current > 90) {
          lastVibrate.current = now;
          navigator.vibrate(r.level !== null ? hapticPattern(r.level) : LAND_HAPTIC);
        }
      }

      window.clearTimeout(announceTimer.current);
      if (source === 'keyboard' || source === 'click') s.announce(r.spoken);
      else if (r.key !== lastKey.current) {
        announceTimer.current = window.setTimeout(() => usePlayerStore.getState().announce(r.spoken), POINTER_ANNOUNCE_MS);
      }
      lastKey.current = r.key;

      window.clearTimeout(idleTimer.current);
      idleTimer.current = window.setTimeout(() => engine.exploreStop(), IDLE_FADE_MS);
    },
    [readingAt],
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
    lastKey.current = null;
    engine.exploreStop(0.3);
  }, []);

  // Stop sounds when leaving Explore mode.
  useEffect(() => leave, [leave]);

  const speakHere = useCallback(() => {
    const { lat, lon } = usePlayerStore.getState().explore.cursor;
    const r = readingAt(lat, lon);
    if (r) usePlayerStore.getState().announce(r.spoken);
  }, [readingAt]);

  const describe = useCallback(() => usePlayerStore.getState().announce(frame.description), [frame.description]);

  const speakLegend = useCallback(
    () =>
      usePlayerStore
        .getState()
        .announce(`${dataset.title}. ${describeExploreMapping(dataset.mapping, presence ? 'presence' : 'colormap').join(' ')}`),
    [dataset, presence],
  );

  /** First click / key on the map: unlock audio. */
  const activate = useCallback(async () => {
    const first = !engine.ready;
    await engine.init();
    if (first) {
      const s = usePlayerStore.getState();
      engine.setMasterMuted(s.muted);
      engine.setMasterVolume(s.volumeDb);
    }
  }, []);

  return { readingAt, moveTo, moveBy, leave, speakHere, describe, speakLegend, activate };
}

export type ExploreApi = ReturnType<typeof useExplore>;
