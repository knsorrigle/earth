import type { MappingConfig } from '../mapping/types';

export interface TimeSeriesPoint {
  /** Calendar year of the observation. */
  year: number;
  value: number;
}

export interface DataSource {
  /** Short human name shown in the UI. */
  name: string;
  /** Landing page for the dataset. */
  url: string;
  /** Exact file the bundled data was taken from. */
  dataUrl?: string;
  /** Formal citation as requested by the data provider. */
  citation: string;
  /** Subset of the product actually used. */
  subset?: string;
}

export interface Dataset {
  id: string;
  title: string;
  /** Unit as displayed, e.g. "million km²". */
  unit: string;
  /** Unit as it should be read aloud, e.g. "million square kilometres". */
  unitSpoken: string;
  /** Number of decimals to show and speak. */
  decimals: number;
  source: DataSource;
  /** GIBS layer identifier (Phase 2+). Verified against GIBS docs, never guessed. */
  gibsLayerId?: string;
  /** URL of the GIBS colormap XML for the layer (Phase 2+). */
  colormap?: string;
  /** Parsed annual time series, sorted by year. */
  timeSeries?: TimeSeriesPoint[];
  dateRange: { start: string; end: string };
  description: string;
  /** Text alternative for the visual representation of this dataset. */
  altText: string;
  /** How values become sound. */
  mapping: MappingConfig;
}
