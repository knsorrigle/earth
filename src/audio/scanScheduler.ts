import * as Tone from 'tone';
import type { AudioEngine } from './engine';
import type { ScanPlan } from '../sampling/scan';
import { columnNotes, DEFAULT_SCANNER, type ScanNote, type ScannerConfig } from '../mapping/scanner';
import { lonToPan } from '../mapping/spatial';

export interface ScanCallbacks {
  /** Visually synced: the column whose notes are sounding now. */
  onStep: (column: number, notes: ScanNote[]) => void;
  onEnd: () => void;
}

interface Anchor {
  /** AudioContext time the column starts sounding. */
  time: number;
  column: number;
}

/**
 * Plays a scan plan column by column on the Tone transport. Keeps timing
 * anchors so the visual beam can be placed exactly where the audio is.
 */
export class ScanScheduler {
  private plan: ScanPlan | null = null;
  private cursor = 0;
  private repeatId: number | null = null;
  private finished = false;
  private step = 0.5;
  private anchors: Anchor[] = [];

  constructor(
    private engine: AudioEngine,
    private callbacks: ScanCallbacks,
    private cfg: ScannerConfig = DEFAULT_SCANNER,
  ) {}

  get playing(): boolean {
    return this.repeatId !== null;
  }

  get stepSeconds(): number {
    return this.step;
  }

  setPlan(plan: ScanPlan | null): void {
    this.plan = plan;
    if (plan) this.cursor = Math.min(this.cursor, plan.columns.length - 1);
  }

  setCursor(column: number): void {
    if (!this.plan) return;
    this.cursor = Math.max(0, Math.min(this.plan.columns.length - 1, column));
  }

  /** Seconds per column. Takes effect on the next play(). */
  setStepSeconds(seconds: number): void {
    this.step = seconds;
  }

  notesFor(column: number): ScanNote[] {
    if (!this.plan) return [];
    return columnNotes(this.plan.columns[column], this.plan, this.cfg);
  }

  /** Sound one column right now (scrubbing while paused). */
  audition(column: number): ScanNote[] {
    if (!this.plan) return [];
    const notes = this.notesFor(column);
    const now = Tone.now();
    this.engine.setScanPan(lonToPan(this.plan.columns[column].lon), now);
    for (const n of notes) this.engine.playScanNote(n.freq, n.velocity, now + n.offset);
    return notes;
  }

  play(): void {
    if (this.playing || !this.plan) return;
    const transport = Tone.getTransport();
    transport.cancel(0);
    this.finished = false;
    this.anchors = [];
    this.repeatId = transport.scheduleRepeat((time) => this.tick(time), this.step, 0);
    transport.start('+0.05');
  }

  pause(): void {
    const transport = Tone.getTransport();
    transport.stop();
    transport.cancel(0);
    this.repeatId = null;
    this.anchors = [];
  }

  /**
   * Fractional column the listener is hearing right now (for a smoothly
   * moving beam), or null when not playing.
   */
  audiblePosition(): number | null {
    if (!this.playing || this.anchors.length === 0) return null;
    const now = Tone.immediate();
    let a: Anchor | undefined;
    for (const x of this.anchors) if (x.time <= now) a = x;
    if (!a) return this.anchors[0].column;
    return Math.min(a.column + 1, a.column + (now - a.time) / this.step);
  }

  private tick(time: number): void {
    if (this.finished || !this.plan) return;
    const i = this.cursor;
    const column = this.plan.columns[i];
    const notes = this.notesFor(i);
    this.engine.setScanPan(lonToPan(column.lon), time);
    for (const n of notes) this.engine.playScanNote(n.freq, n.velocity, time + n.offset, Math.min(0.6, this.step * 1.2));
    this.anchors.push({ time, column: i });
    if (this.anchors.length > 4) this.anchors.shift();
    Tone.getDraw().schedule(() => this.callbacks.onStep(i, notes), time);

    if (i >= this.plan.columns.length - 1) {
      this.finished = true;
      Tone.getDraw().schedule(() => {
        this.pause();
        this.callbacks.onEnd();
      }, time + this.step);
    } else {
      this.cursor = i + 1;
    }
  }
}
