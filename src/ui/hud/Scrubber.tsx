import { useRef } from 'react';
import type { HudScrub } from './hudModel';
import { useElementWidth } from '../useElementWidth';

const H = 46;
const PAD = 14;

/**
 * Bottom strip of the HUD. Years look like a vinyl groove (each groove's
 * height is that year's value); longitudes like a tape with 5° ticks.
 * Pointer only: the same control exists as an accessible slider in the panel below.
 */
export function Scrubber({ scrub }: { scrub: HudScrub }) {
  const [ref, width] = useElementWidth<HTMLDivElement>(800);
  const dragging = useRef(false);
  const innerW = Math.max(10, width - PAD * 2);

  const seekAt = (clientX: number, el: HTMLElement) => {
    const r = el.getBoundingClientRect();
    const f = Math.max(0, Math.min(1, (clientX - r.left - PAD) / (r.width - PAD * 2)));
    if (scrub.kind === 'years' && scrub.onSeek) scrub.onSeek(Math.round(f * (scrub.years.length - 1)));
    if (scrub.kind === 'lon' && scrub.onSeek) scrub.onSeek(-180 + f * 359.99);
  };
  const interactive = scrub.kind !== 'progress' && !!scrub.onSeek;

  return (
    <div
      ref={ref}
      className={`hud-scrub${interactive ? ' interactive' : ''}`}
      onPointerDown={(e) => {
        if (!interactive) return;
        dragging.current = true;
        e.currentTarget.setPointerCapture(e.pointerId);
        seekAt(e.clientX, e.currentTarget);
      }}
      onPointerMove={(e) => dragging.current && seekAt(e.clientX, e.currentTarget)}
      onPointerUp={() => (dragging.current = false)}
      onPointerCancel={() => (dragging.current = false)}
    >
      <svg width={width} height={H} viewBox={`0 0 ${width} ${H}`}>
        {scrub.kind === 'years' && <YearsGroove scrub={scrub} innerW={innerW} />}
        {scrub.kind === 'lon' && <LonTape scrub={scrub} innerW={innerW} />}
        {scrub.kind === 'progress' && <Progress scrub={scrub} innerW={innerW} />}
      </svg>
    </div>
  );
}

function YearsGroove({ scrub, innerW }: { scrub: Extract<HudScrub, { kind: 'years' }>; innerW: number }) {
  const n = scrub.years.length;
  const x = (i: number) => PAD + (n > 1 ? (i / (n - 1)) * innerW : innerW / 2);
  const mid = scrub.heightsB ? H / 2 : H - 10;
  const maxLen = scrub.heightsB ? H / 2 - 6 : H - 16;
  const labelEvery = n > 80 ? 20 : 10;
  return (
    <g>
      <line className="hud-groove-base" x1={PAD} x2={PAD + innerW} y1={mid} y2={mid} />
      {scrub.years.map((yr, i) => {
        const played = i <= scrub.index;
        const a = scrub.heights[i] ?? 0.5;
        return (
          <g key={yr} className={played ? 'played' : ''}>
            <line className="hud-groove hud-a" x1={x(i)} x2={x(i)} y1={mid} y2={mid - (3 + a * maxLen)} />
            {scrub.heightsB && (
              <line className="hud-groove hud-b" x1={x(i)} x2={x(i)} y1={mid} y2={mid + 3 + (scrub.heightsB[i] ?? 0.5) * maxLen} />
            )}
            {yr % labelEvery === 0 && !scrub.heightsB && (
              <text className="hud-tick-label" x={x(i)} y={H - 1} textAnchor="middle">
                {yr}
              </text>
            )}
          </g>
        );
      })}
      <Needle x={x(scrub.index)} />
    </g>
  );
}

function LonTape({ scrub, innerW }: { scrub: Extract<HudScrub, { kind: 'lon' }>; innerW: number }) {
  const x = (lon: number) => PAD + ((lon + 180) / 360) * innerW;
  const cols = scrub.heights?.length ?? 72;
  const base = H - 12;
  return (
    <g>
      <line className="hud-groove-base" x1={PAD} x2={PAD + innerW} y1={base} y2={base} />
      {Array.from({ length: cols }, (_, i) => {
        const lon = -180 + (i + 0.5) * (360 / cols);
        const h = scrub.heights ? scrub.heights[i] : (Math.round(lon - 2.5) % 30 === 0 ? 0.6 : 0.25);
        return <line key={i} className={`hud-groove hud-a${lon <= scrub.lon ? ' played' : ''}`} x1={x(lon)} x2={x(lon)} y1={base} y2={base - (2 + h * (H - 22))} />;
      })}
      {[-180, -120, -60, 0, 60, 120, 180].map((l) => (
        <text key={l} className="hud-tick-label" x={x(l)} y={H - 1} textAnchor={l === -180 ? 'start' : l === 180 ? 'end' : 'middle'}>
          {l === 0 ? '0°' : `${Math.abs(l)}°${l < 0 ? 'W' : 'E'}`}
        </text>
      ))}
      <Needle x={x(scrub.lon)} />
    </g>
  );
}

function Progress({ scrub, innerW }: { scrub: Extract<HudScrub, { kind: 'progress' }>; innerW: number }) {
  const n = scrub.results.length;
  const w = innerW / n;
  return (
    <g>
      {scrub.results.map((r, i) => (
        <g key={i}>
          <rect
            className={`hud-seg ${r === true ? 'ok' : r === false ? 'no' : i === scrub.current ? 'now' : ''}`}
            x={PAD + i * w + 2}
            y={14}
            width={w - 4}
            height={14}
            rx={3}
          />
          <text className="hud-tick-label" x={PAD + i * w + w / 2} y={H - 3} textAnchor="middle">
            {r === true ? '✓' : r === false ? '✗' : i + 1}
          </text>
        </g>
      ))}
    </g>
  );
}

function Needle({ x }: { x: number }) {
  return (
    <g className="hud-needle" transform={`translate(${x},0)`}>
      <line x1={0} x2={0} y1={2} y2={H - 12} />
      <circle cx={0} cy={4} r={3.5} />
    </g>
  );
}
