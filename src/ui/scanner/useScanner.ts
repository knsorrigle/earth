import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { engine } from '../../audio/engine';
import { ScanScheduler } from '../../audio/scanScheduler';
import type { Dataset } from '../../data/types';
import { describeScannerMapping } from '../../mapping/legend';
import { midiToNoteName } from '../../mapping/pitch';
import type { ScanNote } from '../../mapping/scanner';
import { formatLon, speakLon } from '../../sampling/geo';
import { describeColumn, planScan } from '../../sampling/scan';
import { SCAN_DURATIONS, usePlayerStore, type ScanDuration } from '../../state/playerStore';
import type { GibsFrame } from '../map/useGibsFrame';

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

  const caption = (column: number, notes: ScanNote[]) => {
    const p = planRef.current!;
    const lon = formatLon(p.columns[column].lon, 1);
    return notes.length
      ? `♪ ${notes.map((n) => midiToNoteName(n.midi)).join(' ')} · ${lon} · ${notes.length} of ${SCAN_BANDS} bands`
      : `· silence (all land) · ${lon}`;
  };

  const schedulerRef = useRef<ScanScheduler | null>(null);
  if (!schedulerRef.current) {
    schedulerRef.current = new ScanScheduler(engine, {
      onStep: (column, notes) => {
        const s = usePlayerStore.getState();
        const p = planRef.current;
        if (!p) return;
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
    });
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
    if (p) s.announce(`Paused. ${describeColumn(p, s.scan.column, dsRef.current.unitSpoken, dsRef.current.decimals)}`);
  }, [scheduler]);

  const toggle = useCallback(() => {
    if (usePlayerStore.getState().scan.isScanning) pause();
    else void play();
  }, [play, pause]);

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
      setActive(notes);
      s.setCaption(caption(c, notes));
      if (opts.announce !== false) s.announce(describeColumn(p, c, dsRef.current.unitSpoken, dsRef.current.decimals));
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
    usePlayerStore.getState().announce(describeColumn(p, usePlayerStore.getState().scan.column, dataset.unitSpoken, dataset.decimals));
  }, [dataset]);

  const describe = useCallback(() => usePlayerStore.getState().announce(frame.description), [frame.description]);

  const speakLegend = useCallback(
    () => usePlayerStore.getState().announce(`Scanner. ${describeScannerMapping(dataset.mapping, SCAN_BANDS).join(' ')}`),
    [dataset],
  );

  const livePosition = useCallback(() => scheduler.audiblePosition(), [scheduler]);

  return { plan, active, play, pause, toggle, seek, step, setDuration, changeSpeed, describeHere, describe, speakLegend, livePosition, ensureAudio };
}

export type ScannerApi = ReturnType<typeof useScanner>;
