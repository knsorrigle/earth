import { useEffect } from 'react';
import { usePlayerStore } from '../../state/playerStore';
import type { HudState } from './hudModel';

/** The active mode calls this every render with its current HUD; cleared when the mode unmounts. */
export function usePublishHud(hud: HudState | null) {
  useEffect(() => {
    usePlayerStore.getState().setHud(hud);
  });
  useEffect(() => () => usePlayerStore.getState().setHud(null), []);
}
