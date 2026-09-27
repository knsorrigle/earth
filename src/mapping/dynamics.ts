import { clamp } from './pitch';

/**
 * Distance from the reference -> note velocity. Notes near the reference are
 * soft; notes far from it are more present. Kept in a narrow band so long
 * listening stays comfortable.
 */
export function deviationToVelocity(
  value: number,
  reference: number,
  domain: readonly [number, number],
  [minVel, maxVel]: readonly [number, number] = [0.35, 0.8],
): number {
  const span = Math.abs(domain[1] - domain[0]) || 1;
  const t = clamp(Math.abs(value - reference) / span, 0, 1);
  return minVel + (maxVel - minVel) * t;
}

/** Beats per minute -> seconds per data point (one point per beat). */
export function bpmToSecondsPerStep(bpm: number): number {
  return 60 / bpm;
}
