import type { MappingConfig } from './types';

/** Plain-words description of the sound mapping, one idea per line. */
export function describeMapping(cfg: MappingConfig): string[] {
  const up = cfg.invert ? cfg.lowerMeans : cfg.higherMeans;
  const down = cfg.invert ? cfg.higherMeans : cfg.lowerMeans;
  return [
    `Each note is one year.`,
    `Higher pitch means ${up}; lower pitch means ${down}.`,
    `The steady hum is tuned to the ${cfg.referenceYear} level. Notes lower than the hum are below ${cfg.referenceYear}.`,
    `Louder notes are further from the ${cfg.referenceYear} level.`,
  ];
}

/** Plain-words description of Explore mode sounds. */
export function describeExploreMapping(cfg: MappingConfig): string[] {
  const up = cfg.invert ? cfg.lowerMeans : cfg.higherMeans;
  const down = cfg.invert ? cfg.higherMeans : cfg.lowerMeans;
  return [
    `Move over the map to hear the value under the cursor.`,
    `Higher pitch means ${up}; lower pitch means ${down}.`,
    `West sounds in your left ear, east in your right.`,
    `A soft rushing sound means land or no data.`,
  ];
}
