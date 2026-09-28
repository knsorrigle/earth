import { useCallback, useEffect, useRef, useState } from 'react';
import { useReducedMotion } from 'framer-motion';
import { engine } from '../audio/engine';
import { usePlayerStore } from '../state/playerStore';

const SEEN_KEY = 'earth-jukebox:intro-seen';
const RISE = 3.2;
const FALL = 2.6;

function seenThisSession(): boolean {
  try {
    return window.sessionStorage.getItem(SEEN_KEY) === '1';
  } catch {
    return false;
  }
}
function markSeen() {
  try {
    window.sessionStorage.setItem(SEEN_KEY, '1');
  } catch {
    /* storage unavailable: the intro may show again next time */
  }
}

type Phase = 'gate' | 'swell' | 'leaving' | 'done';

/**
 * Black screen -> (Begin) -> a low swelling tone -> the globe emerges through a
 * window that grows with the tone's actual level (and stays open as it fades) -> title -> app.
 * A modal dialog: Esc skips any time, Enter skips while it plays. Not shown
 * under reduced motion, and only once per session.
 */
export function Intro({ onDone }: { onDone: () => void }) {
  const reduced = useReducedMotion() ?? false;
  const [phase, setPhase] = useState<Phase>(() => (seenThisSession() ? 'done' : 'gate'));
  const overlay = useRef<HTMLDivElement>(null);
  const beginRef = useRef<HTMLButtonElement>(null);
  const [titleOn, setTitleOn] = useState(false);

  const finish = useCallback(
    (skipped: boolean) => {
      markSeen();
      if (skipped) engine.stopIntroSwell();
      setPhase('leaving');
      window.setTimeout(
        () => {
          setPhase('done');
          onDone();
          const s = usePlayerStore.getState();
          s.announce('Earth Jukebox. Choose a record on the globe, or press 1 to 5 for modes. H reads the globe display.');
          // The app stops being inert on the next render; move focus into it after that.
          window.setTimeout(() => document.getElementById('player')?.focus({ preventScroll: true }), 50);
        },
        skipped ? 150 : 700,
      );
    },
    [onDone],
  );

  // Reduced motion or already seen: straight to the app.
  useEffect(() => {
    if (phase === 'done' || reduced) {
      if (reduced) markSeen();
      onDone();
      if (reduced && phase !== 'done') setPhase('done');
    }
  }, [phase, reduced, onDone]);

  useEffect(() => {
    if (phase !== 'gate') return;
    // The intro reveals the globe: start at the top even if the browser restored a scroll position.
    window.scrollTo(0, 0);
    beginRef.current?.focus();
  }, [phase]);

  const begin = useCallback(async () => {
    await engine.init();
    const s = usePlayerStore.getState();
    engine.setMasterMuted(s.muted);
    engine.setMasterVolume(s.volumeDb);
    engine.playIntroSwell(RISE, FALL);
    setPhase('swell');
  }, []);

  // The reveal follows the audio level every frame.
  useEffect(() => {
    if (phase !== 'swell') return;
    let raf = 0;
    let opened = 0;
    const start = performance.now();
    const tick = () => {
      const el = overlay.current;
      // The window opens with the swell and stays open as the tone fades.
      opened = Math.max(opened, engine.introLevel());
      const level = opened;
      const stage = document.querySelector('.stage')?.getBoundingClientRect();
      if (el) {
        const cx = stage ? stage.left + stage.width / 2 : window.innerWidth / 2;
        const cy = stage ? stage.top + stage.height / 2 : window.innerHeight / 2;
        const maxR = Math.hypot(window.innerWidth, window.innerHeight);
        el.style.setProperty('--cx', `${cx}px`);
        el.style.setProperty('--cy', `${cy}px`);
        el.style.setProperty('--r', `${Math.max(0, level) * maxR * 0.42}px`);
      }
      const elapsed = (performance.now() - start) / 1000;
      if (elapsed > RISE * 0.8) setTitleOn(true);
      if (elapsed > RISE + 1.4) {
        finish(false);
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [phase, finish]);

  // Keys belong to the intro while it is open (capture phase, before the app's shortcuts).
  useEffect(() => {
    if (phase === 'done' || reduced) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || (e.key === 'Enter' && phase === 'swell')) {
        e.preventDefault();
        e.stopImmediatePropagation();
        if (phase !== 'leaving') finish(true);
        return;
      }
      // Let Tab / Enter / Space reach the dialog's own buttons; the app's shortcuts get nothing.
      // (stopImmediatePropagation also covers events dispatched on window itself.)
      if (!['Tab', 'Enter', ' '].includes(e.key)) e.stopImmediatePropagation();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [phase, reduced, finish]);

  if (phase === 'done' || reduced) return null;

  return (
    <div
      ref={overlay}
      className={`intro intro-${phase}`}
      role="dialog"
      aria-modal="true"
      aria-labelledby="intro-title"
      aria-describedby="intro-desc"
    >
      <div className={`intro-title${titleOn || phase === 'gate' ? ' on' : ''}`}>
        <h2 id="intro-title">Earth Jukebox</h2>
        <p id="intro-desc">NASA Earth data you can hear. Headphones recommended.</p>
      </div>
      {phase === 'gate' && (
        <div className="intro-actions">
          <button ref={beginRef} type="button" className="btn play" onClick={() => void begin()}>
            ▶ Begin with sound
          </button>
          <button type="button" className="btn small ghost" onClick={() => finish(true)}>
            Skip intro <kbd>Esc</kbd>
          </button>
        </div>
      )}
      {phase === 'swell' && (
        <p className="intro-skip">
          Press <kbd>Enter</kbd> or <kbd>Esc</kbd> to skip
        </p>
      )}
    </div>
  );
}
