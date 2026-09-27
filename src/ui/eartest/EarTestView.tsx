import { useEffect } from 'react';
import type { Dataset } from '../../data/types';
import { ORDINAL } from '../../game/earTest';
import { usePlayerStore, type EarDifficulty, type EarSet } from '../../state/playerStore';
import { useGibsFrame } from '../map/useGibsFrame';
import { RevealRegions, RevealSparkline } from './RevealVisuals';
import { ROUND_LENGTH, useEarTest, type EarTestApi } from './useEarTest';

export const EAR_SHORTCUTS: { keys: string; action: string }[] = [
  { keys: 'Enter', action: 'Start / next question' },
  { keys: 'Space', action: 'Play both clips' },
  { keys: 'Shift + ← / →', action: 'Play only the first / second clip' },
  { keys: '← / →', action: 'Answer: first / second' },
  { keys: 'I', action: 'Repeat the question (or the answer)' },
  { keys: 'S', action: 'Say the score' },
  { keys: 'L', action: 'How it works' },
];

export function EarTestView({ sst }: { sst: Dataset }) {
  const frame = useGibsFrame(sst, null);
  const api = useEarTest(sst, frame);
  useEarKeys(api);
  const ear = usePlayerStore((s) => s.ear);
  const setEar = usePlayerStore((s) => s.setEar);
  const { phase, question: q, score } = api;

  return (
    <>
      <section className="track" aria-labelledby="ear-title">
        <div className="track-meta">
          <p className="eyebrow">Ear Test · {ROUND_LENGTH} questions</p>
          <h2 id="ear-title">Can you hear the difference?</h2>
          <p className="track-desc">
            Two clips of real NASA and NOAA data. Pick the one that is more — or less — using only your ears. Works with your
            eyes closed.
          </p>
        </div>
        <div className="readout ear-score" aria-label="Score">
          <div className="readout-year">
            <span className="num">{score.correct}</span>
            <span className="unit">{'\u00a0/\u00a0'}{score.answered}</span>
          </div>
          <div className="readout-delta mono">
            streak {score.streak} · best streak {score.bestStreak}
          </div>
          <div className="readout-delta mono">
            best round on {ear.difficulty}: {api.best === null ? '—' : `${api.best} / ${ROUND_LENGTH}`}
          </div>
        </div>
      </section>

      <div className="picker-row">
        <label className="field picker">
          <span className="field-label">Questions</span>
          <select value={ear.set} onChange={(e) => setEar({ set: e.target.value as EarSet })}>
            <option value="mixed">Mixed</option>
            <option value="timeline">Years from the records</option>
            <option value="region" disabled={api.regionCount < 2}>
              Ocean regions (today's map)
            </option>
          </select>
        </label>
        <label className="field picker">
          <span className="field-label">Difficulty</span>
          <select value={ear.difficulty} onChange={(e) => setEar({ difficulty: e.target.value as EarDifficulty })}>
            <option value="easy">Easy — far apart</option>
            <option value="medium">Medium</option>
            <option value="hard">Hard — one or two notes apart</option>
          </select>
        </label>
      </div>

      <section className="panel ear-card" aria-labelledby="ear-q">
        {phase === 'intro' && (
          <>
            <h3 id="ear-q" className="ear-prompt">
              Ready when you are.
            </h3>
            <ul className="legend-list">
              {api.howItWorks.map((l) => (
                <li key={l}>{l}</li>
              ))}
            </ul>
            <button type="button" className="btn play" onClick={api.start}>
              Start <kbd>Enter</kbd>
            </button>
          </>
        )}

        {(phase === 'question' || phase === 'revealed') && q && (
          <>
            <p className="eyebrow">
              Question {api.qNum} of {ROUND_LENGTH} · {q.kind === 'timeline' ? api.datasetOf(q).title : 'Ocean regions'} · {q.gap}{' '}
              {q.gap === 1 ? 'step' : 'steps'} apart
            </p>
            <h3 id="ear-q" className="ear-prompt">
              {q.prompt}
            </h3>

            <div className="ear-listen">
              <button type="button" className="btn play" onClick={() => void api.playClips('both')}>
                ▶ Listen <kbd>Space</kbd>
              </button>
            </div>

            <div className="ear-choices" role="group" aria-label="Your answer">
              {([0, 1] as const).map((i) => {
                const revealed = phase === 'revealed';
                const isAnswer = revealed && i === q.answer;
                const isChoice = revealed && i === api.choice;
                return (
                  <div key={i} className={`ear-choice${api.playing === i ? ' playing' : ''}${isAnswer ? ' correct' : ''}${isChoice && !isAnswer ? ' wrong' : ''}`}>
                    <button
                      type="button"
                      className="btn ear-answer"
                      onClick={() => api.answer(i)}
                      disabled={revealed}
                      aria-label={`${ORDINAL[i]} clip${revealed ? `: ${q.items[i].label}` : ''}`}
                    >
                      <span className="ear-side">{i === 0 ? '◀ First' : 'Second ▶'}</span>
                      <span className="ear-sub">{revealed ? q.items[i].label : `clip ${i + 1} · ${i === 0 ? 'left' : 'right'} ear`}</span>
                      {revealed && (
                        <span className="ear-val mono">
                          {q.items[i].value.toFixed(api.datasetOf(q).decimals)} {api.datasetOf(q).unit}
                          {isAnswer ? ' ✓' : isChoice ? ' ✗' : ''}
                        </span>
                      )}
                    </button>
                    <button type="button" className="btn small ghost" onClick={() => void api.playClips(i)} aria-label={`Play only the ${ORDINAL[i]} clip`}>
                      ♪ only this
                    </button>
                  </div>
                );
              })}
            </div>

            {phase === 'revealed' && (
              <div className="ear-reveal">
                <p className={`ear-result ${api.choice === q.answer ? 'ok' : 'no'}`}>
                  {api.choice === q.answer ? '✓ Correct' : '✗ Not quite'} — the {ORDINAL[q.answer]} clip,{' '}
                  {q.items[q.answer].label}, {q.ask === 'higher' ? api.wordsOf(q).higher : api.wordsOf(q).lower}.
                </p>
                {q.kind === 'timeline' ? (
                  <RevealSparkline dataset={api.datasetOf(q)} question={q} />
                ) : (
                  <RevealRegions bitmap={frame.bitmap} question={q} />
                )}
                <button type="button" className="btn play" onClick={api.next}>
                  {api.qNum >= ROUND_LENGTH ? 'See results' : 'Next question'} <kbd>Enter</kbd>
                </button>
              </div>
            )}
          </>
        )}

        {phase === 'done' && (
          <>
            <h3 id="ear-q" className="ear-prompt">
              Round complete: {score.correct} of {score.answered}.
            </h3>
            <p className="muted">
              {Math.round((100 * score.correct) / Math.max(1, score.answered))}% correct · best streak {score.bestStreak}. Try a harder
              difficulty, or switch to ocean regions.
            </p>
            <button type="button" className="btn play" onClick={api.start}>
              Play again <kbd>Enter</kbd>
            </button>
          </>
        )}
      </section>

      <div className="panels">
        <section className="panel legend" aria-labelledby="ear-how">
          <div className="panel-head">
            <h2 id="ear-how">How it works</h2>
            <div className="panel-actions">
              <button type="button" className="btn small" onClick={api.speakHelp}>
                Speak it <kbd>L</kbd>
              </button>
            </div>
          </div>
          <ul className="legend-list">
            {api.howItWorks.map((l) => (
              <li key={l}>{l}</li>
            ))}
          </ul>
        </section>
        <details className="panel help">
          <summary>
            <h2>Keyboard controls</h2>
          </summary>
          <dl className="shortcuts">
            {EAR_SHORTCUTS.map((s) => (
              <div key={s.keys}>
                <dt>
                  <kbd>{s.keys}</kbd>
                </dt>
                <dd>{s.action}</dd>
              </div>
            ))}
          </dl>
        </details>
      </div>
    </>
  );
}

function useEarKeys(api: EarTestApi) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      const tag = t?.tagName ?? '';
      if (tag === 'TEXTAREA' || tag === 'SELECT' || tag === 'INPUT' || t?.isContentEditable) return;
      const onButton = ['BUTTON', 'SUMMARY', 'A'].includes(tag);
      switch (e.key) {
        case 'Enter':
          if (onButton) return; // let the focused button do its own thing
          api.next();
          break;
        case ' ':
          if (onButton) return;
          void api.playClips('both');
          break;
        case 'ArrowLeft':
          if (e.shiftKey) void api.playClips(0);
          else api.answer(0);
          break;
        case 'ArrowRight':
          if (e.shiftKey) void api.playClips(1);
          else api.answer(1);
          break;
        case 'i':
        case 'I':
          api.repeatPrompt();
          break;
        case 's':
        case 'S':
          api.speakScore();
          break;
        case 'l':
        case 'L':
          api.speakHelp();
          break;
        default:
          return;
      }
      e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [api]);
}
