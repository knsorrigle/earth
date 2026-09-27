import { clamp } from './pitch';

/**
 * Longitude -> stereo pan. Scaled to ±width so the far east/west never
 * sits entirely in one ear (fatiguing on headphones).
 */
export function lonToPan(lon: number, width = 0.8): number {
  return clamp(lon / 180, -1, 1) * width;
}

/**
 * Normalised value (0..1) -> vibration pattern. navigator.vibrate has no
 * intensity control, so intensity is conveyed by pulse length.
 */
export function hapticPattern(t: number): number[] {
  return [Math.round(8 + 42 * clamp(t, 0, 1))];
}

/** Distinct "bump" pattern when the cursor crosses onto land / no data. */
export const LAND_HAPTIC = [6, 40, 6];
