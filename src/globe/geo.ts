/**
 * Latitude/longitude -> point on a sphere, matching how three.js
 * SphereGeometry wraps an equirectangular (EPSG:4326) texture:
 * u = (lon + 180) / 360, v = (lat + 90) / 180.
 */
export function latLonToXYZ(lat: number, lon: number, radius = 1): [number, number, number] {
  const theta = ((90 - lat) * Math.PI) / 180; // polar angle from +Y
  const phi = ((lon + 180) * Math.PI) / 180; // azimuth, matches SphereGeometry's phi at u
  return [-radius * Math.cos(phi) * Math.sin(theta), radius * Math.cos(theta), radius * Math.sin(phi) * Math.sin(theta)];
}

/** Rotation about +Y that brings a longitude to face the camera on +Z. */
export function rotationToFaceLon(lon: number): number {
  // latLonToXYZ puts lon = -90 at +Z; each degree east moves the point by -1° of rotation.
  return (-(lon + 90) * Math.PI) / 180;
}

/** Inverse of latLonToXYZ: a point (any radius) -> lat/lon in degrees. */
export function xyzToLatLon(x: number, y: number, z: number): { lat: number; lon: number } {
  const r = Math.hypot(x, y, z) || 1;
  const lat = 90 - (Math.acos(Math.max(-1, Math.min(1, y / r))) * 180) / Math.PI;
  let lon = (Math.atan2(z, -x) * 180) / Math.PI - 180;
  if (lon < -180) lon += 360;
  return { lat, lon };
}
