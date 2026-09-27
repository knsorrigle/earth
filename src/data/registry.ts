import type { Dataset, TimeSeriesPoint } from './types';
import { parseCsv, toAnnualSeries } from './csv';
import { describeSeries } from './describe';
import seaIceCsv from './raw/N_09_extent_v4.0.csv?raw';
import gistempCsv from './raw/GLB.Ts+dSST.csv?raw';
import co2Csv from './raw/co2_annmean_mlo.csv?raw';

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
    encoding: 'colormap',
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

const gistempSeries = toAnnualSeries(parseCsv(gistempCsv, { headerStartsWith: 'Year,' }), 'Year', 'J-D');

export const globalTemperature: Dataset = {
  id: 'global-temperature',
  title: 'Global Temperature',
  unit: '°C',
  unitSpoken: 'degrees Celsius',
  decimals: 2,
  source: {
    name: 'NASA GISS Surface Temperature Analysis (GISTEMP v4)',
    url: 'https://data.giss.nasa.gov/gistemp/',
    dataUrl: 'https://data.giss.nasa.gov/gistemp/tabledata_v4/GLB.Ts+dSST.csv',
    citation:
      'GISTEMP Team, 2026: GISS Surface Temperature Analysis (GISTEMP), version 4. NASA Goddard Institute for Space ' +
      'Studies. Dataset accessed 2026-09-28 at https://data.giss.nasa.gov/gistemp/. Lenssen, N., G.A. Schmidt, ' +
      'M. Hendrickson, P. Jacobs, M. Menne, and R. Ruedy, 2024: A GISTEMPv4 observational uncertainty ensemble. ' +
      'J. Geophys. Res. Atmos., 129, no. 17, e2023JD040179, doi:10.1029/2023JD040179.',
    subset: 'Global land–ocean annual mean (J–D), as the difference from the 1951–1980 average. The current year is left out until it is complete.',
  },
  timeSeries: gistempSeries,
  dateRange: rangeOf(gistempSeries),
  description:
    'How much warmer or cooler each year was across the whole planet, land and ocean together, compared with the 1951–1980 average.',
  altText: describeSeries(gistempSeries, 'global temperature difference from the 1951–1980 average', 'degrees Celsius', 2, { percent: false }),
  mapping: {
    domain: [-0.6, 1.4],
    midiRange: [50, 79],
    scale: 'minorPentatonic',
    root: 57,
    referenceYear: 1951,
    referenceValue: 0,
    referenceLabel: '1951–1980 average',
    higherMeans: 'a warmer year',
    lowerMeans: 'a cooler year',
  },
};

const co2Series = toAnnualSeries(parseCsv(co2Csv), 'year', 'mean');

export const carbonDioxide: Dataset = {
  id: 'co2-mauna-loa',
  title: 'Carbon Dioxide (CO₂)',
  unit: 'ppm',
  unitSpoken: 'parts per million',
  decimals: 1,
  source: {
    name: 'NOAA Global Monitoring Laboratory — Mauna Loa CO₂ annual mean',
    url: 'https://gml.noaa.gov/ccgg/trends/',
    dataUrl: 'https://gml.noaa.gov/webdata/ccgg/trends/co2/co2_annmean_mlo.csv',
    citation:
      'Dr. Xin Lan, NOAA/GML (gml.noaa.gov/ccgg/trends/) and Dr. Ralph Keeling, Scripps Institution of Oceanography (scrippsco2.ucsd.edu/).',
    subset:
      'Annual mean at Mauna Loa Observatory, Hawaii. December 2022 to July 2023 were measured at nearby Maunakea after the Mauna Loa eruption.',
  },
  timeSeries: co2Series,
  dateRange: rangeOf(co2Series),
  description:
    'Carbon dioxide in the air, measured on a Hawaiian volcano since 1958: the longest direct record of the gas that drives global warming.',
  altText: describeSeries(co2Series, 'carbon dioxide at Mauna Loa, yearly average', 'parts per million', 1),
  mapping: {
    domain: [310, 430],
    midiRange: [50, 79],
    scale: 'minorPentatonic',
    root: 57,
    referenceYear: 1959,
    higherMeans: 'more carbon dioxide',
    lowerMeans: 'less carbon dioxide',
  },
};

export const activeFires: Dataset = {
  id: 'active-fires',
  title: 'Active Fires',
  unit: '% of area',
  unitSpoken: 'percent of the area',
  decimals: 2,
  source: {
    name: 'MODIS Thermal Anomalies / Fire locations (Terra + Aqua, FIRMS NRT), via NASA GIBS',
    url: 'https://firms.modaps.eosdis.nasa.gov/',
    dataUrl: 'https://gibs.earthdata.nasa.gov/wms/epsg4326/best/wms.cgi',
    citation:
      'LANCE MODIS (2021). MODIS/Aqua Terra Thermal Anomalies/Fire locations 1km FIRMS NRT (Vector data), version 6.1NRT. ' +
      'NASA/GSFC. https://doi.org/10.5067/FIRMS/MODIS/MCD14DL.NRT.0061. Imagery from NASA GIBS, layer ' +
      'MODIS_Combined_Thermal_Anomalies_All; land/water basemap: GIBS OSM_Land_Water_Map (© OpenStreetMap contributors).',
    subset:
      'Daily fire detections drawn by GIBS as points. The app measures how much of each area is covered by detection points — a relative index of fire activity, not a count of fires.',
  },
  // Verified in the GIBS EPSG:4326 capabilities (2026-09-28): WMS styles size5/size10, daily, 2000-11-01 to present.
  gibsLayerId: 'MODIS_Combined_Thermal_Anomalies_All',
  frame: {
    width: 1440,
    height: 720,
    bbox: [-180, -90, 180, 90],
    encoding: 'presence',
    presenceRgb: [236, 98, 16],
    wmsStyle: 'size5',
    basemap: 'basemaps/OSM_Land_Water_Map.png',
    cachedDates: ['2025-09-01', '2026-03-01', '2026-09-01'],
    defaultDate: '2026-09-01',
  },
  dateRange: { start: '2000-11-01', end: recentDate(1) },
  description:
    'Places where satellites saw unusually hot spots that day — mostly wildfires and farm burning. More crackle means more fire nearby.',
  altText: 'World map of fire detections shown as orange points on dark land.',
  mapping: {
    // Fire activity is sonified on a log scale of marked-area fraction: 0.1% .. 50%.
    // (GIBS draws each detection as a ~5 px dot, so busy regions reach tens of percent.)
    domain: [-3, -0.3],
    midiRange: [55, 86],
    scale: 'majorPentatonic',
    root: 60,
    referenceYear: 0,
    higherMeans: 'more fire',
    lowerMeans: 'less fire',
  },
};

export const DATASETS: Dataset[] = [arcticSeaIce, globalTemperature, carbonDioxide, seaSurfaceTemperature, activeFires];

export const TIMELINE_DATASETS = DATASETS.filter((d) => d.timeSeries);
export const MAP_DATASETS = DATASETS.filter((d) => d.frame);

export function getDataset(id: string): Dataset {
  const d = DATASETS.find((x) => x.id === id);
  if (!d) throw new Error(`Unknown dataset: ${id}`);
  return d;
}
