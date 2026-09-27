# Earth Jukebox

NASA Space Apps project: listen to NASA Earth data. The sound carries the data (you can hear trends by ear), and the whole app works with a screen reader or with your eyes closed.

```bash
npm install
npm run dev      # http://localhost:5173
npm test         # unit tests (mapping, parsing, announcements, soft clip)
npm run build
```

## Architecture

| Folder | Role |
| --- | --- |
| `src/data` | Dataset registry, bundled raw data, CSV parsing, text alternatives |
| `src/mapping` | Pure functions: data → pitch / velocity / reference tone / plain-words legend |
| `src/audio` | Tone.js engine (voices, drone, reverb, limiter + soft-clip ceiling) and timeline scheduler |
| `src/state` | Zustand store |
| `src/ui` | React UI, keyboard control, live-region announcements |
| `src/sampling` | *(Phase 2)* GIBS frame sampling + colormap inversion |

## Data

- **Arctic sea ice, September extent, 1979–2025.** NSIDC Sea Ice Index v4 (G02135),
  file `N_09_extent_v4.0.csv` from
  https://noaadata.apps.nsidc.org/NOAA/G02135/north/monthly/data/ (bundled unmodified in `src/data/raw/`).
  Citation: Fetterer, F., Knowles, K., Meier, W. N., Savoie, M., Windnagel, A. K. & Stafford, T. (2025).
  Sea Ice Index. (G02135, Version 4). NSIDC. https://doi.org/10.7265/a98x-0f50

## Keyboard

Space/K play-pause · ←/→ year · Shift+←/→ 10 years · Home/End · +/− tempo · I where am I · L legend · D hum · M mute
