/**
 * Phones and tablets crackle when the audio thread runs out of time. On those
 * devices we trade a little latency and richness for stable sound: bigger
 * audio buffers, longer scheduling lookahead, a shorter reverb and fewer voices.
 * Desktop keeps the full settings.
 */
export interface AudioProfile {
  constrained: boolean;
  latencyHint: 'interactive' | 'balanced' | 'playback';
  /** Seconds Tone schedules ahead: room for the main thread to stall (e.g. the 3D globe) without late notes. */
  lookAhead: number;
  /** Convolution reverb length; cost grows with it. */
  reverbDecay: number;
  clipperOversample: 'none' | '2x' | '4x';
  /** Voices in the drone/intro "fat" oscillators. */
  fatCount: number;
  melodyPolyphony: number;
  scanPolyphony: number;
}

export function isConstrainedDevice(env: { userAgent: string; coarsePointer: boolean; maxTouchPoints: number }): boolean {
  const ua = env.userAgent;
  const mobileUA = /Android|iPhone|iPad|iPod|Mobile/i.test(ua);
  // iPadOS reports itself as a Mac; touch support gives it away.
  const iPadOS = /Macintosh/.test(ua) && env.maxTouchPoints > 1;
  return mobileUA || iPadOS || env.coarsePointer;
}

export function audioProfileFor(constrained: boolean): AudioProfile {
  return constrained
    ? { constrained, latencyHint: 'playback', lookAhead: 0.15, reverbDecay: 2.2, clipperOversample: 'none', fatCount: 2, melodyPolyphony: 6, scanPolyphony: 12 }
    : { constrained, latencyHint: 'interactive', lookAhead: 0.05, reverbDecay: 4.5, clipperOversample: '2x', fatCount: 3, melodyPolyphony: 10, scanPolyphony: 24 };
}

function detect(): boolean {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return false;
  let coarse = false;
  try {
    coarse = window.matchMedia('(pointer: coarse)').matches;
  } catch {
    /* no matchMedia */
  }
  return isConstrainedDevice({ userAgent: navigator.userAgent, coarsePointer: coarse, maxTouchPoints: navigator.maxTouchPoints ?? 0 });
}

export const AUDIO_PROFILE: AudioProfile = audioProfileFor(detect());
