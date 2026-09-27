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
| `src/sampling` | GIBS frame loading (with offline fallback), colormap XML parsing, colour → value inversion (exact match, then nearest in CIE LAB), value grids and frame statistics |

## Modes

- **Timeline:** one note per year; pitch = value; a hum tuned to the reference year.
- **Explore map:** a gliding tone for the value under the cursor; west/east panned left/right; pink noise over land.
- **Scanner:** a beam sweeps west → east in 72 steps of 5°. Each step strums up to 8 latitude bands north → south
  (22.5° each). Band = register (north higher); within a band, pitch follows that band's own range across the frame, so
  regional contrasts are audible at every latitude; velocity follows ocean coverage; all-land cells are silent.

- **Duet:** two time series on one shared timeline (the years both cover). Record A is a triangle mallet, high register,
  panned left, on the beat; record B is an FM bell, low register, panned right, half a beat later. Both use A minor
  pentatonic so they always harmonise. The legend states how closely they move together (Pearson correlation).

- **Ear Test:** 8-question rounds. Two clips (three notes each, fixed loudness): the first in the left ear, the second in
  the right. Pick which one is more / less with ← / →. Questions come from the timeline records (two years) or from
  today's SST map (two named ocean regions, ocean pixels only). Difficulty = pitch distance between the clips (easy ≥ 5
  scale steps, medium 3–4, hard 1–2; never the same note). The reveal speaks the real values and shows the two years on
  the record or the two regions on the map. Best round per difficulty is kept in this browser only.

## Data

- **Arctic sea ice, September extent, 1979–2025.** NSIDC Sea Ice Index v4 (G02135),
  file `N_09_extent_v4.0.csv` from
  https://noaadata.apps.nsidc.org/NOAA/G02135/north/monthly/data/ (bundled unmodified in `src/data/raw/`).
  Citation: Fetterer, F., Knowles, K., Meier, W. N., Savoie, M., Windnagel, A. K. & Stafford, T. (2025).
  Sea Ice Index. (G02135, Version 4). NSIDC. https://doi.org/10.7265/a98x-0f50

- **Sea surface temperature, daily global map.** GHRSST L4 MUR 0.25° v4.2 (`MUR25-JPL-L4-GLOB-v04.2`),
  JPL MUR MEaSUREs Project, https://doi.org/10.5067/GHM25-4FJ42, served by NASA GIBS as layer
  `GHRSST_L4_MUR25_Sea_Surface_Temperature` (verified in the GIBS EPSG:4326 WMTS capabilities).
  Frames are requested from the GIBS WMS at 1440×720 (the product's native 0.25° grid) and converted back
  to °C with the layer's colormap, `https://gibs.earthdata.nasa.gov/colormaps/v1.3/GHRSST_Sea_Surface_Temperature.xml`
  (215 bins of 0.15 °C; transparent = land / no data).
  Offline fallback: `public/frames/<layer>/<date>.png` (2025-09-01, 2026-03-01, 2026-09-01) and
  `public/colormaps/`, fetched from the same WMS on 2026-09-28.

- **Global temperature, 1880–2025.** NASA GISS GISTEMP v4, global land–ocean annual mean (J–D column) as anomaly vs
  1951–1980, file `GLB.Ts+dSST.csv` from https://data.giss.nasa.gov/gistemp/tabledata_v4/ (bundled unmodified; the
  incomplete current year, marked `***`, is skipped). Cite: GISTEMP Team, 2026: GISS Surface Temperature Analysis
  (GISTEMP), version 4. NASA GISS. Dataset accessed 2026-09-28 at https://data.giss.nasa.gov/gistemp/; and Lenssen et al.
  2024, doi:10.1029/2023JD040179.
- **Carbon dioxide, 1959–2025.** NOAA GML Mauna Loa annual mean, `co2_annmean_mlo.csv` from
  https://gml.noaa.gov/webdata/ccgg/trends/co2/ (bundled unmodified). Credit: Dr. Xin Lan, NOAA/GML and Dr. Ralph Keeling,
  Scripps Institution of Oceanography.
- **Active fires, daily map.** GIBS layer `MODIS_Combined_Thermal_Anomalies_All` (MODIS Terra + Aqua, FIRMS NRT,
  MCD14DL v6.1NRT, https://doi.org/10.5067/FIRMS/MODIS/MCD14DL.NRT.0061), requested from the WMS with style `size5`.
  GIBS draws every detection as one orange marker (236, 98, 16), so there is no colormap to invert; the app measures the
  share of area covered by markers — a relative activity index, not burned area. Basemap and land mask: GIBS
  `OSM_Land_Water_Map` (© OpenStreetMap contributors), bundled in `public/basemaps/`. Fallback frames for the same three
  dates in `public/frames/MODIS_Combined_Thermal_Anomalies_All/`.

## Keyboard

**Timeline:**


Space/K play-pause · ←/→ year · Shift+←/→ 10 years · Home/End · +/− tempo · I where am I · L legend · D hum · M mute

**Explore map:** arrows move 1° · Shift+arrows 10° · I value + location · F describe the map · L legend · [ / ] previous / next day · M mute

**Scanner:** Space/K start-pause sweep · ←/→ step 5° · Shift+←/→ 30° · Home/End · +/− sweep speed · I describe the line under the beam · F describe the map · L legend · [ / ] day

**Duet:** same keys as Timeline (no hum)

**Ear Test:** Enter start / next · Space play both clips · Shift+←/→ play one clip · ←/→ answer first / second · I repeat question · S score · L how it works

**Everywhere:** 1 Timeline · 2 Explore · 3 Scanner · 4 Duet · 5 Ear Test · M mute
