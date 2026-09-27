import { referencePhrase } from './timeline';
import type { MappingConfig } from './types';

/** Plain-words description of the sound mapping, one idea per line. */
export function describeMapping(cfg: MappingConfig): string[] {
  const ref = referencePhrase(cfg);
  const up = cfg.invert ? cfg.lowerMeans : cfg.higherMeans;
  const down = cfg.invert ? cfg.higherMeans : cfg.lowerMeans;
  return [
    `Each note is one year.`,
    `Higher pitch means ${up}; lower pitch means ${down}.`,
    `The steady hum is the level of ${ref}. Notes lower than the hum are below ${ref}.`,
    `Louder notes are further from ${ref}.`,
  ];
}

/** Plain-words description of Explore mode sounds. */
export function describeExploreMapping(cfg: MappingConfig, encoding: 'colormap' | 'presence' = 'colormap'): string[] {
  if (encoding === 'presence') {
    return [
      `Move over the map to hear fires near the cursor, within about 250 kilometres.`,
      `Crackling means active fire; faster, brighter crackling means more fire.`,
      `West sounds in your left ear, east in your right.`,
      `Quiet means land with no fires detected; a soft rushing sound means ocean.`,
    ];
  }
  const up = cfg.invert ? cfg.lowerMeans : cfg.higherMeans;
  const down = cfg.invert ? cfg.higherMeans : cfg.lowerMeans;
  return [
    `Move over the map to hear the value under the cursor.`,
    `Higher pitch means ${up}; lower pitch means ${down}.`,
    `West sounds in your left ear, east in your right.`,
    `A soft rushing sound means land or no data.`,
  ];
}

/** Plain-words description of Scanner mode sounds. */
export function describeScannerMapping(cfg: MappingConfig, bands: number, encoding: 'colormap' | 'presence' = 'colormap'): string[] {
  if (encoding === 'presence') {
    return [
      `A line sweeps the map from west to east; it moves from your left ear to your right.`,
      `At each step, every latitude band with fires plays a note, strummed from north to south, up to ${bands} at once.`,
      `Northern bands play higher, southern bands lower.`,
      `Louder notes, and higher notes within a band, mean more fire. Silence means no fires detected.`,
    ];
  }
  const up = cfg.invert ? cfg.lowerMeans : cfg.higherMeans;
  return [
    `A line sweeps the map from west to east; it moves from your left ear to your right.`,
    `At each step you hear up to ${bands} notes strummed from north to south, one per latitude band.`,
    `Northern bands play higher, southern bands lower.`,
    `Within a band, a higher note means ${up} than elsewhere at that latitude.`,
    `Quieter notes are partly land; missing notes are land.`,
  ];
}
