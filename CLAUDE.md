# Vietnam Trip Website

Multi-file React app. JSX is **precompiled** to plain JS by `./build.sh` (esbuild). No in-browser Babel.

## Build (IMPORTANT)
- Edit the `.jsx` source files, never the generated `.js`.
- After editing `trip-app.jsx` or `trip-icons.jsx`, run **`./build.sh`** (uses `npx esbuild`), then commit the generated `trip-app.js` + `trip-icons.js` alongside.
- `index.html` loads the compiled `trip-icons.js` / `trip-app.js` as plain scripts.

## Files
- `index.html` — HTML shell, all CSS, theme tokens, loader, meta/OG tags, script tags
- `trip-app.jsx` → compiled to `trip-app.js` — main React app: Hero, Dashboard, DayBar, Itinerary, RegionalMap, VietnamMap, MapDrawer, Flights, Hotels, Phrases, Footer, currency converter
- `trip-icons.jsx` → compiled to `trip-icons.js` — SVG icons, exposed as `window.Icon` + `window.weatherIcon`
- `trip-data.js` — single source of truth, `window.TRIP_DATA` (meta, flights, days, hotels, phrases, weather fallback, mapPins, routeOrder)
- `image-slot.js` — custom `<image-slot>` web component. On GitHub Pages it falls back to the `src` attribute
- `build.sh` — esbuild transpile step
- `manifest.webmanifest`, `favicon.svg`, `favicon-64.png`, `apple-touch-icon.png`, `icon-192.png`, `icon-512.png`, `og-cover.jpg` — share/PWA assets (regenerate icons/OG via PIL if branding changes)
- `img/` — all images (JPG/PNG)

## CDN scripts (in `index.html`)
- React 18.3.1 **production.min**, ReactDOM 18.3.1 **production.min**
- **Leaflet 1.9.4** (CSS in `<head>`, JS before app scripts) — real interactive maps, free CARTO basemap tiles (no API key)
- No Babel (precompiled — see Build).

## Live data (free, no API key, with fallback)
- **Weather (dashboard, current)**: Open-Meteo forecast + air-quality APIs, fetched per city in `Dashboard`. `cityCoords` must have an entry for every `D.weather` key. Falls back to static `D.weather` on failure. `window.wmoWeather(code)` (in `trip-icons.jsx`) maps WMO codes → `{icon, cond}`.
- **Trip forecast (per day)**: `useTripForecast()` fetches Open-Meteo 16-day daily for the 4 trip locations (`WX_LOCS`). Each itinerary day shows a `.wx-chip` (hi/lo + icon, or "Forecast nearer the date" if the date is beyond the 16-day window). Tapping any chip opens `WeatherDrawer` (reuses `.drawer` shell) with a `.wx-strip` of all 13 days. Open-Meteo only forecasts 16 days out, so the back of the trip is a placeholder until it enters the window. `dayLocId(city)` maps a day to a location; `dayIso(d)` builds the `2026-06-DD` date.
- **Exchange rate**: `open.er-api.com/v6/latest/AUD`, fetched in `Dashboard` into `rate` state (init `16450` snapshot as fallback).

## Maps
- `VietnamMap` in `trip-app.jsx` is a **Leaflet** map (not SVG). Reads `D.mapPins` (lat/lng) + `D.routeOrder`. Numbered markers + dashed route polyline. Tile layer swaps light/dark with `data-theme`; route colour tracks `--accent`. Uses a ResizeObserver + `invalidateSize()` so it renders correctly inside the off-screen drawer. `interactive={false}` for the mini preview in the Route section.
- Do NOT add global `svg { width:100%; height:100% }` rules scoped to `.map-mini`/`.map-full`/`.region-map-canvas` — they blow up Leaflet's internal attribution flag SVG. (Removed for this reason.)
- `RegionalMap` (per-day segment map) is also **Leaflet** now: static (no drag/zoom), base + dest markers (`.seg-base`/`.seg-dest`), dashed line, fit to both points. Reads `region.base`/`region.dest` `{name, lat, lng}`. The travel-stats panel (bearing/distance/duration/transport) sits above it and is the source of the travel times.

## Deploy
GitHub Pages: `doosyy.github.io/Vietnam-Trip/`. If you edited any `.jsx`, run `./build.sh` first, then:
`git add -A && git commit -m "..." && git push origin main`

## Key facts
- Travellers: Christine, Ashraf, Jason, Chris
- Dates: 11–23 June 2026, Melbourne → HCMC → Hanoi → Melbourne
- Fonts (Google Fonts): **Bricolage Grotesque** (display), **Manrope** (body), **JetBrains Mono** (labels)
- Color system: `oklch()` (needs iOS 15.4+/Safari 15.4+ — fine for current devices)
- Palette tokens: `--emerald`, `--lantern`, `--terracotta`, `--paper`, `--ink`. Light theme is default. `data-theme="night"` on `<html>` swaps to dark; set by the Itinerary IntersectionObserver from each day's mood (evening/night days auto-switch). No manual theme toggle.

## Time-aware behaviour (works before/during/after the trip)
- `useTripPhase()` recomputes every second from `departDate`/`returnDate`. Hero shows: **before** = countdown; **during** = `.trip-status` "Day N of 13 · We're in Vietnam"; **after** = "Until next time" wrap. Don't let the countdown render at 00:00:00.
- Trip forecast fetch uses `forecast_days=16` + `past_days=14`, so days already passed during the trip show their **actual** recorded weather (`state:"actual"`). `dayWeather` compares the day's ISO to today: future-in-window = `ok`, future-beyond = `soon` ("Forecast nearer the date"), past-with-data = `actual`, past-no-data = `past` ("Trip day complete").

## Data shapes
- An itinerary `activity` can have `link` (label → opens the map drawer on a matching pin) and/or `url` (external link → renders a "Tour details" button opening in a new tab). Both, either, or neither.

## Architecture gotchas
- **Loader fade is in its own isolated `<script>` tag** in `index.html` after the loader div. Inline style changes, no class toggling. Immune to React/Babel errors elsewhere
- **Currency converter** has two independent state vars (`aud`, `vndStr`) and two `<input>` elements. Quick-amount buttons must sync both. Header label is `"AUD ⇄ VND"`
- **Drawer** has a single combined `transition:` declaration (background, color, transform). Duplicate declarations silently overwrite — don't split them
- **Drawer** uses `overscroll-behavior: contain` to stop iOS scroll-through
- Accordion pattern uses `grid-template-rows: 0fr → 1fr` (not max-height)
- `.reveal` / `.reveal-img` classes get `.in` via IntersectionObserver in `useReveal()`
- Small-phone breakpoint: `@media (max-width: 380px)` — adjusts activity grid

## Rules — follow these to save tokens

**Read minimally.** Use `offset`/`limit` on Read. Don't read the whole file unless you must.

**grep first.** Use `grep -n "pattern" file` to find line numbers before reading sections.

**Edit surgically.** Use Edit with the smallest unique string. One change per Edit call.

**No recaps.** Don't summarize what you're about to do or what you just did. Just do it.

**No confirmation questions.** If the intent is clear, act. Ask only when genuinely ambiguous.

**Commits are one-liners** unless the change is large. Skip the Co-Author line unless asked.

**No em dashes** in prose I write to the user. Use periods, commas, or colons.
