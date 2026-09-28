import { useCallback, useEffect, useMemo, useRef } from 'react';
import { engine } from '../audio/engine';
import { TimelineScheduler } from '../audio/timelineScheduler';
import { buildTimeline, referenceTone } from '../mapping/timeline';
import { describeMapping } from '../mapping/legend';
import type { NoteEvent } from '../mapping/types';
import type { Dataset } from '../data/types';
import { usePlayerStore } from '../state/playerStore';
import { noteBus } from '../audio/noteBus';
import { setGlobeFocus } from '../globe/focus';
import { seriesVisual } from './globe/visuals';
import { detailedAnnouncement, pointAnnouncement, relationToReference, shouldAnnounce } from './announce';

/**
 * Glue between store, audio engine and scheduler for Timeline mode.
 * All user actions go through the functions returned here.
 */
export function usePlayer(dataset: Dataset) {
  const series = dataset.timeSeries ?? [];
  const events = useMemo(() => buildTimeline(series, dataset.mapping), [series, dataset.mapping]);
  const reference = useMemo(() => referenceTone(series, dataset.mapping), [series, dataset.mapping]);
  const unit = useMemo(() => ({ unitSpoken: dataset.unitSpoken, decimals: dataset.decimals }), [dataset]);

  const caption = useCallback(
    (ev: NoteEvent) => {
      const rel = relationToReference(ev, reference, dataset.decimals);
      const where = ev.deviation < 0 ? 'below the hum' : ev.deviation > 0 ? 'above the hum' : 'on the hum';
      return `♪ ${ev.noteName} · ${ev.year}: ${ev.value.toFixed(dataset.decimals)} ${dataset.unit} (${rel}) — note ${where}`;
    },
    [reference, dataset],
  );

  // Latest values for scheduler callbacks, which are created once.
  const eventsRef = useRef(events);
  const referenceRef = useRef(reference);
  const unitRef = useRef(unit);
  const captionRef = useRef(caption);
  const datasetRef = useRef(dataset);
  datasetRef.current = dataset;
  eventsRef.current = events;
  referenceRef.current = reference;
  unitRef.current = unit;
  captionRef.current = caption;

  const schedulerRef = useRef<TimelineScheduler<NoteEvent> | null>(null);
  if (!schedulerRef.current) {
    schedulerRef.current = new TimelineScheduler<NoteEvent>((ev, time, beat) => {
      engine.playNote({ freq: ev.freq, velocity: ev.velocity, duration: Math.min(beat * 0.8, 1.2) }, time);
    }, {
      onStep: (ev) => {
        const s = usePlayerStore.getState();
        noteBus.emit(seriesVisual(datasetRef.current, ev.value, ev.velocity));
        s.setIndex(ev.index);
        s.setCaption(captionRef.current(ev));
        if (shouldAnnounce(ev, s.announceEvery, eventsRef.current.length)) {
          s.announce(pointAnnouncement(ev, unitRef.current));
        }
      },
      onEnd: () => {
        const s = usePlayerStore.getState();
        s.setPlaying(false);
        engine.setDroneActive(false);
        const last = eventsRef.current[eventsRef.current.length - 1];
        s.announce(`End of timeline. ${detailedAnnouncement(last, referenceRef.current, unitRef.current)}. Press space to play again.`);
      },
    });
  }
  const scheduler = schedulerRef.current;

  useEffect(() => {
    scheduler.setEvents(events);
    engine.setDroneFrequency(reference.freq);
    const s = usePlayerStore.getState();
    if (s.index >= events.length) s.setIndex(events.length - 1);
  }, [scheduler, events, reference]);

  // Mirror settings into the audio engine.
  const bpm = usePlayerStore((s) => s.bpm);
  const droneEnabled = usePlayerStore((s) => s.droneEnabled);
  const muted = usePlayerStore((s) => s.muted);
  const volumeDb = usePlayerStore((s) => s.volumeDb);
  useEffect(() => scheduler.setBpm(bpm), [scheduler, bpm]);
  useEffect(() => engine.setChannelMuted('drone', !droneEnabled), [droneEnabled]);
  useEffect(() => engine.setMasterMuted(muted), [muted]);
  useEffect(() => engine.setMasterVolume(volumeDb), [volumeDb]);

  // Timeline plays centred (Duet moves the melody voice left).
  useEffect(() => engine.setMelodyPan(0), []);

  // Records measured at one place (Mauna Loa) turn the globe there; pan-Arctic and global ones don't.
  useEffect(() => {
    const lon = dataset.place?.lon;
    if (lon === undefined) return;
    return setGlobeFocus(() => ({ lon }));
  }, [dataset]);

  // Leaving Timeline mode: stop cleanly so nothing keeps sounding.
  useEffect(
    () => () => {
      scheduler.pause();
      engine.setDroneActive(false, 0.4);
      usePlayerStore.getState().setPlaying(false);
    },
    [scheduler],
  );

  const ensureAudio = useCallback(async () => {
    const first = !engine.ready;
    await engine.init();
    if (first) {
      const s = usePlayerStore.getState();
      engine.setDroneFrequency(referenceRef.current.freq, 0);
      engine.setChannelMuted('drone', !s.droneEnabled);
      engine.setMasterMuted(s.muted);
      engine.setMasterVolume(s.volumeDb);
    }
  }, []);

  const droneHold = useRef<number | undefined>(undefined);

  const play = useCallback(async () => {
    await ensureAudio();
    const s = usePlayerStore.getState();
    let start = s.index;
    // At the end: start over. Otherwise resume from the shown point.
    if (start >= events.length - 1) start = 0;
    window.clearTimeout(droneHold.current);
    scheduler.setCursor(start);
    engine.setDroneActive(true);
    scheduler.play(s.bpm);
    s.setPlaying(true);
    s.announce(`Playing from ${events[start].year}`);
  }, [ensureAudio, events, scheduler]);

  const pause = useCallback(() => {
    scheduler.pause();
    engine.setDroneActive(false);
    const s = usePlayerStore.getState();
    s.setPlaying(false);
    const ev = events[s.index];
    if (ev) s.announce(`Paused. ${detailedAnnouncement(ev, reference, unit)}`);
  }, [scheduler, events, reference, unit]);

  const toggle = useCallback(() => {
    if (usePlayerStore.getState().isPlaying) pause();
    else void play();
  }, [play, pause]);

  // A record dropped on the jukebox: start from the first year.
  const autoplay = usePlayerStore((s) => s.autoplay);
  useEffect(() => {
    if (autoplay !== 'timeline') return;
    const s = usePlayerStore.getState();
    s.setAutoplay(null);
    scheduler.pause();
    s.setPlaying(false);
    s.setIndex(0);
    void play();
  }, [autoplay, play, scheduler]);

  /**
   * Move to a point. While playing, playback continues from there.
   * While paused, the note is auditioned against a briefly swelling drone.
   */
  const seek = useCallback(
    async (index: number, opts: { announce?: boolean; audition?: boolean } = {}) => {
      const { announce = true, audition = true } = opts;
      const i = Math.max(0, Math.min(events.length - 1, index));
      const s = usePlayerStore.getState();
      const ev = events[i];
      s.setIndex(i);
      s.setCaption(caption(ev));
      scheduler.setCursor(i);
      if (s.isPlaying) {
        if (announce) s.announce(pointAnnouncement(ev, unit));
        return;
      }
      if (announce) s.announce(detailedAnnouncement(ev, reference, unit));
      if (audition) {
        await ensureAudio();
        engine.playNote({ freq: ev.freq, velocity: ev.velocity, duration: 0.5 });
        noteBus.emit(seriesVisual(dataset, ev.value, ev.velocity));
        engine.setDroneActive(true, 0.3);
        window.clearTimeout(droneHold.current);
        droneHold.current = window.setTimeout(() => {
          if (!usePlayerStore.getState().isPlaying) engine.setDroneActive(false, 1.5);
        }, 2500);
      }
    },
    [events, scheduler, caption, unit, reference, ensureAudio],
  );

  const step = useCallback((delta: number) => void seek(usePlayerStore.getState().index + delta), [seek]);

  const speakLegend = useCallback(() => {
    usePlayerStore
      .getState()
      .announce(
        `${dataset.title}. ${describeMapping(dataset.mapping).join(' ')} The hum is ${reference.value.toFixed(dataset.decimals)} ${dataset.unitSpoken}.`,
      );
  }, [dataset, reference]);

  const speakCurrent = useCallback(() => {
    const s = usePlayerStore.getState();
    const ev = events[s.index];
    if (ev) s.announce(detailedAnnouncement(ev, reference, unit));
  }, [events, reference, unit]);

  return { events, reference, play, pause, toggle, seek, step, speakLegend, speakCurrent };
}

export type PlayerApi = ReturnType<typeof usePlayer>;

/** What the shared transport buttons and timeline keyboard shortcuts need (Timeline and Duet). */
export interface TimelineControls {
  events: { length: number };
  toggle: () => void;
  step: (delta: number) => void;
  seek: (index: number, opts?: { announce?: boolean; audition?: boolean }) => Promise<void> | void;
  speakLegend: () => void;
  speakCurrent: () => void;
}
