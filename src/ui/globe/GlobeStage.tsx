import { Component, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, PerformanceMonitor, Stars } from '@react-three/drei';
import { Bloom, EffectComposer } from '@react-three/postprocessing';
import { useReducedMotion } from 'framer-motion';
import { AdditiveBlending, BackSide, Color, DataTexture, ShaderMaterial, SRGBColorSpace, type Texture } from 'three';
import { getDataset } from '../../data/registry';
import { rotationToFaceLon } from '../../globe/geo';
import { atmosphereFragment, atmosphereVertex, globeFragment, globeVertex } from '../../globe/shaders';
import { makeGlobeTexture } from '../../globe/texture';
import { hasWebGL } from '../../globe/webgl';
import { usePlayerStore } from '../../state/playerStore';
import { useGibsFrame } from '../map/useGibsFrame';
import { Hud } from '../hud/Hud';
import { Ripples } from './Ripples';

const FADE_MS = 900;
const RIM = new Color('#7cc8ff');

function blankTexture(): Texture {
  const t = new DataTexture(new Uint8Array([27, 36, 50, 255]), 1, 1);
  t.colorSpace = SRGBColorSpace;
  t.needsUpdate = true;
  return t;
}

/** The data globe: crossfades to each new frame, disposing the old texture afterwards. */
function Globe({ bitmap, underlay, reduced, faceLon }: { bitmap: ImageBitmap | null; underlay: ImageBitmap | null; reduced: boolean; faceLon: number }) {
  const { invalidate } = useThree();
  const blank = useMemo(blankTexture, []);
  // Built imperatively: R3F copies a `uniforms` prop, and texture swaps must reach the live material.
  const material = useMemo(
    () =>
      new ShaderMaterial({
        vertexShader: globeVertex,
        fragmentShader: globeFragment,
        uniforms: { uTexA: { value: blank as Texture }, uTexB: { value: blank as Texture }, uMix: { value: 0 }, uRimColor: { value: RIM } },
        toneMapped: false,
      }),
    [blank],
  );
  const uniforms = material.uniforms as { uTexA: { value: Texture }; uTexB: { value: Texture }; uMix: { value: number } };
  const fadeStart = useRef<number | null>(null);

  const finishFade = () => {
    const old = uniforms.uTexA.value;
    uniforms.uTexA.value = uniforms.uTexB.value;
    uniforms.uMix.value = 0;
    fadeStart.current = null;
    if (old !== blank && old !== uniforms.uTexA.value) old.dispose();
  };

  useEffect(() => {
    if (!bitmap) return;
    const tex = makeGlobeTexture(bitmap, underlay);
    if (fadeStart.current !== null) finishFade(); // a fade was running: settle it first
    if (uniforms.uTexA.value === blank) {
      uniforms.uTexA.value = tex;
      uniforms.uTexB.value = tex;
    } else {
      uniforms.uTexB.value = tex;
      uniforms.uMix.value = 0;
      if (reduced) finishFade();
      else fadeStart.current = performance.now();
    }
    invalidate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bitmap, underlay]);

  useEffect(
    () => () => {
      const a = uniforms.uTexA.value;
      const b = uniforms.uTexB.value;
      if (a !== blank) a.dispose();
      if (b !== blank && b !== a) b.dispose();
      blank.dispose();
      material.dispose();
    },
    [uniforms, blank, material],
  );

  useFrame(() => {
    if (fadeStart.current === null) return;
    const t = Math.min(1, (performance.now() - fadeStart.current) / FADE_MS);
    uniforms.uMix.value = t * t * (3 - 2 * t);
    if (t >= 1) finishFade();
    invalidate();
  });

  return (
    <mesh rotation={[0, rotationToFaceLon(faceLon), 0]} material={material}>
      <sphereGeometry args={[1, 128, 64]} />
      {/* Ripples ride on the globe. None under reduced motion: every note still has sound and a caption. */}
      {!reduced && <Ripples />}
    </mesh>
  );
}

const BASE_DISTANCE = 3.9;
const FOV = 36;

/** Keep the whole globe (plus halo) in view on narrow, portrait stages. */
function FitCamera() {
  const { camera, size, invalidate } = useThree();
  useEffect(() => {
    const aspect = size.width / Math.max(1, size.height);
    const halfV = Math.tan(((FOV / 2) * Math.PI) / 180);
    const needed = 1.2 / (halfV * Math.min(1, aspect)); // 1.2 ≈ globe + halo, with a little margin
    camera.position.setLength(Math.max(BASE_DISTANCE, needed));
    invalidate();
  }, [camera, size, invalidate]);
  return null;
}

function Atmosphere() {
  const uniforms = useMemo(() => ({ uColor: { value: new Color('#5fb8ff') }, uStrength: { value: 0.85 } }), []);
  return (
    <mesh scale={1.09}>
      <sphereGeometry args={[1, 64, 32]} />
      <shaderMaterial
        vertexShader={atmosphereVertex}
        fragmentShader={atmosphereFragment}
        uniforms={uniforms}
        side={BackSide}
        blending={AdditiveBlending}
        transparent
        depthWrite={false}
        toneMapped={false}
      />
    </mesh>
  );
}

/** If WebGL fails at runtime, drop the globe quietly: the 2D maps still carry everything. */
class GlobeBoundary extends Component<{ children: ReactNode; onError: () => void }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch() {
    this.props.onError();
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

/**
 * Hero globe showing the active GIBS layer. Purely visual: every piece of
 * information on it is also available as text and sound elsewhere.
 */
export default function GlobeStage() {
  const datasetId = usePlayerStore((s) => s.explore.datasetId);
  const shownDate = usePlayerStore((s) => s.explore.shownDate);
  const dataset = getDataset(datasetId);
  const frame = useGibsFrame(dataset, null);
  const reduced = useReducedMotion() ?? false;
  const [available, setAvailable] = useState(hasWebGL);
  const [rotating, setRotating] = useState(!reduced);
  const [bloom, setBloom] = useState(true);
  const [dpr, setDpr] = useState(1.5);

  useEffect(() => {
    if (reduced) setRotating(false);
  }, [reduced]);

  if (!available) return null;

  const label = `3D globe showing ${dataset.title}${shownDate ? ` on ${shownDate}` : ''}. Drag to turn it; scroll or pinch to zoom.`;

  return (
    <section className="stage" aria-label="Globe">
      <div className="stage-canvas" role="img" aria-label={label}>
        <GlobeBoundary onError={() => setAvailable(false)}>
          <Canvas
            flat
            dpr={dpr}
            frameloop={rotating ? 'always' : 'demand'}
            camera={{ position: [0, 0.9, BASE_DISTANCE], fov: FOV, near: 0.1, far: 200 }}
            gl={{ antialias: true, powerPreference: 'high-performance', alpha: false }}
            fallback={null}
          >
            <PerformanceMonitor
              onChange={({ factor }) => setDpr(Math.round((1 + factor) * 10) / 10)}
              onDecline={() => setBloom(false)}
              flipflops={3}
              onFallback={() => {
                setBloom(false);
                setDpr(1);
              }}
            />
            <color attach="background" args={['#05070b']} />
            <FitCamera />
            <Stars radius={80} depth={40} count={1400} factor={3} saturation={0} fade speed={0} />
            <Globe bitmap={frame.bitmap} underlay={frame.underlay} reduced={reduced} faceLon={-40} />
            <Atmosphere />
            <OrbitControls
              enablePan={false}
              enableDamping
              dampingFactor={0.08}
              rotateSpeed={0.5}
              minDistance={1.8}
              maxDistance={7}
              autoRotate={rotating}
              autoRotateSpeed={0.35}
            />
            {bloom && (
              <EffectComposer multisampling={0}>
                <Bloom mipmapBlur luminanceThreshold={0.95} luminanceSmoothing={0.05} intensity={0.55} />
              </EffectComposer>
            )}
          </Canvas>
        </GlobeBoundary>
      </div>
      <Hud
        controls={
          <button type="button" className="btn small ghost" onClick={() => setRotating((r) => !r)} aria-pressed={!rotating}>
            {rotating ? 'Pause rotation' : 'Resume rotation'}
          </button>
        }
      />
    </section>
  );
}
