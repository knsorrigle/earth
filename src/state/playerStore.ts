import { create } from 'zustand';
import type { HudState } from '../ui/hud/hudModel';

export type AnnounceEvery = 0 | 1 | 5 | 10;

export interface Announcement {
  text: string;
  /** Increments on every announcement so identical text is re-read. */
  id: number;
}

export type Mode = 'timeline' | 'explore' | 'scanner' | 'duet' | 'eartest';

export type EarDifficulty = 'easy' | 'medium' | 'hard';
export type EarSet = 'mixed' | 'timeline' | 'region';

export type FrameStatus = 'idle' | 'loading' | 'ready' | 'error';

export interface ExploreState {
  datasetId: string;
  /** Requested date, YYYY-MM-DD. */
  date: string;
  /** Date actually displayed (differs when a fallback frame is shown). */
  shownDate: string | null;
  cursor: { lat: number; lon: number };
  status: FrameStatus;
  source: 'live' | 'cache' | null;
  /** Fallback / error message in plain words. */
  notice: string;
}

export const SCAN_DURATIONS = [15, 30, 60, 90] as const;
export type ScanDuration = (typeof SCAN_DURATIONS)[number];

export interface ScanState {
  /** Column the beam is on (last heard, or where playback will start). */
  column: number;
  isScanning: boolean;
  /** Seconds for a full west-to-east sweep. */
  durationSec: ScanDuration;
  /** Speak the longitude every N degrees while scanning (0 = only start/end). */
  announceEveryDeg: 0 | 30 | 60 | 90;
}

export interface PlayerState {
  mode: Mode;
  /** Shared by the map modes (Explore, Scanner): dataset, date and frame status. */
  explore: ExploreState;
  scan: ScanState;
  /** A record was chosen on the jukebox: the mode it opens should start playing once ready. */
  autoplay: 'timeline' | 'scanner' | null;
  /** What the globe HUD shows; published by the active mode. */
  hud: HudState | null;
  hudLegend: boolean;
  /** Ear Test settings. */
  ear: { difficulty: EarDifficulty; set: EarSet };
  /** The two records loaded in Duet mode. */
  duet: { a: string; b: string };
  datasetId: string;
  /** Index of the point currently shown / last heard. */
  index: number;
  isPlaying: boolean;
  bpm: number;
  announceEvery: AnnounceEvery;
  droneEnabled: boolean;
  muted: boolean;
  volumeDb: number;
  legendOpen: boolean;
  announcement: Announcement;
  /** Visible caption for the most recent sound event. */
  caption: string;

  setMode: (mode: Mode) => void;
  setExplore: (patch: Partial<ExploreState>) => void;
  setScan: (patch: Partial<ScanState>) => void;
  setDuet: (patch: Partial<{ a: string; b: string }>) => void;
  setEar: (patch: Partial<{ difficulty: EarDifficulty; set: EarSet }>) => void;
  setHud: (hud: HudState | null) => void;
  setAutoplay: (a: 'timeline' | 'scanner' | null) => void;
  setHudLegend: (open: boolean) => void;
  /** Load a different time series in Timeline mode (resets to its first year). */
  setDatasetId: (id: string) => void;
  setIndex: (i: number) => void;
  setPlaying: (p: boolean) => void;
  setBpm: (bpm: number) => void;
  setAnnounceEvery: (n: AnnounceEvery) => void;
  setDroneEnabled: (on: boolean) => void;
  setMuted: (m: boolean) => void;
  setVolumeDb: (db: number) => void;
  setLegendOpen: (open: boolean) => void;
  announce: (text: string) => void;
  setCaption: (text: string) => void;
}

export const BPM_MIN = 40;
export const BPM_MAX = 200;

export const usePlayerStore = create<PlayerState>((set) => ({
  mode: 'timeline',
  explore: {
    datasetId: 'sea-surface-temperature',
    date: '2026-09-01',
    shownDate: null,
    cursor: { lat: 0, lon: -150 },
    status: 'idle',
    source: null,
    notice: '',
  },
  scan: { column: 0, isScanning: false, durationSec: 30, announceEveryDeg: 60 },
  duet: { a: 'co2-mauna-loa', b: 'global-temperature' },
  ear: { difficulty: 'easy', set: 'mixed' },
  hud: null,
  hudLegend: true,
  autoplay: null,
  datasetId: 'arctic-sea-ice-september',
  index: 0,
  isPlaying: false,
  bpm: 100,
  announceEvery: 5,
  droneEnabled: true,
  muted: false,
  volumeDb: -6,
  legendOpen: true,
  announcement: { text: '', id: 0 },
  caption: '',

  setMode: (mode) => set({ mode, caption: '' }),
  setExplore: (patch) => set((s) => ({ explore: { ...s.explore, ...patch } })),
  setScan: (patch) => set((s) => ({ scan: { ...s.scan, ...patch } })),
  setHud: (hud) => set({ hud }),
  setAutoplay: (autoplay) => set({ autoplay }),
  setHudLegend: (hudLegend) => set({ hudLegend }),
  setEar: (patch) => set((s) => ({ ear: { ...s.ear, ...patch } })),
  setDuet: (patch) => set((s) => ({ duet: { ...s.duet, ...patch }, index: 0, isPlaying: false })),
  setDatasetId: (datasetId) => set({ datasetId, index: 0, isPlaying: false, caption: '' }),
  setIndex: (index) => set({ index }),
  setPlaying: (isPlaying) => set({ isPlaying }),
  setBpm: (bpm) => set({ bpm: Math.round(Math.min(BPM_MAX, Math.max(BPM_MIN, bpm))) }),
  setAnnounceEvery: (announceEvery) => set({ announceEvery }),
  setDroneEnabled: (droneEnabled) => set({ droneEnabled }),
  setMuted: (muted) => set({ muted }),
  setVolumeDb: (volumeDb) => set({ volumeDb }),
  setLegendOpen: (legendOpen) => set({ legendOpen }),
  announce: (text) => set((s) => ({ announcement: { text, id: s.announcement.id + 1 } })),
  setCaption: (caption) => set({ caption }),
}));
