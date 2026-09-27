/**
 * Note event bus: every audible note can be announced here, at the moment it
 * is heard, with where it "is" on Earth and the colour of its value. The
 * globe listens and draws a ripple. Plain pub/sub, no Tone or React.
 */
export interface NoteVisual {
  /**
   * Where the note belongs. A missing coordinate means "anywhere along it"
   * (pan-Arctic, global): the renderer uses the value facing the viewer.
   */
  lat?: number;
  lon?: number;
  /** sRGB colour, 0..1 per channel, from the dataset's colormap / palette. */
  color: [number, number, number];
  /** 0..1, how loud the note is (ripple size). */
  velocity: number;
}

type Listener = (e: NoteVisual) => void;

const listeners = new Set<Listener>();

export const noteBus = {
  emit(e: NoteVisual): void {
    listeners.forEach((l) => l(e));
  },
  /** Returns an unsubscribe function. */
  on(l: Listener): () => void {
    listeners.add(l);
    return () => listeners.delete(l);
  },
};
