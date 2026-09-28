import { describe, expect, it } from 'vitest';
import { Vector3 } from 'three';
import { latLonToXYZ } from './geo';
import { dampAngle, easeElevation, getGlobeFocus, meridianRotation, setGlobeFocus, wrapAngle, yawToFace } from './focus';

const Y = new Vector3(0, 1, 0);

describe('focus provider', () => {
  it('registers and unregisters only its own provider', () => {
    const off = setGlobeFocus(() => ({ lon: 10 }));
    expect(getGlobeFocus()).toEqual({ lon: 10 });
    const off2 = setGlobeFocus(() => ({ lon: 20, beam: true }));
    off(); // stale unregister must not remove the newer provider
    expect(getGlobeFocus()).toEqual({ lon: 20, beam: true });
    off2();
    expect(getGlobeFocus()).toBeNull();
  });
});

describe('angles', () => {
  it('wraps into (-π, π]', () => {
    expect(wrapAngle(3 * Math.PI)).toBeCloseTo(Math.PI);
    expect(wrapAngle(-3 * Math.PI / 2)).toBeCloseTo(Math.PI / 2);
  });
  it('damps along the shortest way round', () => {
    // From 170° to -170° is +20°, not -340°.
    const a = (170 * Math.PI) / 180;
    const b = (-170 * Math.PI) / 180;
    const next = dampAngle(a, b, 0.5);
    expect(wrapAngle(next)).toBeCloseTo(Math.PI, 5);
  });
});

describe('yawToFace', () => {
  it('turns a longitude to face a camera at any azimuth', () => {
    for (const az of [0, 1, -2]) {
      for (const lon of [-150, 0, 80]) {
        const p = new Vector3(...latLonToXYZ(0, lon)).applyAxisAngle(Y, yawToFace(lon, az));
        expect(Math.atan2(p.x, p.z)).toBeCloseTo(wrapAngle(az), 5);
      }
    }
  });
});

describe('meridianRotation', () => {
  it('carries the lon −90 meridian to the requested longitude', () => {
    for (const lon of [-90, 0, 135]) {
      const p = new Vector3(...latLonToXYZ(30, -90)).applyAxisAngle(Y, meridianRotation(lon));
      const q = new Vector3(...latLonToXYZ(30, lon));
      expect(p.distanceTo(q)).toBeLessThan(1e-9);
    }
  });
});

describe('easeElevation', () => {
  it('keeps distance and azimuth while changing elevation', () => {
    const start: [number, number, number] = [1, 0.5, 3];
    const r = Math.hypot(...start);
    const az = Math.atan2(1, 3);
    const end = easeElevation(start, 55, 1);
    expect(Math.hypot(...end)).toBeCloseTo(r);
    expect(Math.atan2(end[0], end[2])).toBeCloseTo(az);
    expect((Math.asin(end[1] / r) * 180) / Math.PI).toBeCloseTo(55);
    const half = easeElevation(start, 55, 0.5);
    const e0 = (Math.asin(0.5 / r) * 180) / Math.PI;
    expect((Math.asin(half[1] / r) * 180) / Math.PI).toBeCloseTo((e0 + 55) / 2);
  });
});
