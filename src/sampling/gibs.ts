import type { BBox } from './grid';
import { parseColormapXml, type Colormap } from './colormap';

/**
 * NASA GIBS access. Endpoints verified against
 * https://gibs.earthdata.nasa.gov/wmts/epsg4326/best/1.0.0/WMTSCapabilities.xml
 * and https://nasa-gibs.github.io/gibs-api-docs/ (both send Access-Control-Allow-Origin: *).
 *
 * WMS GetMap is used rather than stitching WMTS tiles: one request returns
 * exactly the requested bbox at the requested size, and GIBS serves exact
 * palette colours (verified: 100% of opaque pixels match the colormap).
 */
export const GIBS_WMS_EPSG4326 = 'https://gibs.earthdata.nasa.gov/wms/epsg4326/best/wms.cgi';

export interface FrameRequest {
  layer: string;
  /** YYYY-MM-DD */
  date: string;
  width: number;
  height: number;
  bbox: BBox;
  style?: string;
}

export function buildWmsGetMapUrl({ layer, date, width, height, bbox, style = '' }: FrameRequest): string {
  const [w, s, e, n] = bbox;
  const params = new URLSearchParams({
    SERVICE: 'WMS',
    REQUEST: 'GetMap',
    VERSION: '1.3.0',
    LAYERS: layer,
    STYLES: style,
    CRS: 'EPSG:4326',
    // WMS 1.3.0 + EPSG:4326 uses lat,lon axis order.
    BBOX: [s, w, n, e].join(','),
    WIDTH: String(width),
    HEIGHT: String(height),
    FORMAT: 'image/png',
    TRANSPARENT: 'TRUE',
    TIME: date,
  });
  return `${GIBS_WMS_EPSG4326}?${params}`;
}

export function cachedFrameUrl(baseUrl: string, layer: string, date: string): string {
  return `${baseUrl}frames/${layer}/${date}.png`;
}

/** Fraction of pixels that are at least half opaque. */
export function opaqueFraction(rgba: ArrayLike<number>): number {
  let n = 0;
  const total = rgba.length / 4;
  for (let p = 3; p < rgba.length; p += 4) if (rgba[p] >= 128) n++;
  return total ? n / total : 0;
}

/** Cached date closest to the requested one. */
export function nearestDate(dates: string[], target: string): string | undefined {
  const t = Date.parse(target);
  return [...dates].sort((a, b) => Math.abs(Date.parse(a) - t) - Math.abs(Date.parse(b) - t))[0];
}

export interface Frame {
  rgba: Uint8ClampedArray;
  width: number;
  height: number;
  bitmap: ImageBitmap;
  /** Date actually shown (may differ from the requested one when falling back). */
  date: string;
  source: 'live' | 'cache';
  /** Plain-language note when a fallback was used. */
  notice?: string;
}

/**
 * Decode an image to raw RGBA without colour management, so pixel values
 * are exactly what GIBS encoded.
 */
export async function fetchRgba(url: string, signal?: AbortSignal) {
  const res = await fetch(url, { signal, mode: 'cors' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const type = res.headers.get('content-type') ?? '';
  if (!type.startsWith('image/')) throw new Error(`Not an image (${type})`); // WMS errors come back as XML
  const bitmap = await createImageBitmap(await res.blob(), { colorSpaceConversion: 'none', premultiplyAlpha: 'none' });
  const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('2D canvas unavailable');
  ctx.drawImage(bitmap, 0, 0);
  const { data } = ctx.getImageData(0, 0, bitmap.width, bitmap.height);
  return { rgba: data, width: bitmap.width, height: bitmap.height, bitmap };
}

function withTimeout(signal: AbortSignal | undefined, ms: number): AbortSignal {
  const t = AbortSignal.timeout(ms);
  return signal ? AbortSignal.any([signal, t]) : t;
}

/** Below this, a "successful" GIBS response is treated as empty (no data for that date). */
const MIN_COVERAGE = 0.05;

/**
 * Live GIBS frame, falling back to the bundled frame for the same date,
 * then to the nearest bundled date.
 */
export async function loadFrame(
  req: FrameRequest,
  opts: {
    baseUrl: string;
    cachedDates: string[];
    signal?: AbortSignal;
    timeoutMs?: number;
    /** Sparse layers (fire points) are legitimately almost empty; skip the "no data" check. */
    allowSparse?: boolean;
  },
): Promise<Frame> {
  const { baseUrl, cachedDates, signal, timeoutMs = 15000 } = opts;
  let reason = '';
  try {
    const live = await fetchRgba(buildWmsGetMapUrl(req), withTimeout(signal, timeoutMs));
    if (opaqueFraction(live.rgba) >= MIN_COVERAGE) return { ...live, date: req.date, source: 'live' };
    if (!opts.allowSparse) reason = 'NASA GIBS has no data for that date yet';
    else return { ...live, date: req.date, source: 'live' };
  } catch (err) {
    if (signal?.aborted) throw err;
    reason = 'NASA GIBS could not be reached';
  }

  const fallbackDate = cachedDates.includes(req.date) ? req.date : nearestDate(cachedDates, req.date);
  if (!fallbackDate) throw new Error(`${reason}, and no saved frames are available.`);
  const cached = await fetchRgba(cachedFrameUrl(baseUrl, req.layer, fallbackDate), signal);
  const notice =
    fallbackDate === req.date
      ? `${reason}; showing the saved copy of ${fallbackDate}.`
      : `${reason}; showing the nearest saved date, ${fallbackDate}.`;
  return { ...cached, date: fallbackDate, source: 'cache', notice };
}

export async function loadColormap(liveUrl: string, cachedUrl: string, signal?: AbortSignal): Promise<Colormap> {
  for (const url of [liveUrl, cachedUrl]) {
    try {
      const res = await fetch(url, { signal: withTimeout(signal, 10000) });
      if (!res.ok) continue;
      const cmap = parseColormapXml(await res.text());
      if (cmap.entries.length > 0) return cmap;
    } catch (err) {
      if (signal?.aborted) throw err;
    }
  }
  throw new Error('Colormap unavailable');
}
