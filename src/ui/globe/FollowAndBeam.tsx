import { useEffect, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { AdditiveBlending, CatmullRomCurve3, type Group, MeshBasicMaterial, type ShaderMaterial, TubeGeometry, Vector3 } from 'three';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import { dampAngle, getGlobeFocus, meridianRotation, yawToFace } from '../../globe/focus';
import { latLonToXYZ } from '../../globe/geo';

/** Seconds-based easing constants: how quickly the globe turns and the beam fades. */
const TURN_RATE = 3.5;
const FADE_RATE = 6;

/**
 * Turns the globe so the active mode's focus (scanner beam, cursor, record
 * location) faces the viewer, and drives the beam's position and strength.
 */
export function FollowController({
  worldRef,
  beamRef,
  globeMaterial,
  controlsRef,
  follow,
  rotating,
}: {
  worldRef: React.RefObject<Group | null>;
  beamRef: React.RefObject<Group | null>;
  globeMaterial: React.RefObject<ShaderMaterial | null>;
  controlsRef: React.RefObject<OrbitControlsImpl | null>;
  follow: boolean;
  rotating: boolean;
}) {
  const { invalidate } = useThree();
  const state = useMemo(() => ({ strength: 0, lon: 0 }), []);

  // With the globe paused the canvas draws on demand: wake it while a mode offers a focus.
  useEffect(() => {
    const id = window.setInterval(() => {
      if (getGlobeFocus()) invalidate();
    }, 250);
    return () => window.clearInterval(id);
  }, [invalidate]);

  useFrame(({ camera }, dt) => {
    const f = getGlobeFocus();
    const following = follow && !!f;
    // Idle auto-rotation fights following; it only runs when nothing is being followed.
    if (controlsRef.current) controlsRef.current.autoRotate = rotating && !following;

    const world = worldRef.current;
    if (world && f && following) {
      const azimuth = Math.atan2(camera.position.x, camera.position.z);
      world.rotation.y = dampAngle(world.rotation.y, yawToFace(f.lon, azimuth), 1 - Math.exp(-dt * TURN_RATE));
    }

    const target = f?.beam ? 1 : 0;
    state.strength += (target - state.strength) * (1 - Math.exp(-dt * FADE_RATE));
    if (f?.beam) state.lon = f.lon;

    const m = globeMaterial.current;
    if (m) {
      m.uniforms.uBeam.value = state.strength;
      m.uniforms.uBeamLon.value = state.lon;
    }
    const beam = beamRef.current;
    if (beam) {
      beam.visible = state.strength > 0.01;
      beam.rotation.y = meridianRotation(state.lon);
      for (const child of beam.children) {
        const mat = (child as unknown as { material: MeshBasicMaterial }).material;
        mat.opacity = (mat.userData.base as number) * state.strength;
      }
    }
    if (f || state.strength > 0.01) invalidate();
  });

  return null;
}

/** A glowing meridian from pole to pole, built at lon −90 and turned into place by FollowController. */
export function ScanBeam({ beamRef }: { beamRef: React.RefObject<Group | null> }) {
  const parts = useMemo(() => {
    const pts: Vector3[] = [];
    for (let lat = -88; lat <= 88; lat += 2) pts.push(new Vector3(...latLonToXYZ(lat, -90, 1.012)));
    const curve = new CatmullRomCurve3(pts);
    const make = (radius: number, color: string, opacity: number) => {
      const material = new MeshBasicMaterial({
        color,
        transparent: true,
        opacity,
        blending: AdditiveBlending,
        depthWrite: false,
        toneMapped: false,
      });
      material.userData.base = opacity;
      return { geometry: new TubeGeometry(curve, 160, radius, 8, false), material };
    };
    return [make(0.024, '#ffd166', 0.22), make(0.005, '#fff1c9', 0.95)];
  }, []);

  useEffect(
    () => () => {
      for (const p of parts) {
        p.geometry.dispose();
        p.material.dispose();
      }
    },
    [parts],
  );

  return (
    <group ref={beamRef} visible={false}>
      {parts.map((p, i) => (
        <mesh key={i} geometry={p.geometry} material={p.material} renderOrder={4} />
      ))}
    </group>
  );
}
