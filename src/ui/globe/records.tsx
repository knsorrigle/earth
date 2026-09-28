import type { PaletteStop } from '../../globe/colors';

/** How each dataset looks as a record on the jukebox: label colours and an icon. */
export interface RecordLook {
  /** Label gradient, low to high value. */
  stops: PaletteStop[];
  icon: 'ice' | 'thermo' | 'co2' | 'wave' | 'flame';
}

export const RECORD_LOOKS: Record<string, RecordLook> = {
  'arctic-sea-ice-september': {
    icon: 'ice',
    stops: [
      { t: 0, color: '#123a6b' },
      { t: 0.5, color: '#4fa3d9' },
      { t: 1, color: '#f4fbff' },
    ],
  },
  'global-temperature': {
    icon: 'thermo',
    stops: [
      { t: 0, color: '#3b6fd8' },
      { t: 0.3, color: '#eef2f7' },
      { t: 1, color: '#d7301f' },
    ],
  },
  'co2-mauna-loa': {
    icon: 'co2',
    stops: [
      { t: 0, color: '#5a8f6a' },
      { t: 0.5, color: '#f2b766' },
      { t: 1, color: '#e0482f' },
    ],
  },
  // Sampled from the GIBS GHRSST colormap: cold purple, blue, green-yellow, hot red.
  'sea-surface-temperature': {
    icon: 'wave',
    stops: [
      { t: 0, color: '#2b001a' },
      { t: 0.35, color: '#2a6bd6' },
      { t: 0.65, color: '#e8e03a' },
      { t: 1, color: '#b01e00' },
    ],
  },
  'active-fires': {
    icon: 'flame',
    stops: [
      { t: 0, color: '#2a3444' },
      { t: 0.6, color: '#ec6210' },
      { t: 1, color: '#ffd166' },
    ],
  },
};

const PATHS: Record<RecordLook['icon'], string> = {
  ice: 'M12 2v20M4 6l16 12M20 6 4 18M9 3l3 3 3-3M9 21l3-3 3 3',
  thermo: 'M10 4a2 2 0 1 1 4 0v9.5a4 4 0 1 1-4 0zM12 10v6',
  co2: 'M7 12a3 3 0 1 0 0-.01M17 7a3 3 0 1 0 0-.01M17 17a3 3 0 1 0 0-.01M9.7 10.6l4.6-2.2M9.7 13.4l4.6 2.2',
  wave: 'M2 9c2.5-3 5-3 7.5 0s5 3 7.5 0 3.5-2 5-1M2 15c2.5-3 5-3 7.5 0s5 3 7.5 0 3.5-2 5-1',
  flame: 'M12 22c4 0 7-3 7-7 0-5-5-7-5-12-3 2-5 5-4 8-2-1-3-2-3-4-2 2-2 5-2 8 0 4 3 7 7 7z',
};

export function RecordIcon({ icon }: { icon: RecordLook['icon'] }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d={PATHS[icon]} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
