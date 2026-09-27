import type { TimeSeriesPoint } from './types';

/**
 * Plain-language text alternative for a time series chart:
 * start, end, extremes and net change.
 */
export function describeSeries(
  series: TimeSeriesPoint[],
  what: string,
  unitSpoken: string,
  decimals: number,
): string {
  if (series.length === 0) return `No data for ${what}.`;
  const first = series[0];
  const last = series[series.length - 1];
  const min = series.reduce((a, b) => (b.value < a.value ? b : a));
  const max = series.reduce((a, b) => (b.value > a.value ? b : a));
  const f = (v: number) => v.toFixed(decimals);
  const change = last.value - first.value;
  const pct = first.value !== 0 ? Math.round((change / first.value) * 100) : 0;
  const dir = change < 0 ? 'fell' : change > 0 ? 'rose' : 'stayed the same';
  return (
    `Line chart of ${what}, ${first.year} to ${last.year}. ` +
    `It starts at ${f(first.value)} ${unitSpoken} in ${first.year} and ends at ${f(last.value)} in ${last.year}; ` +
    `overall it ${dir}${change !== 0 ? ` by ${f(Math.abs(change))} (${Math.abs(pct)} percent)` : ''}. ` +
    `Highest: ${f(max.value)} in ${max.year}. Lowest: ${f(min.value)} in ${min.year}.`
  );
}
