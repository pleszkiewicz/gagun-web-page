# gagun-web-page
HTML web page created by Gagun

## Structure

- `index.html` contains the application shell and the empty page host.
- `app.js` owns navigation, hash routing, and localization helpers.
- `locales/en.js` contains English UI strings. Add another locale file with the same keys to translate the app.
- `pages/plotter-2d.js` registers the `2D Plotter` page.
- `pages/fractals.js` registers the animated black-and-white Julia sets page.
- `pages/periodic-table.js` registers an interactive periodic table with element details and category legend.

To add another page, create a new file in `pages/`, push a page module into `window.gagunPageModules`, add its translation keys to the locale files, and include the new script in `index.html` before `app.js`.
