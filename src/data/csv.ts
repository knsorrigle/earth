/**
 * Minimal CSV parser for the simple, unquoted numeric CSVs published by
 * NSIDC / NOAA / NASA. Headers and cells are trimmed (NSIDC pads with spaces).
 */
export function parseCsv(text: string): Record<string, string>[] {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.startsWith('#'));
  if (lines.length === 0) return [];
  const headers = lines[0].split(',').map((h) => h.trim());
  return lines.slice(1).map((line) => {
    const cells = line.split(',').map((c) => c.trim());
    const row: Record<string, string> = {};
    headers.forEach((h, i) => {
      row[h] = cells[i] ?? '';
    });
    return row;
  });
}

/**
 * Extract a clean annual series from parsed rows. Rows with missing or
 * sentinel values (NSIDC uses -9999) are dropped. Result is sorted by year.
 */
export function toAnnualSeries(
  rows: Record<string, string>[],
  yearColumn: string,
  valueColumn: string,
  isMissing: (v: number) => boolean = (v) => v <= -999,
): { year: number; value: number }[] {
  return rows
    .map((r) => ({ year: Number(r[yearColumn]), value: Number(r[valueColumn]) }))
    .filter((p) => Number.isFinite(p.year) && Number.isFinite(p.value) && !isMissing(p.value))
    .sort((a, b) => a.year - b.year);
}
