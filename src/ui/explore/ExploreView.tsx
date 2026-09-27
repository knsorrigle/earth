import { useEffect } from 'react';
import type { Dataset } from '../../data/types';
import { describeExploreMapping } from '../../mapping/legend';
import { formatLatLon } from '../../sampling/geo';
import { usePlayerStore } from '../../state/playerStore';
import { shiftDate } from '../map/DateBar';
import { ColorBar, PresenceKey } from '../map/ColorBar';
import { MapCanvas } from '../map/MapCanvas';
import { useGibsFrame } from '../map/useGibsFrame';
import { DateBar } from '../map/DateBar';
import { DatasetPicker } from '../DatasetPicker';
import { selectMapDataset } from '../map/selectMapDataset';
import { MAP_DATASETS } from '../../data/registry';
import { useExplore, type ExploreApi } from './useExplore';
import { shortLegend } from '../hud/hudModel';
import { usePublishHud } from '../hud/usePublishHud';
import { speakLatLon } from '../../sampling/geo';

const EXPLORE_HINT = 'Use the arrow keys to move, F to describe the map.';

export const EXPLORE_SHORTCUTS: { keys: string; action: string }[] = [
  { keys: 'Arrow keys', action: 'Move 1°' },
  { keys: 'Shift + arrows', action: 'Move 10°' },
  { keys: 'I', action: 'Say value and location' },
  { keys: 'F', action: 'Describe the whole map' },
  { keys: 'L', action: 'Say what the sounds mean' },
  { keys: '[ / ]', action: 'Previous / next day' },
  { keys: 'M', action: 'Mute / unmute' },
];

export function ExploreView({ dataset }: { dataset: Dataset }) {
  const frame = useGibsFrame(dataset, EXPLORE_HINT);
  const api = useExplore(dataset, frame);
  useExploreKeys(api, dataset);
  const ex = usePlayerStore((s) => s.explore);
  const caption = usePlayerStore((s) => s.caption);
  const reading = api.readingAt(ex.cursor.lat, ex.cursor.lon);
  const encoding = frame.presence ? 'presence' : 'colormap';
  usePublishHud({
    mode: 'Explore',
    dataset: dataset.title,
    date: ex.shownDate ?? ex.date,
    source: ex.status === 'ready' ? (ex.source === 'live' ? 'live · NASA GIBS' : 'saved copy') : ex.status === 'loading' ? 'loading…' : '',
    values: reading ? [{ value: reading.display, unit: reading.unit, spoken: reading.valueSpoken }] : [],
    place: formatLatLon(ex.cursor.lat, ex.cursor.lon),
    placeSpoken: speakLatLon(ex.cursor.lat, ex.cursor.lon),
    legend: shortLegend('explore', dataset.mapping, { presence: frame.presence }),
    scrub: { kind: 'lon', lon: ex.cursor.lon, onSeek: (lon) => void api.moveTo(ex.cursor.lat, lon, 'click') },
  });
  const { start } = dataset.dateRange;

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
            <span className="num">{reading?.display ?? '—'}</span>
            {reading?.unit && <span className="unit"> {reading.unit}</span>}
          </div>
          <div className="readout-delta mono">{formatLatLon(ex.cursor.lat, ex.cursor.lon)}</div>
          <p className="caption">{caption || 'Click the map or press an arrow key to start listening.'}</p>
        </div>
      </section>

      <div className="picker-row">
        <DatasetPicker
          label="Map"
          datasets={MAP_DATASETS}
          value={dataset.id}
          onChange={selectMapDataset}
        />
      </div>
      <DateBar dataset={dataset} />

      <figure className="map-figure">
        <MapCanvas
          bitmap={frame.bitmap}
          underlay={frame.underlay}
          cursor={ex.cursor}
          label={`${dataset.title} map. Arrow keys move the cursor; F describes the map.`}
          describedBy="map-alt"
          busy={ex.status === 'loading'}
          onMove={(lat, lon, src) => void api.moveTo(lat, lon, src)}
          onActivate={() => void api.activate()}
          onLeave={api.leave}
        />
        {frame.grid && !frame.presence && (
          <ColorBar colormap={frame.grid.colormap} unit="°" ticks={[0, 5, 10, 15, 20, 25, 30]} marker={reading?.marker} domain={[-1, 33]} />
        )}
        {frame.presence && <PresenceKey rgb={dataset.frame!.presenceRgb!} label="Fire detection (MODIS, Terra + Aqua)" />}
        <figcaption id="map-alt" className="chart-alt">
          {frame.description}
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
              <button type="button" className="btn small" onClick={api.describe} disabled={!frame.grid}>
                Describe this map <kbd>F</kbd>
              </button>
            </div>
          </div>
          <ul className="legend-list">
            {describeExploreMapping(dataset.mapping, encoding).map((l) => (
              <li key={l}>{l}</li>
            ))}
          </ul>
          <p className="muted small">
            On phones that support it, the device vibrates as the reading changes — longer pulses mean {dataset.mapping.higherMeans}.
          </p>
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
