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
  varying vec2 vUv;
  varying vec3 vNormalV;
  varying vec3 vViewDirV;
  void main() {
    vec4 a = texture2D(uTexA, vUv);
    vec4 b = texture2D(uTexB, vUv);
    vec3 c = mix(a.rgb, b.rgb, uMix);
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
