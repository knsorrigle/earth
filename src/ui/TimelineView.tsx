import type { Dataset } from '../data/types';
import { usePlayerStore } from '../state/playerStore';
import { usePlayer } from './usePlayer';
import { useKeyboardShortcuts } from './useKeyboardShortcuts';
import { TimelineChart } from './TimelineChart';
import { Readout } from './Readout';
import { Settings, Transport } from './Transport';
import { KeyboardHelp, Legend } from './Legend';
import { DatasetPicker } from './DatasetPicker';
import { getDataset, TIMELINE_DATASETS } from '../data/registry';

export function TimelineView({ dataset }: { dataset: Dataset }) {
  const api = usePlayer(dataset);
  useKeyboardShortcuts(api);
  // The year index is shared with Duet, which can have more years: clamp on the way in.
  const index = Math.min(usePlayerStore((s) => s.index), api.events.length - 1);
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

      <div className="picker-row">
        <DatasetPicker
          label="Record"
          datasets={TIMELINE_DATASETS}
          value={dataset.id}
          onChange={(id) => {
            const s = usePlayerStore.getState();
            s.setDatasetId(id);
            const d = getDataset(id);
            s.announce(`${d.title}, ${d.dateRange.start} to ${d.dateRange.end}. Press space to play, L for what the sounds mean.`);
          }}
        />
      </div>

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
