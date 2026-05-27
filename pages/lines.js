function renderLines(container, { t }) {
  const countdownDuration = 5000;
  const playerSpeed = 118;

  const players = [
    {
      id: "one",
      className: "is-player-one",
      label: t("pages.lines.playerOneLabel"),
      keys: t("pages.lines.playerOneKeys"),
      keyCodes: ["KeyW", "KeyA", "KeyS", "KeyD"],
      color: "#38bdf8",
      direction: { x: 1, y: 0 },
      getStart: (width, height, margin) => ({ x: margin, y: height / 2 }),
    },
    {
      id: "two",
      className: "is-player-two",
      label: t("pages.lines.playerTwoLabel"),
      keys: t("pages.lines.playerTwoKeys"),
      keyCodes: ["ArrowUp", "ArrowLeft", "ArrowDown", "ArrowRight"],
      color: "#f59e0b",
      direction: { x: -1, y: 0 },
      getStart: (width, height, margin) => ({ x: width - margin, y: height / 2 }),
    },
    {
      id: "three",
      className: "is-player-three",
      label: t("pages.lines.playerThreeLabel"),
      keys: t("pages.lines.playerThreeKeys"),
      keyCodes: ["KeyI", "KeyJ", "KeyK", "KeyL"],
      color: "#a78bfa",
      direction: { x: 0, y: -1 },
      getStart: (width, height, margin) => ({ x: width / 2, y: height - margin }),
    },
    {
      id: "four",
      className: "is-player-four",
      label: t("pages.lines.playerFourLabel"),
      keys: t("pages.lines.playerFourKeys"),
      keyCodes: ["KeyT", "KeyF", "KeyG", "KeyH"],
      color: "#22c55e",
      direction: { x: 0, y: 1 },
      getStart: (width, height, margin) => ({ x: width / 2, y: margin }),
    },
  ];

  const keyboardRows = [
    [
      { label: "1" },
      { label: "2" },
      { label: "3" },
      { label: "4" },
      { label: "5" },
      { label: "6" },
      { label: "7" },
      { label: "8" },
      { label: "9" },
      { label: "0" },
    ],
    [
      { label: "Q" },
      { label: "W", code: "KeyW", player: "one" },
      { label: "E" },
      { label: "R" },
      { label: "T", code: "KeyT", player: "four" },
      { label: "Y" },
      { label: "U" },
      { label: "I", code: "KeyI", player: "three" },
      { label: "O" },
      { label: "P" },
    ],
    [
      { label: "A", code: "KeyA", player: "one" },
      { label: "S", code: "KeyS", player: "one" },
      { label: "D", code: "KeyD", player: "one" },
      { label: "F", code: "KeyF", player: "four" },
      { label: "G", code: "KeyG", player: "four" },
      { label: "H", code: "KeyH", player: "four" },
      { label: "J", code: "KeyJ", player: "three" },
      { label: "K", code: "KeyK", player: "three" },
      { label: "L", code: "KeyL", player: "three" },
    ],
    [
      { label: "Z" },
      { label: "X" },
      { label: "C" },
      { label: "V" },
      { label: "B" },
      { label: "N" },
      { label: "M" },
    ],
  ];

  const playerByKeyCode = new Map(
    players.flatMap((player) => player.keyCodes.map((keyCode) => [keyCode, player])),
  );

  const state = {
    phase: "registration",
    registeredPlayerIds: new Set(),
    countdownAnimationId: 0,
    countdownStartedAt: 0,
    animationId: 0,
    lastFrameAt: 0,
    runners: [],
    width: 0,
    height: 0,
    dpr: 1,
  };

  function getPlayerClass(player) {
    return player ? ` is-player-${player}` : "";
  }

  function renderKeyboardKey(key) {
    const codeAttribute = key.code ? ` data-code="${key.code}"` : "";
    const playerAttribute = key.player ? ` data-player="${key.player}"` : "";
    return `<span class="lines-key${getPlayerClass(key.player)}"${codeAttribute}${playerAttribute}>${key.label}</span>`;
  }

  function renderKeyboardRow(row, index) {
    return `
      <div class="lines-key-row lines-key-row-${index + 1}" style="--key-count: ${row.length}">
        ${row.map(renderKeyboardKey).join("")}
      </div>
    `;
  }

  function renderControlChip(player) {
    return `
      <div class="lines-player-chip ${player.className}" data-player="${player.id}" data-status="${t("pages.lines.waiting")}">
        <span class="lines-player-swatch" aria-hidden="true"></span>
        <span class="lines-player-label">${player.label}</span>
        <span class="lines-player-keys">${player.keys}</span>
      </div>
    `;
  }

  container.innerHTML = `
    <section class="lines-page" aria-label="${t("pages.lines.pageLabel")}">
      <div class="lines-stage" aria-label="${t("pages.lines.stageLabel")}">
        <div class="lines-stage-surface" aria-hidden="true"></div>
        <canvas
          class="lines-game-canvas"
          id="linesGameCanvas"
          aria-label="${t("pages.lines.canvasLabel")}"
        ></canvas>

        <div class="lines-control-overlay" aria-label="${t("pages.lines.overlayLabel")}">
          <div class="lines-player-markers" aria-hidden="true">
            <div class="lines-spawn-slot lines-spawn-top">
              ${renderControlChip(players[3])}
            </div>
            <div class="lines-spawn-slot lines-spawn-left">
              ${renderControlChip(players[0])}
            </div>
            <div class="lines-spawn-slot lines-spawn-right">
              ${renderControlChip(players[1])}
            </div>
            <div class="lines-spawn-slot lines-spawn-bottom">
              ${renderControlChip(players[2])}
            </div>
          </div>

          <section class="lines-keyboard-panel">
            <header class="lines-overlay-header">
              <div>
                <h1>${t("pages.lines.heading")}</h1>
              </div>
              <p class="lines-countdown" id="linesCountdown" aria-hidden="true">
                <span>${t("pages.lines.countdownLabel")}</span>
                <strong id="linesCountdownValue">5s</strong>
              </p>
              <p class="lines-player-count" id="linesPlayerCount">${t("pages.lines.players")}</p>
            </header>

            <div class="lines-keyboard-wrap">
              <div class="lines-keyboard" aria-label="${t("pages.lines.keyboardLabel")}">
                <div class="lines-key-rows" aria-hidden="true">
                  ${keyboardRows.map(renderKeyboardRow).join("")}
                </div>

                <div class="lines-arrow-cluster" aria-hidden="true">
                  <span class="lines-arrow-spacer"></span>
                  ${renderKeyboardKey({ label: "&uarr;", code: "ArrowUp", player: "two" })}
                  <span class="lines-arrow-spacer"></span>
                  ${renderKeyboardKey({ label: "&larr;", code: "ArrowLeft", player: "two" })}
                  ${renderKeyboardKey({ label: "&darr;", code: "ArrowDown", player: "two" })}
                  ${renderKeyboardKey({ label: "&rarr;", code: "ArrowRight", player: "two" })}
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>
    </section>
  `;

  const stage = container.querySelector(".lines-stage");
  const canvas = container.querySelector("#linesGameCanvas");
  const ctx = canvas.getContext("2d");
  const overlay = container.querySelector(".lines-control-overlay");
  const playerCount = container.querySelector("#linesPlayerCount");
  const countdown = container.querySelector("#linesCountdown");
  const countdownValue = container.querySelector("#linesCountdownValue");
  const activeKeys = new Map(
    [...container.querySelectorAll(".lines-key[data-code]")].map((element) => [
      element.dataset.code,
      element,
    ]),
  );
  const chipElements = new Map(
    [...container.querySelectorAll(".lines-player-chip")].map((element) => [
      element.dataset.player,
      element,
    ]),
  );

  function getRegisteredPlayers() {
    return players.filter((player) => state.registeredPlayerIds.has(player.id));
  }

  function updateRegistrationUi() {
    const registeredCount = state.registeredPlayerIds.size;

    playerCount.textContent =
      registeredCount > 0
        ? t("pages.lines.registeredPlayers", { count: registeredCount })
        : t("pages.lines.players");

    players.forEach((player) => {
      const isRegistered = state.registeredPlayerIds.has(player.id);
      const chip = chipElements.get(player.id);

      chip.classList.toggle("is-registered", isRegistered);
      chip.dataset.status = t(isRegistered ? "pages.lines.ready" : "pages.lines.waiting");

      container
        .querySelectorAll(`.lines-key[data-player="${player.id}"]`)
        .forEach((keyElement) => keyElement.classList.toggle("is-registered", isRegistered));
    });
  }

  function resizeCanvas() {
    const rect = stage.getBoundingClientRect();
    const width = Math.max(1, Math.round(rect.width));
    const height = Math.max(1, Math.round(rect.height));
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    if (width === state.width && height === state.height && dpr === state.dpr) {
      return;
    }

    state.width = width;
    state.height = height;
    state.dpr = dpr;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    if (state.phase === "running") {
      initialiseRunners();
      drawGame();
    }
  }

  function clampToCanvas(point) {
    return {
      x: Math.max(0, Math.min(state.width, point.x)),
      y: Math.max(0, Math.min(state.height, point.y)),
    };
  }

  function initialiseRunners() {
    const margin = Math.max(30, Math.min(76, Math.min(state.width, state.height) * 0.08));

    state.runners = getRegisteredPlayers().map((player) => {
      const start = player.getStart(state.width, state.height, margin);

      return {
        player,
        direction: player.direction,
        alive: true,
        x: start.x,
        y: start.y,
        path: [start],
      };
    });
  }

  function drawGame() {
    ctx.clearRect(0, 0, state.width, state.height);

    state.runners.forEach((runner) => {
      ctx.strokeStyle = runner.player.color;
      ctx.lineWidth = 3;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.beginPath();

      runner.path.forEach((point, index) => {
        if (index === 0) {
          ctx.moveTo(point.x, point.y);
        } else {
          ctx.lineTo(point.x, point.y);
        }
      });

      ctx.stroke();
      ctx.fillStyle = runner.player.color;
      ctx.beginPath();
      ctx.arc(runner.x, runner.y, 5.5, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  function animateGame(now) {
    if (!state.lastFrameAt) {
      state.lastFrameAt = now;
    }

    const elapsed = Math.min(0.05, (now - state.lastFrameAt) / 1000);
    state.lastFrameAt = now;

    state.runners.forEach((runner) => {
      if (!runner.alive) return;

      const nextPoint = {
        x: runner.x + runner.direction.x * playerSpeed * elapsed,
        y: runner.y + runner.direction.y * playerSpeed * elapsed,
      };
      const clampedPoint = clampToCanvas(nextPoint);

      runner.x = clampedPoint.x;
      runner.y = clampedPoint.y;
      runner.path.push(clampedPoint);
      runner.alive =
        clampedPoint.x === nextPoint.x &&
        clampedPoint.y === nextPoint.y &&
        state.width > 1 &&
        state.height > 1;
    });

    drawGame();
    state.animationId = window.requestAnimationFrame(animateGame);
  }

  function startGame() {
    if (state.phase === "running") return;

    state.phase = "running";
    window.cancelAnimationFrame(state.countdownAnimationId);
    countdown.classList.remove("is-visible");
    countdown.setAttribute("aria-hidden", "true");
    overlay.hidden = true;
    stage.classList.add("is-game-running");
    activeKeys.forEach((keyElement) => keyElement.classList.remove("is-pressed"));

    resizeCanvas();
    initialiseRunners();
    drawGame();
    state.lastFrameAt = 0;
    state.animationId = window.requestAnimationFrame(animateGame);
  }

  function tickCountdown(now) {
    const elapsed = now - state.countdownStartedAt;
    const remaining = Math.max(0, countdownDuration - elapsed);
    countdownValue.textContent = `${Math.ceil(remaining / 1000)}s`;

    if (remaining <= 0) {
      startGame();
      return;
    }

    state.countdownAnimationId = window.requestAnimationFrame(tickCountdown);
  }

  function startCountdown() {
    state.phase = "countdown";
    state.countdownStartedAt = performance.now();
    countdown.classList.add("is-visible");
    countdown.setAttribute("aria-hidden", "false");
    updateRegistrationUi();
    tickCountdown(state.countdownStartedAt);
  }

  function registerPlayer(player) {
    if (state.phase === "running" || state.registeredPlayerIds.has(player.id)) return;

    state.registeredPlayerIds.add(player.id);
    updateRegistrationUi();

    if (state.registeredPlayerIds.size >= 2 && state.phase === "registration") {
      startCountdown();
    }
  }

  function setPressedKey(event, isPressed) {
    const player = playerByKeyCode.get(event.code);
    const keyElement = activeKeys.get(event.code);

    if (!player || event.altKey || event.ctrlKey || event.metaKey) return;

    event.preventDefault();

    if (keyElement) {
      keyElement.classList.toggle("is-pressed", isPressed);
    }

    if (isPressed) {
      registerPlayer(player);
    }
  }

  function clearPressedKeys() {
    activeKeys.forEach((keyElement) => keyElement.classList.remove("is-pressed"));
  }

  const handleKeyDown = (event) => setPressedKey(event, true);
  const handleKeyUp = (event) => setPressedKey(event, false);
  const resizeObserver = new ResizeObserver(resizeCanvas);

  resizeObserver.observe(stage);
  resizeCanvas();
  updateRegistrationUi();
  window.addEventListener("keydown", handleKeyDown);
  window.addEventListener("keyup", handleKeyUp);
  window.addEventListener("blur", clearPressedKeys);

  return () => {
    window.cancelAnimationFrame(state.countdownAnimationId);
    window.cancelAnimationFrame(state.animationId);
    resizeObserver.disconnect();
    window.removeEventListener("keydown", handleKeyDown);
    window.removeEventListener("keyup", handleKeyUp);
    window.removeEventListener("blur", clearPressedKeys);
  };
}

window.gagunPageModules = window.gagunPageModules || [];
window.gagunPageModules.push({
  id: "lines",
  sectionId: "games",
  navKey: "pages.lines.navLabel",
  titleKey: "pages.lines.title",
  theme: {
    background: "#dfe8f0",
    backgroundSoft: "#f7fbff",
    mathColor: "rgba(12, 32, 52, 0.12)",
    mathOpacity: "0.54",
  },
  render: renderLines,
});
