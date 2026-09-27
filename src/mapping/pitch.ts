import type { ScaleName } from './types';

/** Semitone offsets from the root for each scale. */
export const SCALES: Record<ScaleName, readonly number[]> = {
  majorPentatonic: [0, 2, 4, 7, 9],
  minorPentatonic: [0, 3, 5, 7, 10],
  naturalMinor: [0, 2, 3, 5, 7, 8, 10],
  chromatic: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
};

const NOTE_NAMES = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];

export function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

/** Map v from [a, b] to [0, 1], clamped. A degenerate domain maps to 0.5. */
export function normalize(v: number, [a, b]: readonly [number, number]): number {
  if (a === b) return 0.5;
  return clamp((v - a) / (b - a), 0, 1);
}

function pitchClass(midi: number, root: number): number {
  return (((midi - root) % 12) + 12) % 12;
}

export function isInScale(midi: number, root: number, scale: ScaleName): boolean {
  return SCALES[scale].includes(pitchClass(midi, root));
}

/** All scale notes within [lo, hi] inclusive, ascending. */
export function scaleNotesInRange(
  [lo, hi]: readonly [number, number],
  root: number,
  scale: ScaleName,
): number[] {
  const notes: number[] = [];
  for (let m = Math.ceil(lo); m <= Math.floor(hi); m++) {
    if (isInScale(m, root, scale)) notes.push(m);
  }
  return notes;
}

/** Nearest scale note to an arbitrary (possibly fractional) MIDI value. Ties go down. */
export function quantizeToScale(midi: number, root: number, scale: ScaleName): number {
  let best = Math.round(midi);
  let bestDist = Infinity;
  for (let m = Math.floor(midi) - 12; m <= Math.ceil(midi) + 12; m++) {
    if (!isInScale(m, root, scale)) continue;
    const d = Math.abs(m - midi);
    if (d < bestDist) {
      best = m;
      bestDist = d;
    }
  }
  return best;
}

/**
 * Data value -> MIDI note. The value is placed proportionally across the
 * scale notes available in midiRange, so the mapping is monotonic and every
 * step of the scale represents an equal slice of the domain.
 */
export function valueToMidi(
  value: number,
  cfg: { domain: [number, number]; midiRange: [number, number]; root: number; scale: ScaleName; invert?: boolean },
): number {
  const notes = scaleNotesInRange(cfg.midiRange, cfg.root, cfg.scale);
  if (notes.length === 0) return quantizeToScale((cfg.midiRange[0] + cfg.midiRange[1]) / 2, cfg.root, cfg.scale);
  let t = normalize(value, cfg.domain);
  if (cfg.invert) t = 1 - t;
  return notes[Math.round(t * (notes.length - 1))];
}

export function midiToFreq(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

export function midiToNoteName(midi: number): string {
  const m = Math.round(midi);
  return `${NOTE_NAMES[((m % 12) + 12) % 12]}${Math.floor(m / 12) - 1}`;
}
