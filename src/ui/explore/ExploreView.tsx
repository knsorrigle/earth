import { useEffect } from 'react';
import type { Dataset } from '../../data/types';
import { describeExploreMapping } from '../../mapping/legend';
import { displayEntry } from '../../sampling/describe';
import { formatLatLon } from '../../sampling/geo';
import { sampleGrid } from '../../sampling/grid';
import { usePlayerStore } from '../../state/playerStore';
import { ColorBar } from './ColorBar';
import { MapCanvas } from './MapCanvas';
import { useExplore, type ExploreApi } from './useExplore';

export const EXPLORE_SHORTCUTS: { keys: string; action: string }[] = [
  { keys: 'Arrow keys', action: 'Move 1°' },
  { keys: 'Shift + arrows', action: 'Move 10°' },
  { keys: 'I', action: 'Say value and location' },
  { keys: 'F', action: 'Describe the whole map' },
  { keys: 'L', action: 'Say what the sounds mean' },
  { keys: '[ / ]', action: 'Previous / next day' },
  { keys: 'M', action: 'Mute / unmute' },
];

function shiftDate(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function ExploreView({ dataset }: { dataset: Dataset }) {
  const api = useExplore(dataset);
  useExploreKeys(api, dataset);
  const ex = usePlayerStore((s) => s.explore);
  const setExplore = usePlayerStore((s) => s.setExplore);
  const caption = usePlayerStore((s) => s.caption);
  const sample = api.grid ? sampleGrid(api.grid, ex.cursor.lat, ex.cursor.lon) : null;
  const { start, end } = dataset.dateRange;
  const setDate = (d: string) => {
    if (d >= start && d <= end) setExplore({ date: d });
  };

  return (
    <>
      <section className="track" aria-labelledby="explore-title">
        <div className="track-meta">
          <p className="eyebrow">Explore · daily · {start.slice(0, 4)}–now</p>
          <h2 id="explore-title">{dataset.title}</h2>
          <p className="track-desc">{dataset.description}</p>
        </div>
        <div className="readout">
          <div className="readout-year readout-explore">
            <span className="num">{displayEntry(sample?.entry ?? null, dataset.decimals)}</span>
            {sample?.entry && <span className="unit"> {dataset.unit}</span>}
          </div>
          <div className="readout-delta mono">{formatLatLon(ex.cursor.lat, ex.cursor.lon)}</div>
          <p className="caption">{caption || 'Click the map or press an arrow key to start listening.'}</p>
        </div>
      </section>

      <div className="explore-bar">
        <div className="date-controls" role="group" aria-label="Date">
          <button type="button" className="btn small" onClick={() => setDate(shiftDate(ex.date, -1))} aria-label="Previous day">
            ‹
          </button>
          <label className="date-field">
            <span className="sr-only">Map date</span>
            <input type="date" value={ex.date} min={start} max={end} onChange={(e) => e.target.value && setDate(e.target.value)} />
          </label>
          <button type="button" className="btn small" onClick={() => setDate(shiftDate(ex.date, 1))} aria-label="Next day" disabled={ex.date >= end}>
            ›
          </button>
        </div>
        <p className={`frame-status ${ex.source ?? ''}`} role="note">
          {ex.status === 'loading' && 'Loading from NASA GIBS…'}
          {ex.status === 'ready' &&
            (ex.source === 'live' ? `Live from NASA GIBS · ${ex.shownDate}` : `Saved copy · ${ex.shownDate}`)}
          {ex.status === 'error' && `Map unavailable: ${ex.notice}`}
          {ex.status === 'ready' && ex.notice && <span className="notice"> — {ex.notice}</span>}
        </p>
      </div>

      <figure className="map-figure">
        <MapCanvas
          bitmap={api.bitmap}
          label={`${dataset.title} map. Arrow keys move the cursor; F describes the map.`}
          describedBy="map-alt"
          busy={ex.status === 'loading'}
          onMove={(lat, lon, src) => void api.moveTo(lat, lon, src)}
          onActivate={() => void api.activate()}
          onLeave={api.leave}
        />
        {api.grid && (
          <ColorBar colormap={api.grid.colormap} unit="°" ticks={[0, 5, 10, 15, 20, 25, 30]} marker={sample?.entry?.value} domain={[-1, 33]} />
        )}
        <figcaption id="map-alt" className="chart-alt">
          {api.frameDescription}
        </figcaption>
      </figure>

      <div className="panels">
        <section className="panel legend" aria-labelledby="explore-legend-title">
          <div className="panel-head">
            <h2 id="explore-legend-title">What you're hearing</h2>
            <div className="panel-actions">
              <button type="button" className="btn small" onClick={api.speakLegend}>
                Speak it <kbd>L</kbd>
              </button>
              <button type="button" className="btn small" onClick={api.describe} disabled={!api.grid}>
                Describe this map <kbd>F</kbd>
              </button>
            </div>
          </div>
          <ul className="legend-list">
            {describeExploreMapping(dataset.mapping).map((l) => (
              <li key={l}>{l}</li>
            ))}
          </ul>
          <p className="muted small">On phones that support it, the device vibrates as you cross into warmer or colder water — longer pulses mean warmer.</p>
        </section>
        <details className="panel help">
          <summary>
            <h2>Keyboard controls</h2>
          </summary>
          <dl className="shortcuts">
            {EXPLORE_SHORTCUTS.map((s) => (
              <div key={s.keys}>
                <dt>
                  <kbd>{s.keys}</kbd>
                </dt>
                <dd>{s.action}</dd>
              </div>
            ))}
          </dl>
        </details>
      </div>
    </>
  );
}

function useExploreKeys(api: ExploreApi, dataset: Dataset) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      const tag = t?.tagName ?? '';
      const type = tag === 'INPUT' ? (t as HTMLInputElement).type : '';
      if (tag === 'TEXTAREA' || tag === 'SELECT' || (tag === 'INPUT' && type !== 'checkbox') || t?.isContentEditable) return;
      const step = e.shiftKey ? 10 : 1;
      const s = usePlayerStore.getState();
      switch (e.key) {
        case 'ArrowUp':
          api.moveBy(step, 0);
          break;
        case 'ArrowDown':
          api.moveBy(-step, 0);
          break;
        case 'ArrowLeft':
          api.moveBy(0, -step);
          break;
        case 'ArrowRight':
          api.moveBy(0, step);
          break;
        case 'i':
        case 'I':
          api.speakHere();
          break;
        case 'f':
        case 'F':
          api.describe();
          break;
        case 'l':
        case 'L':
          api.speakLegend();
          break;
        case '[':
        case ']': {
          const d = shiftDate(s.explore.date, e.key === '[' ? -1 : 1);
          if (d >= dataset.dateRange.start && d <= dataset.dateRange.end) s.setExplore({ date: d });
          break;
        }
        default:
          return;
      }
      e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [api, dataset]);
}
