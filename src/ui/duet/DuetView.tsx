import { getDataset, TIMELINE_DATASETS } from '../../data/registry';
import type { Dataset } from '../../data/types';
import { usePlayerStore } from '../../state/playerStore';
import { DatasetPicker } from '../DatasetPicker';
import { KeyboardHelp } from '../Legend';
import { Settings, Transport } from '../Transport';
import { useKeyboardShortcuts } from '../useKeyboardShortcuts';
import { DuetChart } from './DuetChart';
import { useDuet } from './useDuet';
import { useMemo } from 'react';
import { normaliseHeights, shortLegend } from '../hud/hudModel';
import { usePublishHud } from '../hud/usePublishHud';

export function DuetView({ dsA, dsB }: { dsA: Dataset; dsB: Dataset }) {
  const api = useDuet(dsA, dsB);
  useKeyboardShortcuts(api, { drone: false });
  const index = usePlayerStore((s) => s.index);
  const caption = usePlayerStore((s) => s.caption);
  const setDuet = usePlayerStore((s) => s.setDuet);
  const { steps, refA, refB } = api.duet;
  const st = steps[Math.min(index, steps.length - 1)];
  const years = useMemo(() => steps.map((x) => x.year), [steps]);
  const heightsA = useMemo(() => normaliseHeights(steps.map((x) => x.a.value)), [steps]);
  const heightsB = useMemo(() => normaliseHeights(steps.map((x) => x.b.value)), [steps]);
  const sign = (d: number) => (d > 0 ? '+' : d < 0 ? '−' : '±');
  usePublishHud(
    st
      ? {
          mode: 'Duet',
          dataset: `${dsA.title} & ${dsB.title}`,
          date: String(st.year),
          values: [
            {
              label: `◀ ${dsA.title}`,
              value: st.a.value.toFixed(dsA.decimals),
              unit: dsA.unit,
              spoken: `${st.a.value.toFixed(dsA.decimals)} ${dsA.unitSpoken}`,
              delta: `${sign(st.a.deviation)}${Math.abs(st.a.deviation).toFixed(dsA.decimals)} vs ${refA.label}`,
              voice: 'a',
            },
            {
              label: `${dsB.title} ▶`,
              value: st.b.value.toFixed(dsB.decimals),
              unit: dsB.unit,
              spoken: `${st.b.value.toFixed(dsB.decimals)} ${dsB.unitSpoken}`,
              delta: `${sign(st.b.deviation)}${Math.abs(st.b.deviation).toFixed(dsB.decimals)} vs ${refB.label}`,
              voice: 'b',
            },
          ],
          place: [dsA.place?.label, dsB.place?.label].filter(Boolean).join('  ·  '),
          placeSpoken: [dsA.place?.spoken, dsB.place?.spoken].filter(Boolean).join(' and '),
          legend: shortLegend('duet', null, { titleA: dsA.title, titleB: dsB.title }),
          scrub: { kind: 'years', years, heights: heightsA, heightsB, index: Math.min(index, steps.length - 1), onSeek: (i) => void api.seek(i, { announce: false }) },
        }
      : null,
  );

  const pick = (slot: 'a' | 'b', id: string) => {
    setDuet({ [slot]: id });
    const other = slot === 'a' ? dsB : dsA;
    usePlayerStore.getState().announce(`${getDataset(id).title} with ${other.title}. Press space to play, L for what the sounds mean.`);
  };

  if (!st) {
    return <p className="muted">These two records don't share any years.</p>;
  }

  const delta = (v: number, ref: typeof refA, ds: Dataset) => {
    const d = v - ref.value;
    return `${d > 0 ? '+' : d < 0 ? '−' : '±'}${Math.abs(d).toFixed(ds.decimals)} vs ${ref.label}`;
  };

  return (
    <>
      <section className="track" aria-labelledby="duet-title">
        <div className="track-meta">
          <p className="eyebrow">
            Duet · {steps[0].year}–{steps[steps.length - 1].year}
          </p>
          <h2 id="duet-title">
            {dsA.title} <span className="muted">&amp;</span> {dsB.title}
          </h2>
          <p className="track-desc">Two records, one timeline. Listen for when they move together — and when they don't.</p>
        </div>
        <div className="readout duet-readout">
          <div className="readout-year">{st.year}</div>
          <div className="duet-values">
            <div className="duet-a">
              <span className="voice-tag">◀ mallet · {dsA.title}</span>
              <span>
                <span className="num">{st.a.value.toFixed(dsA.decimals)}</span> <span className="unit">{dsA.unit}</span>
              </span>
              <span className="mono small">{delta(st.a.value, refA, dsA)}</span>
            </div>
            <div className="duet-b">
              <span className="voice-tag">bell · {dsB.title} ▶</span>
              <span>
                <span className="num">{st.b.value.toFixed(dsB.decimals)}</span> <span className="unit">{dsB.unit}</span>
              </span>
              <span className="mono small">{delta(st.b.value, refB, dsB)}</span>
            </div>
          </div>
          <p className="caption">{caption || 'Press Play or Space to listen.'}</p>
        </div>
      </section>

      <div className="picker-row">
        <DatasetPicker
          label="Record A — mallet, left"
          datasets={TIMELINE_DATASETS}
          value={dsA.id}
          disabledIds={[dsB.id]}
          onChange={(id) => pick('a', id)}
        />
        <DatasetPicker
          label="Record B — bell, right"
          datasets={TIMELINE_DATASETS}
          value={dsB.id}
          disabledIds={[dsA.id]}
          onChange={(id) => pick('b', id)}
        />
      </div>

      <DuetChart
        dsA={dsA}
        dsB={dsB}
        steps={steps}
        index={index}
        describedBy="duet-legend"
        valueText={`${st.year}. ${dsA.title} ${st.a.value.toFixed(dsA.decimals)} ${dsA.unitSpoken}. ${dsB.title} ${st.b.value.toFixed(dsB.decimals)} ${dsB.unitSpoken}.`}
        onSeek={(i, o) => void api.seek(i, o)}
        onScrubEnd={api.speakCurrent}
      />

      <div className="controls">
        <Transport api={api} />
        <Settings drone={false} />
      </div>

      <div className="panels">
        <section className="panel legend" aria-labelledby="duet-legend-title">
          <div className="panel-head">
            <h2 id="duet-legend-title">What you're hearing</h2>
            <div className="panel-actions">
              <button type="button" className="btn small" onClick={api.speakLegend}>
                Speak it <kbd>L</kbd>
              </button>
            </div>
          </div>
          <ul className="legend-list" id="duet-legend">
            {api.legendLines.map((l) => (
              <li key={l}>{l}</li>
            ))}
          </ul>
        </section>
        <KeyboardHelp />
      </div>
    </>
  );
}
