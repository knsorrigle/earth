import * as Tone from 'tone';
import type { AudioEngine } from './engine';
import type { NoteEvent } from '../mapping/types';

export interface TimelineCallbacks {
  /** Called on the animation frame closest to when the note is heard. */
  onStep: (event: NoteEvent) => void;
  /** Called (visually synced) after the last note. */
  onEnd: () => void;
}

/**
 * Plays a list of note events, one per beat, on the Tone transport.
 * The cursor can be moved while playing; tempo changes are ramped.
 */
export class TimelineScheduler {
  private events: NoteEvent[] = [];
  private cursor = 0;
  private repeatId: number | null = null;
  /** Set once the last note is scheduled so later ticks in the lookahead window are ignored. */
  private finished = false;

  constructor(
    private engine: AudioEngine,
    private callbacks: TimelineCallbacks,
  ) {}

  setEvents(events: NoteEvent[]): void {
    this.events = events;
    this.cursor = Math.min(this.cursor, Math.max(0, events.length - 1));
  }

  /** Next index to be played. */
  setCursor(index: number): void {
    this.cursor = Math.max(0, Math.min(this.events.length - 1, index));
  }

  get playing(): boolean {
    return this.repeatId !== null;
  }

  setBpm(bpm: number): void {
    const t = Tone.getTransport();
    if (this.playing) t.bpm.rampTo(bpm, 0.3);
    else t.bpm.value = bpm;
  }

  play(bpm: number): void {
    if (this.playing || this.events.length === 0) return;
    const transport = Tone.getTransport();
    transport.cancel(0);
    transport.bpm.value = bpm;
    this.finished = false;
    this.repeatId = transport.scheduleRepeat((time) => this.tick(time), '4n', 0);
    transport.start('+0.05');
  }

  pause(): void {
    const transport = Tone.getTransport();
    transport.stop();
    transport.cancel(0);
    this.repeatId = null;
  }

  private tick(time: number): void {
    if (this.finished) return;
    const i = this.cursor;
    const ev = this.events[i];
    if (!ev) return;
    const transport = Tone.getTransport();
    const beat = 60 / transport.bpm.value;
    this.engine.playNote({ freq: ev.freq, velocity: ev.velocity, duration: Math.min(beat * 0.8, 1.2) }, time);
    Tone.getDraw().schedule(() => this.callbacks.onStep(ev), time);

    if (i >= this.events.length - 1) {
      // Last note: stop once it has sounded, then report the end.
      this.finished = true;
      Tone.getDraw().schedule(() => {
        this.pause();
        this.callbacks.onEnd();
      }, time + beat);
    } else {
      this.cursor = i + 1;
    }
  }
}
