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
import { useMemo } from 'react';
import { normaliseHeights, shortLegend } from './hud/hudModel';
import { usePublishHud } from './hud/usePublishHud';

export function TimelineView({ dataset }: { dataset: Dataset }) {
  const api = usePlayer(dataset);
  useKeyboardShortcuts(api);
  // The year index is shared with Duet, which can have more years: clamp on the way in.
  const index = Math.min(usePlayerStore((s) => s.index), api.events.length - 1);
  const event = api.events[index];

  const years = useMemo(() => api.events.map((e) => e.year), [api.events]);
  const heights = useMemo(() => normaliseHeights(api.events.map((e) => e.value)), [api.events]);
  const d = event.deviation;
  usePublishHud({
    mode: 'Timeline',
    dataset: dataset.title,
    date: String(event.year),
    values: [
      {
        value: event.value.toFixed(dataset.decimals),
        unit: dataset.unit,
        spoken: `${event.value.toFixed(dataset.decimals)} ${dataset.unitSpoken}`,
        delta: `${d > 0 ? '+' : d < 0 ? '−' : '±'}${Math.abs(d).toFixed(dataset.decimals)} vs ${api.reference.label}`,
      },
    ],
    place: dataset.place?.label ?? '',
    placeSpoken: dataset.place?.spoken,
    legend: shortLegend('timeline', dataset.mapping, { refLabel: api.reference.label }),
    scrub: { kind: 'years', years, heights, index, onSeek: (i) => void api.seek(i, { announce: false }) },
  });

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
