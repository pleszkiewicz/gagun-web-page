(function () {
  "use strict";
  const game = window.gagunBomberman;
  const tile = 48;

  function createRenderer(canvas) {
    const context = canvas.getContext("2d");
    const images = new Map();
    let currentTheme = "garden";

    function load(path) {
      if (!images.has(path)) {
        const image = new Image();
        image.src = path;
        images.set(path, image);
      }
      return images.get(path);
    }

    Object.values(game.themes).forEach(theme => {
      [theme.textures.floor, theme.textures.wall, theme.textures.crate, theme.textures.bomb, ...theme.textures.players].forEach(load);
    });
    Object.values(game.itemTextures).forEach(load);

    function resize() {
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      const width = Math.max(1, Math.round(canvas.clientWidth * ratio));
      const height = Math.max(1, Math.round(canvas.clientHeight * ratio));
      if (canvas.width === width && canvas.height === height) return;
      canvas.width = width;
      canvas.height = height;
      context.setTransform(width / (game.rules.columns * tile), 0, 0, height / (game.rules.rows * tile), 0, 0);
      context.imageSmoothingEnabled = true;
      context.imageSmoothingQuality = "high";
    }

    function sprite(path, x, y, width = tile, height = tile, fallback = "#94aaa4") {
      const image = load(path);
      if (image.complete && image.naturalWidth) {
        context.drawImage(image, x, y, width, height);
      } else {
        context.fillStyle = fallback;
        context.fillRect(x + 3, y + 3, width - 6, height - 6);
      }
    }

    function roundedRect(x, y, width, height, radius, color) {
      context.beginPath();
      context.roundRect(x, y, width, height, radius);
      context.fillStyle = color;
      context.fill();
    }

    function drawFire(state, theme, time) {
      const size = tile * (0.65 + Math.sin(time * 22) * 0.025);
      for (const flame of state.flames.values()) {
        const x = (flame.x + 0.5) * tile;
        const y = (flame.y + 0.5) * tile;
        context.save();
        context.shadowColor = theme.fire;
        context.shadowBlur = currentTheme === "arcade" ? 20 : 9;
        roundedRect(x - size / 2, y - size / 2, size, size, 10, theme.fire);
        for (const [dx, dy] of game.directions) {
          if (!state.flames.has(`${flame.x + dx},${flame.y + dy}`)) continue;
          roundedRect(x - size / 2 + dx * tile / 2, y - size / 2 + dy * tile / 2, size, size, 8, theme.fire);
        }
        context.restore();
      }
      for (const flame of state.flames.values()) {
        const x = (flame.x + 0.5) * tile;
        const y = (flame.y + 0.5) * tile;
        for (const [dx, dy] of game.directions) {
          if (state.flames.has(`${flame.x + dx},${flame.y + dy}`)) {
            roundedRect(x - 6 + dx * tile / 2, y - 6 + dy * tile / 2, 12, 12, 4, theme.fireCore);
            context.fillStyle = theme.fireCore;
            context.fillRect(x + Math.min(0, dx * tile / 2) - 5, y + Math.min(0, dy * tile / 2) - 5, Math.abs(dx * tile / 2) + 10, Math.abs(dy * tile / 2) + 10);
          }
        }
        roundedRect(x - 10, y - 10, 20, 20, 7, theme.fireCore);
      }
    }

    function draw(state, { theme = currentTheme, time = state.elapsed } = {}) {
      currentTheme = theme;
      const skin = game.themes[theme];
      const textures = skin.textures;
      context.clearRect(0, 0, canvas.width, canvas.height);
      context.fillStyle = skin.shadow;
      context.fillRect(0, 0, game.rules.columns * tile, game.rules.rows * tile);
      for (let y = 0; y < game.rules.rows; y++) {
        for (let x = 0; x < game.rules.columns; x++) {
          sprite(textures.floor, x * tile, y * tile);
          if ((x + y) % 2 === 0) {
            context.fillStyle = currentTheme === "arcade" ? "#090f221c" : "#ffffff0d";
            context.fillRect(x * tile, y * tile, tile, tile);
          }
          if (state.board[y][x] === 1) sprite(textures.wall, x * tile, y * tile);
          if (state.board[y][x] === 2) sprite(textures.crate, x * tile, y * tile);
        }
      }
      for (const item of state.items.values()) {
        if (item.availableAt > state.elapsed) continue;
        const bob = Math.sin(time * 3 + item.x) * 1.3;
        sprite(game.itemTextures[item.type], item.x * tile + 4, item.y * tile + 3 + bob, tile - 8, tile - 8);
      }
      for (const bomb of state.bombs) {
        const progress = Math.min(1, Math.max(0, (state.elapsed - bomb.placedAt) / game.rules.fuse));
        const pulse = 1 + Math.sin(time * (progress > 0.7 ? 23 : 11)) * 0.035;
        const size = tile * 0.94 * pulse;
        sprite(textures.bomb, (bomb.x + 0.5) * tile - size / 2, (bomb.y + 0.5) * tile - size / 2, size, size, "#263444");
        context.beginPath();
        context.arc((bomb.x + 0.5) * tile, (bomb.y + 0.58) * tile, 19, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (1 - progress));
        context.strokeStyle = game.controls[bomb.ownerId].color;
        context.lineWidth = 2;
        context.stroke();
      }
      drawFire(state, skin, time);
      for (const player of [...state.players].sort((first, second) => game.position(first).y - game.position(second).y)) {
        if (!player.alive) {
          context.globalAlpha = 0.4;
          context.strokeStyle = game.controls[player.id].color;
          context.lineWidth = 3;
          context.beginPath();
          context.moveTo((player.x + 0.35) * tile, (player.y + 0.35) * tile);
          context.lineTo((player.x + 0.65) * tile, (player.y + 0.65) * tile);
          context.moveTo((player.x + 0.65) * tile, (player.y + 0.35) * tile);
          context.lineTo((player.x + 0.35) * tile, (player.y + 0.65) * tile);
          context.stroke();
          context.globalAlpha = 1;
          continue;
        }
        const current = game.position(player);
        const x = (current.x + 0.5) * tile;
        const y = (current.y + 0.5) * tile;
        if (player.shield || player.invulnerableUntil > state.elapsed) {
          context.beginPath();
          context.arc(x, y, tile * 0.48, 0, Math.PI * 2);
          context.fillStyle = "#c5a8f32b";
          context.fill();
          context.strokeStyle = "#b69aeccc";
          context.lineWidth = 2;
          context.stroke();
        }
        context.save();
        if (player.invulnerableUntil > state.elapsed && Math.floor(state.elapsed * 14) % 2) context.globalAlpha = 0.45;
        const bob = player.moving ? Math.sin(time * 35) * 1.4 : 0;
        sprite(textures.players[player.id], x - tile * 0.48, y - tile * 0.57 + bob, tile * 0.96, tile * 0.96, game.controls[player.id].color);
        context.restore();
      }
      for (const effect of state.effects) {
        const age = state.elapsed - effect.at;
        const color = effect.type === "crate" ? "#d59170" : effect.type === "elimination" ? game.controls[effect.playerId].color : skin.fire;
        if (effect.type === "pickup") continue;
        context.globalAlpha = Math.max(0, 1 - age / 0.7);
        context.fillStyle = color;
        for (let particle = 0; particle < 6; particle++) {
          const angle = particle * Math.PI / 3 + effect.x;
          const radius = age * (effect.type === "crate" ? 42 : 65);
          const x = (effect.x + 0.5) * tile + Math.cos(angle) * radius;
          const y = (effect.y + 0.5) * tile + Math.sin(angle) * radius;
          context.fillRect(x, y, 4 * (1 - age), 4 * (1 - age));
        }
        context.globalAlpha = 1;
      }
    }

    resize();
    return { draw, resize };
  }

  game.createRenderer = createRenderer;
}());
