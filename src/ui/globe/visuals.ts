import type { NoteVisual } from '../../audio/noteBus';
import type { Dataset } from '../../data/types';
import { paletteColor } from '../../globe/colors';
import { normalize } from '../../mapping/pitch';

/** A time-series value as a ripple: at the record's place, coloured by its palette. */
export function seriesVisual(ds: Dataset, value: number, velocity: number): NoteVisual {
  const t = normalize(value, ds.mapping.domain);
  return {
    lat: ds.place?.lat,
    lon: ds.place?.lon,
    color: ds.palette ? paletteColor(ds.palette, t) : [0.9, 0.95, 1],
    velocity,
  };
}
