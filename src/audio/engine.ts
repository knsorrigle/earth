import * as Tone from 'tone';
import { encodeWav, joinChunks } from './wav';
import { AUDIO_PROFILE } from './deviceProfile';

// Phones: replace Tone's default (interactive, tiny buffers) context with a
// "playback" one before anything else uses Tone, so the audio thread has
// enough headroom not to crackle. Desktop keeps the default.
if (AUDIO_PROFILE.constrained && typeof window !== 'undefined' && typeof window.AudioContext === 'function') {
  Tone.setContext(new Tone.Context({ latencyHint: AUDIO_PROFILE.latencyHint, lookAhead: AUDIO_PROFILE.lookAhead }));
}

/** Longest recording kept in memory (stereo float32 ≈ 23 MB per minute at 48 kHz). */
export const MAX_RECORD_SECONDS = 600;

export type ChannelId = 'melody' | 'drone' | 'explore' | 'scanner' | 'duet';

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
 *   melody PolySynth -> lowpass -> Panner -> Channel(melody) ─┐
 *   duet PolySynth(FM) -> lowpass -> Panner -> Channel(duet) ─┤
 *   drone oscillators -> lowpass -> Gain -> Channel(drone) ─┤
 *   explore Synth -> lowpass -> Panner ─┐                   │
 *   land pink noise -> lowpass -> Gain -> Panner ─> Channel(explore) ─┤
 *   scanner PolySynth -> lowpass -> Panner -> Channel(scanner) ─┤
 *   crackle NoiseSynth -> bandpass -> Panner -> Channel(explore) ─┤
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
  /** Spectrum tap after the limiter, before the user's volume/mute, so visuals show the music even when muted. */
  private fft!: Tone.FFT;
  private clipper!: Tone.WaveShaper;
  private clipPreGain!: Tone.Gain;
  private master!: Tone.Gain;
  private reverb!: Tone.Reverb;
  private channels!: Record<ChannelId, Tone.Channel>;
  private melody!: Tone.PolySynth<Tone.Synth>;
  private melodyFilter!: Tone.Filter;
  private melodyPanner!: Tone.Panner;
  private duetSynth!: Tone.PolySynth<Tone.FMSynth>;
  private duetFilter!: Tone.Filter;
  private duetPanner!: Tone.Panner;
  private droneLow!: Tone.OmniOscillator<Tone.FatOscillator>;
  private droneHigh!: Tone.Oscillator;
  private droneFilter!: Tone.Filter;
  private droneGain!: Tone.Gain;
  private droneActive = false;
  private exploreSynth!: Tone.Synth;
  private exploreFilter!: Tone.Filter;
  private explorePanner!: Tone.Panner;
  private landNoise!: Tone.Noise;
  private landFilter!: Tone.Filter;
  private landGain!: Tone.Gain;
  private landPanner!: Tone.Panner;
  private exploreSounding = false;
  private scanSynth!: Tone.PolySynth<Tone.Synth>;
  private scanFilter!: Tone.Filter;
  private scanPanner!: Tone.Panner;
  private crackle!: Tone.NoiseSynth;
  private crackleFilter!: Tone.Filter;
  private cracklePanner!: Tone.Panner;
  private crackleRate = 0;
  private introGain: Tone.Gain | null = null;
  private recTap: ScriptProcessorNode | null = null;
  private recCtx: AudioContext | null = null;
  private recChunks: Float32Array[][] = [];
  private recFrames = 0;
  private recording = false;
  private crackleTimer: ReturnType<typeof setTimeout> | undefined;

  /** True only once the whole graph exists (build() is async: reverb IR generation). */
  private built = false;

  get ready(): boolean {
    return this.built;
  }

  /** Must be called from a user gesture the first time (browser autoplay policy). */
  init(): Promise<void> {
    if (!this.initPromise) this.initPromise = this.build();
    return this.initPromise;
  }

  private async build(): Promise<void> {
    await Tone.start();
    // Tighter scheduling so the visual playhead and notes feel locked together.
    Tone.getContext().lookAhead = AUDIO_PROFILE.lookAhead;

    // A WaveShaper only maps inputs in [-1, 1] (beyond that it holds the curve
    // ends), so pre-scale by 1/CLIP_RANGE and expand inside the curve: the soft
    // curve then covers overshoots up to +12 dBFS, and anything hotter sits at
    // softClip(CLIP_RANGE) ≈ ceiling.
    this.clipper = new Tone.WaveShaper((v) => softClip(v * CLIP_RANGE), 8192).toDestination();
    this.clipper.oversample = AUDIO_PROFILE.clipperOversample;
    this.clipPreGain = new Tone.Gain(1 / CLIP_RANGE).connect(this.clipper);
    this.limiter = new Tone.Limiter(-3).connect(this.clipPreGain);
    this.fft = new Tone.FFT({ size: 1024, smoothing: 0.4 });
    this.limiter.connect(this.fft);
    this.master = new Tone.Gain(1).connect(this.limiter);
    this.reverb = new Tone.Reverb({ decay: AUDIO_PROFILE.reverbDecay, preDelay: 0.03, wet: 0.28 }).connect(this.master);
    await this.reverb.ready;

    this.channels = {
      melody: new Tone.Channel({ volume: -2 }).connect(this.reverb),
      drone: new Tone.Channel({ volume: -14 }).connect(this.reverb),
      explore: new Tone.Channel({ volume: 0 }).connect(this.reverb),
      scanner: new Tone.Channel({ volume: 3 }).connect(this.reverb),
      duet: new Tone.Channel({ volume: 4 }).connect(this.reverb),
    };

    // Melody: soft mallet-like triangle, rounded off by a gentle lowpass.
    this.melodyPanner = new Tone.Panner(0).connect(this.channels.melody);
    this.melodyFilter = new Tone.Filter({ type: 'lowpass', frequency: 2400, rolloff: -12, Q: 0.4 }).connect(this.melodyPanner);

    // Duet second voice: a warm FM bell, deliberately unlike the triangle mallet.
    this.duetPanner = new Tone.Panner(0.45).connect(this.channels.duet);
    this.duetFilter = new Tone.Filter({ type: 'lowpass', frequency: 1900, rolloff: -12, Q: 0.3 }).connect(this.duetPanner);
    this.duetSynth = new Tone.PolySynth(Tone.FMSynth, {
      harmonicity: 2,
      modulationIndex: 1.4,
      oscillator: { type: 'sine' },
      modulation: { type: 'triangle' },
      envelope: { attack: 0.03, decay: 0.7, sustain: 0.25, release: 1.5 },
      modulationEnvelope: { attack: 0.02, decay: 0.4, sustain: 0.2, release: 1 },
      volume: 0,
    }).connect(this.duetFilter);
    this.duetSynth.maxPolyphony = 10;
    this.melody = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: 'triangle' },
      envelope: { attack: 0.012, decay: 0.4, sustain: 0.22, release: 1.6 },
      volume: 0,
    }).connect(this.melodyFilter);
    this.melody.maxPolyphony = AUDIO_PROFILE.melodyPolyphony;

    // Drone: a slowly beating low fat-sine plus a pure tone at the reference pitch.
    this.droneGain = new Tone.Gain(0).connect(this.channels.drone);
    this.droneFilter = new Tone.Filter({ type: 'lowpass', frequency: 900, rolloff: -24 }).connect(this.droneGain);
    this.droneLow = new Tone.OmniOscillator({ type: 'fatsine', count: AUDIO_PROFILE.fatCount, spread: 10, frequency: 110, volume: -4 });
    this.droneLow.connect(this.droneFilter);
    this.droneHigh = new Tone.Oscillator({ type: 'sine', frequency: 220, volume: -10 }).connect(this.droneFilter);
    // Drone oscillators start when the drone is wanted and stop once faded out (see setDroneActive).

    // Explore: a sustained, slightly chorused tone that glides between values.
    this.explorePanner = new Tone.Panner(0).connect(this.channels.explore);
    this.exploreFilter = new Tone.Filter({ type: 'lowpass', frequency: 2000, rolloff: -12, Q: 0.3 }).connect(this.explorePanner);
    this.exploreSynth = new Tone.Synth({
      oscillator: { type: 'fattriangle', count: 2, spread: 14 },
      envelope: { attack: 0.06, decay: 0.25, sustain: 0.65, release: 0.7 },
      volume: 0,
    }).connect(this.exploreFilter);

    // Land / no data: soft filtered pink noise, like distant surf.
    this.landPanner = new Tone.Panner(0).connect(this.channels.explore);
    this.landGain = new Tone.Gain(0).connect(this.landPanner);
    this.landFilter = new Tone.Filter({ type: 'lowpass', frequency: 650, rolloff: -24 }).connect(this.landGain);
    // Started only while the land wash is audible (see exploreLand), so it costs nothing otherwise.
    this.landNoise = new Tone.Noise({ type: 'pink', volume: -10 }).connect(this.landFilter);

    // Scanner: soft harp-like plucks; all notes of one step share the sweep's pan.
    this.scanPanner = new Tone.Panner(0).connect(this.channels.scanner);
    this.scanFilter = new Tone.Filter({ type: 'lowpass', frequency: 2600, rolloff: -12, Q: 0.3 }).connect(this.scanPanner);
    this.scanSynth = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: 'triangle' },
      envelope: { attack: 0.004, decay: 0.5, sustain: 0.06, release: 0.9 },
      volume: -2,
    }).connect(this.scanFilter);
    this.scanSynth.maxPolyphony = AUDIO_PROFILE.scanPolyphony;

    // Fire crackle: very short band-passed noise bursts at random intervals.
    this.cracklePanner = new Tone.Panner(0).connect(this.channels.explore);
    this.crackleFilter = new Tone.Filter({ type: 'bandpass', frequency: 2200, Q: 1.2 }).connect(this.cracklePanner);
    this.crackle = new Tone.NoiseSynth({
      noise: { type: 'white' },
      envelope: { attack: 0.001, decay: 0.018, sustain: 0, release: 0.01 },
      volume: -8,
    }).connect(this.crackleFilter);
    this.built = true;
  }

  /** Current dB spectrum (bins evenly spaced up to nyquist), or null before the audio starts. */
  getSpectrum(): Float32Array | null {
    return this.ready ? this.fft.getValue() : null;
  }

  get nyquist(): number {
    return Tone.getContext().sampleRate / 2;
  }

  /** One scanner note at an exact (scheduled) time. */
  playScanNote(freq: number, velocity: number, time: number, duration = 0.35): void {
    if (!this.ready) return;
    this.scanSynth.triggerAttackRelease(freq, duration, time, Math.min(1, Math.max(0, velocity)));
  }

  /** Pan for the scanner voice, ramped briefly so steps never click. */
  setScanPan(pan: number, time?: number): void {
    if (!this.ready) return;
    this.scanPanner.pan.rampTo(pan, 0.04, time);
  }

  releaseScanner(): void {
    if (!this.ready) return;
    this.scanSynth.releaseAll();
  }

  /**
   * Fire crackle. rate = bursts per second (0 stops), brightness 0..1 moves
   * the band-pass up. Bursts are Poisson-timed so it sounds like fire, not a metronome.
   */
  setCrackle(rate: number, brightness: number, pan: number): void {
    if (!this.ready) return;
    const now = Tone.now();
    this.cracklePanner.pan.rampTo(pan, 0.08, now);
    this.crackleFilter.frequency.rampTo(1400 + 3200 * Math.min(1, Math.max(0, brightness)), 0.1, now);
    const wasRunning = this.crackleRate > 0;
    this.crackleRate = Math.max(0, rate);
    if (this.crackleRate > 0 && !wasRunning) this.crackleTick();
  }

  private crackleTick = (): void => {
    clearTimeout(this.crackleTimer);
    if (this.crackleRate <= 0 || !this.ready) return;
    this.crackle.triggerAttackRelease(0.004 + Math.random() * 0.02, Tone.now() + 0.01, 0.35 + Math.random() * 0.65);
    const wait = -Math.log(1 - Math.random()) / this.crackleRate;
    this.crackleTimer = setTimeout(this.crackleTick, Math.min(1500, wait * 1000));
  };

  /** Sound the value under the explore cursor. Glides if already sounding. */
  exploreTone(freq: number, pan: number, velocity = 0.6): void {
    if (!this.ready) return;
    const now = Tone.now();
    this.landOff(0.08);
    this.explorePanner.pan.rampTo(pan, 0.08, now);
    if (this.exploreSounding) {
      this.exploreSynth.frequency.rampTo(freq, 0.06, now);
    } else {
      this.exploreSynth.triggerAttack(freq, now, velocity);
      this.exploreSounding = true;
    }
  }

  private landOn = false;

  /** Fade the land wash out and stop its noise source afterwards. */
  private landOff(fadeSeconds: number): void {
    const now = Tone.now();
    this.landGain.gain.rampTo(0, fadeSeconds, now);
    this.landOn = false;
    window.setTimeout(() => {
      if (!this.landOn && this.ready && this.landNoise.state === 'started') this.landNoise.stop();
    }, (fadeSeconds + 0.2) * 1000);
  }

  /** Cursor is over land / no data. */
  exploreLand(pan: number): void {
    if (!this.ready) return;
    this.landOn = true;
    if (this.landNoise.state !== 'started') this.landNoise.start();
    const now = Tone.now();
    if (this.exploreSounding) {
      this.exploreSynth.triggerRelease(now);
      this.exploreSounding = false;
    }
    this.landPanner.pan.rampTo(pan, 0.08, now);
    this.landGain.gain.rampTo(1, 0.08, now);
  }

  /** Silence the explore tone and land wash but leave the fire crackle running. */
  exploreQuiet(): void {
    if (!this.ready) return;
    const now = Tone.now();
    if (this.exploreSounding) {
      this.exploreSynth.triggerRelease(now);
      this.exploreSounding = false;
    }
    this.landOff(0.15);
  }

  /** Fade explore sound out (cursor left the map or stopped moving). */
  exploreStop(fadeSeconds = 0.6): void {
    if (!this.ready) return;
    this.crackleRate = 0;
    clearTimeout(this.crackleTimer);
    const now = Tone.now();
    if (this.exploreSounding) {
      this.exploreSynth.triggerRelease(now);
      this.exploreSounding = false;
    }
    this.landOff(fadeSeconds);
  }

  playNote(note: NoteSpec, time?: number): void {
    if (!this.ready) return;
    const v = Math.min(1, Math.max(0, note.velocity));
    this.melody.triggerAttackRelease(note.freq, note.duration, time ?? Tone.now(), v);
  }

  /**
   * A mallet note at an exact time and stereo position (Ear Test clips:
   * first clip left, second right). Returns when the note starts, in seconds from now.
   */
  playClipNote(freq: number, pan: number, delaySeconds: number, duration = 0.28, velocity = 0.6): void {
    if (!this.ready) return;
    const t = Tone.now() + delaySeconds;
    this.melodyPanner.pan.setValueAtTime(pan, Math.max(Tone.now(), t - 0.02));
    this.melody.triggerAttackRelease(freq, duration, t, velocity);
  }

  /** Gentle feedback: a rising pair for correct, a soft falling pair for wrong. */
  playCue(kind: 'correct' | 'wrong', delaySeconds = 0): void {
    if (!this.ready) return;
    const t = Tone.now() + delaySeconds;
    this.melodyPanner.pan.setValueAtTime(0, Math.max(Tone.now(), t - 0.02));
    const notes = kind === 'correct' ? [76, 81] : [57, 52]; // E5→A5 / A3→E3
    notes.forEach((m, i) => {
      const f = 440 * Math.pow(2, (m - 69) / 12);
      this.melody.triggerAttackRelease(f, 0.35, t + i * 0.16, kind === 'correct' ? 0.5 : 0.4);
    });
  }

  /**
   * "Needle drop" when a record is chosen: a soft low thump and a short
   * burst of filtered vinyl crackle. Built on demand and disposed after.
   */
  playNeedleDrop(): void {
    if (!this.ready) return;
    const t = Tone.now() + 0.02;
    const out = new Tone.Gain(0.9).connect(this.master);
    const thump = new Tone.MembraneSynth({
      pitchDecay: 0.04,
      octaves: 3,
      envelope: { attack: 0.002, decay: 0.28, sustain: 0, release: 0.1 },
      volume: -14,
    }).connect(out);
    const hissFilter = new Tone.Filter({ type: 'bandpass', frequency: 2600, Q: 0.7 }).connect(out);
    const hiss = new Tone.NoiseSynth({
      noise: { type: 'pink' },
      envelope: { attack: 0.005, decay: 0.45, sustain: 0, release: 0.1 },
      volume: -24,
    }).connect(hissFilter);
    thump.triggerAttackRelease(55, 0.2, t);
    hiss.triggerAttackRelease(0.4, t + 0.03);
    // A few crackles on top.
    const crackle = new Tone.NoiseSynth({ noise: { type: 'white' }, envelope: { attack: 0.001, decay: 0.012, sustain: 0 }, volume: -22 }).connect(
      hissFilter,
    );
    // One noise voice: its start times must increase, so sort the random crackle times.
    const times = Array.from({ length: 5 }, () => t + 0.05 + Math.random() * 0.4).sort((a, b) => a - b);
    times.forEach((ct, i) => crackle.triggerAttackRelease(0.008, ct + i * 0.001, 0.4 + Math.random() * 0.6));
    window.setTimeout(() => [thump, hiss, crackle, hissFilter, out].forEach((n) => n.dispose()), 1500);
  }

  /**
   * Intro: a low tone that swells up over `rise` seconds and fades over
   * `fall`. The visuals follow introLevel(), so picture and sound stay locked.
   */
  playIntroSwell(rise = 3.2, fall = 2.6): void {
    if (!this.ready) return;
    const t = Tone.now() + 0.05;
    const gain = new Tone.Gain(0).connect(this.master);
    const filter = new Tone.Filter({ type: 'lowpass', frequency: 160, rolloff: -24, Q: 0.6 }).connect(gain);
    const low = new Tone.OmniOscillator({ type: 'fatsine', count: AUDIO_PROFILE.fatCount, spread: 18, frequency: 55, volume: -6 }).connect(filter);
    const mid = new Tone.Oscillator({ type: 'sine', frequency: 110, volume: -12 }).connect(filter);
    const fifth = new Tone.Oscillator({ type: 'triangle', frequency: 164.81, volume: -24 }).connect(filter);
    [low, mid, fifth].forEach((o) => o.start(t));
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(1, t + rise);
    gain.gain.setValueAtTime(1, t + rise);
    gain.gain.exponentialRampToValueAtTime(0.001, t + rise + fall);
    filter.frequency.setValueAtTime(160, t);
    filter.frequency.exponentialRampToValueAtTime(1500, t + rise);
    filter.frequency.exponentialRampToValueAtTime(400, t + rise + fall);
    this.introGain = gain;
    const end = t + rise + fall + 0.1;
    [low, mid, fifth].forEach((o) => o.stop(end));
    window.setTimeout(() => {
      [low, mid, fifth, filter, gain].forEach((n) => n.dispose());
      if (this.introGain === gain) this.introGain = null;
    }, (rise + fall + 0.5) * 1000);
  }

  /** Current intro swell level, 0..1 (0 when no intro is playing). */
  introLevel(): number {
    return this.introGain ? this.introGain.gain.value : 0;
  }

  /** Skip: fade the swell out quickly. */
  stopIntroSwell(): void {
    if (!this.introGain) return;
    const now = Tone.now();
    this.introGain.gain.cancelScheduledValues(now);
    this.introGain.gain.rampTo(0, 0.25, now);
  }

  get isRecording(): boolean {
    return this.recording;
  }

  /**
   * Start capturing the final mix (after the limiter, before the listener's
   * volume and mute) as raw PCM. Tone's context wrapper has no ScriptProcessor,
   * so the mix is sent out as a MediaStream (uncompressed) and read by a small
   * native AudioContext used only for capture.
   */
  async startRecording(): Promise<boolean> {
    if (!this.ready || this.recording) return this.recording;
    const raw = Tone.getContext().rawContext as unknown as AudioContext;
    if (!this.recTap) {
      if (typeof raw.createMediaStreamDestination !== 'function' || typeof window.AudioContext !== 'function') return false;
      const out = raw.createMediaStreamDestination();
      out.channelCount = 2;
      this.clipper.connect(out);
      const cap = new window.AudioContext({ sampleRate: raw.sampleRate });
      if (typeof cap.createScriptProcessor !== 'function') return false;
      const src = cap.createMediaStreamSource(out.stream);
      const tap = cap.createScriptProcessor(4096, 2, 2);
      tap.onaudioprocess = (e: AudioProcessingEvent) => {
        if (!this.recording) return;
        if (this.recFrames >= MAX_RECORD_SECONDS * cap.sampleRate) return;
        const ib = e.inputBuffer;
        const left = ib.getChannelData(0).slice(0);
        const right = ib.numberOfChannels > 1 ? ib.getChannelData(1).slice(0) : left;
        this.recChunks.push([left, right]);
        this.recFrames += left.length;
      };
      src.connect(tap);
      // The processor must reach a destination to run; its output buffer stays silent.
      tap.connect(cap.destination);
      this.recTap = tap;
      this.recCtx = cap;
    }
    await this.recCtx?.resume();
    this.recChunks = [];
    this.recFrames = 0;
    this.recording = true;
    return true;
  }

  /** Stop and return the recording as a 16-bit stereo WAV. */
  stopRecording(): { wav: Blob; seconds: number } | null {
    if (!this.recording || !this.recTap) return null;
    this.recording = false;
    const rate = this.recCtx?.sampleRate ?? Tone.getContext().sampleRate;
    const channels = joinChunks(this.recChunks, 2);
    this.recChunks = [];
    const seconds = channels[0].length / rate;
    return { wav: new Blob([encodeWav(channels, rate)], { type: 'audio/wav' }), seconds };
  }

  /** Second duet voice (FM bell). */
  playDuetNote(note: NoteSpec, time?: number): void {
    if (!this.ready) return;
    this.duetSynth.triggerAttackRelease(note.freq, note.duration, time ?? Tone.now(), Math.min(1, Math.max(0, note.velocity)));
  }

  /** Stereo position of the main melody voice (centre for Timeline, left in Duet). */
  setMelodyPan(pan: number): void {
    if (!this.ready) return;
    this.melodyPanner.pan.rampTo(pan, 0.2);
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
    if (active) {
      if (this.droneLow.state !== 'started') this.droneLow.start();
      if (this.droneHigh.state !== 'started') this.droneHigh.start();
    }
    this.droneGain.gain.cancelScheduledValues(Tone.now());
    this.droneGain.gain.rampTo(active ? 1 : 0, rampSeconds);
    if (!active) {
      // Silent oscillators still cost CPU (a lot, on phones): stop them once the fade is done.
      window.setTimeout(() => {
        if (this.droneActive || !this.ready) return;
        if (this.droneLow.state === 'started') this.droneLow.stop();
        if (this.droneHigh.state === 'started') this.droneHigh.stop();
      }, (rampSeconds + 0.2) * 1000);
    }
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
    this.duetSynth.releaseAll();
  }

  dispose(): void {
    if (!this.ready) return;
    [this.droneLow, this.droneHigh, this.droneFilter, this.droneGain, this.melody, this.melodyFilter,
      this.melodyPanner, this.duetSynth, this.duetFilter, this.duetPanner, this.exploreSynth, this.exploreFilter, this.explorePanner, this.landNoise, this.landFilter, this.landGain,
      this.landPanner, this.scanSynth, this.scanFilter, this.scanPanner, this.crackle, this.crackleFilter, this.cracklePanner, this.channels.melody, this.channels.drone,
      this.channels.explore, this.channels.scanner, this.channels.duet, this.reverb, this.master, this.limiter, this.fft, this.clipPreGain, this.clipper].forEach((n) => n.dispose());
    this.built = false;
    this.initPromise = null;
  }
}

/** App-wide engine instance. */
export const engine = new AudioEngine();
