import { MotionConfig } from 'framer-motion';
import { DATASETS, getDataset } from '../data/registry';
import { usePlayerStore } from '../state/playerStore';
import { usePlayer } from './usePlayer';
import { useKeyboardShortcuts } from './useKeyboardShortcuts';
import { LiveRegion } from './LiveRegion';
import { TimelineChart } from './TimelineChart';
import { Readout } from './Readout';
import { Settings, Transport } from './Transport';
import { KeyboardHelp, Legend, Sources } from './Legend';

export function App() {
  const datasetId = usePlayerStore((s) => s.datasetId);
  const dataset = getDataset(datasetId);
  const api = usePlayer(dataset);
  useKeyboardShortcuts(api);
  const index = usePlayerStore((s) => s.index);
  const event = api.events[index];

  return (
    <MotionConfig reducedMotion="user">
      <a className="skip" href="#player">
        Skip to player
      </a>
      <LiveRegion />
      <div className="shell">
        <header className="masthead">
          <div className="brand">
            <span className="brand-mark" aria-hidden="true" />
            <h1>Earth Jukebox</h1>
          </div>
          <p className="tagline">NASA Earth data you can hear. Eyes closed works too.</p>
        </header>

        <main id="player" tabIndex={-1}>
          <section className="track" aria-labelledby="track-title">
            <div className="track-meta">
              <p className="eyebrow">
                Timeline · {dataset.dateRange.start}–{dataset.dateRange.end}
              </p>
              <h2 id="track-title">{dataset.title}</h2>
              <p className="track-desc">{dataset.description}</p>
            </div>
            <Readout dataset={dataset} event={event} reference={api.reference} />
          </section>

          <TimelineChart
            dataset={dataset}
            events={api.events}
            reference={api.reference}
            index={index}
            onSeek={(i, o) => void api.seek(i, o)}
            onScrubEnd={api.speakCurrent}
          />

          <div className="controls">
            <Transport api={api} />
            <Settings />
          </div>

          <div className="panels">
            <Legend dataset={dataset} reference={api.reference} onSpeak={api.speakLegend} />
            <KeyboardHelp />
          </div>
        </main>

        <Sources datasets={DATASETS} />
      </div>
    </MotionConfig>
  );
}
