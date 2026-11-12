# gagun-web-page
HTML web page created by Gagun

## Structure

- `index.html` contains the application shell and the empty page host.
- `app.js` owns navigation, path routing, and localization helpers.
- `locales/en.js` contains English UI strings. Add another locale file with the same keys to translate the app.
- `pages/plotter-2d.js` registers the `2D Plotter` page.
- `pages/plotter-3d.js` registers the `3D Plotter` page.
- `pages/fourier-epicycles.js` registers the Fourier epicycles animation page.
- `pages/fractals.js` registers the animated black-and-white Julia sets page.
- `pages/periodic-table.js` registers an interactive periodic table with element details and category legend.
- `pages/lines.js` registers the Lines game start screen with keyboard control groups.
- `pages/traffic-simulator.js` registers `/traffic-simulator`, a buildless Ełk traffic pilot with all 16 saved MZK lines, visibility controls, directed-road car routing, pedestrian/bicycle/scooter travel, mapped cycling infrastructure and searchable multi-street road closures. Its map supports drag, wheel/pinch zoom and keyboard navigation.

To add another page, create a new file in `pages/`, push a page module into `window.gagunPageModules`, add its translation keys to the locale files, and include the new script in `index.html` before `app.js`.

## Routing

Pages use clean paths such as `/julia-sets`, `/periodic-table`, and `/lines` so analytics can report individual page URLs. Before publishing to GitHub Pages, the deployment workflow loads the page modules included in `index.html` and copies the application shell to `<page-id>/index.html` for every registered page. This lets direct visits and browser refreshes work on static hosting, including URLs with a trailing slash. New pages are included automatically when registered and loaded in `index.html`.

The application shell sets its base URL to `/`, so scripts, styles, and images still load from the site root on each route. The `_redirects` file provides the equivalent fallback on Cloudflare Pages; GitHub Pages does not use it.

## Ełk traffic pilot

The pilot uses local Canvas rendering and plain JavaScript. It needs no backend, API key, package installation or build step. Its data loads only when opening the traffic page, using classic scripts to support the app's `file:` hash routing. Browser QA uses the local HTTP preview; the browser test tool does not allow direct `file:` navigation.

The saved map and MZK timetable are dated 11 November 2026. The date picker uses the actual service calendars through 30 December 2026. City sliders use GUS 2025: 58,889 city residents and an estimated 28,054 passenger cars, derived from the county's 41,765 cars / 87,671 residents. The car estimate is explicitly labelled. A configurable assumption of 2 trips/resident/day sets the travel budget; normalized weekday peaks distribute it over the day. Fleet availability and rain change all five mode shares. Bicycles/scooters follow mapped access/directions, prefer real cycle facilities and walk through permitted footway links. Scooters use cycle facilities or confirmed low-speed carriageways and stay below 20 km/h. A separate map layer shows the cycling network. The Manual road closures panel searches streets, toggles whole streets or individual map sections, displays partial closures and clears manual blocks atomically. Trip behavior and congestion remain unvalidated against local traffic counts. Buses retain real departures and show capacity-limited loads and stop queues; all 16 saved MZK lines run, with 360 scheduled trips on 12 November. Line checkboxes control route/stop/bus visibility and the departure list while hidden lines keep affecting traffic. City passengers use actual compatible stop pairs within the study area. Lane counts use OSM tags where available (21.1% of the drivable snapshot length), with visible assumptions elsewhere, and affect physical parallel queues and street width. Closing a section blocks new vehicle entries, lets vehicles already inside clear it, reroutes cars where possible, and holds buses on their scheduled route until reopening. Pedestrians retain access. Restart clears closures; changing time/date preserves manual blocks and starts a fresh schedule of timed events. Changing city parameters/rain preserves ongoing trips.

The Accidents & roadworks panel adds independent frequency and duration sliders, active-event countdowns, map focus and early completion. Random events close individual public road sections within 5 km and automatically release them when simulated time expires. Manual blocks remain independent. Frequencies and durations are scenario assumptions, not measured local incident statistics. Pausing also pauses event timers; changing time/date discards timed events and preserves manual closures. Restart clears both kinds of closure while retaining slider settings.

See [data provenance, model coefficients and regeneration](assets/traffic/README.md). City data are bundled locally as `assets/traffic/city-data.js`, with original GUS responses retained in `gus-2025.json`. Regenerate offline with `python3 scripts/build-elk-city-data.py`, or explicitly refresh the 2025 observations with `--refresh`. Run the dependency-free checks with `node --test tests/*.test.cjs` and `python3 -B -m unittest discover -s tests -p 'test_*.py'`. Node/Python are used only for development checks/data preparation; the page remains static.

## Analytics

The site is prepared for Cloudflare Web Analytics through `analytics.js`.

1. In Cloudflare, open Web Analytics and add this site's hostname.
2. Copy the Web Analytics site token.
3. Paste it into `index.html`:

```html
<script src="analytics.js" data-cloudflare-token="YOUR_TOKEN_HERE" defer></script>
```

The loader stays disabled until a token is provided, and it also skips localhost traffic.
