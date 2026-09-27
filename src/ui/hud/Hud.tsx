import { usePlayerStore } from '../../state/playerStore';
import { hudSummary } from './hudModel';
import { Scrubber } from './Scrubber';

/**
 * Corner readouts over the globe. Visual only (aria-hidden): the same facts
 * are announced by each mode, and H reads the whole HUD aloud.
 */
export function Hud({ controls }: { controls: React.ReactNode }) {
  const hud = usePlayerStore((s) => s.hud);
  const legendOpen = usePlayerStore((s) => s.hudLegend);
  const setLegend = usePlayerStore((s) => s.setHudLegend);

  return (
    <div className="hud">
      {hud && (
        <div aria-hidden="true">
          <div className="hud-corner tl">
            <span className="hud-k">{hud.mode}</span>
            <span className="hud-v strong">{hud.dataset}</span>
            {legendOpen && hud.legend.length > 0 && (
              <ul className="hud-legend">
                {hud.legend.map((l) => (
                  <li key={l}>{l}</li>
                ))}
              </ul>
            )}
          </div>
          <div className="hud-corner tr">
            <span className="hud-k">date</span>
            <span className="hud-v strong">{hud.date || '—'}</span>
            {hud.source && <span className="hud-v">{hud.source}</span>}
          </div>
          <div className="hud-corner bl">
            {hud.values.map((v, i) => (
              <div key={i} className={`hud-value${v.voice ? ` voice-${v.voice}` : ''}`}>
                {v.label && <span className="hud-k">{v.label}</span>}
                <span className="hud-num">
                  {v.value}
                  <span className="hud-unit"> {v.unit}</span>
                </span>
                {v.delta && <span className="hud-v">{v.delta}</span>}
              </div>
            ))}
          </div>
          <div className="hud-corner br">
            <span className="hud-k">place</span>
            <span className="hud-v strong">{hud.place || '—'}</span>
          </div>
          {hud.scrub && <Scrubber scrub={hud.scrub} />}
        </div>
      )}
      <div className="hud-controls">
        {controls}
        {hud && (
          <>
            <button type="button" className="btn small ghost" aria-pressed={legendOpen} onClick={() => setLegend(!legendOpen)}>
              {legendOpen ? 'Hide legend' : 'Show legend'}
            </button>
            <button type="button" className="btn small ghost" onClick={() => usePlayerStore.getState().announce(hudSummary(hud))}>
              Read HUD <kbd>H</kbd>
            </button>
          </>
        )}
      </div>
    </div>
  );
}
