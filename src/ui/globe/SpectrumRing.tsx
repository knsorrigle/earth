import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { AdditiveBlending, BufferAttribute, BufferGeometry, Color, DoubleSide, type Mesh, ShaderMaterial } from 'three';
import { engine } from '../../audio/engine';
import { peak, smoothInto, spectrumToBins } from '../../audio/spectrum';
import { spectrumFragment, spectrumVertex } from '../../globe/shaders';

const N_BARS = 96; // must match N_BARS in the shader
const HALF = N_BARS / 2; // frequency bins; the ring mirrors them left/right

/** One quad per bar: corners (-1,0) (1,0) (1,1) (-1,1). */
function barGeometry(): BufferGeometry {
  const bar = new Float32Array(N_BARS * 4);
  const corner = new Float32Array(N_BARS * 8);
  const pos = new Float32Array(N_BARS * 12); // unused by the shader but required by three
  const index: number[] = [];
  const corners = [
    [-1, 0],
    [1, 0],
    [1, 1],
    [-1, 1],
  ];
  for (let b = 0; b < N_BARS; b++) {
    for (let c = 0; c < 4; c++) {
      bar[b * 4 + c] = b;
      corner[(b * 4 + c) * 2] = corners[c][0];
      corner[(b * 4 + c) * 2 + 1] = corners[c][1];
    }
    const o = b * 4;
    index.push(o, o + 1, o + 2, o, o + 2, o + 3);
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(pos, 3));
  g.setAttribute('aBar', new BufferAttribute(bar, 1));
  g.setAttribute('aCorner', new BufferAttribute(corner, 2));
  g.setIndex(index);
  return g;
}

/**
 * Live FFT of everything the listener hears, as a halo of bars around the
 * globe. It only moves when there is sound.
 */
export function SpectrumRing() {
  const { invalidate } = useThree();
  const meshRef = useRef<Mesh>(null);
  const mags = useMemo(() => new Float32Array(HALF), []);

  const { geometry, material } = useMemo(() => {
    const material = new ShaderMaterial({
      vertexShader: spectrumVertex,
      fragmentShader: spectrumFragment,
      uniforms: {
        uMags: { value: mags },
        uInner: { value: 1.2 },
        uLength: { value: 0.28 },
        uWidth: { value: 0.024 },
        uLow: { value: new Color('#f2b766') },
        uHigh: { value: new Color('#8fd8ff') },
      },
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
      side: DoubleSide,
      toneMapped: false,
    });
    return { geometry: barGeometry(), material };
  }, [mags]);

  useEffect(
    () => () => {
      geometry.dispose();
      material.dispose();
    },
    [geometry, material],
  );

  // With the globe paused the canvas only draws on demand: poll gently for sound so the ring wakes up.
  useEffect(() => {
    const id = window.setInterval(() => {
      const db = engine.getSpectrum();
      if (db && peak(spectrumToBins(db, engine.nyquist, 16)) > 0.02) invalidate();
    }, 200);
    return () => window.clearInterval(id);
  }, [invalidate]);

  useFrame(({ camera }) => {
    // Always face the viewer: a clean halo from any orbit angle.
    meshRef.current?.quaternion.copy(camera.quaternion);
    const db = engine.getSpectrum();
    const target = db ? spectrumToBins(db, engine.nyquist, HALF) : new Float32Array(HALF);
    smoothInto(mags, target);
    // Keep drawing while anything is still visible (including the slow release).
    if (peak(mags) > 0.005) invalidate();
  });

  return <mesh ref={meshRef} geometry={geometry} material={material} frustumCulled={false} renderOrder={3} />;
}
