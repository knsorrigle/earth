import { engine, MAX_RECORD_SECONDS } from '../audio/engine';
import { recordingFileName } from '../audio/wav';
import { usePlayerStore } from '../state/playerStore';

export function formatDuration(seconds: number): string {
  const s = Math.round(seconds);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

let capTimer: number | undefined;

/** Start or stop recording the performance; on stop, offer the WAV for download. */
export async function toggleRecording(): Promise<void> {
  const s = usePlayerStore.getState();
  if (s.recordingSince === null) {
    await engine.init();
    engine.setMasterMuted(s.muted);
    engine.setMasterVolume(s.volumeDb);
    const ok = await engine.startRecording();
    if (!ok) {
      s.announce('Recording is not supported in this browser.');
      return;
    }
    s.setRecording({ recordingSince: performance.now() });
    s.announce(`Recording what you hear. Press R or the Stop button to finish; up to ${MAX_RECORD_SECONDS / 60} minutes.`);
    window.clearTimeout(capTimer);
    capTimer = window.setTimeout(() => {
      if (usePlayerStore.getState().recordingSince !== null) void toggleRecording();
    }, MAX_RECORD_SECONDS * 1000);
    return;
  }

  window.clearTimeout(capTimer);
  const res = engine.stopRecording();
  s.setRecording({ recordingSince: null });
  if (!res || res.seconds < 0.1) {
    s.announce('Recording stopped. Nothing was captured.');
    return;
  }
  if (s.lastRecording) URL.revokeObjectURL(s.lastRecording.url);
  const rec = { url: URL.createObjectURL(res.wav), name: recordingFileName(s.mode, new Date()), seconds: res.seconds };
  s.setRecording({ lastRecording: rec });
  s.announce(`Recording finished: ${formatDuration(rec.seconds)}. The download link for the WAV file has focus.`);
  window.setTimeout(() => document.getElementById('recording-download')?.focus(), 50);
}
