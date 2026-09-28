/**
 * Encode PCM channels as a 16-bit little-endian WAV file (RIFF/WAVE, format 1).
 * Samples are clamped to [-1, 1]. Channels are interleaved.
 */
export function encodeWav(channels: Float32Array[], sampleRate: number): ArrayBuffer {
  const nCh = Math.max(1, channels.length);
  const frames = channels[0]?.length ?? 0;
  const bytesPerSample = 2;
  const dataBytes = frames * nCh * bytesPerSample;
  const buf = new ArrayBuffer(44 + dataBytes);
  const v = new DataView(buf);
  const str = (o: number, s: string) => {
    for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i));
  };
  str(0, 'RIFF');
  v.setUint32(4, 36 + dataBytes, true);
  str(8, 'WAVE');
  str(12, 'fmt ');
  v.setUint32(16, 16, true); // fmt chunk size
  v.setUint16(20, 1, true); // PCM
  v.setUint16(22, nCh, true);
  v.setUint32(24, sampleRate, true);
  v.setUint32(28, sampleRate * nCh * bytesPerSample, true); // byte rate
  v.setUint16(32, nCh * bytesPerSample, true); // block align
  v.setUint16(34, 16, true); // bits per sample
  str(36, 'data');
  v.setUint32(40, dataBytes, true);
  let o = 44;
  for (let i = 0; i < frames; i++) {
    for (let c = 0; c < nCh; c++) {
      const s = Math.max(-1, Math.min(1, channels[c]?.[i] ?? 0));
      v.setInt16(o, s < 0 ? Math.round(s * 0x8000) : Math.round(s * 0x7fff), true);
      o += 2;
    }
  }
  return buf;
}

/** Join recorded chunks (each: one Float32Array per channel) into whole channels. */
export function joinChunks(chunks: Float32Array[][], nCh: number): Float32Array[] {
  const total = chunks.reduce((n, c) => n + (c[0]?.length ?? 0), 0);
  const out = Array.from({ length: nCh }, () => new Float32Array(total));
  let o = 0;
  for (const chunk of chunks) {
    const len = chunk[0]?.length ?? 0;
    for (let c = 0; c < nCh; c++) out[c].set(chunk[c] ?? chunk[0], o);
    o += len;
  }
  return out;
}

/** "earth-jukebox-scanner-20260928-141503.wav" */
export function recordingFileName(mode: string, when: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  const stamp = `${when.getFullYear()}${p(when.getMonth() + 1)}${p(when.getDate())}-${p(when.getHours())}${p(when.getMinutes())}${p(when.getSeconds())}`;
  return `earth-jukebox-${mode}-${stamp}.wav`;
}
