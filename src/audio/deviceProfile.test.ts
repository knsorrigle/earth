import { describe, expect, it } from 'vitest';
import { audioProfileFor, isConstrainedDevice } from './deviceProfile';

const env = (userAgent: string, coarsePointer = false, maxTouchPoints = 0) => ({ userAgent, coarsePointer, maxTouchPoints });

describe('isConstrainedDevice', () => {
  it('detects phones and tablets', () => {
    expect(isConstrainedDevice(env('Mozilla/5.0 (Linux; Android 14; Pixel 8) Mobile Safari'))).toBe(true);
    expect(isConstrainedDevice(env('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)'))).toBe(true);
    // iPadOS pretends to be a Mac but has touch.
    expect(isConstrainedDevice(env('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', false, 5))).toBe(true);
    expect(isConstrainedDevice(env('Mozilla/5.0 (X11; Linux x86_64)', true))).toBe(true);
  });
  it('leaves desktops alone', () => {
    expect(isConstrainedDevice(env('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', false, 0))).toBe(false);
    expect(isConstrainedDevice(env('Mozilla/5.0 (Windows NT 10.0; Win64; x64)'))).toBe(false);
  });
});

describe('audioProfileFor', () => {
  it('phones get bigger buffers, more lookahead and a lighter graph', () => {
    const phone = audioProfileFor(true);
    const desk = audioProfileFor(false);
    expect(phone.latencyHint).toBe('playback');
    expect(phone.lookAhead).toBeGreaterThan(desk.lookAhead);
    expect(phone.reverbDecay).toBeLessThan(desk.reverbDecay);
    expect(phone.scanPolyphony).toBeLessThan(desk.scanPolyphony);
    expect(phone.clipperOversample).toBe('none');
  });
});
