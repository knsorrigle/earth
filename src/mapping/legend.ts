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
