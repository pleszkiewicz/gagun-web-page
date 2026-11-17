(function () {
  "use strict";

  const game = window.gagunBomberman = window.gagunBomberman || {};
  const rules = Object.freeze({
    columns: 17,
    rows: 13,
    fuse: 2.4,
    flameDuration: 0.6,
    roundDuration: 150,
    startingBombs: 2,
    startingRange: 2,
    maxRange: 8,
    maxBombs: 6,
    maxSpeed: 3,
    moveDuration: 0.17,
  });
  const directions = [[0, -1], [1, 0], [0, 1], [-1, 0]];
  const spawns = [[1, 1], [15, 11], [15, 1], [1, 11]];
  const itemTypes = ["flame", "bomb", "speed", "shield"];
  const cellKey = (x, y) => `${x},${y}`;

  const controls = Object.freeze([
    { id: 0, color: "#29b7cc", name: "Aqua", movement: ["KeyW", "KeyD", "KeyS", "KeyA"], keys: ["W", "D", "S", "A"], bomb: "KeyE", bombLabel: "E" },
    { id: 1, color: "#efa83a", name: "Amber", movement: ["ArrowUp", "ArrowRight", "ArrowDown", "ArrowLeft"], keys: ["↑", "→", "↓", "←"], bomb: "ShiftRight", bombLabel: "R Shift" },
    { id: 2, color: "#ab89ef", name: "Violet", movement: ["KeyI", "KeyL", "KeyK", "KeyJ"], keys: ["I", "L", "K", "J"], bomb: "KeyO", bombLabel: "O" },
    { id: 3, color: "#57c888", name: "Mint", movement: ["KeyT", "KeyH", "KeyG", "KeyF"], keys: ["T", "H", "G", "F"], bomb: "KeyY", bombLabel: "Y" },
  ]);

  function createBoard(random) {
    const board = Array.from({ length: rules.rows }, () => Array(rules.columns).fill(0));
    const hiddenItems = new Map();
    for (let y = 0; y <= 6; y++) {
      for (let x = 0; x <= 8; x++) {
        const wall = x === 0 || y === 0 || (x % 2 === 0 && y % 2 === 0);
        const safe = (x === 1 && y <= 2) || (y === 1 && x <= 2);
        const tile = wall ? 1 : !safe && (random() < 0.68 || (x === 3 && y === 1)) ? 2 : 0;
        const item = tile === 2 && random() < 0.4 ? itemTypes[Math.floor(random() * itemTypes.length)] : null;
        for (const mirrorY of new Set([y, rules.rows - 1 - y])) {
          for (const mirrorX of new Set([x, rules.columns - 1 - x])) {
            board[mirrorY][mirrorX] = tile;
            if (item) hiddenItems.set(cellKey(mirrorX, mirrorY), item);
          }
        }
      }
    }
    for (const [x, y] of [[3, 1], [13, 1], [3, 11], [13, 11]]) {
      board[y][x] = 2;
      hiddenItems.set(cellKey(x, y), "flame");
    }
    return { board, hiddenItems };
  }

  function position(player) {
    if (!player.moving) return { x: player.x, y: player.y };
    const fraction = Math.min(1, player.moveElapsed / player.moveDuration);
    return {
      x: player.fromX + (player.x - player.fromX) * fraction,
      y: player.fromY + (player.y - player.fromY) * fraction,
    };
  }

  function createRound(playerIds, { random = Math.random } = {}) {
    const ids = [...new Set(playerIds)];
    if (ids.length < 2 || ids.length > 4 || ids.some(id => !controls[id])) {
      throw new Error("A round needs two to four different players.");
    }
    const { board, hiddenItems } = createBoard(random);
    const state = {
      board, hiddenItems,
      players: ids.map(id => ({
        id, x: spawns[id][0], y: spawns[id][1],
        fromX: spawns[id][0], fromY: spawns[id][1],
        moving: false, moveElapsed: 0, moveDuration: rules.moveDuration,
        facing: "down", alive: true, range: rules.startingRange,
        capacity: rules.startingBombs, speed: 0, shield: false, invulnerableUntil: 0,
      })),
      bombs: [], flames: new Map(), items: new Map(), effects: [],
      elapsed: 0, remaining: rules.roundDuration, phase: "running", winnerId: null,
    };
    let nextBombId = 1;
    let events = [];

    function emit(type, details = {}) {
      events.push({ type, ...details });
      if (["explosion", "crate", "elimination", "pickup"].includes(type)) {
        state.effects.push({ type, at: state.elapsed, ...details });
      }
    }

    function move(id, dx, dy) {
      const player = state.players.find(candidate => candidate.id === id);
      if (state.phase !== "running" || !player?.alive || player.moving) return false;
      if (!directions.some(([x, y]) => x === dx && y === dy)) return false;
      player.facing = dx > 0 ? "right" : dx < 0 ? "left" : dy < 0 ? "up" : "down";
      const x = player.x + dx;
      const y = player.y + dy;
      if (state.board[y]?.[x] !== 0 || state.bombs.some(bomb => bomb.x === x && bomb.y === y)) return false;
      player.fromX = player.x;
      player.fromY = player.y;
      player.x = x;
      player.y = y;
      player.moveElapsed = 0;
      player.moveDuration = rules.moveDuration / (1 + player.speed * 0.15);
      player.moving = true;
      return true;
    }

    function placeBomb(id) {
      const player = state.players.find(candidate => candidate.id === id);
      if (state.phase !== "running" || !player?.alive) return false;
      const current = position(player);
      const x = Math.round(current.x);
      const y = Math.round(current.y);
      if (state.bombs.filter(bomb => bomb.ownerId === id).length >= player.capacity
        || state.bombs.some(bomb => bomb.x === x && bomb.y === y)) return false;
      const bomb = { id: nextBombId++, x, y, ownerId: id, range: player.range, placedAt: state.elapsed, explodesAt: state.elapsed + rules.fuse };
      state.bombs.push(bomb);
      emit("place", { x, y, ownerId: id });
      return true;
    }

    function detonateBombs() {
      const queue = state.bombs.filter(bomb => bomb.explodesAt <= state.elapsed
        || state.flames.has(cellKey(bomb.x, bomb.y)));
      const detonated = new Set();
      const destroyed = new Set();
      const fire = (x, y, ownerId) => {
        const key = cellKey(x, y);
        state.flames.set(key, { x, y, ownerId, expiresAt: state.elapsed + rules.flameDuration });
        const item = state.items.get(key);
        if (item && item.availableAt <= state.elapsed) state.items.delete(key);
      };
      while (queue.length) {
        const bomb = queue.shift();
        if (detonated.has(bomb.id)) continue;
        detonated.add(bomb.id);
        fire(bomb.x, bomb.y, bomb.ownerId);
        emit("explosion", { x: bomb.x, y: bomb.y, ownerId: bomb.ownerId });
        for (const [dx, dy] of directions) {
          for (let distance = 1; distance <= bomb.range; distance++) {
            const x = bomb.x + dx * distance;
            const y = bomb.y + dy * distance;
            const tile = state.board[y]?.[x];
            if (tile === undefined || tile === 1) break;
            fire(x, y, bomb.ownerId);
            if (tile === 2) {
              destroyed.add(cellKey(x, y));
              break;
            }
            const neighbour = state.bombs.find(candidate => candidate.x === x && candidate.y === y && !detonated.has(candidate.id));
            if (neighbour) {
              queue.push(neighbour);
              break;
            }
          }
        }
      }
      state.bombs = state.bombs.filter(bomb => !detonated.has(bomb.id));
      for (const key of destroyed) {
        const [x, y] = key.split(",").map(Number);
        state.board[y][x] = 0;
        emit("crate", { x, y });
        const type = state.hiddenItems.get(key);
        if (type) state.items.set(key, { x, y, type, availableAt: state.elapsed + rules.flameDuration + 0.02 });
        state.hiddenItems.delete(key);
      }
    }

    function step(seconds) {
      state.elapsed += seconds;
      state.remaining = Math.max(0, rules.roundDuration - state.elapsed);
      for (const [key, flame] of state.flames) {
        if (flame.expiresAt <= state.elapsed) state.flames.delete(key);
      }
      for (const player of state.players) {
        if (player.moving) {
          player.moveElapsed += seconds;
          if (player.moveElapsed + 0.000001 >= player.moveDuration) player.moving = false;
        }
      }
      detonateBombs();
      for (const player of state.players) {
        if (!player.alive) continue;
        const current = position(player);
        const key = cellKey(Math.round(current.x), Math.round(current.y));
        if (state.flames.has(key) && player.invulnerableUntil <= state.elapsed) {
          if (player.shield) {
            player.shield = false;
            player.invulnerableUntil = state.elapsed + 1;
            emit("shield", { playerId: player.id });
          } else {
            player.alive = false;
            emit("elimination", { x: current.x, y: current.y, playerId: player.id });
            continue;
          }
        }
        const item = state.items.get(key);
        if (!item || item.availableAt > state.elapsed) continue;
        if (item.type === "flame") player.range = Math.min(rules.maxRange, player.range + 1);
        if (item.type === "bomb") player.capacity = Math.min(rules.maxBombs, player.capacity + 1);
        if (item.type === "speed") player.speed = Math.min(rules.maxSpeed, player.speed + 1);
        if (item.type === "shield") player.shield = true;
        state.items.delete(key);
        emit("pickup", { x: item.x, y: item.y, playerId: player.id, item: item.type });
      }
      state.effects = state.effects.filter(effect => state.elapsed - effect.at < 0.7);
      const survivors = state.players.filter(player => player.alive);
      if (survivors.length <= 1 || state.remaining <= 0) {
        state.phase = "finished";
        state.winnerId = survivors.length === 1 ? survivors[0].id : null;
        emit("finish", { winnerId: state.winnerId });
      }
    }

    return {
      state, move, placeBomb,
      advance(seconds) {
        if (!Number.isFinite(seconds) || seconds <= 0) return;
        let remaining = seconds;
        while (remaining > 0.000001 && state.phase === "running") {
          const delta = Math.min(remaining, 1 / 60);
          step(delta);
          remaining -= delta;
        }
      },
      drainEvents() {
        const pending = events;
        events = [];
        return pending;
      },
    };
  }

  Object.assign(game, { rules, controls, directions, position, createRound });
}());
