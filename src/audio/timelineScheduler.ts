import * as Tone from 'tone';
export interface TimelineCallbacks<E> {
  /** Called on the animation frame closest to when the note is heard. */
  onStep: (event: E) => void;
  /** Called (visually synced) after the last note. */
  onEnd: () => void;
}

/** Sounds one step at an exact audio time; beat = seconds per step at the current tempo. */
export type StepSound<E> = (event: E, time: number, beat: number) => void;

/**
 * Plays a list of steps, one per beat, on the Tone transport.
 * The cursor can be moved while playing; tempo changes are ramped.
 */
export class TimelineScheduler<E> {
  private events: E[] = [];
  private cursor = 0;
  private repeatId: number | null = null;
  /** Set once the last note is scheduled so later ticks in the lookahead window are ignored. */
  private finished = false;

  constructor(
    private sound: StepSound<E>,
    private callbacks: TimelineCallbacks<E>,
  ) {}

  setEvents(events: E[]): void {
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
    this.sound(ev, time, beat);
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
