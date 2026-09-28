/**
 * Globe surface: crossfades between two equirectangular textures. Unlit on
 * purpose — the colours are data (a GIBS colormap), so no lighting or tone
 * mapping may shift them. A gentle limb darkening gives depth without
 * changing the colours facing the viewer.
 */
export const globeVertex = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vNormalV;
  varying vec3 vViewDirV;
  void main() {
    vUv = uv;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vNormalV = normalize(normalMatrix * normal);
    vViewDirV = normalize(-mv.xyz);
    gl_Position = projectionMatrix * mv;
  }
`;

export const globeFragment = /* glsl */ `
  uniform sampler2D uTexA;
  uniform sampler2D uTexB;
  uniform float uMix;
  uniform vec3 uRimColor;
  uniform float uBeamLon;
  uniform float uBeam;
  uniform vec3 uBeamColor;
  varying vec2 vUv;
  varying vec3 vNormalV;
  varying vec3 vViewDirV;
  void main() {
    vec4 a = texture2D(uTexA, vUv);
    vec4 b = texture2D(uTexB, vUv);
    vec3 c = mix(a.rgb, b.rgb, uMix);
    // Scanner: brighten the surface under the beam (a soft band ~9° wide around its meridian).
    float lon = vUv.x * 360.0 - 180.0;
    float dLon = abs(mod(lon - uBeamLon + 540.0, 360.0) - 180.0);
    float beam = exp(-pow(dLon / 9.0, 2.0)) * uBeam;
    c = c * (1.0 + 0.6 * beam) + uBeamColor * 0.1 * beam;
    float ndv = clamp(dot(vNormalV, vViewDirV), 0.0, 1.0);
    float limb = mix(0.45, 1.0, pow(ndv, 0.6));
    // Thin atmospheric rim on the surface itself, only at the very edge.
    vec3 rim = uRimColor * pow(1.0 - ndv, 4.0) * 0.45;
    gl_FragColor = vec4(c * limb + rim, 1.0);
    #include <colorspace_fragment>
  }
`;

/** Atmosphere: Fresnel rim on a slightly larger back-facing sphere, additive. */
export const atmosphereVertex = /* glsl */ `
  varying vec3 vNormalV;
  varying vec3 vViewDirV;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vNormalV = normalize(normalMatrix * normal);
    vViewDirV = normalize(-mv.xyz);
    gl_Position = projectionMatrix * mv;
  }
`;

export const atmosphereFragment = /* glsl */ `
  uniform vec3 uColor;
  uniform float uStrength;
  varying vec3 vNormalV;
  varying vec3 vViewDirV;
  void main() {
    // Back faces of a sphere ~9% larger than the globe. Just outside the globe's edge the
    // back-face normal points ~0.41 away from the viewer; at the halo's outer edge it is
    // perpendicular (0). Brightest against the globe, fading to nothing outward.
    float d = clamp(-dot(vNormalV, vViewDirV), 0.0, 1.0);
    float glow = pow(smoothstep(0.0, 0.41, d), 3.0) * uStrength;
    gl_FragColor = vec4(uColor * glow, glow);
  }
`;

/**
 * Note ripples: one instanced quad per ring, tangent to the globe. Growth and
 * fade are computed in the shader from each instance's start time, so the CPU
 * only writes a few floats when a note fires.
 */
export const rippleVertex = /* glsl */ `
  attribute vec3 aColor;
  attribute float aStart;
  attribute float aSize;
  uniform float uTime;
  uniform float uDuration;
  varying vec2 vUv;
  varying vec3 vColor;
  varying float vLife;
  void main() {
    float life = clamp((uTime - aStart) / uDuration, 0.0, 1.0);
    float grow = 1.0 - pow(1.0 - life, 3.0);
    vec3 p = position * aSize * mix(0.12, 1.0, grow);
    vUv = uv;
    vColor = aColor;
    vLife = life;
    gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(p, 1.0);
  }
`;

export const rippleFragment = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vColor;
  varying float vLife;
  void main() {
    if (vLife >= 1.0) discard;
    float d = length(vUv - 0.5) * 2.0;
    // A crisp ring with a soft inner trail.
    float ring = smoothstep(0.66, 0.84, d) * (1.0 - smoothstep(0.88, 1.0, d));
    float trail = smoothstep(0.15, 0.84, d) * (1.0 - smoothstep(0.84, 0.94, d)) * 0.3;
    float a = (ring + trail) * pow(1.0 - vLife, 1.4);
    gl_FragColor = vec4(vColor * (1.6 * a), a);
    #include <colorspace_fragment>
  }
`;

/**
 * Spectrum ring: a halo of N bars facing the viewer. It is mirrored: bars rise
 * from the bottom (lowest frequencies, warm) up both sides to the top (highest,
 * cool), so position on the ring always means pitch. Only uMags changes per frame.
 */
export const spectrumVertex = /* glsl */ `
  #define N_BARS 96
  #define HALF 48
  attribute float aBar;   // bar index 0..N_BARS-1
  attribute vec2 aCorner; // x: -1/1 across the bar, y: 0 inner / 1 outer
  uniform float uMags[HALF];
  uniform float uInner;
  uniform float uLength;
  uniform float uWidth;
  varying float vMag;
  varying float vT;
  varying float vY;
  void main() {
    int k = aBar < float(HALF) ? int(aBar) : int(float(N_BARS) - 1.0 - aBar);
    float mag = uMags[k];
    float ang = -1.5707963 + (aBar + 0.5) / float(N_BARS) * 6.2831853;
    vec2 dir = vec2(cos(ang), sin(ang));
    vec2 side = vec2(-dir.y, dir.x);
    float r = uInner + aCorner.y * (0.006 + mag * uLength);
    vec2 p = dir * r + side * aCorner.x * uWidth * 0.5;
    vMag = mag;
    vT = float(k) / float(HALF - 1);
    vY = aCorner.y;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 0.0, 1.0);
  }
`;

export const spectrumFragment = /* glsl */ `
  uniform vec3 uLow;
  uniform vec3 uHigh;
  varying float vMag;
  varying float vT;
  varying float vY;
  void main() {
    vec3 col = mix(uLow, uHigh, vT);
    // Brighter with level, fading toward the outer tip.
    float a = (0.1 + 0.9 * vMag) * (1.0 - 0.6 * vY);
    gl_FragColor = vec4(col * a, a);
    #include <colorspace_fragment>
  }
`;

/**
 * Jukebox record: a vinyl disc facing the viewer. Grooves, a sheen that turns
 * with uSpin (only while its music plays), a centre label painted with the
 * dataset's own colour scale (uStops), and a glow rim when active / focused.
 */
export const recordVertex = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

export const recordFragment = /* glsl */ `
  uniform vec3 uColors[4];
  uniform float uPos[4];
  uniform float uSpin;
  uniform float uGlow;
  uniform float uAlpha;
  uniform vec3 uGlowColor;
  varying vec2 vUv;

  vec3 palette(float t) {
    vec3 c = uColors[0];
    for (int i = 1; i < 4; i++) {
      float a = uPos[i - 1];
      float b = uPos[i];
      if (b > a) c = mix(c, uColors[i], clamp((t - a) / (b - a), 0.0, 1.0));
    }
    return c;
  }

  void main() {
    vec2 p = vUv * 2.0 - 1.0;
    float r = length(p);
    if (r > 1.0) discard;
    float ang = atan(p.y, p.x) - uSpin;
    // Vinyl with fine grooves and a sheen that sweeps round as it spins.
    vec3 col = vec3(0.035, 0.045, 0.06) + 0.035 * (0.5 + 0.5 * sin(r * 95.0));
    col += vec3(0.16) * pow(abs(cos(ang)), 18.0) * smoothstep(0.45, 0.6, r) * (1.0 - smoothstep(0.9, 0.97, r));
    // Label: the dataset's colour scale, low (bottom) to high (top), turning with the record.
    vec2 q = vec2(cos(-uSpin) * p.x - sin(-uSpin) * p.y, sin(-uSpin) * p.x + cos(-uSpin) * p.y);
    float label = 1.0 - smoothstep(0.43, 0.45, r);
    col = mix(col, palette(clamp(q.y / 0.88 + 0.5, 0.0, 1.0)), label);
    col = mix(col, vec3(0.02), 1.0 - smoothstep(0.05, 0.065, r)); // spindle hole
    // Rim glow.
    float rim = smoothstep(0.86, 0.97, r) * (1.0 - smoothstep(0.97, 1.0, r));
    col += uGlowColor * rim * (0.25 + 1.4 * uGlow);
    gl_FragColor = vec4(col, uAlpha);
    #include <colorspace_fragment>
  }
`;
