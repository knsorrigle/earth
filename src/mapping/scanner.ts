import type { ScanColumn, ScanPlan } from '../sampling/scan';
import { clamp, midiToFreq, valueToMidi } from './pitch';
import type { ScaleName } from './types';

export interface ScannerConfig {
  /** Highest MIDI note used (top of the northernmost band's register). */
  topMidi: number;
  /** Semitones between neighbouring band registers. */
  bandSpacing: number;
  /** Width of each band's register in semitones. */
  bandSpan: number;
  scale: ScaleName;
  root: number;
  /** Cells with less data coverage than this stay silent (mostly land). */
  minCoverage: number;
  /** Delay between successive band notes within one step (the "strum"). */
  strumSeconds: number;
  /** Velocity at minCoverage and at full coverage. */
  velocity: [number, number];
  /** Hard cap on notes per step. */
  maxVoices: number;
}

export const DEFAULT_SCANNER: ScannerConfig = {
  topMidi: 86,
  bandSpacing: 5,
  bandSpan: 12,
  scale: 'majorPentatonic',
  root: 60,
  minCoverage: 0.15,
  strumSeconds: 0.028,
  velocity: [0.18, 0.5],
  maxVoices: 8,
};

/** Register of band i (0 = northernmost): north plays higher. */
export function bandWindow(i: number, cfg: ScannerConfig): [number, number] {
  const hi = cfg.topMidi - i * cfg.bandSpacing;
  return [hi - cfg.bandSpan, hi];
}

export interface ScanNote {
  band: number;
  midi: number;
  freq: number;
  velocity: number;
  /** Seconds after the step's start. */
  offset: number;
  value: number;
}

/**
 * One scan step -> notes. Within a band, pitch follows the value relative to
 * that band's own range across the frame, so regional contrasts (cold
 * upwelling, warm currents) are audible at every latitude.
 */
export function columnNotes(column: ScanColumn, plan: ScanPlan, cfg: ScannerConfig = DEFAULT_SCANNER): ScanNote[] {
  const candidates: Omit<ScanNote, 'offset'>[] = [];
  column.cells.forEach((cell, band) => {
    if (cell.mean === null || cell.coverage < cfg.minCoverage) return;
    const range = plan.bandRanges[band];
    const domain: [number, number] = Number.isFinite(range.min) ? [range.min, range.max] : [cell.mean, cell.mean];
    const midi = valueToMidi(cell.mean, { domain, midiRange: bandWindow(band, cfg), root: cfg.root, scale: cfg.scale });
    const t = clamp((cell.coverage - cfg.minCoverage) / (1 - cfg.minCoverage), 0, 1);
    const velocity = cfg.velocity[0] + (cfg.velocity[1] - cfg.velocity[0]) * t;
    candidates.push({ band, midi, freq: midiToFreq(midi), velocity, value: cell.mean });
  });

  // Over the cap: keep the cells with the most data, then restore north-to-south order.
  const kept =
    candidates.length > cfg.maxVoices
      ? [...candidates].sort((a, b) => column.cells[b.band].coverage - column.cells[a.band].coverage).slice(0, cfg.maxVoices).sort((a, b) => a.band - b.band)
      : candidates;

  return kept.map((n, i) => ({ ...n, offset: i * cfg.strumSeconds }));
}

/** Seconds per column for a full sweep of the given duration. */
export function stepSeconds(durationSeconds: number, columns: number): number {
  return durationSeconds / columns;
}
