import { rotationToFaceLon } from './geo';

/**
 * What the globe should face, offered by the active mode. A plain module-level
 * provider (like the note bus) because it is read every animation frame.
 */
export interface GlobeFocus {
  lon: number;
  /** Draw the scanner beam along this meridian. */
  beam?: boolean;
}

type Provider = () => GlobeFocus | null;
let provider: Provider | null = null;

/** Register the current mode's focus; returns an unregister function. */
export function setGlobeFocus(p: Provider): () => void {
  provider = p;
  return () => {
    if (provider === p) provider = null;
  };
}

export function getGlobeFocus(): GlobeFocus | null {
  return provider ? provider() : null;
}

/** Wrap an angle (radians) into (-π, π]. */
export function wrapAngle(a: number): number {
  const t = a % (2 * Math.PI);
  if (t > Math.PI) return t - 2 * Math.PI;
  if (t <= -Math.PI) return t + 2 * Math.PI;
  return t;
}

/** Globe yaw that puts `lon` facing a camera at azimuth `cameraAzimuth` (atan2(x, z)). */
export function yawToFace(lon: number, cameraAzimuth: number): number {
  return rotationToFaceLon(lon) + cameraAzimuth;
}

/** Move `current` toward `target` by fraction k along the shortest way round. */
export function dampAngle(current: number, target: number, k: number): number {
  return current + wrapAngle(target - current) * k;
}

/** Rotation (about +Y, radians) that carries the meridian at lon −90 (built facing +Z) to `lon`. */
export function meridianRotation(lon: number): number {
  return ((lon + 90) * Math.PI) / 180;
}
