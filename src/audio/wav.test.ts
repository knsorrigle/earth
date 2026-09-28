import { describe, expect, it } from 'vitest';
import { encodeWav, joinChunks, recordingFileName } from './wav';

describe('encodeWav', () => {
  const left = new Float32Array([0, 1, -1, 0.5]);
  const right = new Float32Array([0, -1, 2, -0.5]); // 2 must clamp
  const buf = encodeWav([left, right], 48000);
  const v = new DataView(buf);
  const tag = (o: number) => String.fromCharCode(...new Uint8Array(buf, o, 4));

  it('writes a valid 16-bit PCM stereo header', () => {
    expect(tag(0)).toBe('RIFF');
    expect(tag(8)).toBe('WAVE');
    expect(tag(12)).toBe('fmt ');
    expect(tag(36)).toBe('data');
    expect(v.getUint16(20, true)).toBe(1);
    expect(v.getUint16(22, true)).toBe(2);
    expect(v.getUint32(24, true)).toBe(48000);
    expect(v.getUint32(28, true)).toBe(48000 * 4);
    expect(v.getUint16(32, true)).toBe(4);
    expect(v.getUint16(34, true)).toBe(16);
    expect(v.getUint32(40, true)).toBe(4 * 2 * 2);
    expect(buf.byteLength).toBe(44 + 16);
    expect(v.getUint32(4, true)).toBe(buf.byteLength - 8);
  });

  it('interleaves and clamps samples', () => {
    const s = (i: number) => v.getInt16(44 + i * 2, true);
    expect([s(0), s(1)]).toEqual([0, 0]);
    expect([s(2), s(3)]).toEqual([32767, -32768]);
    expect([s(4), s(5)]).toEqual([-32768, 32767]); // right channel 2 -> clamped to 1
    expect(s(6)).toBe(Math.round(0.5 * 32767));
  });
});

describe('joinChunks', () => {
  it('concatenates per channel', () => {
    const out = joinChunks(
      [
        [new Float32Array([1, 2]), new Float32Array([3, 4])],
        [new Float32Array([5]), new Float32Array([6])],
      ],
      2,
    );
    expect([...out[0]]).toEqual([1, 2, 5]);
    expect([...out[1]]).toEqual([3, 4, 6]);
  });
});

describe('recordingFileName', () => {
  it('stamps mode and local time', () => {
    expect(recordingFileName('scanner', new Date(2026, 8, 28, 14, 15, 3))).toBe('earth-jukebox-scanner-20260928-141503.wav');
  });
});
