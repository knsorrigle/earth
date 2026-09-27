/** "12.5° N, 140.0° W" */
export function formatLatLon(lat: number, lon: number, decimals = 1): string {
  const ns = lat >= 0 ? 'N' : 'S';
  const ew = lon >= 0 ? 'E' : 'W';
  return `${Math.abs(lat).toFixed(decimals)}° ${ns}, ${Math.abs(lon).toFixed(decimals)}° ${ew}`;
}

/** "12.5 degrees north, 140 degrees west" — trailing .0 dropped for speech. */
export function speakLatLon(lat: number, lon: number, decimals = 1): string {
  const f = (v: number) => String(Number(Math.abs(v).toFixed(decimals)));
  const ns = lat === 0 ? '' : lat > 0 ? ' north' : ' south';
  const ew = lon === 0 || Math.abs(lon) === 180 ? '' : lon > 0 ? ' east' : ' west';
  return `${f(lat)} degrees${ns}, ${f(lon)} degrees${ew}`;
}

/** "150 degrees west" */
export function speakLon(lon: number, decimals = 0): string {
  const v = String(Number(Math.abs(lon).toFixed(decimals)));
  if (Number(v) === 0 || Number(v) === 180) return `${v} degrees`;
  return `${v} degrees ${lon > 0 ? 'east' : 'west'}`;
}

/** "150° W" */
export function formatLon(lon: number, decimals = 0): string {
  const v = Math.abs(lon).toFixed(decimals);
  if (Number(v) === 0 || Number(v) === 180) return `${v}°`;
  return `${v}° ${lon > 0 ? 'E' : 'W'}`;
}
