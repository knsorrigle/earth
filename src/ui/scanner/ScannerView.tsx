import { useEffect, useMemo } from 'react';
import { useReducedMotion } from 'framer-motion';
import type { Dataset } from '../../data/types';
import { describeScannerMapping } from '../../mapping/legend';
import { formatLon } from '../../sampling/geo';
import { SCAN_DURATIONS, usePlayerStore, type ScanDuration, type ScanState } from '../../state/playerStore';
import { ColorBar, PresenceKey } from '../map/ColorBar';
import { DatasetPicker } from '../DatasetPicker';
import { selectMapDataset } from '../map/selectMapDataset';
import { MAP_DATASETS } from '../../data/registry';
import { DateBar, shiftDate } from '../map/DateBar';
import { MapCanvas, type ScanOverlay } from '../map/MapCanvas';
import { useGibsFrame } from '../map/useGibsFrame';
import { SCAN_BANDS, SCAN_COLUMNS, useScanner, type ScannerApi } from './useScanner';

const SCANNER_HINT = 'Press space to scan, arrow keys to step, I to describe this line.';

export const SCANNER_SHORTCUTS: { keys: string; action: string }[] = [
  { keys: 'Space or K', action: 'Start / pause the sweep' },
  { keys: '← / →', action: 'Step 5° west / east' },
  { keys: 'Shift + ← / →', action: 'Step 30°' },
  { keys: 'Home / End', action: 'West / east edge' },
  { keys: '+ / −', action: 'Faster / slower sweep' },
  { keys: 'I', action: 'Describe the line under the beam' },
  { keys: 'F', action: 'Describe the whole map' },
  { keys: 'L', action: 'Say what the sounds mean' },
  { keys: '[ / ]', action: 'Previous / next day' },
];

export function ScannerView({ dataset }: { dataset: Dataset }) {
  const frame = useGibsFrame(dataset, SCANNER_HINT);
  const api = useScanner(dataset, frame);
  useScannerKeys(api, dataset);
  const scan = usePlayerStore((s) => s.scan);
  const status = usePlayerStore((s) => s.explore.status);
  const caption = usePlayerStore((s) => s.caption);
  const setScan = usePlayerStore((s) => s.setScan);
  const reduced = useReducedMotion() ?? false;
  const column = api.plan?.columns[scan.column];

  const overlay: ScanOverlay | null = useMemo(
    () =>
      api.plan
        ? {
            bands: SCAN_BANDS,
            columns: SCAN_COLUMNS,
            column: scan.column,
            livePosition: api.livePosition,
            active: api.active.map((n) => ({ band: n.band, velocity: n.velocity })),
            smooth: scan.isScanning && !reduced,
          }
        : null,
    [api.plan, api.active, api.livePosition, scan.column, scan.isScanning, reduced],
  );

  return (
    <>
      <section className="track" aria-labelledby="scanner-title">
        <div className="track-meta">
          <p className="eyebrow">Scanner · {SCAN_BANDS} latitude bands · west → east</p>
          <h2 id="scanner-title">{dataset.title}</h2>
          <p className="track-desc">
            A beam sweeps the whole planet. Each band of latitude is a string; you hear the map as a chord that changes as
            the beam crosses {frame.presence ? 'fire zones and quiet regions' : 'currents, coasts and continents'}.
          </p>
        </div>
        <div className="readout">
          <div className="readout-year readout-explore">
            <span className="num">{column ? formatLon(column.lon, 1) : '—'}</span>
          </div>
          <div className="readout-delta mono">
            {scan.isScanning ? 'scanning' : 'paused'} · {scan.durationSec}s sweep
          </div>
          <p className="caption">{caption || 'Press Play or Space to start the sweep.'}</p>
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
          scan={overlay}
          label={`${dataset.title} scanner. Space starts the sweep; arrow keys step the beam; I describes the line.`}
          describedBy="scan-alt"
          busy={status === 'loading'}
          onMove={(_lat, lon, src) => {
            if (!api.plan) return;
            const c = Math.min(SCAN_COLUMNS - 1, Math.floor(((lon + 180) / 360) * SCAN_COLUMNS));
            if (c !== usePlayerStore.getState().scan.column || src !== 'hover') void api.seek(c, { announce: false });
          }}
          onActivate={() => void api.ensureAudio()}
          onRelease={api.describeHere}
        />
        {frame.grid && !frame.presence && (
          <ColorBar colormap={frame.grid.colormap} unit="°" ticks={[0, 5, 10, 15, 20, 25, 30]} domain={[-1, 33]} />
        )}
        {frame.presence && <PresenceKey rgb={dataset.frame!.presenceRgb!} label="Fire detection (MODIS, Terra + Aqua)" />}
        <figcaption id="scan-alt" className="chart-alt">
          {frame.description}
        </figcaption>
      </figure>

      <div className="controls">
        <div className="transport" role="group" aria-label="Sweep">
          <button type="button" className="btn icon" onClick={() => void api.seek(0)} aria-label="West edge" title="West edge (Home)">
            ⇤
          </button>
          <button type="button" className="btn icon" onClick={() => api.step(-1)} disabled={scan.column === 0} aria-label="Step west" title="Step west (←)">
            ‹
          </button>
          <button
            type="button"
            className="btn play"
            onClick={api.toggle}
            disabled={!api.plan}
            aria-label={scan.isScanning ? 'Pause sweep' : 'Start sweep'}
          >
            <span aria-hidden="true">{scan.isScanning ? '❚❚' : '▶'}</span>
            <span>{scan.isScanning ? 'Pause' : 'Scan'}</span>
          </button>
          <button type="button" className="btn icon" onClick={() => api.step(1)} disabled={scan.column === SCAN_COLUMNS - 1} aria-label="Step east" title="Step east (→)">
            ›
          </button>
          <button type="button" className="btn icon" onClick={() => void api.seek(SCAN_COLUMNS - 1)} aria-label="East edge" title="East edge (End)">
            ⇥
          </button>
        </div>
        <div className="settings" role="group" aria-label="Sweep settings">
          <label className="field">
            <span className="field-label">Sweep length</span>
            <select value={scan.durationSec} onChange={(e) => api.setDuration(Number(e.target.value) as ScanDuration)}>
              {SCAN_DURATIONS.map((d) => (
                <option key={d} value={d}>
                  {d} seconds
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span className="field-label">Spoken longitude while scanning</span>
            <select
              value={scan.announceEveryDeg}
              onChange={(e) => setScan({ announceEveryDeg: Number(e.target.value) as ScanState['announceEveryDeg'] })}
            >
              <option value={30}>Every 30°</option>
              <option value={60}>Every 60°</option>
              <option value={90}>Every 90°</option>
              <option value={0}>Only start and end</option>
            </select>
          </label>
        </div>
      </div>

      <div className="panels">
        <section className="panel legend" aria-labelledby="scan-legend-title">
          <div className="panel-head">
            <h2 id="scan-legend-title">What you're hearing</h2>
            <div className="panel-actions">
              <button type="button" className="btn small" onClick={api.speakLegend}>
                Speak it <kbd>L</kbd>
              </button>
              <button type="button" className="btn small" onClick={api.describeHere} disabled={!api.plan}>
                Describe this line <kbd>I</kbd>
              </button>
              <button type="button" className="btn small" onClick={api.describe} disabled={!api.plan}>
                Describe map <kbd>F</kbd>
              </button>
            </div>
          </div>
          <ul className="legend-list">
            {describeScannerMapping(dataset.mapping, SCAN_BANDS, frame.presence ? 'presence' : 'colormap').map((l) => (
              <li key={l}>{l}</li>
            ))}
          </ul>
        </section>
        <details className="panel help">
          <summary>
            <h2>Keyboard controls</h2>
          </summary>
          <dl className="shortcuts">
            {SCANNER_SHORTCUTS.map((s) => (
              <div key={s.keys}>
                <dt>
                  <kbd>{s.keys}</kbd>
                </dt>
                <dd>{s.action}</dd>
              </div>
            ))}
          </dl>
          <p className="muted small">When a button has focus, Space presses that button.</p>
        </details>
      </div>
    </>
  );
}

function useScannerKeys(api: ScannerApi, dataset: Dataset) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      const tag = t?.tagName ?? '';
      const type = tag === 'INPUT' ? (t as HTMLInputElement).type : '';
      if (tag === 'TEXTAREA' || (tag === 'INPUT' && type !== 'checkbox') || t?.isContentEditable) return;
      const activatesNatively = ['BUTTON', 'SELECT', 'SUMMARY', 'A'].includes(tag) || type === 'checkbox';
      const arrowsNatively = tag === 'SELECT';
      const s = usePlayerStore.getState();
      switch (e.key) {
        case ' ':
          if (activatesNatively) return;
          api.toggle();
          break;
        case 'k':
        case 'K':
          api.toggle();
          break;
        case 'ArrowRight':
          if (arrowsNatively) return;
          api.step(e.shiftKey ? 6 : 1);
          break;
        case 'ArrowLeft':
          if (arrowsNatively) return;
          api.step(e.shiftKey ? -6 : -1);
          break;
        case 'Home':
          void api.seek(0);
          break;
        case 'End':
          void api.seek(SCAN_COLUMNS - 1);
          break;
        case '+':
        case '=':
          api.changeSpeed(true);
          break;
        case '-':
        case '_':
          api.changeSpeed(false);
          break;
        case 'i':
        case 'I':
          api.describeHere();
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
