import type { Colormap } from '../../sampling/colormap';

interface Props {
  colormap: Colormap;
  unit: string;
  ticks: number[];
  /** Current value to mark on the bar, if any. */
  marker?: number | null;
  domain: [number, number];
}

/** Horizontal legend built from the actual GIBS colormap entries. */
export function ColorBar({ colormap, unit, ticks, marker, domain }: Props) {
  const [lo, hi] = domain;
  const pos = (v: number) => `${(Math.max(0, Math.min(1, (v - lo) / (hi - lo))) * 100).toFixed(2)}%`;
  const stops = colormap.entries
    .filter((_, i) => i % 3 === 0 || i === colormap.entries.length - 1)
    .map((e) => `rgb(${e.rgb.join(',')}) ${pos(e.value)}`)
    .join(', ');
  return (
    <div className="colorbar" aria-hidden="true">
      <div className="colorbar-ramp" style={{ background: `linear-gradient(90deg, ${stops})` }}>
        {marker !== null && marker !== undefined && <span className="colorbar-marker" style={{ left: pos(marker) }} />}
      </div>
      <div className="colorbar-ticks">
        {ticks.map((t) => (
          <span key={t} style={{ left: pos(t) }}>
            {t}
            {unit}
          </span>
        ))}
      </div>
    </div>
  );
}

/** Legend for presence layers: a single marker colour on the land/sea basemap. */
export function PresenceKey({ rgb, label }: { rgb: [number, number, number]; label: string }) {
  return (
    <div className="presence-key" aria-hidden="true">
      <span className="swatch" style={{ background: `rgb(${rgb.join(',')})` }} />
      {label}
      <span className="swatch land" />
      Land
      <span className="swatch sea" />
      Ocean
    </div>
  );
}
