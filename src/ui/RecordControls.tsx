import { useEffect, useState } from 'react';
import { usePlayerStore } from '../state/playerStore';
import { formatDuration, toggleRecording } from './recording';

/** Record / Stop, a running timer, and the finished WAV as a download link. */
export function RecordControls() {
  const since = usePlayerStore((s) => s.recordingSince);
  const last = usePlayerStore((s) => s.lastRecording);
  const setRecording = usePlayerStore((s) => s.setRecording);
  const [now, setNow] = useState(() => performance.now());

  useEffect(() => {
    if (since === null) return;
    const id = window.setInterval(() => setNow(performance.now()), 500);
    return () => window.clearInterval(id);
  }, [since]);

  const recording = since !== null;
  return (
    <div className="record-controls">
      <button
        type="button"
        className={`btn small ghost${recording ? ' recording' : ''}`}
        aria-pressed={recording}
        onClick={() => void toggleRecording()}
        title="Record the performance as WAV (R)"
      >
        <span className="rec-dot" aria-hidden="true" />
        {recording ? `Stop · ${formatDuration((now - since) / 1000)}` : 'Record'} <kbd aria-hidden="true">R</kbd>
      </button>
      {last && !recording && (
        <span className="rec-result">
          <a id="recording-download" className="btn small" href={last.url} download={last.name}>
            Download WAV ({formatDuration(last.seconds)})
          </a>
          <button
            type="button"
            className="btn small ghost"
            aria-label="Discard recording"
            onClick={() => {
              URL.revokeObjectURL(last.url);
              setRecording({ lastRecording: null });
            }}
          >
            ×
          </button>
        </span>
      )}
    </div>
  );
}
