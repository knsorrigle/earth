import type { NoteEvent, ReferenceTone } from '../mapping/types';

export interface AnnounceUnit {
  unitSpoken: string;
  decimals: number;
}

/** "Year 2012, 3.57 million square kilometres" */
export function pointAnnouncement(ev: Pick<NoteEvent, 'year' | 'value'>, u: AnnounceUnit): string {
  return `Year ${ev.year}, ${ev.value.toFixed(u.decimals)} ${u.unitSpoken}`;
}

/** "3.48 below 1979" / "0.62 above the 1951–1980 average" / "same as 1979" */
export function relationToReference(ev: Pick<NoteEvent, 'deviation'>, ref: ReferenceTone, decimals: number): string {
  const d = Number(ev.deviation.toFixed(decimals));
  if (d === 0) return `same as ${ref.phrase}`;
  return `${Math.abs(d).toFixed(decimals)} ${d < 0 ? 'below' : 'above'} ${ref.phrase}`;
}

/** Longer form used when paused or stepping: includes relation to the reference. */
export function detailedAnnouncement(ev: NoteEvent, ref: ReferenceTone, u: AnnounceUnit): string {
  return `${pointAnnouncement(ev, u)}, ${relationToReference(ev, ref, u.decimals)}`;
}

/**
 * Whether to announce a point during playback.
 * every = 0 disables periodic announcements (first/last still announced so
 * the listener knows where playback starts and ends).
 */
export function shouldAnnounce(ev: Pick<NoteEvent, 'year' | 'index'>, every: number, total: number): boolean {
  if (ev.index === 0 || ev.index === total - 1) return true;
  if (every <= 0) return false;
  return ev.year % every === 0;
}
