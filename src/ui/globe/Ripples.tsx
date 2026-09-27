import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import {
  AdditiveBlending,
  Color,
  InstancedBufferAttribute,
  InstancedMesh,
  Matrix4,
  Object3D,
  PlaneGeometry,
  Quaternion,
  ShaderMaterial,
  Vector3,
} from 'three';
import { noteBus, type NoteVisual } from '../../audio/noteBus';
import { latLonToXYZ, xyzToLatLon } from '../../globe/geo';
import { rippleFragment, rippleVertex } from '../../globe/shaders';

const MAX_RINGS = 64;
const DURATION = 1.5;
const Z = new Vector3(0, 0, 1);

/**
 * Expanding rings where notes sound, drawn from a fixed pool of instances.
 * Mount as a child of the globe mesh so rings share its rotation.
 */
export function Ripples() {
  const { camera, invalidate } = useThree();
  const meshRef = useRef<InstancedMesh>(null);
  const next = useRef(0);
  const lastEmit = useRef(-Infinity);

  const { geometry, material, color, start, size } = useMemo(() => {
    const geometry = new PlaneGeometry(1, 1);
    const color = new InstancedBufferAttribute(new Float32Array(MAX_RINGS * 3), 3);
    const start = new InstancedBufferAttribute(new Float32Array(MAX_RINGS).fill(-1e6), 1);
    const size = new InstancedBufferAttribute(new Float32Array(MAX_RINGS).fill(0.2), 1);
    geometry.setAttribute('aColor', color);
    geometry.setAttribute('aStart', start);
    geometry.setAttribute('aSize', size);
    const material = new ShaderMaterial({
      vertexShader: rippleVertex,
      fragmentShader: rippleFragment,
      uniforms: { uTime: { value: 0 }, uDuration: { value: DURATION } },
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
      toneMapped: false,
    });
    return { geometry, material, color, start, size };
  }, []);

  useEffect(() => () => {
    geometry.dispose();
    material.dispose();
  }, [geometry, material]);

  useEffect(() => {
    const tmp = new Object3D();
    const q = new Quaternion();
    const m = new Matrix4();
    const c = new Color();
    const camLocal = new Vector3();

    return noteBus.on((e: NoteVisual) => {
      const mesh = meshRef.current;
      if (!mesh) return;
      let { lat, lon } = e;
      if (lat === undefined || lon === undefined) {
        // Missing coordinates are filled from the point of the globe facing the viewer.
        camLocal.copy(camera.position);
        mesh.parent?.worldToLocal(camLocal);
        const facing = xyzToLatLon(camLocal.x, camLocal.y, camLocal.z);
        lat ??= facing.lat;
        lon ??= facing.lon;
      }
      const p = new Vector3(...latLonToXYZ(lat, lon, 1.004));
      q.setFromUnitVectors(Z, p.clone().normalize());
      tmp.position.copy(p);
      tmp.quaternion.copy(q);
      tmp.updateMatrix();
      m.copy(tmp.matrix);

      const i = next.current;
      next.current = (i + 1) % MAX_RINGS;
      mesh.setMatrixAt(i, m);
      mesh.instanceMatrix.needsUpdate = true;
      // Colours arrive in sRGB; the shader works in linear and converts on output.
      c.setRGB(e.color[0], e.color[1], e.color[2]).convertSRGBToLinear();
      color.setXYZ(i, c.r, c.g, c.b);
      color.needsUpdate = true;
      const now = performance.now() / 1000;
      start.setX(i, now);
      start.needsUpdate = true;
      size.setX(i, 0.12 + 0.28 * Math.max(0, Math.min(1, e.velocity)));
      size.needsUpdate = true;
      lastEmit.current = now;
      invalidate();
    });
  }, [camera, invalidate, color, start, size]);

  useFrame(() => {
    const now = performance.now() / 1000;
    material.uniforms.uTime.value = now;
    // Keep rendering while rings are alive, even when the globe itself is paused.
    if (now - lastEmit.current < DURATION + 0.1) invalidate();
  });

  return <instancedMesh ref={meshRef} args={[geometry, material, MAX_RINGS]} frustumCulled={false} renderOrder={2} />;
}
