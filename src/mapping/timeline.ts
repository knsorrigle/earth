import type { TimeSeriesPoint } from '../data/types';
import type { MappingConfig, NoteEvent, ReferenceTone } from './types';
import { midiToFreq, midiToNoteName, valueToMidi } from './pitch';
import { deviationToVelocity } from './dynamics';

/** Value of the reference year, falling back to the first point. */
export function referenceTone(series: TimeSeriesPoint[], cfg: MappingConfig): ReferenceTone {
  const p = series.find((s) => s.year === cfg.referenceYear) ?? series[0];
  const midi = valueToMidi(p.value, cfg);
  return { year: p.year, value: p.value, midi, freq: midiToFreq(midi), noteName: midiToNoteName(midi) };
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
