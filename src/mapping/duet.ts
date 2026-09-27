import type { TimeSeriesPoint } from '../data/types';
import { referenceTone, toNoteEvent } from './timeline';
import type { MappingConfig, NoteEvent, ReferenceTone } from './types';

/** Registers for the two voices: A sits above B so the lines never cross. */
export const DUET_RANGES: Record<'a' | 'b', [number, number]> = {
  a: [62, 86],
  b: [40, 64],
};

/** Stereo positions: A left, B right. */
export const DUET_PAN = { a: -0.45, b: 0.45 };

/** B plays this fraction of a beat after A (call and response). */
export const DUET_OFFSET_BEATS = 0.5;

export interface DuetStep {
  index: number;
  year: number;
  a: NoteEvent;
  b: NoteEvent;
}

export interface Duet {
  steps: DuetStep[];
  refA: ReferenceTone;
  refB: ReferenceTone;
  /** Pearson correlation of the two series over the shared years (NaN if undefined). */
  correlation: number;
}

/** Years present in both series, ascending. */
export function sharedYears(a: TimeSeriesPoint[], b: TimeSeriesPoint[]): number[] {
  const inB = new Set(b.map((p) => p.year));
  return a.map((p) => p.year).filter((y) => inB.has(y));
}

export function correlation(xs: number[], ys: number[]): number {
  const n = Math.min(xs.length, ys.length);
  if (n < 3) return NaN;
  const mx = xs.slice(0, n).reduce((s, v) => s + v, 0) / n;
  const my = ys.slice(0, n).reduce((s, v) => s + v, 0) / n;
  let sxy = 0;
  let sxx = 0;
  let syy = 0;
  for (let i = 0; i < n; i++) {
    const dx = xs[i] - mx;
    const dy = ys[i] - my;
    sxy += dx * dy;
    sxx += dx * dx;
    syy += dy * dy;
  }
  return sxx && syy ? sxy / Math.sqrt(sxx * syy) : NaN;
}

/** Two series -> one step per shared year, each voice in its own register. */
export function buildDuet(a: TimeSeriesPoint[], cfgA: MappingConfig, b: TimeSeriesPoint[], cfgB: MappingConfig): Duet {
  const ca = { ...cfgA, midiRange: DUET_RANGES.a };
  const cb = { ...cfgB, midiRange: DUET_RANGES.b };
  const refA = referenceTone(a, ca);
  const refB = referenceTone(b, cb);
  const byYearA = new Map(a.map((p) => [p.year, p]));
  const byYearB = new Map(b.map((p) => [p.year, p]));
  const years = sharedYears(a, b);
  const steps = years.map((year, i) => ({
    index: i,
    year,
    a: toNoteEvent(byYearA.get(year)!, i, refA, ca),
    b: toNoteEvent(byYearB.get(year)!, i, refB, cb),
  }));
  return {
    steps,
    refA,
    refB,
    correlation: correlation(
      steps.map((s) => s.a.value),
      steps.map((s) => s.b.value),
    ),
  };
}

/** "move closely together" / "move in opposite directions" ... from a correlation. */
export function describeCorrelation(r: number): string {
  if (!Number.isFinite(r)) return 'have too few shared years to compare';
  const abs = Math.abs(r);
  const strength = abs >= 0.8 ? 'closely' : abs >= 0.5 ? 'fairly closely' : abs >= 0.3 ? 'loosely' : null;
  if (!strength) return 'show little relationship';
  return r > 0 ? `rise and fall ${strength} together` : `move ${strength} in opposite directions`;
}

export function describeDuetMapping(
  titleA: string,
  cfgA: MappingConfig,
  titleB: string,
  cfgB: MappingConfig,
  duet: Pick<Duet, 'steps' | 'correlation'>,
): string[] {
  const first = duet.steps[0]?.year;
  const last = duet.steps[duet.steps.length - 1]?.year;
  return [
    `Each beat is one year, ${first} to ${last}: the years both records cover.`,
    `${titleA} is the bright mallet, high and in your left ear. Higher means ${cfgA.higherMeans}.`,
    `${titleB} is the soft bell, lower and in your right ear, half a beat later. Higher means ${cfgB.higherMeans}.`,
    `Over these years the two ${describeCorrelation(duet.correlation)} (correlation ${duet.correlation.toFixed(2)}).`,
  ];
}
