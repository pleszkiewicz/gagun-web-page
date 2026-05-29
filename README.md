# gagun-web-page
HTML web page created by Gagun

## Structure

- `index.html` contains the application shell and the empty page host.
- `app.js` owns navigation, path routing, and localization helpers.
- `locales/en.js` contains English UI strings. Add another locale file with the same keys to translate the app.
- `pages/plotter-2d.js` registers the `2D Plotter` page.
- `pages/plotter-3d.js` registers the `3D Plotter` page.
- `pages/fractals.js` registers the animated black-and-white Julia sets page.
- `pages/periodic-table.js` registers an interactive periodic table with element details and category legend.
- `pages/lines.js` registers the Lines game start screen with keyboard control groups.

To add another page, create a new file in `pages/`, push a page module into `window.gagunPageModules`, add its translation keys to the locale files, and include the new script in `index.html` before `app.js`.

## Routing

Pages use clean paths such as `/julia-sets`, `/periodic-table`, and `/lines` so analytics can report individual page URLs. The `_redirects` file keeps direct visits to those paths working on Cloudflare Pages by serving `index.html` for every route.

## Analytics

The site is prepared for Cloudflare Web Analytics through `analytics.js`.

1. In Cloudflare, open Web Analytics and add this site's hostname.
2. Copy the Web Analytics site token.
3. Paste it into `index.html`:

```html
<script src="analytics.js" data-cloudflare-token="YOUR_TOKEN_HERE" defer></script>
```

The loader stays disabled until a token is provided, and it also skips localhost traffic.
