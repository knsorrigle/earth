import { describe, expect, it } from 'vitest';
import { baseToFront, facing, orbitPosition } from './orbit';

describe('record orbit', () => {
  it('spaces records evenly on the circle', () => {
    const ps = [0, 1, 2, 3].map((i) => orbitPosition(i, 4, 0, 2, -0.1));
    expect(ps[0][2]).toBeCloseTo(2);
    expect(ps[1][0]).toBeCloseTo(2);
    expect(ps[2][2]).toBeCloseTo(-2);
    for (const p of ps) {
      expect(Math.hypot(p[0], p[2])).toBeCloseTo(2);
      expect(p[1]).toBe(-0.1);
    }
  });
  it('baseToFront puts the chosen record facing the camera', () => {
    for (const az of [0, 1.2, -2.5]) {
      for (let i = 0; i < 5; i++) {
        const base = baseToFront(i, 5, az);
        expect(facing(i, 5, base, az)).toBeCloseTo(1);
        const [x, , z] = orbitPosition(i, 5, base, 1, 0);
        expect(Math.atan2(x, z)).toBeCloseTo(Math.atan2(Math.sin(az), Math.cos(az)));
      }
    }
  });
  it('the record opposite the front faces away', () => {
    expect(facing(2, 4, baseToFront(0, 4, 0), 0)).toBeCloseTo(-1);
  });
});
