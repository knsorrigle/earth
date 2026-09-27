import { useMemo, useRef } from 'react';
import type { Dataset } from '../../data/types';
import type { DuetStep } from '../../mapping/duet';
import { useElementWidth } from '../useElementWidth';

interface Props {
  dsA: Dataset;
  dsB: Dataset;
  steps: DuetStep[];
  index: number;
  describedBy: string;
  valueText: string;
  onSeek: (index: number, opts?: { announce?: boolean; audition?: boolean }) => void;
  onScrubEnd: () => void;
}

const HEIGHT = 280;
const M = { top: 20, right: 52, bottom: 34, left: 52 };

function niceTicks(lo: number, hi: number, count = 4): number[] {
  const span = hi - lo || 1;
  const raw = span / count;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => span / s <= count + 1) ?? raw;
  const out: number[] = [];
  for (let v = Math.ceil(lo / step) * step; v <= hi + 1e-9; v += step) out.push(Number(v.toFixed(6)));
  return out;
}

/**
 * Two records on one time axis, each with its own vertical scale (A on the
 * left axis, B on the right). Doubles as the timeline slider.
 */
export function DuetChart({ dsA, dsB, steps, index, describedBy, valueText, onSeek, onScrubEnd }: Props) {
  const [wrapRef, width] = useElementWidth<HTMLDivElement>();
  const dragging = useRef(false);
  const lastIdx = useRef(-1);

  const geo = useMemo(() => {
    const w = Math.max(240, width);
    const innerW = w - M.left - M.right;
    const innerH = HEIGHT - M.top - M.bottom;
    const x0 = steps[0]?.year ?? 0;
    const x1 = steps[steps.length - 1]?.year ?? 1;
    const x = (year: number) => M.left + ((year - x0) / Math.max(1, x1 - x0)) * innerW;
    const scale = (vals: number[]) => {
      const lo = Math.min(...vals);
      const hi = Math.max(...vals);
      const pad = (hi - lo) * 0.08 || 1;
      return { lo: lo - pad, hi: hi + pad };
    };
    const sa = scale(steps.map((s) => s.a.value));
    const sb = scale(steps.map((s) => s.b.value));
    const ya = (v: number) => M.top + (1 - (v - sa.lo) / (sa.hi - sa.lo)) * innerH;
    const yb = (v: number) => M.top + (1 - (v - sb.lo) / (sb.hi - sb.lo)) * innerH;
    const path = (y: (v: number) => number, pick: (s: DuetStep) => number) =>
      steps.map((s, i) => `${i ? 'L' : 'M'}${x(s.year).toFixed(1)},${y(pick(s)).toFixed(1)}`).join('');
    const stepYears = innerW < 420 ? 20 : 10;
    return {
      w,
      innerW,
      innerH,
      x,
      ya,
      yb,
      x0,
      x1,
      pathA: path(ya, (s) => s.a.value),
      pathB: path(yb, (s) => s.b.value),
      ticksA: niceTicks(sa.lo, sa.hi),
      ticksB: niceTicks(sb.lo, sb.hi),
      xTicks: steps.map((s) => s.year).filter((y) => y % stepYears === 0),
    };
  }, [width, steps]);

  const cur = steps[Math.min(index, steps.length - 1)];
  if (!cur) return null;
  const px = geo.x(cur.year);

  const indexAt = (clientX: number, el: Element) => {
    const r = el.getBoundingClientRect();
    const t = (((clientX - r.left) / r.width) * geo.w - M.left) / geo.innerW;
    return Math.round(Math.max(0, Math.min(1, t)) * (steps.length - 1));
  };

  return (
    <figure className="chart">
      <div
        ref={wrapRef}
        className="chart-slider"
        role="slider"
        tabIndex={0}
        aria-label={`Duet timeline: ${dsA.title} and ${dsB.title}`}
        aria-valuemin={geo.x0}
        aria-valuemax={geo.x1}
        aria-valuenow={cur.year}
        aria-valuetext={valueText}
        aria-describedby={describedBy}
        onPointerDown={(e) => {
          dragging.current = true;
          e.currentTarget.setPointerCapture(e.pointerId);
          e.currentTarget.focus();
          lastIdx.current = indexAt(e.clientX, e.currentTarget);
          onSeek(lastIdx.current, { announce: false });
        }}
        onPointerMove={(e) => {
          if (!dragging.current) return;
          const i = indexAt(e.clientX, e.currentTarget);
          if (i !== lastIdx.current) {
            lastIdx.current = i;
            onSeek(i, { announce: false });
          }
        }}
        onPointerUp={() => {
          if (dragging.current) onScrubEnd();
          dragging.current = false;
        }}
        onPointerCancel={() => (dragging.current = false)}
      >
        <svg width={geo.w} height={HEIGHT} viewBox={`0 0 ${geo.w} ${HEIGHT}`} aria-hidden="true">
          <defs>
            <clipPath id="duet-played">
              <rect x={0} y={0} width={px} height={HEIGHT} />
            </clipPath>
          </defs>
          {geo.ticksA.map((v) => (
            <g key={`a${v}`}>
              <line className="grid" x1={M.left} x2={geo.w - M.right} y1={geo.ya(v)} y2={geo.ya(v)} />
              <text className="tick tick-a" x={M.left - 8} y={geo.ya(v)} dy="0.32em" textAnchor="end">
                {v}
              </text>
            </g>
          ))}
          {geo.ticksB.map((v) => (
            <text key={`b${v}`} className="tick tick-b" x={geo.w - M.right + 8} y={geo.yb(v)} dy="0.32em">
              {v}
            </text>
          ))}
          {geo.xTicks.map((yr) => (
            <text key={yr} className="tick" x={geo.x(yr)} y={HEIGHT - 12} textAnchor="middle">
              {yr}
            </text>
          ))}
          <text className="axis-label tick-a" x={M.left} y={12}>
            {dsA.unit}
          </text>
          <text className="axis-label tick-b" x={geo.w - M.right} y={12} textAnchor="end">
            {dsB.unit}
          </text>

          <path className="line-a line-dim" d={geo.pathA} />
          <path className="line-b line-dim" d={geo.pathB} />
          <g clipPath="url(#duet-played)">
            <path className="line-a" d={geo.pathA} />
            <path className="line-b" d={geo.pathB} />
          </g>

          <line className="playhead" x1={px} x2={px} y1={M.top} y2={M.top + geo.innerH} />
          <circle className="dot-a" cx={px} cy={geo.ya(cur.a.value)} r={6} />
          <rect className="dot-b" x={px - 5.5} y={geo.yb(cur.b.value) - 5.5} width={11} height={11} rx={2} />
        </svg>
      </div>
    </figure>
  );
}
