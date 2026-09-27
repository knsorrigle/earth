/** Round-number axis ticks between lo and hi, roughly `count` of them (steps of 1, 2, 2.5 or 5 × 10^n). */
export function niceTicks(lo: number, hi: number, count = 4): number[] {
  const span = hi - lo || 1;
  const raw = span / count;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  // The candidate step whose tick count is closest to the target.
  const step = [1, 2, 2.5, 5, 10]
    .map((m) => m * mag)
    .reduce((best, s) => (Math.abs(span / s - count) < Math.abs(span / best - count) ? s : best));
  const out: number[] = [];
  for (let v = Math.ceil(lo / step) * step; v <= hi + 1e-9; v += step) out.push(Number(v.toFixed(6)));
  return out;
}
