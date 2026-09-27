/**
 * FFT -> a small number of log-spaced bars for the spectrum ring. Pure, so
 * the mapping from sound to picture is tested, not guessed.
 */

/** n+1 log-spaced edges from fMin to fMax. */
export function logBinEdges(n: number, fMin: number, fMax: number): number[] {
  const a = Math.log(fMin);
  const b = Math.log(fMax);
  return Array.from({ length: n + 1 }, (_, i) => Math.exp(a + ((b - a) * i) / n));
}

/**
 * dB spectrum (FFT bins spaced evenly up to nyquist) -> n bars in 0..1.
 * Each bar takes the loudest FFT bin in its frequency range; narrow low bars
 * that contain no FFT bin use the nearest one.
 */
export function spectrumToBins(
  db: ArrayLike<number>,
  nyquist: number,
  n: number,
  fMin = 60,
  fMax = 8000,
  floorDb = -95,
  ceilDb = -35,
): Float32Array {
  const out = new Float32Array(n);
  const size = db.length;
  if (size === 0) return out;
  const hzPerBin = nyquist / size;
  const edges = logBinEdges(n, fMin, fMax);
  for (let i = 0; i < n; i++) {
    let lo = Math.floor(edges[i] / hzPerBin);
    let hi = Math.ceil(edges[i + 1] / hzPerBin);
    lo = Math.max(0, Math.min(size - 1, lo));
    hi = Math.max(lo + 1, Math.min(size, hi));
    let max = -Infinity;
    for (let k = lo; k < hi; k++) if (db[k] > max) max = db[k];
    const t = (max - floorDb) / (ceilDb - floorDb);
    out[i] = Number.isFinite(t) ? Math.max(0, Math.min(1, t)) : 0;
  }
  return out;
}

/** In-place attack/release smoothing: rises quickly, falls slowly (no flicker). */
export function smoothInto(prev: Float32Array, next: ArrayLike<number>, attack = 0.55, release = 0.1): void {
  for (let i = 0; i < prev.length; i++) {
    const k = next[i] > prev[i] ? attack : release;
    prev[i] += (next[i] - prev[i]) * k;
  }
}

/** Largest value (0..1); used to decide whether the ring needs redrawing. */
export function peak(a: ArrayLike<number>): number {
  let m = 0;
  for (let i = 0; i < a.length; i++) if (a[i] > m) m = a[i];
  return m;
}
