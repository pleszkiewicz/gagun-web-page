# Bomberman

Local multiplayer for two, three or four people sharing a keyboard, available at `/bomberman` in the Games section. This is an original browser implementation inspired by the classic battle rules, with original robot characters and artwork. It follows the site's English interface and the four movement groups used in Lines.

## Game design

1. Join by pressing any movement or bomb key belonging to your player. The lobby shows each player's colour, character, controls and readiness. Players can also click their card to join or leave.
2. With at least two players, a five-second countdown begins. Each newly joined player restarts it so the others have time to join. Space starts immediately.
3. Players spawn in separate corners of a symmetric 17 × 13 arena. Stone walls cannot be destroyed. Terracotta blocks, neon crates or cardboard boxes can be destroyed. All four corners have two clear exits and an equally placed first range bonus.
4. Everyone starts with one active bomb and a two-tile blast range. Tap the action key to place a bomb at your current cell. The fuse lasts 2.4 seconds of game time. You can leave the bomb's tile, but bombs block re-entry. Players can pass each other.
5. A blast spreads along the four cardinal directions. Stone stops it. The first breakable block in each direction is destroyed and stops that arm of the blast. A bomb hit by a flame detonates immediately, causing chain reactions. Blocks continue to block all explosions in the same chain before removal.
6. Flames last 0.6 seconds and can eliminate any player, including the bomb's owner. Simultaneous deaths are resolved together, so a simultaneous final knockout is a draw.
7. Some destroyed blocks reveal bonuses after their flames disappear. Exposed bonuses can be destroyed by a later blast. Pickups apply immediately and last for the current round.
8. The final survivor earns one point. The round lasts at most 2:30; multiple survivors at the limit draw without points. First to three points wins the match. A new round resets upgrades and generates a fresh symmetric arena, keeping players and match scores. A new match resets scores.

Escape or the pause button freezes movement, fuses, fire and the round clock. Opening the site navigation, switching tabs or losing window focus also pauses a running round; resuming is explicit. Opening the guide pauses the game. Returning to the lobby clears the current match. Leaving this page stops its animation, keyboard handlers and audio.

## Controls

| Player | Identity | Movement | Bomb |
| --- | --- | --- | --- |
| P1 | Aqua, leaf antenna, number 1 | W / A / S / D | E |
| P2 | Amber, triangle antenna, number 2 | Arrow keys | Right Shift |
| P3 | Violet, star antenna, number 3 | I / J / K / L | O |
| P4 | Mint, round antenna, number 4 | T / F / G / H | Y |

The twenty player keys do not overlap. P2 uses physical `ShiftRight`, shown as **R Shift**; Left Shift and Enter do not place bombs. Bombs require a fresh press, rather than the operating system's repeat events. Holding a movement key repeats movement; quick taps move one cell and turns can be buffered during a step. Space starts a round or proceeds from results. Escape pauses/resumes. Controls use physical `KeyboardEvent.code` positions, as in Lines. Starting each round moves keyboard focus back to the game.

Many ordinary keyboards cannot register all four players' simultaneous inputs. A keyboard with multi-key rollover or an additional USB keyboard can help. The game includes this tip in its guide. It requires a desktop-sized screen and keyboard, following the same availability checks as Lines.

## Power-ups

| Item | Effect | Limit |
| --- | --- | --- |
| Longer blast | Adds one tile to each arm of a newly placed bomb | 8 tiles |
| Extra bomb | Adds one simultaneously active bomb | 6 bombs |
| Quick feet | Adds 15% of base movement speed | 3 upgrades, +45% |
| Safety bubble | Absorbs a blast, followed by one second of immunity | One stored shield |

Bonuses are mirrored with the layout. The default hidden-item chance is 40% per breakable block; the first range upgrade near each corner is guaranteed. A placed bomb retains the range it had when planted.

## Three visual proposals

The style selector sits in the header, between the title and sound controls, and changes the artwork and surrounding interface without restarting the game. The same renderer and rules power all three. **Neon arcade is the default** whenever the page opens.

| Style | Palette and textures | Character and effects |
| --- | --- | --- |
| Pocket garden | Sage grass, rounded mossy stone, cracked terracotta bricks, warm paper interface | Four small garden robots, charcoal bombs, amber and cream flames |
| Neon arcade | Navy floor panels, violet metal blocks, magenta neon crates, dark interface | Colourful robots, bright fuses, pink and yellow blasts |
| Toy box | Mint playmat tiles, blue studded blocks, taped cardboard boxes, cream interface | Toy robots, round bombs, soft orange flames |

All three styles can be changed in the lobby or during a match. There is no separate arena-preview mode. A theme can also be opened directly with `/bomberman?theme=arcade` (or `garden` / `toy`). The sound on/off preference is saved locally when browser storage is available.

The game fits the current window height and width without page scrolling. The arena retains its 17:13 proportions and uses the largest size that fits beside the player panels and below the compact title and controls. Panels and registration/result cards scale down when needed. Style buttons show names without numbers, and panel widths, spacing and controls scale continuously with the window instead of jumping at width breakpoints. Resizing or entering full screen updates the layout and Canvas resolution without restarting the round. The redundant wall/fuse legend and bottom keyboard-hint bar have been removed. **How to play** is below **Power ups** in the sidebar.

Visual proposals and interface screenshots:

- [Pocket garden](garden.jpg)
- [Neon arcade](arcade.jpg)
- [Toy box](toy.jpg)
- [Player registration](lobby.jpg)
- [Current game layout fitted to a 1280 × 720 window](fluid-layout.jpg)

## Replace artwork and sounds

`assets/bomberman/manifest.js` is the single asset map. The rules, drawing code and interface are separate from these file paths. No external artwork or audio services are needed.

### Textures

Each theme has `floor.svg`, `wall.svg`, `crate.svg`, `bomb.svg`, and `player-1.svg` through `player-4.svg` in `assets/bomberman/textures/<theme>/`. The four shared item icons live in `textures/items/`.

Replace a file at the same path, or change its path in `manifest.js`. SVG, PNG and WebP work. Textures use a square 64 × 64 reference frame and are scaled into the arena cells. Keep transparent backgrounds for characters, bombs and items. Keep each player's colour and antenna/number readable; the characters are distinguishable by more than colour alone. The flame colours are the `fire` and `fireCore` theme values in the manifest.

### Sounds

Ten original, short mono PCM WAV effects live in `assets/bomberman/audio/`: `join`, `countdown`, `start`, `place`, `explosion`, `pickup`, `elimination`, `shield`, `victory`, and `draw`.

Replace any WAV at its existing path, or set another WAV/MP3/OGG path in the manifest. Audio starts only after a user gesture. Missing or not-yet-loaded files use a short synthesized fallback. The **Sound on / Sound off** button toggles effects at a fixed level; a compressor controls loudness and multiple explosions in one frame share one sound. No background music is included. Local `file:` use retains synthesized effects when the browser refuses to fetch audio files; HTTP serving enables the bundled WAV files.

The reproducible originals can be rebuilt with `python3 scripts/build-bomberman-assets.py`. **This overwrites these original asset files**, so do not run it over custom replacements. It is a development utility, not a step needed to play or deploy.

## Implementation and checks

- `assets/bomberman/engine.js`: map generation, movement, bombs, chain reactions, items and round results; independent of DOM, rendering and audio.
- `assets/bomberman/manifest.js`: artwork paths, theme colours and sound paths.
- `assets/bomberman/renderer.js`: Canvas drawing, sprites, flames and particles.
- `assets/bomberman/audio.js`: audio loading, playback, volume and cleanup.
- `pages/bomberman.js` and `pages/bomberman.css`: registration, match scores, controls, pause, guide and layout.
- `tests/bomberman.test.cjs`: deterministic behaviour and asset/route checks; run `node --test tests/bomberman.test.cjs`.

The existing GitHub Pages workflow discovers the registered `/bomberman` module and generates its static route entry point automatically. No package installation, framework, backend or build step is added.

## Rules research

- [Konami's Standard battle manual](https://dds.konami.com/games/manual/sbro/multi/en/pc/page04.html) describes last-survivor wins, draws and timed battles. This version uses a simple draw at the time limit, rather than falling sudden-death blocks.
- [Konami's controls manual](https://dds.konami.com/games/manual/sbro/multi/en/pc/) uses separate movement and bomb-placement actions.
- [Bombermaaan's documented features](https://bombermaaan.sourceforge.net/features.php.html) describe shared-computer multiplayer, an initial one-bomb/two-tile range, items hidden in soft walls, extra bombs, increased range and speed.

Fuse length, arena size, scoring target, item limits, shield and the artwork are explicit choices for this implementation. Kicking/throwing bombs, remote detonation, bots, online play, gamepads and background music are possible future additions; they are not part of this version.
