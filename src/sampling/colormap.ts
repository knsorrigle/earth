/**
 * GIBS colormap XML (schema v1.3) parsing.
 * https://gibs.earthdata.nasa.gov/schemas/ColorMap_v1.3.xsd
 *
 * Regex-based rather than DOMParser so it runs (and is tested) outside the browser.
 */

export interface ColormapEntry {
  rgb: [number, number, number];
  /** Lower bound of the value interval (-Infinity if open). */
  min: number;
  /** Upper bound of the value interval (Infinity if open). */
  max: number;
  /** Representative value: midpoint, or the finite edge for open-ended bins. */
  value: number;
  /** Human label from the legend, e.g. "18.30 – 18.45" or "< 0.00". */
  label: string;
  nodata: boolean;
  transparent: boolean;
}

export interface Colormap {
  title: string;
  units: string;
  /** Data entries in ascending value order. */
  entries: ColormapEntry[];
  /** Colors that mean "no data" (land masks, missing, etc.). */
  nodata: ColormapEntry[];
}

function attrs(tag: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const m of tag.matchAll(/([\w:-]+)="([^"]*)"/g)) out[m[1]] = decodeEntities(m[2]);
  return out;
}

function decodeEntities(s: string): string {
  return s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&amp;/g, '&');
}

function parseBound(s: string): number {
  const t = s.trim();
  if (t === '-INF') return -Infinity;
  if (t === 'INF' || t === '+INF') return Infinity;
  return Number(t);
}

/** "[0.15,0.30)" -> {min: 0.15, max: 0.30}; "[5]" -> {min: 5, max: 5}. */
export function parseInterval(s: string): { min: number; max: number } {
  const inner = s.trim().replace(/^[[(]/, '').replace(/[\])]$/, '');
  const parts = inner.split(',');
  if (parts.length === 1) {
    const v = parseBound(parts[0]);
    return { min: v, max: v };
  }
  return { min: parseBound(parts[0]), max: parseBound(parts[1]) };
}

export function representativeValue(min: number, max: number): number {
  if (Number.isFinite(min) && Number.isFinite(max)) return (min + max) / 2;
  if (Number.isFinite(min)) return min;
  if (Number.isFinite(max)) return max;
  return NaN;
}

export function parseColormapXml(xml: string): Colormap {
  const result: Colormap = { title: '', units: '', entries: [], nodata: [] };
  for (const block of xml.matchAll(/<ColorMap\b([^>]*)>([\s\S]*?)<\/ColorMap>/g)) {
    const mapAttrs = attrs(block[1]);
    const body = block[2];
    const labels = new Map<string, string>();
    for (const le of body.matchAll(/<LegendEntry\b([^>]*)\/?>/g)) {
      const a = attrs(le[1]);
      if (a.id !== undefined) labels.set(a.id, a.tooltip ?? '');
    }
    for (const ce of body.matchAll(/<ColorMapEntry\b([^>]*)\/?>/g)) {
      const a = attrs(ce[1]);
      const rgb = (a.rgb ?? '0,0,0').split(',').map(Number) as [number, number, number];
      const nodata = a.nodata === 'true';
      const transparent = a.transparent === 'true';
      const { min, max } = a.value ? parseInterval(a.value) : { min: NaN, max: NaN };
      const entry: ColormapEntry = {
        rgb,
        min,
        max,
        value: representativeValue(min, max),
        label: labels.get(a.ref ?? '') ?? a.label ?? a.value ?? '',
        nodata,
        transparent,
      };
      if (nodata || !a.value) result.nodata.push(entry);
      else result.entries.push(entry);
    }
    if (!mapAttrs.title?.toLowerCase().includes('no data') && mapAttrs.units !== undefined) {
      result.title = mapAttrs.title ?? '';
      result.units = mapAttrs.units ?? '';
    }
  }
  result.entries.sort((x, y) => x.value - y.value);
  return result;
}
