import { useCallback, useEffect, useMemo, useRef } from 'react';
import { engine } from '../../audio/engine';
import { TimelineScheduler } from '../../audio/timelineScheduler';
import type { Dataset } from '../../data/types';
import { buildDuet, describeDuetMapping, DUET_OFFSET_BEATS, DUET_PAN, type DuetStep } from '../../mapping/duet';
import type { NoteEvent, ReferenceTone } from '../../mapping/types';
import { usePlayerStore } from '../../state/playerStore';
import { noteBus } from '../../audio/noteBus';
import { setGlobeFocus } from '../../globe/focus';
import { seriesVisual } from '../globe/visuals';
import { relationToReference, shouldAnnounce } from '../announce';
import type { TimelineControls } from '../usePlayer';

/** Duet mode controller: two records on one shared timeline. */
export function useDuet(dsA: Dataset, dsB: Dataset) {
  const duet = useMemo(
    () => buildDuet(dsA.timeSeries ?? [], dsA.mapping, dsB.timeSeries ?? [], dsB.mapping),
    [dsA, dsB],
  );
  const steps = duet.steps;

  const val = (ds: Dataset, ev: NoteEvent) => `${ev.value.toFixed(ds.decimals)} ${ds.unitSpoken}`;
  const shortLine = useCallback(
    (st: DuetStep) => `${st.year}. ${dsA.title}, ${val(dsA, st.a)}. ${dsB.title}, ${val(dsB, st.b)}.`,
    [dsA, dsB],
  );
  const detailLine = useCallback(
    (st: DuetStep) => {
      const rel = (ds: Dataset, ev: NoteEvent, ref: ReferenceTone) => relationToReference(ev, ref, ds.decimals);
      return (
        `${st.year}. ${dsA.title}, ${val(dsA, st.a)}, ${rel(dsA, st.a, duet.refA)}. ` +
        `${dsB.title}, ${val(dsB, st.b)}, ${rel(dsB, st.b, duet.refB)}.`
      );
    },
    [dsA, dsB, duet],
  );
  const caption = useCallback(
    (st: DuetStep) =>
      `♪ ${st.a.noteName} (left) + ${st.b.noteName} (right) · ${st.year}: ` +
      `${st.a.value.toFixed(dsA.decimals)} ${dsA.unit} · ${st.b.value.toFixed(dsB.decimals)} ${dsB.unit}`,
    [dsA, dsB],
  );

  // Latest values for scheduler callbacks, which are created once.
  const stepsRef = useRef(steps);
  const shortRef = useRef(shortLine);
  const detailRef = useRef(detailLine);
  const captionRef = useRef(caption);
  const dsRef = useRef({ a: dsA, b: dsB });
  dsRef.current = { a: dsA, b: dsB };
  stepsRef.current = steps;
  shortRef.current = shortLine;
  detailRef.current = detailLine;
  captionRef.current = caption;

  const schedulerRef = useRef<TimelineScheduler<DuetStep> | null>(null);
  if (!schedulerRef.current) {
    schedulerRef.current = new TimelineScheduler<DuetStep>(
      (st, time, beat) => {
        const dur = Math.min(beat * 0.8, 1.2);
        engine.playNote({ freq: st.a.freq, velocity: st.a.velocity, duration: dur }, time);
        engine.playDuetNote({ freq: st.b.freq, velocity: st.b.velocity, duration: dur }, time + beat * DUET_OFFSET_BEATS);
      },
      {
        onStep: (st) => {
          const s = usePlayerStore.getState();
          noteBus.emit(seriesVisual(dsRef.current.a, st.a.value, st.a.velocity));
          // The bell sounds half a beat after the mallet.
          const halfBeat = (60 / s.bpm) * DUET_OFFSET_BEATS * 1000;
          window.setTimeout(() => noteBus.emit(seriesVisual(dsRef.current.b, st.b.value, st.b.velocity)), halfBeat);
          s.setIndex(st.index);
          s.setCaption(captionRef.current(st));
          if (shouldAnnounce(st, s.announceEvery, stepsRef.current.length)) s.announce(shortRef.current(st));
        },
        onEnd: () => {
          const s = usePlayerStore.getState();
          s.setPlaying(false);
          const last = stepsRef.current[stepsRef.current.length - 1];
          s.announce(`End of duet. ${detailRef.current(last)} Press space to play again.`);
        },
      },
    );
  }
  const scheduler = schedulerRef.current;

  useEffect(() => {
    scheduler.setEvents(steps);
    const s = usePlayerStore.getState();
    if (s.index >= steps.length) s.setIndex(0);
  }, [scheduler, steps]);

  const bpm = usePlayerStore((s) => s.bpm);
  const muted = usePlayerStore((s) => s.muted);
  const volumeDb = usePlayerStore((s) => s.volumeDb);
  useEffect(() => scheduler.setBpm(bpm), [scheduler, bpm]);
  useEffect(() => engine.setMasterMuted(muted), [muted]);
  useEffect(() => engine.setMasterVolume(volumeDb), [volumeDb]);

  // Face a record's location if either has one.
  useEffect(() => {
    const lon = dsA.place?.lon ?? dsB.place?.lon;
    const arctic = [dsA, dsB].some((d) => (d.place?.lat ?? 0) >= 60);
    const elevation = arctic ? 55 : undefined;
    if (lon === undefined && elevation === undefined) return;
    return setGlobeFocus(() => ({ lon, elevation }));
  }, [dsA, dsB]);

  // Mallet to the left while in Duet; centred again on the way out.
  useEffect(() => {
    engine.setMelodyPan(DUET_PAN.a);
    engine.setDroneActive(false, 0.3);
    return () => {
      scheduler.pause();
      engine.setMelodyPan(0);
      usePlayerStore.getState().setPlaying(false);
    };
  }, [scheduler]);

  const ensureAudio = useCallback(async () => {
    const first = !engine.ready;
    await engine.init();
    if (first) {
      const s = usePlayerStore.getState();
      engine.setMasterMuted(s.muted);
      engine.setMasterVolume(s.volumeDb);
    }
    engine.setMelodyPan(DUET_PAN.a);
  }, []);

  const play = useCallback(async () => {
    if (steps.length === 0) return;
    await ensureAudio();
    const s = usePlayerStore.getState();
    let start = Math.min(s.index, steps.length - 1);
    if (start >= steps.length - 1) start = 0;
    scheduler.setCursor(start);
    scheduler.play(s.bpm);
    s.setPlaying(true);
    s.announce(`Playing duet from ${steps[start].year}`);
  }, [ensureAudio, steps, scheduler]);

  const pause = useCallback(() => {
    scheduler.pause();
    const s = usePlayerStore.getState();
    s.setPlaying(false);
    const st = steps[s.index];
    if (st) s.announce(`Paused. ${detailLine(st)}`);
  }, [scheduler, steps, detailLine]);

  const toggle = useCallback(() => {
    if (usePlayerStore.getState().isPlaying) pause();
    else void play();
  }, [play, pause]);

  const seek = useCallback(
    async (index: number, opts: { announce?: boolean; audition?: boolean } = {}) => {
      const { announce = true, audition = true } = opts;
      const i = Math.max(0, Math.min(steps.length - 1, index));
      const st = steps[i];
      if (!st) return;
      const s = usePlayerStore.getState();
      s.setIndex(i);
      s.setCaption(caption(st));
      scheduler.setCursor(i);
      if (s.isPlaying) {
        if (announce) s.announce(shortLine(st));
        return;
      }
      if (announce) s.announce(detailLine(st));
      if (audition) {
        await ensureAudio();
        engine.playNote({ freq: st.a.freq, velocity: st.a.velocity, duration: 0.5 });
        noteBus.emit(seriesVisual(dsA, st.a.value, st.a.velocity));
        // B answers a moment after A, as in playback.
        window.setTimeout(() => {
          engine.playDuetNote({ freq: st.b.freq, velocity: st.b.velocity, duration: 0.5 });
          noteBus.emit(seriesVisual(dsB, st.b.value, st.b.velocity));
        }, 180);
      }
    },
    [steps, scheduler, caption, shortLine, detailLine, ensureAudio],
  );

  const step = useCallback((delta: number) => void seek(usePlayerStore.getState().index + delta), [seek]);

  const legendLines = useMemo(() => describeDuetMapping(dsA.title, dsA.mapping, dsB.title, dsB.mapping, duet), [dsA, dsB, duet]);

  const speakLegend = useCallback(() => usePlayerStore.getState().announce(`Duet. ${legendLines.join(' ')}`), [legendLines]);

  const speakCurrent = useCallback(() => {
    const st = steps[usePlayerStore.getState().index];
    if (st) usePlayerStore.getState().announce(detailLine(st));
  }, [steps, detailLine]);

  const api: TimelineControls & { duet: typeof duet; legendLines: string[] } = {
    events: steps,
    toggle,
    step,
    seek,
    speakLegend,
    speakCurrent,
    duet,
    legendLines,
  };
  return api;
}

export type DuetApi = ReturnType<typeof useDuet>;
