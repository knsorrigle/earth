export type ScaleName = 'majorPentatonic' | 'minorPentatonic' | 'naturalMinor' | 'chromatic';

export interface MappingConfig {
  /** Data values mapped onto the pitch range. Values outside are clamped. */
  domain: [number, number];
  /** Lowest and highest MIDI note allowed. */
  midiRange: [number, number];
  scale: ScaleName;
  /** MIDI note the scale is built on (only its pitch class matters). */
  root: number;
  /** Year whose value becomes the reference drone. */
  referenceYear: number;
  /**
   * Fixed reference value instead of a year's value (e.g. 0 for an anomaly
   * series relative to a baseline period), with its label, e.g. "1951–1980 average".
   */
  referenceValue?: number;
  referenceLabel?: string;
  /** Plain-words meaning of higher pitch, e.g. "more sea ice". */
  higherMeans: string;
  /** Plain-words meaning of lower pitch. */
  lowerMeans: string;
  /** If true, higher values map to lower pitch. */
  invert?: boolean;
}

/** One sonified data point. */
export interface NoteEvent {
  index: number;
  year: number;
  value: number;
  midi: number;
  freq: number;
  noteName: string;
  /** 0..1 */
  velocity: number;
  /** value - reference value */
  deviation: number;
}

export interface ReferenceTone {
  /** Reference year, or NaN when the reference is a fixed baseline value. */
  year: number;
  /** How to say it after "above"/"below": "1979" or "the 1951–1980 average". */
  phrase: string;
  /** Short display label: "1979" or "1951–1980 average". */
  label: string;
  value: number;
  midi: number;
  freq: number;
  noteName: string;
}
