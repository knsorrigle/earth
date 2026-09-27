import type { TimeSeriesPoint } from '../data/types';
import type { MappingConfig, NoteEvent, ReferenceTone } from './types';
import { midiToFreq, midiToNoteName, valueToMidi } from './pitch';
import { deviationToVelocity } from './dynamics';

/** Plain-words name of the reference: "1979" or "the 1951–1980 average". */
export function referencePhrase(cfg: MappingConfig, year?: number): string {
  if (cfg.referenceValue !== undefined) return `the ${cfg.referenceLabel ?? 'baseline'}`;
  return String(year ?? cfg.referenceYear);
}

/** Reference value: a fixed baseline, or the reference year's value (falling back to the first point). */
export function referenceTone(series: TimeSeriesPoint[], cfg: MappingConfig): ReferenceTone {
  if (cfg.referenceValue !== undefined) {
    const midi = valueToMidi(cfg.referenceValue, cfg);
    return { year: NaN, phrase: referencePhrase(cfg), label: cfg.referenceLabel ?? 'baseline', value: cfg.referenceValue, midi, freq: midiToFreq(midi), noteName: midiToNoteName(midi) };
  }
  const p = series.find((s) => s.year === cfg.referenceYear) ?? series[0];
  const midi = valueToMidi(p.value, cfg);
  return { year: p.year, phrase: String(p.year), label: String(p.year), value: p.value, midi, freq: midiToFreq(midi), noteName: midiToNoteName(midi) };
}

export function toNoteEvent(
  point: TimeSeriesPoint,
  index: number,
  reference: ReferenceTone,
  cfg: MappingConfig,
): NoteEvent {
  const midi = valueToMidi(point.value, cfg);
  return {
    index,
    year: point.year,
    value: point.value,
    midi,
    freq: midiToFreq(midi),
    noteName: midiToNoteName(midi),
    velocity: deviationToVelocity(point.value, reference.value, cfg.domain),
    deviation: point.value - reference.value,
  };
}

/** Full series -> one note per point. */
export function buildTimeline(series: TimeSeriesPoint[], cfg: MappingConfig): NoteEvent[] {
  if (series.length === 0) return [];
  const ref = referenceTone(series, cfg);
  return series.map((p, i) => toNoteEvent(p, i, ref, cfg));
}
