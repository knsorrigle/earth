import { describe, expect, it } from 'vitest';
import { logBinEdges, peak, smoothInto, spectrumToBins } from './spectrum';

describe('logBinEdges', () => {
  it('spans the range geometrically', () => {
    const e = logBinEdges(2, 100, 10000);
    expect(e[0]).toBeCloseTo(100);
    expect(e[1]).toBeCloseTo(1000);
    expect(e[2]).toBeCloseTo(10000);
  });
});

describe('spectrumToBins', () => {
  // 1024 FFT bins up to 24 kHz (~23.4 Hz per bin); silence at -140 dB with a tone at 440 Hz.
  const size = 1024;
  const nyquist = 24000;
  const db = new Float32Array(size).fill(-140);
  const k440 = Math.round(440 / (nyquist / size));
  db[k440] = -40;

  it('silence -> all zero', () => {
    const bins = spectrumToBins(new Float32Array(size).fill(-140), nyquist, 96);
    expect(peak(bins)).toBe(0);
  });

  it('a 440 Hz tone lights the bar covering 440 Hz, and only nearby bars', () => {
    const bins = spectrumToBins(db, nyquist, 96);
    const edges = logBinEdges(96, 60, 8000);
    const bar = edges.findIndex((f, i) => f <= 440 && edges[i + 1] > 440);
    expect(bins[bar]).toBeGreaterThan(0.9);
    const lit = [...bins].filter((v) => v > 0).length;
    expect(lit).toBeLessThanOrEqual(3);
  });

  it('clamps to 0..1', () => {
    const loud = new Float32Array(size).fill(0);
    expect(peak(spectrumToBins(loud, nyquist, 16))).toBe(1);
  });
});

describe('smoothInto', () => {
  it('attacks fast and releases slowly', () => {
    const v = new Float32Array([0, 1]);
    smoothInto(v, [1, 0], 0.5, 0.1);
    expect(v[0]).toBeCloseTo(0.5);
    expect(v[1]).toBeCloseTo(0.9);
  });
});
