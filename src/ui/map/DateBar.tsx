import type { Dataset } from '../../data/types';
import { usePlayerStore } from '../../state/playerStore';

export function shiftDate(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Date picker + frame source status, shared by map modes. */
export function DateBar({ dataset }: { dataset: Dataset }) {
  const ex = usePlayerStore((s) => s.explore);
  const setExplore = usePlayerStore((s) => s.setExplore);
  const { start, end } = dataset.dateRange;
  const setDate = (d: string) => {
    if (d >= start && d <= end) setExplore({ date: d });
  };

  return (
    <div className="explore-bar">
      <div className="date-controls" role="group" aria-label="Date">
        <button type="button" className="btn small" onClick={() => setDate(shiftDate(ex.date, -1))} aria-label="Previous day" disabled={ex.date <= start}>
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
        {ex.status === 'ready' && (ex.source === 'live' ? `Live from NASA GIBS · ${ex.shownDate}` : `Saved copy · ${ex.shownDate}`)}
        {ex.status === 'error' && `Map unavailable: ${ex.notice}`}
        {ex.status === 'ready' && ex.notice && <span className="notice"> — {ex.notice}</span>}
      </p>
    </div>
  );
}
