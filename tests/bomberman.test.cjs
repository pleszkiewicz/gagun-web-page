const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const root = path.join(__dirname, "..");
const context = vm.createContext({ window: {} });
vm.runInContext(fs.readFileSync(path.join(root, "assets/bomberman/engine.js"), "utf8"), context);
const game = context.window.gagunBomberman;

function arena(ids = [0, 1]) {
  const round = game.createRound(ids, { random: () => 0.99 });
  for (const row of round.state.board) {
    row.forEach((tile, x) => { if (tile === 2) row[x] = 0; });
  }
  round.state.hiddenItems.clear();
  return round;
}

function locate(round, id, x, y) {
  const player = round.state.players.find(player => player.id === id);
  Object.assign(player, { x, y, fromX: x, fromY: y, moving: false });
  return player;
}

function plant(round, id, x, y, range = 2) {
  locate(round, id, x, y).range = range;
  assert.equal(round.placeBomb(id), true);
  locate(round, id, id === 0 ? 13 : 15, 11);
  return round.state.bombs.at(-1);
}

test("maps are mirrored, have safe starts and support any two, three or four players", () => {
  for (const ids of [[0, 1], [1, 2, 3], [0, 1, 2, 3], [0, 3]]) {
    const { state } = game.createRound(ids, { random: () => 0.3 });
    assert.equal(state.players.length, ids.length);
    for (const player of state.players) {
      assert.equal(state.board[player.y][player.x], 0);
      const exits = game.directions.filter(([dx, dy]) => state.board[player.y + dy]?.[player.x + dx] === 0);
      assert.equal(exits.length, 2);
    }
    state.board.forEach((row, y) => row.forEach((tile, x) => {
      assert.equal(tile, state.board[12 - y][16 - x]);
      assert.equal(tile, state.board[y][16 - x]);
      assert.equal(tile, state.board[12 - y][x]);
    }));
  }
  assert.throws(() => game.createRound([0]), /two to four/);
  assert.throws(() => game.createRound([0, 9]), /two to four/);
});

test("the twenty player controls are unique and preserve the four Lines movement groups", () => {
  const codes = game.controls.flatMap(player => [...player.movement, player.bomb]);
  assert.equal(new Set(codes).size, 20);
  assert.deepEqual(Array.from(game.controls, player => player.bomb), ["KeyE", "ShiftRight", "KeyO", "KeyY"]);
});

test("movement stops at stone, breakable blocks and bombs, but a planter can step away", () => {
  const round = arena();
  locate(round, 0, 1, 1);
  assert.equal(round.move(0, -1, 0), false);
  round.state.board[1][2] = 2;
  assert.equal(round.move(0, 1, 0), false);
  round.state.board[1][2] = 0;
  assert.equal(round.placeBomb(0), true);
  assert.equal(round.move(0, 1, 0), true);
  round.advance(0.2);
  assert.equal(round.move(0, -1, 0), false);
  assert.equal(round.move(0, 0, 1), false);
});

test("players can place two bombs initially, reject a third and recover capacity after detonation", () => {
  const round = arena();
  plant(round, 0, 3, 3);
  plant(round, 0, 7, 3);
  assert.equal(round.placeBomb(0), false);
  round.advance(2.39);
  assert.equal(round.state.bombs.length, 2);
  round.advance(0.02);
  assert.equal(round.state.bombs.length, 0);
  plant(round, 0, 3, 3);
  plant(round, 0, 7, 3);
  assert.equal(round.placeBomb(0), false);
});

test("new rounds reset every player's upgrades and restore the two-bomb starting capacity", () => {
  for (const ids of [[0, 1], [1, 2, 3], [0, 1, 2, 3]]) {
    const round = arena(ids);
    for (const player of round.state.players) {
      assert.equal(player.capacity, 2);
      const key = `${player.x},${player.y}`;
      for (const type of ["bomb", "flame", "speed", "shield"]) {
        round.state.items.set(key, { x: player.x, y: player.y, type, availableAt: 0 });
        round.advance(0.02);
      }
      assert.equal(player.capacity, 3);
      assert.equal(player.range, 3);
      assert.equal(player.speed, 1);
      assert.equal(player.shield, true);
    }
    const next = game.createRound(ids, { random: () => 0.99 });
    for (const player of next.state.players) {
      assert.equal(player.capacity, 2);
      assert.equal(player.range, 2);
      assert.equal(player.speed, 0);
      assert.equal(player.shield, false);
      assert.equal(player.alive, true);
    }
    assert.equal(next.state.bombs.length, 0);
  }
});

test("a cross-shaped blast stops at stone and the first breakable block in each direction", () => {
  const round = arena();
  round.state.board[3][5] = 1;
  round.state.board[5][3] = 2;
  plant(round, 0, 3, 3, 4);
  round.advance(2.41);
  const fire = round.state.flames;
  assert.ok(fire.has("4,3"));
  assert.equal(fire.has("5,3"), false);
  assert.equal(fire.has("6,3"), false);
  assert.ok(fire.has("3,5"));
  assert.equal(fire.has("3,6"), false);
  assert.equal(round.state.board[3][5], 1);
  assert.equal(round.state.board[5][3], 0);
  assert.equal(fire.has("4,4"), false);
});

test("an explosion triggers a newer bomb immediately and keeps crates blocking the whole chain", () => {
  const round = arena();
  locate(round, 0, 13, 11).capacity = 3;
  plant(round, 0, 3, 3, 4);
  round.advance(1);
  plant(round, 0, 5, 3, 4);
  round.state.board[5][5] = 2;
  round.advance(1.41);
  assert.equal(round.state.bombs.length, 0);
  assert.ok(round.state.flames.has("7,3"));
  assert.equal(round.state.flames.has("5,6"), false);
  assert.equal(round.drainEvents().filter(event => event.type === "explosion").length, 2);
});

test("a hidden bonus appears after its revealing fire fades and can be collected", () => {
  const round = arena();
  round.state.board[3][5] = 2;
  round.state.hiddenItems.set("5,3", "bomb");
  plant(round, 0, 3, 3, 3);
  round.advance(2.41);
  const item = round.state.items.get("5,3");
  assert.equal(item.type, "bomb");
  assert.ok(item.availableAt > round.state.elapsed);
  round.advance(0.65);
  const player = locate(round, 0, 5, 3);
  round.advance(0.02);
  assert.equal(player.capacity, 3);
  assert.equal(round.state.items.has("5,3"), false);
});

test("exposed bonuses are destroyed by a later blast", () => {
  const round = arena();
  round.state.items.set("4,3", { x: 4, y: 3, type: "flame", availableAt: 0 });
  plant(round, 0, 3, 3);
  round.advance(2.41);
  assert.equal(round.state.items.has("4,3"), false);
});

test("range, capacity and speed bonuses stack only to their advertised caps", () => {
  const round = arena();
  const player = round.state.players[0];
  for (const type of ["flame", "bomb", "speed"]) {
    for (let i = 0; i < 12; i++) {
      round.state.items.set("1,1", { x: 1, y: 1, type, availableAt: 0 });
      round.advance(0.02);
    }
  }
  assert.equal(player.range, 8);
  assert.equal(player.capacity, 6);
  assert.equal(player.speed, 3);
  assert.equal(round.move(0, 1, 0), true);
  round.advance(0.13);
  assert.equal(player.moving, false);
});

test("a shield absorbs one explosion and prevents repeat hits from the same flame", () => {
  const round = arena();
  locate(round, 0, 3, 3).shield = true;
  assert.equal(round.placeBomb(0), true);
  round.advance(2.41);
  assert.equal(round.state.players[0].alive, true);
  assert.equal(round.state.players[0].shield, false);
  round.advance(0.65);
  assert.equal(round.state.players[0].alive, true);
  assert.equal(round.state.flames.size, 0);
  round.advance(0.4);
  assert.equal(round.placeBomb(0), true);
  round.advance(2.41);
  assert.equal(round.state.players[0].alive, false);
  assert.equal(round.state.winnerId, 1);
});

test("own bombs eliminate their planter and the last survivor wins", () => {
  const round = arena();
  assert.equal(round.placeBomb(0), true);
  round.advance(2.41);
  assert.equal(round.state.players[0].alive, false);
  assert.equal(round.state.phase, "finished");
  assert.equal(round.state.winnerId, 1);
  assert.equal(round.placeBomb(1), false);
});

test("players killed by simultaneous explosions draw instead of receiving a premature win", () => {
  const round = arena();
  assert.equal(round.placeBomb(0), true);
  assert.equal(round.placeBomb(1), true);
  round.advance(2.41);
  assert.equal(round.state.players.filter(player => player.alive).length, 0);
  assert.equal(round.state.phase, "finished");
  assert.equal(round.state.winnerId, null);
});

test("the round clock ends in a draw and ignores further time or invalid time inputs", () => {
  const round = arena([0, 1, 2]);
  round.advance(NaN);
  round.advance(-1);
  assert.equal(round.state.elapsed, 0);
  round.advance(151);
  assert.equal(round.state.remaining, 0);
  assert.equal(round.state.phase, "finished");
  assert.equal(round.state.winnerId, null);
  const elapsed = round.state.elapsed;
  round.advance(100);
  assert.equal(round.state.elapsed, elapsed);
});

test("every declared skin and sound points to a bundled, usable asset", () => {
  vm.runInContext(fs.readFileSync(path.join(root, "assets/bomberman/manifest.js"), "utf8"), context);
  for (const theme of Object.values(game.themes)) {
    const textures = theme.textures;
    for (const file of [textures.floor, textures.wall, textures.crate, textures.bomb, ...textures.players]) {
      assert.match(fs.readFileSync(path.join(root, file), "utf8"), /<svg/);
    }
  }
  for (const file of Object.values(game.itemTextures)) assert.ok(fs.existsSync(path.join(root, file)));
  for (const file of Object.values(game.sounds)) {
    const data = fs.readFileSync(path.join(root, file));
    assert.equal(data.toString("ascii", 0, 4), "RIFF");
    assert.equal(data.toString("ascii", 8, 12), "WAVE");
    assert.ok(data.length > 1000);
  }
});

test("the new page registers a clean static route and loads after its dependencies", () => {
  const pageContext = vm.createContext({ window: {} });
  vm.runInContext(fs.readFileSync(path.join(root, "pages/bomberman.js"), "utf8"), pageContext);
  const page = pageContext.window.gagunPageModules[0];
  assert.equal(page.id, "bomberman");
  assert.equal(page.sectionId, "games");
  assert.equal(page.requiresDesktop, true);
  const index = fs.readFileSync(path.join(root, "index.html"), "utf8");
  const controllerIndex = index.indexOf('src="pages/bomberman.js');
  assert.ok(controllerIndex > 0);
  for (const source of ["engine", "manifest", "renderer", "audio"]) {
    const dependencyIndex = index.indexOf(`src="assets/bomberman/${source}.js`);
    assert.ok(dependencyIndex > 0 && dependencyIndex < controllerIndex);
  }
  assert.ok(index.indexOf('src="app.js') > controllerIndex);
});
