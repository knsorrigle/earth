import { useEffect, useRef } from 'react';
import { useElementWidth } from '../useElementWidth';

/** hover = mouse move without a click (not a user gesture, so it can't unlock audio). */
export type InputSource = 'hover' | 'click' | 'touch' | 'keyboard';

export interface ScanOverlay {
  bands: number;
  columns: number;
  /** Column the beam sits on when not playing (or under reduced motion). */
  column: number;
  /** Fractional column heard right now while playing, or null. Polled every frame. */
  livePosition: () => number | null;
  /** Bands sounding in the current column, with 0..1 loudness. */
  active: { band: number; velocity: number }[];
  smooth: boolean;
}

interface Props {
  bitmap: ImageBitmap | null;
  label: string;
  describedBy: string;
  busy: boolean;
  cursor?: { lat: number; lon: number } | null;
  scan?: ScanOverlay | null;
  onMove: (lat: number, lon: number, source: InputSource) => void;
  onActivate: () => void;
  onLeave?: () => void;
  /** Called when a drag ends (pointer up). */
  onRelease?: () => void;
}

const GRATICULE_STEP = 30;

/**
 * Equirectangular map. Two stacked canvases: the frame (redrawn only when the
 * image or size changes) and an overlay (cursor or scanner beam).
 * Exposed as role="application" so screen readers pass arrow keys through.
 */
export function MapCanvas({ bitmap, label, describedBy, busy, cursor, scan, onMove, onActivate, onLeave, onRelease }: Props) {
  const [wrapRef, width] = useElementWidth<HTMLDivElement>(960);
  const baseRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const dragging = useRef(false);
  const height = Math.round(width / 2);
  const dpr = Math.min(2, window.devicePixelRatio || 1);

  // Base layer: land, frame, graticule.
  useEffect(() => {
    const c = baseRef.current;
    const ctx = c?.getContext('2d');
    if (!c || !ctx) return;
    c.width = Math.round(width * dpr);
    c.height = Math.round(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#161d29';
    ctx.fillRect(0, 0, width, height);
    if (bitmap) {
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(bitmap, 0, 0, width, height);
    }
    ctx.lineWidth = 1;
    for (let lon = -180 + GRATICULE_STEP; lon < 180; lon += GRATICULE_STEP) {
      const x = ((lon + 180) / 360) * width;
      ctx.strokeStyle = lon === 0 ? 'rgba(233,238,245,0.28)' : 'rgba(233,238,245,0.12)';
      ctx.beginPath();
      ctx.moveTo(x + 0.5, 0);
      ctx.lineTo(x + 0.5, height);
      ctx.stroke();
    }
    for (let lat = -90 + GRATICULE_STEP; lat < 90; lat += GRATICULE_STEP) {
      const y = ((90 - lat) / 180) * height;
      ctx.strokeStyle = lat === 0 ? 'rgba(233,238,245,0.28)' : 'rgba(233,238,245,0.12)';
      ctx.beginPath();
      ctx.moveTo(0, y + 0.5);
      ctx.lineTo(width, y + 0.5);
      ctx.stroke();
    }
  }, [bitmap, width, height, dpr]);

  // Overlay: cursor or scanner beam. The beam animates via rAF while playing.
  useEffect(() => {
    const c = overlayRef.current;
    const ctx = c?.getContext('2d');
    if (!c || !ctx) return;
    if (c.width !== Math.round(width * dpr)) {
      c.width = Math.round(width * dpr);
      c.height = Math.round(height * dpr);
    }

    const draw = () => {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, width, height);
      if (cursor) drawCursor(ctx, cursor, width, height);
      if (scan) {
        const live = scan.smooth ? scan.livePosition() : null;
        drawScan(ctx, scan, live ?? scan.column + 0.5, width, height);
      }
    };

    draw();
    if (!scan?.smooth) return;
    let raf = 0;
    const loop = () => {
      draw();
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [cursor, scan, width, height, dpr]);

  const toLatLon = (e: React.PointerEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const fx = Math.max(0, Math.min(0.99999, (e.clientX - r.left) / r.width));
    const fy = Math.max(0, Math.min(1, (e.clientY - r.top) / r.height));
    return { lon: -180 + fx * 360, lat: 90 - fy * 180 };
  };

  return (
    <div
      ref={wrapRef}
      className={`map${scan ? ' map-scan' : ''}`}
      role="application"
      aria-roledescription="interactive map"
      aria-label={label}
      aria-describedby={describedBy}
      aria-busy={busy}
      tabIndex={0}
      style={{ height }}
      onPointerDown={(e) => {
        e.currentTarget.focus();
        e.currentTarget.setPointerCapture(e.pointerId);
        dragging.current = true;
        onActivate();
        const { lat, lon } = toLatLon(e);
        onMove(lat, lon, e.pointerType === 'mouse' ? 'click' : 'touch');
      }}
      onPointerMove={(e) => {
        // In scanner mode only drags seek; in explore mode mouse hover also sounds.
        if (scan && !dragging.current) return;
        const { lat, lon } = toLatLon(e);
        onMove(lat, lon, e.pointerType === 'mouse' ? (dragging.current ? 'click' : 'hover') : 'touch');
      }}
      onPointerUp={() => {
        if (dragging.current) onRelease?.();
        dragging.current = false;
      }}
      onPointerLeave={() => {
        if (!dragging.current) onLeave?.();
      }}
      onPointerCancel={() => {
        dragging.current = false;
        onLeave?.();
      }}
    >
      <canvas ref={baseRef} style={{ width, height }} aria-hidden="true" />
      <canvas ref={overlayRef} style={{ width, height }} aria-hidden="true" />
      {busy && (
        <div className="map-loading" aria-hidden="true">
          Loading map from NASA GIBS…
        </div>
      )}
    </div>
  );
}

function drawCursor(ctx: CanvasRenderingContext2D, cursor: { lat: number; lon: number }, width: number, height: number) {
  const x = ((cursor.lon + 180) / 360) * width;
  const y = ((90 - cursor.lat) / 180) * height;
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = 1;
  ctx.setLineDash([3, 4]);
  ctx.beginPath();
  ctx.moveTo(0, y);
  ctx.lineTo(width, y);
  ctx.moveTo(x, 0);
  ctx.lineTo(x, height);
  ctx.stroke();
  ctx.setLineDash([]);
  ring(ctx, x, y, 9);
}

function ring(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
  ctx.lineWidth = 3;
  ctx.strokeStyle = '#05070b';
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.lineWidth = 2;
  ctx.strokeStyle = '#ffd166';
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.stroke();
}

function drawScan(ctx: CanvasRenderingContext2D, scan: ScanOverlay, position: number, width: number, height: number) {
  const colW = width / scan.columns;
  const bandH = height / scan.bands;
  const x = Math.max(0, Math.min(width, position * colW));

  // Band boundaries.
  ctx.strokeStyle = 'rgba(255,209,102,0.22)';
  ctx.lineWidth = 1;
  ctx.setLineDash([2, 6]);
  for (let b = 1; b < scan.bands; b++) {
    const y = Math.round(b * bandH) + 0.5;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }
  ctx.setLineDash([]);

  // Brighten the surface under the beam.
  const glowW = Math.max(colW * 3, 24);
  const g = ctx.createLinearGradient(x - glowW, 0, x + glowW, 0);
  g.addColorStop(0, 'rgba(255,255,255,0)');
  g.addColorStop(0.5, 'rgba(255,255,255,0.18)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(x - glowW, 0, glowW * 2, height);

  // Beam.
  ctx.strokeStyle = 'rgba(255,209,102,0.95)';
  ctx.lineWidth = 2;
  ctx.shadowColor = 'rgba(255,209,102,0.8)';
  ctx.shadowBlur = 10;
  ctx.beginPath();
  ctx.moveTo(x, 0);
  ctx.lineTo(x, height);
  ctx.stroke();
  ctx.shadowBlur = 0;

  // Sounding bands.
  for (const a of scan.active) {
    const y = (a.band + 0.5) * bandH;
    const r = 3 + a.velocity * 9;
    ctx.fillStyle = `rgba(255,255,255,${0.45 + a.velocity * 0.5})`;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#05070b';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }
}
