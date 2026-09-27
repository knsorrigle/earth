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

export interface FrameSpec {
  /** Pixel size requested from GIBS. Matches the product's native grid where possible. */
  width: number;
  height: number;
  /** [west, south, east, north] */
  bbox: [number, number, number, number];
  /**
   * How pixel colours encode data:
   * - colormap: invert the GIBS colormap to a value per pixel
   * - presence: a single marker colour means "detected" (e.g. fire points); no colour means none
   */
  encoding: 'colormap' | 'presence';
  /** Bundled fallback copy of the colormap XML (under /public). colormap encoding only. */
  colormapFallback?: string;
  /** Marker colour for presence layers, as rendered by the GIBS WMS style. */
  presenceRgb?: [number, number, number];
  /** WMS style to request (presence layers use point styles such as "size5"). */
  wmsStyle?: string;
  /** Static basemap drawn beneath sparse layers; also used as a land/water mask. */
  basemap?: string;
  /** Dates with a bundled fallback frame in /public/frames/<layer>/<date>.png. */
  cachedDates: string[];
  defaultDate: string;
  /** Meaning of values below the colormap's lowest bin, if any. */
  belowRangeMeans?: string;
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
  /** Global map frames from GIBS (Explore / Scanner modes). */
  frame?: FrameSpec;
  /** Parsed annual time series, sorted by year. */
  timeSeries?: TimeSeriesPoint[];
  dateRange: { start: string; end: string };
  description: string;
  /** Text alternative for the visual representation of this dataset. */
  altText: string;
  /** How values become sound. */
  mapping: MappingConfig;
}
