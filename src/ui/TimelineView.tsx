import type { Dataset } from '../data/types';
import { usePlayerStore } from '../state/playerStore';
import { usePlayer } from './usePlayer';
import { useKeyboardShortcuts } from './useKeyboardShortcuts';
import { TimelineChart } from './TimelineChart';
import { Readout } from './Readout';
import { Settings, Transport } from './Transport';
import { KeyboardHelp, Legend } from './Legend';

export function TimelineView({ dataset }: { dataset: Dataset }) {
  const api = usePlayer(dataset);
  useKeyboardShortcuts(api);
  const index = usePlayerStore((s) => s.index);
  const event = api.events[index];

  return (
    <>
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
    </>
  );
}
