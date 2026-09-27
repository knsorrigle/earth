import { usePlayerStore, BPM_MAX, BPM_MIN, type AnnounceEvery } from '../state/playerStore';
import type { PlayerApi } from './usePlayer';

export function Transport({ api }: { api: PlayerApi }) {
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const index = usePlayerStore((s) => s.index);
  const last = api.events.length - 1;

  return (
    <div className="transport" role="group" aria-label="Playback">
      <button type="button" className="btn icon" onClick={() => void api.seek(0)} aria-label="First year" title="First year (Home)">
        <Icon d="M6 5v14M19 5 9 12l10 7z" />
      </button>
      <button type="button" className="btn icon" onClick={() => api.step(-1)} disabled={index === 0} aria-label="Previous year" title="Previous year (←)">
        <Icon d="M15 5 8 12l7 7" />
      </button>
      <button
        type="button"
        className="btn play"
        onClick={api.toggle}
        aria-label={isPlaying ? 'Pause' : 'Play'}
        title={isPlaying ? 'Pause (Space)' : 'Play (Space)'}
      >
        {isPlaying ? <Icon d="M8 5v14M16 5v14" /> : <Icon d="M7 4.5v15L19.5 12z" fill />}
        <span>{isPlaying ? 'Pause' : 'Play'}</span>
      </button>
      <button type="button" className="btn icon" onClick={() => api.step(1)} disabled={index === last} aria-label="Next year" title="Next year (→)">
        <Icon d="m9 5 7 7-7 7" />
      </button>
      <button type="button" className="btn icon" onClick={() => void api.seek(last)} aria-label="Last year" title="Last year (End)">
        <Icon d="M18 5v14M5 5l10 7-10 7z" />
      </button>
    </div>
  );
}

export function Settings() {
  const bpm = usePlayerStore((s) => s.bpm);
  const setBpm = usePlayerStore((s) => s.setBpm);
  const announceEvery = usePlayerStore((s) => s.announceEvery);
  const setAnnounceEvery = usePlayerStore((s) => s.setAnnounceEvery);
  const droneEnabled = usePlayerStore((s) => s.droneEnabled);
  const setDroneEnabled = usePlayerStore((s) => s.setDroneEnabled);
  const muted = usePlayerStore((s) => s.muted);
  const setMuted = usePlayerStore((s) => s.setMuted);
  const volumeDb = usePlayerStore((s) => s.volumeDb);
  const setVolumeDb = usePlayerStore((s) => s.setVolumeDb);

  const yearsPerSecond = (bpm / 60).toFixed(1);

  return (
    <div className="settings" role="group" aria-label="Sound settings">
      <label className="field">
        <span className="field-label">
          Tempo <output className="mono">{bpm} bpm · {yearsPerSecond} yr/s</output>
        </span>
        <input
          type="range"
          min={BPM_MIN}
          max={BPM_MAX}
          step={5}
          value={bpm}
          onChange={(e) => setBpm(Number(e.target.value))}
          aria-valuetext={`${bpm} beats per minute, ${yearsPerSecond} years per second`}
        />
      </label>

      <label className="field">
        <span className="field-label">
          Volume <output className="mono">{volumeDb} dB</output>
        </span>
        <input
          type="range"
          min={-30}
          max={0}
          step={1}
          value={volumeDb}
          onChange={(e) => setVolumeDb(Number(e.target.value))}
          aria-valuetext={`${volumeDb} decibels`}
        />
      </label>

      <label className="field">
        <span className="field-label">Spoken updates while playing</span>
        <select value={announceEvery} onChange={(e) => setAnnounceEvery(Number(e.target.value) as AnnounceEvery)}>
          <option value={1}>Every year</option>
          <option value={5}>Every 5 years</option>
          <option value={10}>Every 10 years</option>
          <option value={0}>Only start and end</option>
        </select>
      </label>

      <div className="toggles">
        <label className="switch">
          <input type="checkbox" checked={droneEnabled} onChange={(e) => setDroneEnabled(e.target.checked)} />
          <span>Reference hum</span>
        </label>
        <label className="switch">
          <input type="checkbox" checked={muted} onChange={(e) => setMuted(e.target.checked)} />
          <span>Mute</span>
        </label>
      </div>
    </div>
  );
}

function Icon({ d, fill = false }: { d: string; fill?: boolean }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d={d} fill={fill ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
