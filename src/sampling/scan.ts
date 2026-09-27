import { NO_DATA } from './inverter';
import { pixelToLatLon, type ValueGrid } from './grid';
import { speakLon } from './geo';

export interface LatBand {
  index: number;
  north: number;
  south: number;
  /** "67.5° N to 45° N" */
  name: string;
}

/** Area-weighted summary of one band within one scan column. */
export interface BandCell {
  /** Mean value over cells with data; null if the cell is all land / no data. */
  mean: number | null;
  /** Fraction (area-weighted) of the cell that has data, 0..1. */
  coverage: number;
}

export interface ScanColumn {
  index: number;
  west: number;
  east: number;
  /** Centre longitude. */
  lon: number;
  /** One cell per band, north to south. */
  cells: BandCell[];
}

export interface ScanPlan {
  bands: LatBand[];
  columns: ScanColumn[];
  /** Min / max of the cell means per band across the whole frame (NaN if the band has no data). */
  bandRanges: { min: number; max: number }[];
  /** Same, over strictly positive means only (for log-scaled presence layers). */
  positiveRanges: { min: number; max: number }[];
}

function fmtLat(v: number): string {
  if (v === 0) return '0°';
  return `${Math.abs(v)}° ${v > 0 ? 'N' : 'S'}`;
}

/** n equal latitude bands, north to south. */
export function latBands(n: number): LatBand[] {
  const h = 180 / n;
  return Array.from({ length: n }, (_, i) => {
    const north = 90 - i * h;
    const south = 90 - (i + 1) * h;
    return { index: i, north, south, name: `${fmtLat(north)} to ${fmtLat(south)}` };
  });
}

/**
 * Pre-compute everything the scanner needs for one frame: per column, per
 * band, the area-weighted mean value and ocean coverage. Done once per frame
 * so playback only reads a small table.
 */
export function planScan(grid: ValueGrid, columnCount: number, bandCount: number): ScanPlan {
  const bands = latBands(bandCount);
  const { width, height } = grid;
  const entries = grid.colormap.entries;

  // Row -> band index and area weight.
  const rowBand = new Int16Array(height);
  const rowWeight = new Float64Array(height);
  for (let y = 0; y < height; y++) {
    const { lat } = pixelToLatLon(grid, 0, y);
    rowWeight[y] = Math.cos((lat * Math.PI) / 180);
    rowBand[y] = Math.min(bandCount - 1, Math.floor(((90 - lat) / 180) * bandCount));
  }

  const columns: ScanColumn[] = [];
  const colDeg = 360 / columnCount;
  for (let c = 0; c < columnCount; c++) {
    const x0 = Math.floor((c / columnCount) * width);
    const x1 = Math.floor(((c + 1) / columnCount) * width);
    const wAll = new Float64Array(bandCount);
    const wData = new Float64Array(bandCount);
    const vSum = new Float64Array(bandCount);
    for (let y = 0; y < height; y++) {
      const b = rowBand[y];
      const w = rowWeight[y];
      const row = y * width;
      for (let x = x0; x < x1; x++) {
        wAll[b] += w;
        const bin = grid.bins[row + x];
        if (bin === NO_DATA) continue;
        wData[b] += w;
        vSum[b] += entries[bin].value * w;
      }
    }
    const west = -180 + c * colDeg;
    columns.push({
      index: c,
      west,
      east: west + colDeg,
      lon: west + colDeg / 2,
      cells: bands.map((_, b) => ({
        mean: wData[b] > 0 ? vSum[b] / wData[b] : null,
        coverage: wAll[b] > 0 ? wData[b] / wAll[b] : 0,
      })),
    });
  }

  const rangeOf = (b: number, keep: (m: number) => boolean) => {
    let min = Infinity;
    let max = -Infinity;
    for (const col of columns) {
      const m = col.cells[b].mean;
      if (m === null || !keep(m)) continue;
      if (m < min) min = m;
      if (m > max) max = m;
    }
    return Number.isFinite(min) ? { min, max } : { min: NaN, max: NaN };
  };
  const bandRanges = bands.map((_, b) => rangeOf(b, () => true));
  const positiveRanges = bands.map((_, b) => rangeOf(b, (m) => m > 0));

  return { bands, columns, bandRanges, positiveRanges };
}

/** Column index for a longitude. */
export function columnAt(plan: ScanPlan, lon: number): number {
  const n = plan.columns.length;
  const wrapped = ((((lon + 180) % 360) + 360) % 360) / 360;
  return Math.min(n - 1, Math.floor(wrapped * n));
}

/** Spoken summary of one column: every band's value and ocean share. */
export function describeColumn(plan: ScanPlan, column: number, unitSpoken: string, decimals: number, presence = false): string {
  const col = plan.columns[column];
  const parts = col.cells.map((cell, b) => {
    const name = plan.bands[b].name;
    if (presence) {
      return cell.mean && cell.mean > 0 ? `${name}: fire on ${(cell.mean * 100).toFixed(2)} percent of the area` : `${name}: no fires`;
    }
    if (cell.mean === null || cell.coverage < 0.01) return `${name}: land or no data`;
    const pct = Math.round(cell.coverage * 100);
    return `${name}: ${cell.mean.toFixed(decimals)} ${unitSpoken}${pct < 95 ? `, ${pct} percent ocean` : ''}`;
  });
  return `At ${speakLon(col.lon, 1)}. ${parts.join('. ')}.`;
}

