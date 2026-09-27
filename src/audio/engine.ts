import * as Tone from 'tone';

export type ChannelId = 'melody' | 'drone';

export interface NoteSpec {
  freq: number;
  /** 0..1 */
  velocity: number;
  /** Seconds the note is held before release. */
  duration: number;
}

/**
 * Tone.js audio graph. Knows nothing about datasets or UI.
 *
 *   melody PolySynth -> lowpass -> Channel(melody) ─┐
 *   drone oscillators -> lowpass -> Gain -> Channel(drone) ─┤
 *                                   Reverb -> master Gain -> Limiter -> SoftClip -> Destination
 *
 * Normal playback peaks around -15 dBFS. The limiter tames dense passages, and
 * because a compressor can overshoot on fast transients, a tanh soft clipper
 * after it guarantees the signal never exceeds OUTPUT_CEILING. Destination
 * volume only ever attenuates (<= 0 dB), so nothing can clip after that.
 */
/** Absolute output ceiling in linear gain (-1 dBFS). */
export const OUTPUT_CEILING = Math.pow(10, -1 / 20);

const CLIP_RANGE = 4;

/** y = c·tanh(x/c): unity gain for quiet signals, never exceeds c. */
export function softClip(x: number, ceiling = OUTPUT_CEILING): number {
  return ceiling * Math.tanh(x / ceiling);
}

export class AudioEngine {
  private initPromise: Promise<void> | null = null;
  private limiter!: Tone.Limiter;
  private clipper!: Tone.WaveShaper;
  private clipPreGain!: Tone.Gain;
  private master!: Tone.Gain;
  private reverb!: Tone.Reverb;
  private channels!: Record<ChannelId, Tone.Channel>;
  private melody!: Tone.PolySynth<Tone.Synth>;
  private melodyFilter!: Tone.Filter;
  private droneLow!: Tone.OmniOscillator<Tone.FatOscillator>;
  private droneHigh!: Tone.Oscillator;
  private droneFilter!: Tone.Filter;
  private droneGain!: Tone.Gain;
  private droneActive = false;

  get ready(): boolean {
    return this.initPromise !== null && this.limiter !== undefined;
  }

  /** Must be called from a user gesture the first time (browser autoplay policy). */
  init(): Promise<void> {
    if (!this.initPromise) this.initPromise = this.build();
    return this.initPromise;
  }

  private async build(): Promise<void> {
    await Tone.start();
    // Tighter scheduling so the visual playhead and notes feel locked together.
    Tone.getContext().lookAhead = 0.05;

    // A WaveShaper only maps inputs in [-1, 1] (beyond that it holds the curve
    // ends), so pre-scale by 1/CLIP_RANGE and expand inside the curve: the soft
    // curve then covers overshoots up to +12 dBFS, and anything hotter sits at
    // softClip(CLIP_RANGE) ≈ ceiling.
    this.clipper = new Tone.WaveShaper((v) => softClip(v * CLIP_RANGE), 8192).toDestination();
    this.clipper.oversample = '2x';
    this.clipPreGain = new Tone.Gain(1 / CLIP_RANGE).connect(this.clipper);
    this.limiter = new Tone.Limiter(-3).connect(this.clipPreGain);
    this.master = new Tone.Gain(1).connect(this.limiter);
    this.reverb = new Tone.Reverb({ decay: 4.5, preDelay: 0.03, wet: 0.28 }).connect(this.master);
    await this.reverb.ready;

    this.channels = {
      melody: new Tone.Channel({ volume: -2 }).connect(this.reverb),
      drone: new Tone.Channel({ volume: -14 }).connect(this.reverb),
    };

    // Melody: soft mallet-like triangle, rounded off by a gentle lowpass.
    this.melodyFilter = new Tone.Filter({ type: 'lowpass', frequency: 2400, rolloff: -12, Q: 0.4 }).connect(
      this.channels.melody,
    );
    this.melody = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: 'triangle' },
      envelope: { attack: 0.012, decay: 0.4, sustain: 0.22, release: 1.6 },
      volume: 0,
    }).connect(this.melodyFilter);
    this.melody.maxPolyphony = 10;

    // Drone: a slowly beating low fat-sine plus a pure tone at the reference pitch.
    this.droneGain = new Tone.Gain(0).connect(this.channels.drone);
    this.droneFilter = new Tone.Filter({ type: 'lowpass', frequency: 900, rolloff: -24 }).connect(this.droneGain);
    this.droneLow = new Tone.OmniOscillator({ type: 'fatsine', count: 3, spread: 10, frequency: 110, volume: -4 });
    this.droneLow.connect(this.droneFilter);
    this.droneHigh = new Tone.Oscillator({ type: 'sine', frequency: 220, volume: -10 }).connect(this.droneFilter);
    this.droneLow.start();
    this.droneHigh.start();
  }

  playNote(note: NoteSpec, time?: number): void {
    if (!this.ready) return;
    const v = Math.min(1, Math.max(0, note.velocity));
    this.melody.triggerAttackRelease(note.freq, note.duration, time ?? Tone.now(), v);
  }

  /**
   * Reference drone pitch. A quiet pure tone sits exactly at the reference
   * pitch (the anchor notes are compared against); a warmer body sits two
   * octaves below so the drone stays in the background.
   */
  setDroneFrequency(freq: number, rampSeconds = 0.4): void {
    if (!this.ready) return;
    this.droneLow.frequency.rampTo(freq / 4, rampSeconds);
    this.droneHigh.frequency.rampTo(freq, rampSeconds);
  }

  /** Fade the drone in or out. Long ramps: the drone should never pop. */
  setDroneActive(active: boolean, rampSeconds = 1.2): void {
    if (!this.ready || active === this.droneActive) return;
    this.droneActive = active;
    this.droneGain.gain.cancelScheduledValues(Tone.now());
    this.droneGain.gain.rampTo(active ? 1 : 0, rampSeconds);
  }

  setChannelMuted(id: ChannelId, muted: boolean): void {
    if (!this.ready) return;
    this.channels[id].mute = muted;
  }

  setChannelSolo(id: ChannelId, solo: boolean): void {
    if (!this.ready) return;
    this.channels[id].solo = solo;
  }

  /** Master volume in dB (0 = unity). Smoothed to avoid zipper noise. */
  setMasterVolume(db: number): void {
    Tone.getDestination().volume.rampTo(Math.min(0, db), 0.1);
  }

  setMasterMuted(muted: boolean): void {
    Tone.getDestination().mute = muted;
  }

  /** Let ringing notes finish naturally instead of cutting them. */
  releaseAll(): void {
    if (!this.ready) return;
    this.melody.releaseAll();
  }

  dispose(): void {
    if (!this.ready) return;
    [this.droneLow, this.droneHigh, this.droneFilter, this.droneGain, this.melody, this.melodyFilter,
      this.channels.melody, this.channels.drone, this.reverb, this.master, this.limiter, this.clipPreGain, this.clipper].forEach((n) => n.dispose());
    this.initPromise = null;
  }
}

/** App-wide engine instance. */
export const engine = new AudioEngine();
