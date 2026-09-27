import type { GridStats } from './grid';
import type { ColormapEntry } from './colormap';
import { speakLatLon } from './geo';

export interface ValueWords {
  unitSpoken: string;
  decimals: number;
  /** Meaning of values below the colormap's lowest bound, e.g. "freezing seawater or sea ice". */
  belowRangeMeans?: string;
}

/** Spoken value for a colormap bin, honest about open-ended bins. */
export function speakEntry(entry: ColormapEntry | null, w: ValueWords): string {
  if (!entry) return 'Land or no data';
  const f = (v: number) => String(Number(v.toFixed(w.decimals)));
  if (!Number.isFinite(entry.min)) {
    return `Below ${f(entry.max)} ${w.unitSpoken}${w.belowRangeMeans ? `, ${w.belowRangeMeans}` : ''}`;
  }
  if (!Number.isFinite(entry.max)) return `${f(entry.min)} ${w.unitSpoken} or more`;
  return `About ${f(entry.value)} ${w.unitSpoken}`;
}

/** Short display value: "18.4", "< 0", "≥ 32". */
export function displayEntry(entry: ColormapEntry | null, decimals: number): string {
  if (!entry) return '—';
  if (!Number.isFinite(entry.min)) return `< ${Number(entry.max.toFixed(decimals))}`;
  if (!Number.isFinite(entry.max)) return `≥ ${Number(entry.min.toFixed(decimals))}`;
  return entry.value.toFixed(decimals);
}

const lowerFirst = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);

/** "Describe this map": a plain-language summary of a whole frame. */
export function describeFrame(stats: GridStats, what: string, date: string, w: ValueWords): string {
  const f = (v: number) => v.toFixed(w.decimals);
  const parts = [
    `${what} on ${date}.`,
    `About ${Math.round(stats.coverage * 100)} percent of the globe has data; the rest is land or no data.`,
  ];
  if (Number.isFinite(stats.mean)) parts.push(`Average: ${f(stats.mean)} ${w.unitSpoken}.`);
  if (stats.max) parts.push(`Warmest: ${lowerFirst(speakEntry(stats.max.entry, w))}, near ${speakLatLon(stats.max.lat, stats.max.lon, 0)}.`);
  if (stats.min) parts.push(`Coldest: ${lowerFirst(speakEntry(stats.min.entry, w))}, near ${speakLatLon(stats.min.lat, stats.min.lon, 0)}.`);
  const zones = stats.zones.filter((z) => Number.isFinite(z.mean));
  if (zones.length) parts.push(`By region: ${zones.map((z) => `${z.name}, ${f(z.mean)}`).join('; ')}.`);
  return parts.join(' ');
}
