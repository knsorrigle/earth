import { useEffect, useRef } from 'react';
import { usePlayerStore } from '../../state/playerStore';
import { useElementWidth } from '../useElementWidth';
import type { InputSource } from './useExplore';

interface Props {
  bitmap: ImageBitmap | null;
  label: string;
  describedBy: string;
  busy: boolean;
  onMove: (lat: number, lon: number, source: InputSource) => void;
  onActivate: () => void;
  onLeave: () => void;
}

const GRATICULE_STEP = 30;

/**
 * Equirectangular map. Two stacked canvases: the frame (redrawn only when
 * the image or size changes) and a cursor overlay (redrawn on every move).
 * Exposed as role="application" so screen readers pass arrow keys through.
 */
export function MapCanvas({ bitmap, label, describedBy, busy, onMove, onActivate, onLeave }: Props) {
  const [wrapRef, width] = useElementWidth<HTMLDivElement>(960);
  const baseRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const cursor = usePlayerStore((s) => s.explore.cursor);
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

  // Overlay: cursor crosshair.
  useEffect(() => {
    const c = overlayRef.current;
    const ctx = c?.getContext('2d');
    if (!c || !ctx) return;
    if (c.width !== Math.round(width * dpr)) {
      c.width = Math.round(width * dpr);
      c.height = Math.round(height * dpr);
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);
    const x = ((cursor.lon + 180) / 360) * width;
    const y = ((90 - cursor.lat) / 180) * height;
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.setLineDash([3, 4]);
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#05070b';
    ctx.beginPath();
    ctx.arc(x, y, 9, 0, Math.PI * 2);
    ctx.stroke();
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#ffd166';
    ctx.beginPath();
    ctx.arc(x, y, 9, 0, Math.PI * 2);
    ctx.stroke();
  }, [cursor, width, height, dpr]);

  const toLatLon = (e: React.PointerEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const fx = (e.clientX - r.left) / r.width;
    const fy = (e.clientY - r.top) / r.height;
    return { lon: -180 + fx * 360, lat: 90 - fy * 180 };
  };
  const sourceOf = (e: React.PointerEvent): InputSource => (e.pointerType === 'mouse' ? 'hover' : 'touch');

  return (
    <div
      ref={wrapRef}
      className="map"
      role="application"
      aria-roledescription="interactive map"
      aria-label={label}
      aria-describedby={describedBy}
      aria-busy={busy}
      tabIndex={0}
      style={{ height }}
      onPointerDown={(e) => {
        e.currentTarget.focus();
        if (e.pointerType !== 'mouse') e.currentTarget.setPointerCapture(e.pointerId);
        onActivate();
        const { lat, lon } = toLatLon(e);
        onMove(lat, lon, e.pointerType === 'mouse' ? 'click' : 'touch');
      }}
      onPointerMove={(e) => {
        const { lat, lon } = toLatLon(e);
        onMove(lat, lon, sourceOf(e));
      }}
      onPointerLeave={onLeave}
      onPointerCancel={onLeave}
    >
      <canvas ref={baseRef} style={{ width, height }} aria-hidden="true" />
      <canvas ref={overlayRef} style={{ width, height }} aria-hidden="true" />
      {busy && <div className="map-loading" aria-hidden="true">Loading map from NASA GIBS…</div>}
    </div>
  );
}
