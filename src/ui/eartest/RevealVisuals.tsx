import { useEffect, useMemo, useRef } from 'react';
import type { Dataset } from '../../data/types';
import type { Question } from '../../game/earTest';
import { useElementWidth } from '../useElementWidth';

/** Whole record as a line, with the two quizzed years marked 1 and 2. */
export function RevealSparkline({ dataset, question }: { dataset: Dataset; question: Question }) {
  const [ref, width] = useElementWidth<HTMLDivElement>();
  const H = 180;
  const M = { t: 18, r: 16, b: 26, l: 40 };
  const series = dataset.timeSeries ?? [];
  const g = useMemo(() => {
    const w = Math.max(220, width);
    const ys = series.map((p) => p.value);
    const lo = Math.min(...ys);
    const hi = Math.max(...ys);
    const x0 = series[0]?.year ?? 0;
    const x1 = series[series.length - 1]?.year ?? 1;
    const x = (yr: number) => M.l + ((yr - x0) / (x1 - x0 || 1)) * (w - M.l - M.r);
    const y = (v: number) => M.t + (1 - (v - lo) / (hi - lo || 1)) * (H - M.t - M.b);
    return { w, x, y, lo, hi, x0, x1, d: series.map((p, i) => `${i ? 'L' : 'M'}${x(p.year).toFixed(1)},${y(p.value).toFixed(1)}`).join('') };
  }, [width, series]);

  return (
    <div ref={ref} className="reveal-visual" aria-hidden="true">
      <svg width={g.w} height={H} viewBox={`0 0 ${g.w} ${H}`}>
        <text className="tick" x={M.l - 6} y={g.y(g.hi)} dy="0.32em" textAnchor="end">
          {g.hi.toFixed(dataset.decimals > 1 ? 1 : 0)}
        </text>
        <text className="tick" x={M.l - 6} y={g.y(g.lo)} dy="0.32em" textAnchor="end">
          {g.lo.toFixed(dataset.decimals > 1 ? 1 : 0)}
        </text>
        <text className="tick" x={g.x(g.x0)} y={H - 6} textAnchor="start">
          {g.x0}
        </text>
        <text className="tick" x={g.x(g.x1)} y={H - 6} textAnchor="end">
          {g.x1}
        </text>
        <path d={g.d} fill="none" stroke="var(--ice)" strokeWidth={1.75} opacity={0.6} />
        {question.items.map((it, i) => {
          const cx = g.x(it.year!);
          const cy = g.y(it.value);
          const win = i === question.answer;
          return (
            <g key={it.id}>
              <line x1={cx} x2={cx} y1={M.t} y2={H - M.b} stroke="var(--line-strong)" strokeDasharray="3 3" />
              <circle cx={cx} cy={cy} r={win ? 9 : 7} fill="var(--bg)" stroke={win ? 'var(--pos)' : 'var(--muted)'} strokeWidth={3} />
              <text x={cx} y={cy} dy="0.35em" textAnchor="middle" className="reveal-num">
                {i + 1}
              </text>
              <text x={cx} y={M.t - 5} textAnchor="middle" className="tick">
                {it.label}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

/** The map with the two quizzed regions boxed and numbered. */
export function RevealRegions({ bitmap, question }: { bitmap: ImageBitmap | null; question: Question }) {
  const [ref, width] = useElementWidth<HTMLDivElement>();
  const canvas = useRef<HTMLCanvasElement>(null);
  const height = Math.round(width / 2);

  useEffect(() => {
    const c = canvas.current;
    const ctx = c?.getContext('2d');
    if (!c || !ctx) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    c.width = Math.round(width * dpr);
    c.height = Math.round(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#161d29';
    ctx.fillRect(0, 0, width, height);
    if (bitmap) ctx.drawImage(bitmap, 0, 0, width, height);
    question.items.forEach((it, i) => {
      if (!it.box) return;
      const [w, s, e, n] = it.box;
      const x = ((w + 180) / 360) * width;
      const y = ((90 - n) / 180) * height;
      const bw = ((e - w) / 360) * width;
      const bh = ((n - s) / 180) * height;
      const win = i === question.answer;
      ctx.lineWidth = 4;
      ctx.strokeStyle = '#05070b';
      ctx.strokeRect(x, y, bw, bh);
      ctx.lineWidth = 2;
      ctx.strokeStyle = win ? '#8fe3b0' : '#e9eef5';
      ctx.strokeRect(x, y, bw, bh);
      ctx.font = '600 13px ui-monospace, monospace';
      const label = String(i + 1);
      ctx.fillStyle = '#05070b';
      ctx.fillRect(x + bw + 3, y - 2, 16, 18);
      ctx.fillStyle = win ? '#8fe3b0' : '#e9eef5';
      ctx.fillText(label, x + bw + 7, y + 12);
    });
  }, [bitmap, question, width, height]);

  return (
    <div ref={ref} className="reveal-visual" aria-hidden="true">
      <canvas ref={canvas} style={{ width, height, display: 'block' }} />
    </div>
  );
}
