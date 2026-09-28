import { engine } from '../../audio/engine';
import type { Dataset } from '../../data/types';
import { usePlayerStore } from '../../state/playerStore';
import { selectMapDataset } from '../map/selectMapDataset';

/** Delay between the needle drop and the track starting (the disc's flight). */
export const DROP_MS = 750;

/**
 * Choose a record on the jukebox: needle drop, then open its mode and start
 * the music — Timeline for time series, a Scanner sweep for maps.
 */
export async function playRecord(ds: Dataset, reduced: boolean): Promise<void> {
  // The click is the user gesture that unlocks audio.
  await engine.init();
  const s = usePlayerStore.getState();
  engine.setMasterMuted(s.muted);
  engine.setMasterVolume(s.volumeDb);
  // A sound effect must never stop the record from playing.
  try {
    engine.playNeedleDrop();
  } catch {
    /* ignore */
  }
  s.announce(`Needle down: ${ds.title}. ${ds.timeSeries ? 'Playing the timeline.' : 'Starting a scan of the map.'}`);
  const go = () => {
    const st = usePlayerStore.getState();
    if (ds.timeSeries) {
      if (st.datasetId !== ds.id) st.setDatasetId(ds.id);
      st.setMode('timeline');
      st.setAutoplay('timeline');
    } else {
      selectMapDataset(ds.id);
      st.setMode('scanner');
      st.setAutoplay('scanner');
    }
  };
  if (reduced) go();
  else window.setTimeout(go, DROP_MS);
}
