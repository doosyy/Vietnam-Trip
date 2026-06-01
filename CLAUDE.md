# Vietnam Trip Website

Multi-file React app, no build step. React + Babel transpile JSX in-browser via CDN.

## Files
- `index.html` (~850 lines) — HTML shell, all CSS, theme tokens, loader, script tags
- `trip-app.jsx` (~1100 lines) — main React app: Hero, Dashboard, DayBar, Itinerary, RegionalMap, VietnamMap, MapDrawer, Flights, Hotels, Phrases, Marquee, Footer, currency converter
- `trip-data.js` (~300 lines) — single source of truth, exposed as `window.TRIP_DATA` (meta, flights, days, hotels, phrases, weather, mapPins)
- `trip-icons.jsx` (~70 lines) — SVG icon components, exposed as `window.Icon` + `window.weatherIcon`
- `image-slot.js` (~640 lines) — custom `<image-slot>` web component from Claude Design tool. On GitHub Pages it falls back to the `src` attribute (no omelette runtime)
- `img/` — all images (JPG/PNG)

## CDN scripts (in `index.html`)
- React 18.3.1 **production.min** (not dev — dev is 5× larger, kills mobile load)
- ReactDOM 18.3.1 **production.min**
- @babel/standalone 7.29.0 (with SRI hash)
- **Leaflet 1.9.4** (CSS in `<head>`, JS before app scripts) — real interactive route map, free CARTO basemap tiles (no API key)

## Maps
- `VietnamMap` in `trip-app.jsx` is a **Leaflet** map (not SVG). Reads `D.mapPins` (lat/lng) + `D.routeOrder`. Numbered markers + dashed route polyline. Tile layer swaps light/dark with `data-theme`; route colour tracks `--accent`. Uses a ResizeObserver + `invalidateSize()` so it renders correctly inside the off-screen drawer. `interactive={false}` for the mini preview in the Route section.
- Do NOT add global `svg { width:100%; height:100% }` rules scoped to `.map-mini`/`.map-full` — they blow up Leaflet's internal attribution flag SVG. (Removed for this reason.)
- `RegionalMap` (per-day segment diagram) is still the original abstract SVG with travel stats, not Leaflet.

## Deploy
GitHub Pages: `doosyy.github.io/Vietnam-Trip/`. Push to deploy:
`git add -A && git commit -m "..." && git push origin main`

## Key facts
- Travellers: Christine, Ashraf, Jason, Chris
- Dates: 11–23 June 2026, Melbourne → HCMC → Hanoi → Melbourne
- Fonts (Google Fonts): **Bricolage Grotesque** (display), **Manrope** (body), **JetBrains Mono** (labels)
- Color system: `oklch()` (needs iOS 15.4+/Safari 15.4+ — fine for current devices)
- Palette tokens: `--emerald`, `--lantern`, `--terracotta`, `--paper`, `--ink`. Light theme is default. `data-theme="night"` on `<html>` swaps to dark; driven by day mood (evening/night days auto-switch)
- Exchange rate constant: `RATE = 16450` (AUD → VND) in `trip-app.jsx`

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
