import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { engine } from '../../audio/engine';
import { ScanScheduler } from '../../audio/scanScheduler';
import type { Dataset } from '../../data/types';
import { describeScannerMapping } from '../../mapping/legend';
import { midiToNoteName } from '../../mapping/pitch';
import { columnNotes, DEFAULT_SCANNER, type ScanNote } from '../../mapping/scanner';
import { formatLon, speakLon } from '../../sampling/geo';
import { describeColumn, planScan } from '../../sampling/scan';
import { SCAN_DURATIONS, usePlayerStore, type ScanDuration } from '../../state/playerStore';
import type { GibsFrame } from '../map/useGibsFrame';
import { noteBus } from '../../audio/noteBus';
import { setGlobeFocus } from '../../globe/focus';
import { colormapColor, hexToRgb, type RGB } from '../../globe/colors';

export const SCAN_COLUMNS = 72; // 5° per step
export const SCAN_BANDS = 8; // 22.5° per band

/**
 * Scanner mode controller: sweeps the loaded frame west to east, strumming
 * one note per latitude band per column.
 */
export function useScanner(dataset: Dataset, frame: GibsFrame) {
  const plan = useMemo(() => (frame.grid ? planScan(frame.grid, SCAN_COLUMNS, SCAN_BANDS) : null), [frame.grid]);
  const [active, setActive] = useState<ScanNote[]>([]);

  const planRef = useRef(plan);
  planRef.current = plan;
  const dsRef = useRef(dataset);
  dsRef.current = dataset;
  const playStart = useRef(-1);
  const frameRef = useRef(frame);
  frameRef.current = frame;

  /** One ripple per strummed band, at the band's centre latitude, following the strum timing. */
  const emitColumn = (column: number, notes: ScanNote[]) => {
    const p = planRef.current;
    const f = frameRef.current;
    if (!p || !f.grid) return;
    const lon = p.columns[column].lon;
    const fire: RGB | null = f.presence ? hexToRgb('#ec6210') : null;
    for (const n of notes) {
      const band = p.bands[n.band];
      const lat = (band.north + band.south) / 2;
      const color = fire ?? colormapColor(f.grid.colormap, n.value);
      window.setTimeout(() => noteBus.emit({ lat, lon, color, velocity: n.velocity }), n.offset * 1000);
    }
  };
  const presenceRef = useRef(frame.presence);
  presenceRef.current = frame.presence;

  const caption = (column: number, notes: ScanNote[]) => {
    const p = planRef.current!;
    const lon = formatLon(p.columns[column].lon, 1);
    return notes.length
      ? `♪ ${notes.map((n) => midiToNoteName(n.midi)).join(' ')} · ${lon} · ${notes.length} of ${SCAN_BANDS} bands`
      : `· silence (all land) · ${lon}`;
  };

  const cfg = useMemo(
    () => (frame.presence ? { ...DEFAULT_SCANNER, magnitude: 'logValue' as const, logDomain: dataset.mapping.domain } : DEFAULT_SCANNER),
    [frame.presence, dataset],
  );
  /** Notes per column across the whole sweep (drives the HUD tape). */
  const columnCounts = useMemo(() => (plan ? plan.columns.map((c) => columnNotes(c, plan, cfg).length) : null), [plan, cfg]);

  const schedulerRef = useRef<ScanScheduler | null>(null);
  if (!schedulerRef.current) {
    schedulerRef.current = new ScanScheduler(engine, {
      onStep: (column, notes) => {
        const s = usePlayerStore.getState();
        const p = planRef.current;
        if (!p) return;
        emitColumn(column, notes);
        s.setScan({ column });
        setActive(notes);
        s.setCaption(caption(column, notes));
        const every = s.scan.announceEveryDeg;
        const west = p.columns[column].west;
        // The first column of a sweep was already announced by play().
        if (column !== playStart.current && every > 0 && (west + 180) % every === 0) s.announce(speakLon(west));
      },
      onEnd: () => {
        const s = usePlayerStore.getState();
        s.setScan({ isScanning: false });
        setActive([]);
        s.announce('Scan complete at 180 degrees. Press space to scan again, or F to describe the map.');
      },
    }, cfg);
  }
  const scheduler = schedulerRef.current;

  useEffect(() => {
    scheduler.setPlan(plan);
    // A new frame while scanning: stop rather than jump mid-sweep.
    if (scheduler.playing) {
      scheduler.pause();
      usePlayerStore.getState().setScan({ isScanning: false });
    }
  }, [scheduler, plan]);

  // The globe faces the beam: the same audio-timed position as the 2D map's beam.
  useEffect(
    () =>
      setGlobeFocus(() => {
        const pos = scheduler.audiblePosition() ?? usePlayerStore.getState().scan.column + 0.5;
        return { lon: -180 + pos * (360 / SCAN_COLUMNS), beam: true };
      }),
    [scheduler],
  );

  useEffect(
    () => () => {
      scheduler.pause();
      engine.releaseScanner();
      usePlayerStore.getState().setScan({ isScanning: false });
    },
    [scheduler],
  );

  const ensureAudio = useCallback(async () => {
    const first = !engine.ready;
    await engine.init();
    if (first) {
      const s = usePlayerStore.getState();
      engine.setMasterMuted(s.muted);
      engine.setMasterVolume(s.volumeDb);
    }
  }, []);

  const play = useCallback(async () => {
    if (!planRef.current) return;
    await ensureAudio();
    const s = usePlayerStore.getState();
    let start = s.scan.column;
    if (start >= SCAN_COLUMNS - 1) start = 0;
    playStart.current = start;
    scheduler.setCursor(start);
    scheduler.setStepSeconds(s.scan.durationSec / SCAN_COLUMNS);
    scheduler.play();
    s.setScan({ isScanning: true, column: start });
    s.announce(`Scanning west to east from ${speakLon(planRef.current.columns[start].west)}, ${s.scan.durationSec} seconds for the whole globe.`);
  }, [ensureAudio, scheduler]);

  const pause = useCallback(() => {
    scheduler.pause();
    const s = usePlayerStore.getState();
    s.setScan({ isScanning: false });
    const p = planRef.current;
    if (p) s.announce(`Paused. ${describeColumn(p, s.scan.column, dsRef.current.unitSpoken, dsRef.current.decimals, presenceRef.current)}`);
  }, [scheduler]);

  const toggle = useCallback(() => {
    if (usePlayerStore.getState().scan.isScanning) pause();
    else void play();
  }, [play, pause]);

  // A map record dropped on the jukebox: sweep from the west edge once the frame is ready.
  const autoplay = usePlayerStore((s) => s.autoplay);
  useEffect(() => {
    if (autoplay !== 'scanner' || !plan) return;
    const s = usePlayerStore.getState();
    s.setAutoplay(null);
    scheduler.pause();
    s.setScan({ column: 0, isScanning: false });
    void play();
  }, [autoplay, plan, play, scheduler]);

  /** Move the beam. While paused, the column is strummed and announced. */
  const seek = useCallback(
    async (column: number, opts: { announce?: boolean } = {}) => {
      const p = planRef.current;
      if (!p) return;
      const c = Math.max(0, Math.min(SCAN_COLUMNS - 1, column));
      const s = usePlayerStore.getState();
      s.setScan({ column: c });
      scheduler.setCursor(c);
      if (s.scan.isScanning) return;
      await ensureAudio();
      const notes = scheduler.audition(c);
      emitColumn(c, notes);
      setActive(notes);
      s.setCaption(caption(c, notes));
      if (opts.announce !== false) s.announce(describeColumn(p, c, dsRef.current.unitSpoken, dsRef.current.decimals, presenceRef.current));
    },
    [scheduler, ensureAudio],
  );

  const step = useCallback((delta: number) => void seek(usePlayerStore.getState().scan.column + delta), [seek]);

  const setDuration = useCallback(
    (d: ScanDuration) => {
      const s = usePlayerStore.getState();
      s.setScan({ durationSec: d });
      if (s.scan.isScanning) {
        // Interval changes need a reschedule: continue from the current column.
        scheduler.pause();
        scheduler.setCursor(usePlayerStore.getState().scan.column + 1);
        scheduler.setStepSeconds(d / SCAN_COLUMNS);
        scheduler.play();
      }
    },
    [scheduler],
  );

  const changeSpeed = useCallback(
    (faster: boolean) => {
      const cur = usePlayerStore.getState().scan.durationSec;
      const i = SCAN_DURATIONS.indexOf(cur);
      const next = SCAN_DURATIONS[Math.max(0, Math.min(SCAN_DURATIONS.length - 1, i + (faster ? -1 : 1)))];
      setDuration(next);
      usePlayerStore.getState().announce(`${next} second sweep`);
    },
    [setDuration],
  );

  const describeHere = useCallback(() => {
    const p = planRef.current;
    if (!p) return;
    usePlayerStore.getState().announce(describeColumn(p, usePlayerStore.getState().scan.column, dataset.unitSpoken, dataset.decimals, frame.presence));
  }, [dataset]);

  const describe = useCallback(() => usePlayerStore.getState().announce(frame.description), [frame.description]);

  const speakLegend = useCallback(
    () =>
      usePlayerStore
        .getState()
        .announce(`Scanner. ${describeScannerMapping(dataset.mapping, SCAN_BANDS, frame.presence ? 'presence' : 'colormap').join(' ')}`),
    [dataset, frame.presence],
  );

  const livePosition = useCallback(() => scheduler.audiblePosition(), [scheduler]);

  return { plan, active, columnCounts, play, pause, toggle, seek, step, setDuration, changeSpeed, describeHere, describe, speakLegend, livePosition, ensureAudio };
}

export type ScannerApi = ReturnType<typeof useScanner>;
