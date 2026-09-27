import { CanvasTexture, LinearMipmapLinearFilter, SRGBColorSpace } from 'three';

/** Colour for land / no-data under colormap layers (transparent in GIBS frames). */
export const GLOBE_LAND = '#1b2432';

/**
 * Flatten a GIBS frame (and optional basemap underlay) onto an opaque canvas
 * and wrap it as a texture for the globe.
 */
export function makeGlobeTexture(frame: ImageBitmap, underlay: ImageBitmap | null): CanvasTexture {
  const c = document.createElement('canvas');
  c.width = frame.width;
  c.height = frame.height;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = GLOBE_LAND;
  ctx.fillRect(0, 0, c.width, c.height);
  if (underlay) ctx.drawImage(underlay, 0, 0, c.width, c.height);
  ctx.drawImage(frame, 0, 0, c.width, c.height);
  const tex = new CanvasTexture(c);
  tex.colorSpace = SRGBColorSpace;
  tex.minFilter = LinearMipmapLinearFilter;
  tex.anisotropy = 4;
  tex.needsUpdate = true;
  return tex;
}
