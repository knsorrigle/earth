import { wrapAngle } from './focus';

/**
 * Record orbit: n discs evenly spaced on a horizontal circle around the globe.
 * Angle 0 = toward +Z; a record faces the viewer when its angle equals the
 * camera azimuth (atan2(x, z)).
 */
export function orbitAngle(index: number, n: number, base: number): number {
  return base + (index / n) * Math.PI * 2;
}

export function orbitPosition(index: number, n: number, base: number, radius: number, y: number): [number, number, number] {
  const a = orbitAngle(index, n, base);
  return [radius * Math.sin(a), y, radius * Math.cos(a)];
}

/** The base angle that brings record `index` to the front for a camera at `azimuth`. */
export function baseToFront(index: number, n: number, azimuth: number): number {
  return azimuth - (index / n) * Math.PI * 2;
}

/** How much a record faces the viewer: 1 in front, -1 directly behind the globe. */
export function facing(index: number, n: number, base: number, azimuth: number): number {
  return Math.cos(wrapAngle(orbitAngle(index, n, base) - azimuth));
}
