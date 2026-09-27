import { useMemo, useRef } from 'react';
import type { Dataset } from '../data/types';
import type { NoteEvent, ReferenceTone } from '../mapping/types';
import { pointAnnouncement } from './announce';
import { useElementWidth } from './useElementWidth';

interface Props {
  dataset: Dataset;
  events: NoteEvent[];
  reference: ReferenceTone;
  index: number;
  onSeek: (index: number, opts?: { announce?: boolean; audition?: boolean }) => void;
  onScrubEnd: () => void;
}

const HEIGHT = 280;
const M = { top: 20, right: 20, bottom: 34, left: 44 };

/**
 * Line chart that doubles as the timeline slider: focusable, draggable,
 * and exposed to assistive tech as role="slider".
 */
export function TimelineChart({ dataset, events, reference, index, onSeek, onScrubEnd }: Props) {
  const [wrapRef, width] = useElementWidth<HTMLDivElement>();
  const dragging = useRef(false);
  const lastIdx = useRef(-1);

  const geo = useMemo(() => {
    const w = Math.max(200, width);
    const innerW = w - M.left - M.right;
    const innerH = HEIGHT - M.top - M.bottom;
    const years = events.map((e) => e.year);
    const values = events.map((e) => e.value);
    const y0 = Math.floor(Math.min(...values, reference.value) - 0.25);
    const y1 = Math.ceil(Math.max(...values, reference.value) + 0.25);
    const x0 = years[0];
    const x1 = years[years.length - 1];
    const x = (year: number) => M.left + ((year - x0) / Math.max(1, x1 - x0)) * innerW;
    const y = (v: number) => M.top + (1 - (v - y0) / (y1 - y0)) * innerH;
    const path = events.map((e, i) => `${i ? 'L' : 'M'}${x(e.year).toFixed(1)},${y(e.value).toFixed(1)}`).join('');
    const yTicks: number[] = [];
    for (let v = y0; v <= y1; v++) yTicks.push(v);
    const step = innerW < 420 ? 10 : 5;
    const xTicks = years.filter((yr) => yr % step === 0);
    return { w, innerW, innerH, x, y, path, yTicks, xTicks, x0, x1 };
  }, [width, events, reference]);

  const current = events[index];
  const px = geo.x(current.year);
  const py = geo.y(current.value);
  const refY = geo.y(reference.value);

  const indexFromClientX = (clientX: number, el: Element) => {
    const rect = el.getBoundingClientRect();
    const xPx = ((clientX - rect.left) / rect.width) * geo.w;
    const t = (xPx - M.left) / geo.innerW;
    return Math.round(Math.max(0, Math.min(1, t)) * (events.length - 1));
  };

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    dragging.current = true;
    e.currentTarget.setPointerCapture(e.pointerId);
    e.currentTarget.focus();
    const i = indexFromClientX(e.clientX, e.currentTarget);
    lastIdx.current = i;
    onSeek(i, { announce: false });
  };
  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragging.current) return;
    const i = indexFromClientX(e.clientX, e.currentTarget);
    if (i !== lastIdx.current) {
      lastIdx.current = i;
      onSeek(i, { announce: false });
    }
  };
  const onPointerUp = () => {
    if (!dragging.current) return;
    dragging.current = false;
    onScrubEnd();
  };

  return (
    <figure className="chart">
      <div
        ref={wrapRef}
        className="chart-slider"
        role="slider"
        tabIndex={0}
        aria-label={`Timeline: ${dataset.title}`}
        aria-valuemin={geo.x0}
        aria-valuemax={geo.x1}
        aria-valuenow={current.year}
        aria-valuetext={pointAnnouncement(current, { unitSpoken: dataset.unitSpoken, decimals: dataset.decimals })}
        aria-describedby="chart-alt"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <svg width={geo.w} height={HEIGHT} viewBox={`0 0 ${geo.w} ${HEIGHT}`} aria-hidden="true">
          <defs>
            <clipPath id="played">
              <rect x={0} y={0} width={px} height={HEIGHT} />
            </clipPath>
            <linearGradient id="area" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="var(--ice)" stopOpacity="0.28" />
              <stop offset="100%" stopColor="var(--ice)" stopOpacity="0" />
            </linearGradient>
          </defs>

          {geo.yTicks.map((v) => (
            <g key={v}>
              <line className="grid" x1={M.left} x2={geo.w - M.right} y1={geo.y(v)} y2={geo.y(v)} />
              <text className="tick" x={M.left - 8} y={geo.y(v)} dy="0.32em" textAnchor="end">
                {v}
              </text>
            </g>
          ))}
          {geo.xTicks.map((yr) => (
            <text key={yr} className="tick" x={geo.x(yr)} y={HEIGHT - 12} textAnchor="middle">
              {yr}
            </text>
          ))}

          <line className="ref-line" x1={M.left} x2={geo.w - M.right} y1={refY} y2={refY} />
          <text className="ref-label" x={geo.w - M.right} y={refY - 6} textAnchor="end">
            {reference.year} level · the hum
          </text>

          <path className="line-future" d={geo.path} />
          <g clipPath="url(#played)">
            <path
              d={`${geo.path}L${geo.x(geo.x1)},${M.top + geo.innerH}L${geo.x(geo.x0)},${M.top + geo.innerH}Z`}
              fill="url(#area)"
            />
            <path className="line-played" d={geo.path} />
          </g>

          <line className="deviation" x1={px} x2={px} y1={refY} y2={py} />
          <line className="playhead" x1={px} x2={px} y1={M.top} y2={M.top + geo.innerH} />
          <circle className="playhead-dot" cx={px} cy={py} r={6} />
        </svg>
      </div>
      <figcaption id="chart-alt" className="chart-alt">
        {dataset.altText}
      </figcaption>
    </figure>
  );
}
