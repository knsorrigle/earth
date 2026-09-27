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

export const DATASETS: Dataset[] = [arcticSeaIce];

export function getDataset(id: string): Dataset {
  const d = DATASETS.find((x) => x.id === id);
  if (!d) throw new Error(`Unknown dataset: ${id}`);
  return d;
}
