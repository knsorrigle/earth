import type { Dataset, TimeSeriesPoint } from './types';
import { parseCsv, toAnnualSeries } from './csv';
import { describeSeries } from './describe';
import seaIceCsv from './raw/N_09_extent_v4.0.csv?raw';

function rangeOf(series: TimeSeriesPoint[]) {
  return { start: String(series[0].year), end: String(series[series.length - 1].year) };
}

const seaIceSeries = toAnnualSeries(parseCsv(seaIceCsv), 'year', 'extent');

export const arcticSeaIce: Dataset = {
  id: 'arctic-sea-ice-september',
  title: 'Arctic Sea Ice',
  unit: 'million km²',
  unitSpoken: 'million square kilometres',
  decimals: 2,
  source: {
    name: 'NSIDC Sea Ice Index, Version 4 (G02135)',
    url: 'https://nsidc.org/data/g02135/versions/4',
    dataUrl: 'https://noaadata.apps.nsidc.org/NOAA/G02135/north/monthly/data/N_09_extent_v4.0.csv',
    citation:
      'Fetterer, F., Knowles, K., Meier, W. N., Savoie, M., Windnagel, A. K. & Stafford, T. (2025). ' +
      'Sea Ice Index. (G02135, Version 4). [Data Set]. Boulder, Colorado USA. ' +
      'National Snow and Ice Data Center. https://doi.org/10.7265/a98x-0f50',
    subset: 'Northern Hemisphere, September monthly mean extent (the annual minimum month).',
  },
  timeSeries: seaIceSeries,
  dateRange: rangeOf(seaIceSeries),
  description:
    'How much of the Arctic Ocean is still covered by ice at the end of each summer. ' +
    'September is when the ice reaches its yearly minimum, so it is the clearest signal of long-term melt.',
  altText: describeSeries(seaIceSeries, 'Arctic sea ice extent each September', 'million square kilometres', 2),
  mapping: {
    domain: [3, 8],
    midiRange: [50, 79],
    scale: 'minorPentatonic',
    root: 57, // A3
    referenceYear: 1979,
    higherMeans: 'more sea ice',
    lowerMeans: 'less sea ice',
  },
};

/** Latest date GIBS is likely to have (MUR25 is published with a ~1–2 day lag). */
function recentDate(daysAgo: number): string {
  const d = new Date(Date.now() - daysAgo * 86400000);
  return d.toISOString().slice(0, 10);
}

export const seaSurfaceTemperature: Dataset = {
  id: 'sea-surface-temperature',
  title: 'Sea Surface Temperature',
  unit: '°C',
  unitSpoken: 'degrees Celsius',
  decimals: 1,
  source: {
    name: 'GHRSST Level 4 MUR 0.25° Global Foundation SST Analysis v4.2, via NASA GIBS',
    url: 'https://podaac.jpl.nasa.gov/dataset/MUR25-JPL-L4-GLOB-v04.2',
    dataUrl: 'https://gibs.earthdata.nasa.gov/wms/epsg4326/best/wms.cgi',
    citation:
      'JPL MUR MEaSUREs Project (2019). GHRSST Level 4 MUR 0.25deg Global Foundation Sea Surface Temperature ' +
      'Analysis (v4.2). NASA/JPL. https://doi.org/10.5067/GHM25-4FJ42. Imagery from NASA GIBS, ' +
      'layer GHRSST_L4_MUR25_Sea_Surface_Temperature.',
    subset: 'Daily global map, colours converted back to temperature using the GIBS colormap (0.15 °C steps).',
  },
  // Verified in the GIBS EPSG:4326 WMTS capabilities (2026-09-28): time range 2002-09-01 to present, daily.
  gibsLayerId: 'GHRSST_L4_MUR25_Sea_Surface_Temperature',
  colormap: 'https://gibs.earthdata.nasa.gov/colormaps/v1.3/GHRSST_Sea_Surface_Temperature.xml',
  frame: {
    width: 1440,
    height: 720,
    bbox: [-180, -90, 180, 90],
    colormapFallback: 'colormaps/GHRSST_Sea_Surface_Temperature.xml',
    cachedDates: ['2025-09-01', '2026-03-01', '2026-09-01'],
    defaultDate: '2026-09-01',
    belowRangeMeans: 'freezing seawater or sea ice',
  },
  dateRange: { start: '2002-09-01', end: recentDate(2) },
  description:
    'The temperature of the ocean surface, from a daily gap-free analysis that blends several satellites. ' +
    'Warm water fuels storms and coral bleaching; cold currents carry nutrients.',
  altText:
    'World map of sea surface temperature. Tropical oceans are warmest, shading to cold water near the poles. Land is dark.',
  mapping: {
    domain: [-2, 32],
    midiRange: [45, 84],
    scale: 'majorPentatonic',
    root: 60, // C
    referenceYear: 0, // no reference drone in Explore mode
    higherMeans: 'warmer water',
    lowerMeans: 'colder water',
  },
};

export const DATASETS: Dataset[] = [arcticSeaIce, seaSurfaceTemperature];

export function getDataset(id: string): Dataset {
  const d = DATASETS.find((x) => x.id === id);
  if (!d) throw new Error(`Unknown dataset: ${id}`);
  return d;
}
