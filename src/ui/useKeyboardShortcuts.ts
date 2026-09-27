import { useEffect } from 'react';
import { usePlayerStore } from '../state/playerStore';
import type { TimelineControls } from './usePlayer';
import { hudSummary } from './hud/hudModel';

const TEMPO_STEP = 10;

export const SHORTCUTS: { keys: string; action: string }[] = [
  { keys: 'Space or K', action: 'Play / pause' },
  { keys: '← / →', action: 'Previous / next year' },
  { keys: 'Shift + ← / →', action: 'Jump 10 years' },
  { keys: 'Home / End', action: 'First / last year' },
  { keys: '+ / −', action: 'Faster / slower' },
  { keys: 'I', action: 'Say where I am' },
  { keys: 'L', action: 'Say what the sounds mean' },
  { keys: 'D', action: 'Reference hum on / off' },
  { keys: 'M', action: 'Mute / unmute' },
  { keys: '1 – 5', action: 'Timeline / Explore / Scanner / Duet / Ear Test' },
  { keys: 'H', action: 'Read the globe HUD' },
];

/**
 * Global keyboard control. Keys that a focused control already handles
 * natively (Space on buttons, arrows on sliders/selects, typing in text
 * fields) are left alone so standard behaviour is never broken.
 */
/** Keys that work in every mode: mute and mode switching. */
export function useGlobalKeys() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      const tag = t?.tagName ?? '';
      if (tag === 'TEXTAREA' || tag === 'SELECT' || (tag === 'INPUT' && !['range', 'checkbox'].includes((t as HTMLInputElement).type))) return;
      const s = usePlayerStore.getState();
      switch (e.key) {
        case 'm':
        case 'M':
          s.setMuted(!s.muted);
          s.announce(!s.muted ? 'Muted' : 'Sound on');
          break;
        case '1':
          if (s.mode !== 'timeline') s.setMode('timeline');
          s.announce('Timeline mode');
          break;
        case '2':
          if (s.mode !== 'explore') s.setMode('explore');
          s.announce('Explore mode');
          break;
        case '3':
          if (s.mode !== 'scanner') s.setMode('scanner');
          s.announce('Scanner mode');
          break;
        case '4':
          if (s.mode !== 'duet') s.setMode('duet');
          s.announce('Duet mode');
          break;
        case 'h':
        case 'H': {
          if (s.hud) s.announce(hudSummary(s.hud));
          break;
        }
        case '5':
          if (s.mode !== 'eartest') s.setMode('eartest');
          s.announce('Ear Test. Press Enter to start.');
          break;
        default:
          return;
      }
      e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}

export function useKeyboardShortcuts(api: TimelineControls, opts: { drone?: boolean } = {}) {
  const drone = opts.drone ?? true;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      const tag = t?.tagName ?? '';
      const type = tag === 'INPUT' ? (t as HTMLInputElement).type : '';
      const isTextEntry =
        tag === 'TEXTAREA' || (tag === 'INPUT' && !['range', 'checkbox', 'radio', 'button'].includes(type)) || !!t?.isContentEditable;
      if (isTextEntry) return;
      const activatesNatively = ['BUTTON', 'SELECT', 'SUMMARY', 'A'].includes(tag) || ['checkbox', 'radio', 'button'].includes(type);
      const arrowsNatively = tag === 'SELECT' || type === 'range';

      const s = usePlayerStore.getState();
      const len = api.events.length;
      switch (e.key) {
        case ' ':
          if (activatesNatively) return;
          e.preventDefault();
          api.toggle();
          break;
        case 'k':
        case 'K':
          api.toggle();
          break;
        case 'ArrowRight':
        case 'ArrowUp':
          if (arrowsNatively) return;
          e.preventDefault();
          api.step(e.shiftKey ? 10 : 1);
          break;
        case 'ArrowLeft':
        case 'ArrowDown':
          if (arrowsNatively) return;
          e.preventDefault();
          api.step(e.shiftKey ? -10 : -1);
          break;
        case 'Home':
          if (arrowsNatively) return;
          e.preventDefault();
          void api.seek(0);
          break;
        case 'End':
          if (arrowsNatively) return;
          e.preventDefault();
          void api.seek(len - 1);
          break;
        case '+':
        case '=':
          s.setBpm(s.bpm + TEMPO_STEP);
          s.announce(`Tempo ${usePlayerStore.getState().bpm} beats per minute`);
          break;
        case '-':
        case '_':
          s.setBpm(s.bpm - TEMPO_STEP);
          s.announce(`Tempo ${usePlayerStore.getState().bpm} beats per minute`);
          break;
        case 'd':
        case 'D':
          if (!drone) return;
          s.setDroneEnabled(!s.droneEnabled);
          s.announce(`Reference hum ${!s.droneEnabled ? 'on' : 'off'}`);
          break;
        case 'l':
        case 'L':
          api.speakLegend();
          break;
        case 'i':
        case 'I':
          api.speakCurrent();
          break;
        default:
          return;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [api, drone]);
}
