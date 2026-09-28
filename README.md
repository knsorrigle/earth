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
| `src/globe` | Globe maths (lat/lon ↔ sphere, tested against three.js), shaders, textures, WebGL detection |
| `src/ui` | React UI, keyboard control, live-region announcements; `ui/globe` is the three.js stage |
| `src/sampling` | GIBS frame loading (with offline fallback), colormap XML parsing, colour → value inversion (exact match, then nearest in CIE LAB), value grids and frame statistics |

## Globe (Phase 6, step 1)

A three.js globe (react-three-fiber) shows the active GIBS frame — the same image the Explore/Scanner maps use, so no
extra requests. The surface shader is unlit and the renderer has no tone mapping, so colormap colours stay faithful;
only the limb is darkened. Texture swaps crossfade in a shader and the old texture is disposed. Fresnel atmosphere,
restrained bloom (threshold above the brightest data colour), faint static starfield, slow idle rotation with a
Pause button, damped orbit controls. Adaptive DPR and bloom switched off when the performance monitor sees a drop.
Reduced motion: no rotation, instant texture swaps. No WebGL: the globe is skipped and the 2D maps carry everything.
The globe is lazy-loaded so the accessible UI never waits for three.js.

## HUD (Phase 6, step 2)

Each mode publishes a small `HudState` (mode, dataset, date/source, values, place, plain-words legend, scrubber) to
the store; the HUD over the globe renders it. Corners: mode + dataset (with the legend), date + source, value(s) +
difference from the reference, place / lat-lon. The bottom scrubber is data-driven: Timeline = a vinyl groove whose
groove heights are the yearly values; Duet = two interleaved grooves (A up, B down); Scanner = a tape whose ticks show
how many bands sound at each 5° column; Explore = a longitude tape; Ear Test = 8 result segments. The HUD is
`aria-hidden` (its facts are already announced by the mode); **H** or the "Read HUD" button speaks all of it.

## Note ripples (Phase 6, step 3)

`src/audio/noteBus.ts` is a tiny pub/sub: every mode emits `{lat, lon, color, velocity}` at the moment a note is
heard (from the Tone.Draw-synced step callbacks, with strum / half-beat offsets). The globe draws an expanding ring
there: a pool of 64 instanced quads whose growth and fade (1.5 s) run in the shader from a per-instance start time,
so a note costs a few attribute writes. Colours come from the GIBS colormap bin (map data) or the record's palette
(time series). A missing coordinate means "anywhere along it" (pan-Arctic sea ice, global temperature) and is filled
from the point facing the viewer. No ripples before an Ear Test answer (they'd give it away), none under reduced motion.

## Spectrum ring (Phase 6, step 4)

A `Tone.FFT` (1024 bins) taps the mix after the limiter — before the user's volume and mute, so the ring keeps
showing the music for deaf and hard-of-hearing users even when muted. `src/audio/spectrum.ts` (pure, tested) groups
the FFT into 48 log-spaced bands (60 Hz – 8 kHz), maps −95…−35 dB to 0…1 and smooths with fast attack / slow release.
The ring is a camera-facing halo of 96 bars, mirrored: lowest frequencies at the bottom (warm), highest at the top
(cool), so position on the ring means pitch. One mesh; only a 48-float uniform changes per frame. Silent audio = a
faint still baseline; when the globe is paused the canvas redraws only while there is sound. Off under reduced motion.

## Scanner beam and follow (Phase 6, step 5)

Modes offer the globe a focus through `src/globe/focus.ts` (read every frame, like the note bus): Scanner the beam's
audio-timed longitude, Explore the cursor, Timeline/Duet a record's location when it has one (Mauna Loa). The globe,
its ripples and the beam sit in one group that turns — shortest way round, eased — to keep the focus facing the camera
at whatever azimuth the viewer has orbited to; idle auto-rotation pauses while following, and a **Follow** toggle turns
it off. In Scanner a glowing meridian arc marks the beam and the globe shader brightens a ~9° band under it
(`uBeamLon`, `uBeam`). No automatic turning under reduced motion. The yaw maths is unit-tested against three.js.

## Jukebox orbit (Phase 6, step 6)

Every dataset is a record orbiting the globe: a camera-facing vinyl disc (grooves, a sheen, a label painted with the
dataset's own colour scale) plus a real `<button>` (drei `Html`, portalled into an overlay outside the canvas so screen
readers can reach it). The orbit only turns while music plays — speed follows the live spectrum level — and the loaded
record spins; in silence everything holds still. Tab / ←→ / Home / End move between records and swing the focused one to
the front; labels of records behind the globe are hidden but stay in the Tab order. Choosing a record plays a needle drop
(thump + filtered crackle), flies the disc to the centre, then opens its track: time series start in Timeline, maps start a
Scanner sweep (the globe crossfades to the new map). Reduced motion: no orbiting or flight; the choice is instant.

## Intro (Phase 6, step 7)

Browsers only allow sound after a user gesture, so the intro opens on a black screen with **Begin with sound** (focused)
and **Skip intro**. Begin starts a low swelling tone (A1/A2 drone with a soft fifth, filter opening); the globe emerges
through a circular window whose radius follows the tone's actual gain, then the title appears at the peak and the dialog
fades into the app, focus moving to the player. It is a modal dialog (`aria-modal`, the app behind is `inert`, app
shortcuts are blocked); **Esc** skips at any time and **Enter** skips while it plays. Not shown under reduced motion,
and only once per browser session.

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
