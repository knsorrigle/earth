import { describe, expect, it } from 'vitest';
import { SphereGeometry, Vector3 } from 'three';
import { latLonToXYZ, rotationToFaceLon } from './geo';

describe('latLonToXYZ matches three.js SphereGeometry texture mapping', () => {
  const geo = new SphereGeometry(1, 36, 18);
  const pos = geo.attributes.position;
  const uv = geo.attributes.uv;

  it('every vertex lies at the lat/lon its UV samples', () => {
    for (let i = 0; i < pos.count; i++) {
      const u = uv.getX(i);
      const v = uv.getY(i);
      const lon = u * 360 - 180;
      const lat = v * 180 - 90;
      const [x, y, z] = latLonToXYZ(lat, lon);
      expect(x).toBeCloseTo(pos.getX(i), 5);
      expect(y).toBeCloseTo(pos.getY(i), 5);
      expect(z).toBeCloseTo(pos.getZ(i), 5);
    }
  });

  it('poles and radius', () => {
    expect(latLonToXYZ(90, 0)[1]).toBeCloseTo(1);
    expect(latLonToXYZ(-90, 0)[1]).toBeCloseTo(-1);
    const [x, y, z] = latLonToXYZ(12, 34, 2.5);
    expect(Math.hypot(x, y, z)).toBeCloseTo(2.5);
  });

  it('rotationToFaceLon turns a longitude to face +Z', () => {
    for (const lon of [-150, -90, 0, 45, 170]) {
      const p = new Vector3(...latLonToXYZ(0, lon)).applyAxisAngle(new Vector3(0, 1, 0), rotationToFaceLon(lon));
      expect(p.z).toBeCloseTo(1);
    }
  });
});
