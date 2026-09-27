import type { MappingConfig } from '../../mapping/types';

/** One number shown in the value corner. `voice` tints it for Duet (a = mallet, b = bell). */
export interface HudValue {
  label?: string;
  value: string;
  unit: string;
  /** Spoken form, e.g. "7.05 million square kilometres". */
  spoken: string;
  delta?: string;
  voice?: 'a' | 'b';
}

/** What the bottom scrubber shows. Every tick is driven by data. */
export type HudScrub =
  | {
      kind: 'years';
      years: number[];
      /** 0..1 heights per year (the value, normalised). A second series for Duet. */
      heights: number[];
      heightsB?: number[];
      index: number;
      /** Called with a year index when the listener drags the groove. */
      onSeek?: (index: number) => void;
    }
  | {
      kind: 'lon';
      /** Current longitude, -180..180. */
      lon: number;
      /** Optional 0..1 tick heights per column (e.g. how many scanner bands sound). */
      heights?: number[];
      onSeek?: (lon: number) => void;
    }
  | { kind: 'progress'; results: (boolean | null)[]; current: number };

export interface HudState {
  mode: string;
  dataset: string;
  date: string;
  source?: string;
  values: HudValue[];
  place: string;
  /** Spoken form of the place. */
  placeSpoken?: string;
  legend: string[];
  scrub: HudScrub | null;
}

/** Everything in the HUD as one sentence set, for the H key / screen readers. */
export function hudSummary(h: HudState): string {
  const vals = h.values
    .map((v) => `${v.label ? `${v.label}: ` : ''}${v.spoken}${v.delta ? `, ${v.delta}` : ''}`)
    .join('. ');
  const parts = [
    `${h.mode}. ${h.dataset}.`,
    h.date ? `Date: ${h.date}${h.source ? `, ${h.source}` : ''}.` : '',
    vals ? `${vals}.` : '',
    h.place ? `Place: ${h.placeSpoken ?? h.place}.` : '',
    h.legend.length ? `Legend: ${h.legend.join('; ')}.` : '',
  ];
  return parts.filter(Boolean).join(' ');
}

/** Short plain-words legend lines for the HUD strip. */
export function shortLegend(
  kind: 'timeline' | 'explore' | 'scanner' | 'duet' | 'eartest',
  cfg: MappingConfig | null,
  extra: { refLabel?: string; presence?: boolean; titleA?: string; titleB?: string } = {},
): string[] {
  const up = cfg ? (cfg.invert ? cfg.lowerMeans : cfg.higherMeans) : '';
  switch (kind) {
    case 'timeline':
      return [`higher pitch = ${up}`, `hum = ${extra.refLabel ?? 'reference'}`, 'one note = one year'];
    case 'explore':
      return extra.presence
        ? ['crackle = fire nearby', 'faster = more fire', 'left / right = west / east', 'wash = ocean']
        : [`higher pitch = ${up}`, 'left / right = west / east', 'rushing = land'];
    case 'scanner':
      return extra.presence
        ? ['north = higher strings', 'louder = more fire', 'silence = no fire']
        : ['north = higher strings', `higher in a band = ${up}`, 'gaps = land'];
    case 'duet':
      return [`mallet · left = ${extra.titleA ?? 'A'}`, `bell · right = ${extra.titleB ?? 'B'}`, 'higher = more'];
    case 'eartest':
      return ['first clip = left ear', 'second clip = right ear', '← / → to answer'];
  }
}

/** Normalise values to 0..1 for groove heights (flat series -> 0.5). */
export function normaliseHeights(values: number[]): number[] {
  if (values.length === 0) return [];
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  return values.map((v) => (hi === lo ? 0.5 : (v - lo) / (hi - lo)));
}
