import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import { CircleGeometry, Color, type Group, type Mesh, ShaderMaterial, Vector3 } from 'three';
import { engine } from '../../audio/engine';
import { peak, spectrumToBins } from '../../audio/spectrum';
import { DATASETS } from '../../data/registry';
import type { Dataset } from '../../data/types';
import { dampAngle } from '../../globe/focus';
import { baseToFront, facing, orbitPosition } from '../../globe/orbit';
import { recordFragment, recordVertex } from '../../globe/shaders';
import { usePlayerStore } from '../../state/playerStore';
import { playRecord, DROP_MS } from './playRecord';
import { RECORD_LOOKS, RecordIcon } from './records';

const RADIUS = 1.74;
const Y = 0.1;
const DISC = 0.12;

/** The dataset currently loaded in the active mode (the record "on the turntable"). */
function useActiveId(): string {
  const mode = usePlayerStore((s) => s.mode);
  const timelineId = usePlayerStore((s) => s.datasetId);
  const mapId = usePlayerStore((s) => s.explore.datasetId);
  return mode === 'explore' || mode === 'scanner' ? mapId : timelineId;
}

function makeMaterial(ds: Dataset): ShaderMaterial {
  const look = RECORD_LOOKS[ds.id];
  const stops = [...look.stops];
  while (stops.length < 4) stops.push(stops[stops.length - 1]);
  return new ShaderMaterial({
    vertexShader: recordVertex,
    fragmentShader: recordFragment,
    uniforms: {
      uColors: { value: stops.slice(0, 4).map((s) => new Color(s.color)) },
      uPos: { value: stops.slice(0, 4).map((s) => s.t) },
      uSpin: { value: 0 },
      uGlow: { value: 0 },
      uAlpha: { value: 1 },
      uGlowColor: { value: new Color('#8fd8ff') },
    },
    transparent: true,
    depthWrite: false,
    toneMapped: false,
  });
}

/**
 * Datasets as records orbiting the globe. They move only while music plays
 * (speed follows loudness); the loaded record spins. Every disc carries a real
 * button so the shelf works with Tab, arrow keys and screen readers.
 */
export function RecordShelf({ overlay, reduced }: { overlay: React.RefObject<HTMLDivElement | null>; reduced: boolean }) {
  const { invalidate } = useThree();
  const records = DATASETS;
  const n = records.length;
  const activeId = useActiveId();
  const [focused, setFocused] = useState<number | null>(null);
  const [hovered, setHovered] = useState<number | null>(null);

  const groups = useRef<(Group | null)[]>([]);
  const discs = useRef<(Mesh | null)[]>([]);
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);
  const anim = useRef({ base: 0.35, spin: 0, energy: 0, flying: null as null | { index: number; start: number } });

  const geometry = useMemo(() => new CircleGeometry(DISC, 48), []);
  const materials = useMemo(() => records.map(makeMaterial), [records]);
  useEffect(
    () => () => {
      geometry.dispose();
      materials.forEach((m) => m.dispose());
    },
    [geometry, materials],
  );

  // Records are still in silence; wake the canvas when sound starts (the globe may be paused).
  useEffect(() => {
    const id = window.setInterval(() => {
      const db = engine.getSpectrum();
      if (db && peak(spectrumToBins(db, engine.nyquist, 16)) > 0.02) invalidate();
    }, 250);
    return () => window.clearInterval(id);
  }, [invalidate]);

  useEffect(() => {
    invalidate();
  }, [focused, hovered, activeId, invalidate]);

  const front = useMemo(() => new Vector3(), []);

  useFrame(({ camera }, dt) => {
    const a = anim.current;
    const azimuth = Math.atan2(camera.position.x, camera.position.z);
    const db = engine.getSpectrum();
    const level = db ? peak(spectrumToBins(db, engine.nyquist, 16)) : 0;
    a.energy += (level - a.energy) * (1 - Math.exp(-dt * 4));

    if (focused !== null) {
      // Keyboard focus swings that record to the front (functional motion, kept even when quiet).
      const target = baseToFront(focused, n, azimuth);
      a.base = reduced ? target : dampAngle(a.base, target, 1 - Math.exp(-dt * 5));
    } else if (!reduced) {
      a.base += dt * a.energy * 0.35;
    }
    if (!reduced) a.spin += dt * a.energy * 3.5;

    const now = performance.now();
    front.copy(camera.position).multiplyScalar(0.42);
    let busy = focused !== null || a.energy > 0.01;

    records.forEach((ds, i) => {
      const g = groups.current[i];
      const disc = discs.current[i];
      if (!g || !disc) return;
      const [x, y, z] = orbitPosition(i, n, a.base, RADIUS, Y);
      g.position.set(x, y, z);
      disc.quaternion.copy(camera.quaternion);
      let scale = 1;
      let alpha = 0.3 + 0.7 * ((facing(i, n, a.base, azimuth) + 1) / 2);

      const fly = a.flying;
      if (fly && fly.index === i) {
        const t = Math.min(1, (now - fly.start) / DROP_MS);
        const e = t * t * (3 - 2 * t);
        g.position.lerp(front, e);
        scale = 1 + 2.2 * e;
        alpha = 1 - Math.max(0, (t - 0.65) / 0.35);
        if (t >= 1) a.flying = null;
        busy = true;
      }
      g.scale.setScalar(scale);

      const u = materials[i].uniforms;
      const active = ds.id === activeId;
      u.uGlow.value = active ? 1 : focused === i || hovered === i ? 0.7 : 0;
      u.uSpin.value = active ? a.spin : 0;
      u.uAlpha.value = alpha;
      const btn = buttons.current[i];
      if (btn) {
        // Labels of records behind the globe are hidden (they stay in the Tab order; focus brings them round).
        const f = facing(i, n, a.base, azimuth);
        const hidden = f < -0.25 && focused !== i;
        btn.style.opacity = hidden ? '0' : String(Math.max(0.45, alpha));
        btn.style.pointerEvents = hidden ? 'none' : 'auto';
      }
    });
    if (busy) invalidate();
  });

  const select = (i: number) => {
    const ds = records[i];
    if (!reduced) anim.current.flying = { index: i, start: performance.now() };
    invalidate();
    void playRecord(ds, reduced);
  };

  const onKey = (e: React.KeyboardEvent, i: number) => {
    let next: number | null = null;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = (i + 1) % n;
    if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') next = (i + n - 1) % n;
    if (e.key === 'Home') next = 0;
    if (e.key === 'End') next = n - 1;
    if (next === null) return;
    // Arrow keys belong to the shelf while it has focus, not to the mode's shortcuts.
    e.preventDefault();
    e.stopPropagation();
    buttons.current[next]?.focus();
  };

  return (
    <>
      {records.map((ds, i) => {
        const look = RECORD_LOOKS[ds.id];
        const active = ds.id === activeId;
        return (
          <group key={ds.id} ref={(g) => void (groups.current[i] = g)}>
            <mesh ref={(m) => void (discs.current[i] = m)} geometry={geometry} material={materials[i]} renderOrder={5} />
            <Html portal={overlay as React.MutableRefObject<HTMLElement>} position={[0, -DISC - 0.07, 0]} center zIndexRange={[30, 10]}>
              <button
                ref={(b) => void (buttons.current[i] = b)}
                type="button"
                className={`record-btn${active ? ' active' : ''}`}
                aria-label={`${ds.title}: ${ds.timeSeries ? `timeline, ${ds.dateRange.start} to ${ds.dateRange.end}` : 'daily map'}${active ? ', loaded now' : ''}. Press to play.`}
                aria-current={active ? 'true' : undefined}
                onClick={() => select(i)}
                onFocus={() => setFocused(i)}
                onBlur={() => setFocused((f) => (f === i ? null : f))}
                onMouseEnter={() => setHovered(i)}
                onMouseLeave={() => setHovered((h) => (h === i ? null : h))}
                onKeyDown={(e) => onKey(e, i)}
                tabIndex={0}
              >
                <RecordIcon icon={look.icon} />
                <span>{ds.title}</span>
              </button>
            </Html>
          </group>
        );
      })}
    </>
  );
}
