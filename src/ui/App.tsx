import { MotionConfig } from 'framer-motion';
import { DATASETS, getDataset } from '../data/registry';
import { usePlayerStore, type Mode } from '../state/playerStore';
import { useGlobalKeys } from './useKeyboardShortcuts';
import { LiveRegion } from './LiveRegion';
import { Sources } from './Legend';
import { TimelineView } from './TimelineView';
import { ExploreView } from './explore/ExploreView';

const MODES: { id: Mode; label: string; key: string }[] = [
  { id: 'timeline', label: 'Timeline', key: '1' },
  { id: 'explore', label: 'Explore map', key: '2' },
];

export function App() {
  const mode = usePlayerStore((s) => s.mode);
  const setMode = usePlayerStore((s) => s.setMode);
  const timelineId = usePlayerStore((s) => s.datasetId);
  const exploreId = usePlayerStore((s) => s.explore.datasetId);
  useGlobalKeys();

  const onTabKey = (e: React.KeyboardEvent, i: number) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    e.preventDefault();
    e.stopPropagation();
    const next = MODES[(i + (e.key === 'ArrowRight' ? 1 : MODES.length - 1)) % MODES.length];
    setMode(next.id);
    document.getElementById(`tab-${next.id}`)?.focus();
  };

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
          <div className="tabs" role="tablist" aria-label="Mode">
            {MODES.map((m, i) => (
              <button
                key={m.id}
                id={`tab-${m.id}`}
                type="button"
                role="tab"
                aria-selected={mode === m.id}
                aria-controls="player"
                tabIndex={mode === m.id ? 0 : -1}
                className="tab"
                onClick={() => setMode(m.id)}
                onKeyDown={(e) => onTabKey(e, i)}
              >
                {m.label} <kbd aria-hidden="true">{m.key}</kbd>
              </button>
            ))}
          </div>
        </header>

        <main id="player" tabIndex={-1} role="tabpanel" aria-labelledby={`tab-${mode}`}>
          {mode === 'timeline' ? (
            <TimelineView key="timeline" dataset={getDataset(timelineId)} />
          ) : (
            <ExploreView key="explore" dataset={getDataset(exploreId)} />
          )}
        </main>

        <Sources datasets={DATASETS} />
      </div>
    </MotionConfig>
  );
}
