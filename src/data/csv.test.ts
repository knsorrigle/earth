import { describe, expect, it } from 'vitest';
import { parseCsv, toAnnualSeries } from './csv';

const NSIDC_SAMPLE = `year, mo,source_dataset, region, extent,   area
1979,  9,    NSIDC-0051,      N,   7.05,   4.58
1981,  9,    NSIDC-0051,      N,   7.14,   4.44
1980,  9,    NSIDC-0051,      N,   7.67,   4.87
1982,  9,    NSIDC-0051,      N,-9999,-9999
`;

describe('parseCsv', () => {
  it('trims padded headers and cells', () => {
    const rows = parseCsv(NSIDC_SAMPLE);
    expect(rows).toHaveLength(4);
    expect(rows[0]).toMatchObject({ year: '1979', extent: '7.05', source_dataset: 'NSIDC-0051' });
  });

  it('returns [] for empty input', () => {
    expect(parseCsv('')).toEqual([]);
    expect(parseCsv('\n\n')).toEqual([]);
  });
});

describe('toAnnualSeries', () => {
  it('sorts by year and drops sentinel values', () => {
    const series = toAnnualSeries(parseCsv(NSIDC_SAMPLE), 'year', 'extent');
    expect(series).toEqual([
      { year: 1979, value: 7.05 },
      { year: 1980, value: 7.67 },
      { year: 1981, value: 7.14 },
    ]);
  });
});
