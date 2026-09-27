import type { Colormap } from '../sampling/colormap';

export type RGB = [number, number, number];

export interface PaletteStop {
  /** 0..1 position along the palette. */
  t: number;
  color: string;
}

export function hexToRgb(hex: string): RGB {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.replace(/./g, (c) => c + c) : h, 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

/** Colour at t (0..1, clamped) along positioned stops, linearly interpolated. */
export function paletteColor(stops: PaletteStop[], t: number): RGB {
  const x = Math.max(0, Math.min(1, t));
  const sorted = [...stops].sort((a, b) => a.t - b.t);
  if (x <= sorted[0].t) return hexToRgb(sorted[0].color);
  for (let i = 1; i < sorted.length; i++) {
    const a = sorted[i - 1];
    const b = sorted[i];
    if (x <= b.t) {
      const f = (x - a.t) / (b.t - a.t || 1);
      const ca = hexToRgb(a.color);
      const cb = hexToRgb(b.color);
      return [ca[0] + (cb[0] - ca[0]) * f, ca[1] + (cb[1] - ca[1]) * f, ca[2] + (cb[2] - ca[2]) * f];
    }
  }
  return hexToRgb(sorted[sorted.length - 1].color);
}

/** The GIBS colormap colour for a value (the bin that contains it; clamped to the ends). */
export function colormapColor(cmap: Colormap, value: number): RGB {
  const entries = cmap.entries;
  if (entries.length === 0) return [1, 1, 1];
  let e = entries[entries.length - 1];
  for (const x of entries) {
    if (value < x.max || (value === x.max && x.min === x.max)) {
      e = x;
      break;
    }
  }
  if (value < entries[0].min) e = entries[0];
  return [e.rgb[0] / 255, e.rgb[1] / 255, e.rgb[2] / 255];
}
