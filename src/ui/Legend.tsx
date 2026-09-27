import type { Dataset } from '../data/types';
import type { ReferenceTone } from '../mapping/types';
import { describeMapping } from '../mapping/legend';
import { usePlayerStore } from '../state/playerStore';
import { SHORTCUTS } from './useKeyboardShortcuts';

interface Props {
  dataset: Dataset;
  reference: ReferenceTone;
  onSpeak: () => void;
}

export function Legend({ dataset, reference, onSpeak }: Props) {
  const open = usePlayerStore((s) => s.legendOpen);
  const setOpen = usePlayerStore((s) => s.setLegendOpen);
  const lines = describeMapping(dataset.mapping);

  return (
    <section className="panel legend" aria-labelledby="legend-title">
      <div className="panel-head">
        <h2 id="legend-title">What you're hearing</h2>
        <div className="panel-actions">
          <button type="button" className="btn small" onClick={onSpeak}>
            Speak it <kbd>L</kbd>
          </button>
          <button type="button" className="btn small ghost" aria-expanded={open} aria-controls="legend-body" onClick={() => setOpen(!open)}>
            {open ? 'Hide' : 'Show'}
          </button>
        </div>
      </div>
      <div id="legend-body" hidden={!open}>
        <ul className="legend-list">
          {lines.map((l) => (
            <li key={l}>{l}</li>
          ))}
        </ul>
        <p className="muted small">
          Hum pitch: {reference.noteName} = {reference.value.toFixed(dataset.decimals)} {dataset.unit} ({reference.label}).
        </p>
      </div>
    </section>
  );
}

export function KeyboardHelp() {
  return (
    <details className="panel help">
      <summary>
        <h2>Keyboard controls</h2>
      </summary>
      <dl className="shortcuts">
        {SHORTCUTS.map((s) => (
          <div key={s.keys}>
            <dt>
              <kbd>{s.keys}</kbd>
            </dt>
            <dd>{s.action}</dd>
          </div>
        ))}
      </dl>
      <p className="muted small">
        When a button has focus, Space presses that button. Tab to the chart to use Space for play/pause.
      </p>
    </details>
  );
}

export function Sources({ datasets }: { datasets: Dataset[] }) {
  return (
    <footer className="sources">
      <h2>Data sources</h2>
      {datasets.map((d) => (
        <div key={d.id} className="source">
          <p>
            <strong>{d.title}</strong> — <a href={d.source.url}>{d.source.name}</a>
            {d.source.subset ? `. ${d.source.subset}` : ''}
          </p>
          <p className="citation">{d.source.citation}</p>
          {d.source.dataUrl && (
            <p className="muted small">
              Bundled file: <a href={d.source.dataUrl}>{d.source.dataUrl.split('/').pop()}</a>
            </p>
          )}
        </div>
      ))}
      <p className="muted small">Earth Jukebox · NASA Space Apps · Sound is generated in your browser with Tone.js.</p>
    </footer>
  );
}
