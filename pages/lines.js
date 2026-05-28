function renderLines(container, { t }) {
  const countdownDuration = 5000;
  const gameOverLockDuration = 2000;
  const playerSpeed = 118;
  const dangerSampleInterval = 90;
  const dangerDistances = {
    wallWarning: 118,
    wallCritical: 18,
    trailWarning: 104,
    trailCritical: 15,
    proximityWarning: 38,
    proximityCritical: 8,
    ownTrailSkipSegments: 22,
  };
  const directions = {
    up: { x: 0, y: -1 },
    right: { x: 1, y: 0 },
    down: { x: 0, y: 1 },
    left: { x: -1, y: 0 },
  };

  const players = [
    {
      id: "one",
      className: "is-player-one",
      label: t("pages.lines.playerOneLabel"),
      keys: t("pages.lines.playerOneKeys"),
      controls: {
        KeyW: directions.up,
        KeyA: directions.left,
        KeyS: directions.down,
        KeyD: directions.right,
      },
      color: "#38bdf8",
      direction: directions.right,
      getStart: (width, height, margin) => ({ x: margin, y: height / 2 }),
    },
    {
      id: "two",
      className: "is-player-two",
      label: t("pages.lines.playerTwoLabel"),
      keys: t("pages.lines.playerTwoKeys"),
      controls: {
        ArrowUp: directions.up,
        ArrowLeft: directions.left,
        ArrowDown: directions.down,
        ArrowRight: directions.right,
      },
      color: "#f59e0b",
      direction: directions.left,
      getStart: (width, height, margin) => ({ x: width - margin, y: height / 2 }),
    },
    {
      id: "three",
      className: "is-player-three",
      label: t("pages.lines.playerThreeLabel"),
      keys: t("pages.lines.playerThreeKeys"),
      controls: {
        KeyI: directions.up,
        KeyJ: directions.left,
        KeyK: directions.down,
        KeyL: directions.right,
      },
      color: "#a78bfa",
      direction: directions.up,
      getStart: (width, height, margin) => ({ x: width / 2, y: height - margin }),
    },
    {
      id: "four",
      className: "is-player-four",
      label: t("pages.lines.playerFourLabel"),
      keys: t("pages.lines.playerFourKeys"),
      controls: {
        KeyT: directions.up,
        KeyF: directions.left,
        KeyG: directions.down,
        KeyH: directions.right,
      },
      color: "#22c55e",
      direction: directions.down,
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

  const controlByKeyCode = new Map(
    players.flatMap((player) =>
      Object.entries(player.controls).map(([keyCode, direction]) => [
        keyCode,
        { player, direction },
      ]),
    ),
  );

  const state = {
    phase: "registration",
    registeredPlayerIds: new Set(),
    countdownAnimationId: 0,
    countdownStartedAt: 0,
    animationId: 0,
    lastFrameAt: 0,
    gameOverTimeoutId: 0,
    canDismissGameOver: false,
    runners: [],
    width: 0,
    height: 0,
    dpr: 1,
    lastDangerSampleAt: 0,
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
              <p
                class="lines-countdown is-visible is-instruction"
                id="linesCountdown"
                aria-hidden="false"
              >
                <span id="linesCountdownLabel">${t("pages.lines.joinPrompt")}</span>
                <strong id="linesCountdownValue" hidden>5s</strong>
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

        <div
          class="lines-game-over"
          id="linesGameOver"
          role="dialog"
          aria-modal="true"
          aria-labelledby="linesGameOverTitle"
          hidden
        >
          <section class="lines-game-over-panel">
            <h2 id="linesGameOverTitle">${t("pages.lines.gameOverTitle")}</h2>
            <ul class="lines-game-over-results" id="linesGameOverResults"></ul>
            <p class="lines-game-over-hint" id="linesGameOverHint" aria-hidden="true">
              ${t("pages.lines.gameOverDismiss")}
            </p>
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
  const countdownLabel = container.querySelector("#linesCountdownLabel");
  const countdownValue = container.querySelector("#linesCountdownValue");
  const gameOver = container.querySelector("#linesGameOver");
  const gameOverResults = container.querySelector("#linesGameOverResults");
  const gameOverHint = container.querySelector("#linesGameOverHint");
  const audioEngine = window.createLinesAudioEngine
    ? window.createLinesAudioEngine()
    : {
        startRound() {},
        setDangerLevel() {},
        playerEliminated() {},
        finishRound() {},
        stop() {},
        dispose() {},
      };
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

  function showRegistrationPrompt() {
    countdownLabel.textContent =
      state.registeredPlayerIds.size === 1
        ? t("pages.lines.waitingForSecondPlayer")
        : t("pages.lines.joinPrompt");
    countdownValue.hidden = true;
    countdown.classList.add("is-visible", "is-instruction");
    countdown.setAttribute("aria-hidden", "false");
  }

  function showCountdownTimer() {
    countdownLabel.textContent = t("pages.lines.countdownLabel");
    countdownValue.hidden = false;
    countdown.classList.add("is-visible");
    countdown.classList.remove("is-instruction");
    countdown.setAttribute("aria-hidden", "false");
  }

  function hideCountdownStatus() {
    countdown.classList.remove("is-visible", "is-instruction");
    countdown.setAttribute("aria-hidden", "true");
    countdownValue.hidden = true;
  }

  function updateRegistrationUi() {
    const registeredCount = state.registeredPlayerIds.size;

    playerCount.textContent =
      registeredCount > 0
        ? t("pages.lines.registeredPlayers", { count: registeredCount })
        : t("pages.lines.players");

    if (state.phase === "registration") {
      showRegistrationPrompt();
    }

    players.forEach((player) => {
      const isRegistered = state.registeredPlayerIds.has(player.id);
      const chip = chipElements.get(player.id);

      chip.classList.remove("is-eliminated", "is-winner");
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

  function isSamePoint(firstPoint, secondPoint) {
    return (
      Math.abs(firstPoint.x - secondPoint.x) < 0.001 &&
      Math.abs(firstPoint.y - secondPoint.y) < 0.001
    );
  }

  function getSegmentCrossProduct(segmentStart, segmentEnd, point) {
    return (
      (segmentEnd.x - segmentStart.x) * (point.y - segmentStart.y) -
      (segmentEnd.y - segmentStart.y) * (point.x - segmentStart.x)
    );
  }

  function isPointOnSegment(point, segmentStart, segmentEnd) {
    const crossProduct = getSegmentCrossProduct(segmentStart, segmentEnd, point);

    if (Math.abs(crossProduct) > 0.001) {
      return false;
    }

    return (
      point.x >= Math.min(segmentStart.x, segmentEnd.x) - 0.001 &&
      point.x <= Math.max(segmentStart.x, segmentEnd.x) + 0.001 &&
      point.y >= Math.min(segmentStart.y, segmentEnd.y) - 0.001 &&
      point.y <= Math.max(segmentStart.y, segmentEnd.y) + 0.001
    );
  }

  function doSegmentsIntersect(firstStart, firstEnd, secondStart, secondEnd) {
    const firstTurnStart = getSegmentCrossProduct(firstStart, firstEnd, secondStart);
    const firstTurnEnd = getSegmentCrossProduct(firstStart, firstEnd, secondEnd);
    const secondTurnStart = getSegmentCrossProduct(secondStart, secondEnd, firstStart);
    const secondTurnEnd = getSegmentCrossProduct(secondStart, secondEnd, firstEnd);

    if (firstTurnStart * firstTurnEnd < -0.001 && secondTurnStart * secondTurnEnd < -0.001) {
      return true;
    }

    return (
      isPointOnSegment(secondStart, firstStart, firstEnd) ||
      isPointOnSegment(secondEnd, firstStart, firstEnd) ||
      isPointOnSegment(firstStart, secondStart, secondEnd) ||
      isPointOnSegment(firstEnd, secondStart, secondEnd)
    );
  }

  function isIntersectionOnlyAtMoveStart(move, otherMove) {
    if (!isPointOnSegment(move.from, otherMove.from, otherMove.to)) {
      return false;
    }

    return (
      !isPointOnSegment(move.to, otherMove.from, otherMove.to) &&
      (!isPointOnSegment(otherMove.from, move.from, move.to) ||
        isSamePoint(otherMove.from, move.from)) &&
      (!isPointOnSegment(otherMove.to, move.from, move.to) || isSamePoint(otherMove.to, move.from))
    );
  }

  function isOppositeDirection(firstDirection, secondDirection) {
    return firstDirection.x + secondDirection.x === 0 && firstDirection.y + secondDirection.y === 0;
  }

  function getVectorDotProduct(firstVector, secondVector) {
    return firstVector.x * secondVector.x + firstVector.y * secondVector.y;
  }

  function getVectorCrossProduct(firstVector, secondVector) {
    return firstVector.x * secondVector.y - firstVector.y * secondVector.x;
  }

  function getPointToSegmentDistance(point, segmentStart, segmentEnd) {
    const segment = {
      x: segmentEnd.x - segmentStart.x,
      y: segmentEnd.y - segmentStart.y,
    };
    const segmentLengthSquared = getVectorDotProduct(segment, segment);

    if (segmentLengthSquared <= 0.001) {
      return Math.hypot(point.x - segmentStart.x, point.y - segmentStart.y);
    }

    const pointOffset = {
      x: point.x - segmentStart.x,
      y: point.y - segmentStart.y,
    };
    const projection = Math.max(
      0,
      Math.min(1, getVectorDotProduct(pointOffset, segment) / segmentLengthSquared),
    );
    const closestPoint = {
      x: segmentStart.x + segment.x * projection,
      y: segmentStart.y + segment.y * projection,
    };

    return Math.hypot(point.x - closestPoint.x, point.y - closestPoint.y);
  }

  function getRaySegmentIntersectionDistance(origin, direction, segmentStart, segmentEnd) {
    const segment = {
      x: segmentEnd.x - segmentStart.x,
      y: segmentEnd.y - segmentStart.y,
    };
    const startOffset = {
      x: segmentStart.x - origin.x,
      y: segmentStart.y - origin.y,
    };
    const denominator = getVectorCrossProduct(direction, segment);

    if (Math.abs(denominator) <= 0.001) {
      if (Math.abs(getVectorCrossProduct(startOffset, direction)) > 0.001) {
        return Infinity;
      }

      const endOffset = {
        x: segmentEnd.x - origin.x,
        y: segmentEnd.y - origin.y,
      };
      const startProjection = getVectorDotProduct(startOffset, direction);
      const endProjection = getVectorDotProduct(endOffset, direction);
      const nearestProjection = Math.min(startProjection, endProjection);
      const furthestProjection = Math.max(startProjection, endProjection);

      return furthestProjection > 0.5 ? Math.max(0, nearestProjection) : Infinity;
    }

    const rayDistance = getVectorCrossProduct(startOffset, segment) / denominator;
    const segmentProgress = getVectorCrossProduct(startOffset, direction) / denominator;

    if (rayDistance > 0.5 && segmentProgress >= -0.001 && segmentProgress <= 1.001) {
      return rayDistance;
    }

    return Infinity;
  }

  function shouldSkipDangerSegment(runner, trailRunner, segmentIndex) {
    return (
      runner === trailRunner &&
      segmentIndex >= trailRunner.path.length - dangerDistances.ownTrailSkipSegments
    );
  }

  function getBoundaryDistanceInDirection(runner) {
    if (runner.direction.x > 0) return state.width - runner.x;
    if (runner.direction.x < 0) return runner.x;
    if (runner.direction.y > 0) return state.height - runner.y;
    if (runner.direction.y < 0) return runner.y;

    return Infinity;
  }

  function getBoundaryProximity(runner) {
    return Math.min(runner.x, state.width - runner.x, runner.y, state.height - runner.y);
  }

  function getTrailDistanceInDirection(runner) {
    const origin = { x: runner.x, y: runner.y };
    let nearestDistance = Infinity;

    state.runners.forEach((trailRunner) => {
      for (let index = 1; index < trailRunner.path.length; index += 1) {
        if (shouldSkipDangerSegment(runner, trailRunner, index)) {
          continue;
        }

        const distance = getRaySegmentIntersectionDistance(
          origin,
          runner.direction,
          trailRunner.path[index - 1],
          trailRunner.path[index],
        );

        if (distance < nearestDistance) {
          nearestDistance = distance;
        }
      }
    });

    return nearestDistance;
  }

  function getTrailProximity(runner) {
    const head = { x: runner.x, y: runner.y };
    let nearestDistance = Infinity;

    state.runners.forEach((trailRunner) => {
      for (let index = 1; index < trailRunner.path.length; index += 1) {
        if (shouldSkipDangerSegment(runner, trailRunner, index)) {
          continue;
        }

        const distance = getPointToSegmentDistance(
          head,
          trailRunner.path[index - 1],
          trailRunner.path[index],
        );

        if (distance < nearestDistance) {
          nearestDistance = distance;
        }
      }
    });

    return nearestDistance;
  }

  function getDangerScore(distance, warningDistance, criticalDistance) {
    if (!Number.isFinite(distance)) {
      return 0;
    }

    if (distance <= criticalDistance) {
      return 1;
    }

    if (distance >= warningDistance) {
      return 0;
    }

    const progress = (warningDistance - distance) / (warningDistance - criticalDistance);

    return progress * progress * (3 - 2 * progress);
  }

  function getRunnerDanger(runner) {
    if (!runner.alive || state.width <= 1 || state.height <= 1) {
      return 0;
    }

    const forwardDanger = Math.max(
      getDangerScore(
        getBoundaryDistanceInDirection(runner),
        dangerDistances.wallWarning,
        dangerDistances.wallCritical,
      ),
      getDangerScore(
        getTrailDistanceInDirection(runner),
        dangerDistances.trailWarning,
        dangerDistances.trailCritical,
      ),
    );
    const proximityDanger = Math.max(
      getDangerScore(
        getBoundaryProximity(runner),
        dangerDistances.proximityWarning,
        dangerDistances.proximityCritical,
      ),
      getDangerScore(
        getTrailProximity(runner),
        dangerDistances.proximityWarning,
        dangerDistances.proximityCritical,
      ),
    );

    return Math.max(forwardDanger, proximityDanger * 0.72);
  }

  function updateAudioDanger(now) {
    if (now - state.lastDangerSampleAt < dangerSampleInterval) {
      return;
    }

    state.lastDangerSampleAt = now;
    audioEngine.setDangerLevel(Math.max(0, ...state.runners.map(getRunnerDanger)));
  }

  function formatSurvivalTime(seconds) {
    return seconds.toFixed(1);
  }

  function initialiseRunners() {
    const margin = Math.max(30, Math.min(76, Math.min(state.width, state.height) * 0.08));

    state.runners = getRegisteredPlayers().map((player) => {
      const start = player.getStart(state.width, state.height, margin);

      return {
        player,
        direction: { ...player.direction },
        queuedDirection: null,
        alive: true,
        survivalTime: 0,
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

  function doesMoveHitTrail(runner, from, to) {
    return state.runners.some((trailRunner) => {
      for (let index = 1; index < trailRunner.path.length; index += 1) {
        const isOwnRecentSegment = trailRunner === runner && index >= trailRunner.path.length - 1;

        if (isOwnRecentSegment) {
          continue;
        }

        if (doSegmentsIntersect(from, to, trailRunner.path[index - 1], trailRunner.path[index])) {
          return true;
        }
      }

      return false;
    });
  }

  function doesMoveHitCurrentMoves(move, moves) {
    return moves.some((otherMove) => {
      if (move.runner === otherMove.runner) {
        return false;
      }

      if (!doSegmentsIntersect(move.from, move.to, otherMove.from, otherMove.to)) {
        return false;
      }

      return !isIntersectionOnlyAtMoveStart(move, otherMove);
    });
  }

  function renderGameOverResults(winnerRunner) {
    gameOverResults.replaceChildren(
      ...state.runners.map((runner) => {
        const result = document.createElement("li");
        const name = document.createElement("span");
        const status = document.createElement("span");
        const isWinner = runner === winnerRunner;

        result.className = `lines-game-over-result ${runner.player.className}`;
        result.classList.toggle("is-winner", isWinner);
        result.classList.toggle("is-eliminated", !isWinner);

        name.className = "lines-game-over-player";
        name.textContent = runner.player.label;

        status.className = "lines-game-over-status";
        status.textContent = isWinner
          ? t("pages.lines.gameOverWins")
          : t("pages.lines.gameOverSurvivalTime", {
              time: formatSurvivalTime(runner.survivalTime),
            });

        result.append(name, status);
        return result;
      }),
    );
  }

  function finishGame() {
    if (state.phase !== "running") return;

    const aliveRunners = state.runners.filter((runner) => runner.alive);
    const winnerRunner = aliveRunners.length === 1 ? aliveRunners[0] : null;
    const winnerText =
      winnerRunner
        ? t("pages.lines.winner", { player: winnerRunner.player.label })
        : t("pages.lines.noWinner");

    state.phase = "game-over";
    window.cancelAnimationFrame(state.animationId);
    state.animationId = 0;
    window.clearTimeout(state.gameOverTimeoutId);
    state.canDismissGameOver = false;
    hideCountdownStatus();
    overlay.hidden = true;
    gameOver.hidden = false;
    gameOver.classList.remove("is-dismissible");
    renderGameOverResults(winnerRunner);
    gameOverHint.setAttribute("aria-hidden", "true");
    gameOverHint.textContent = t("pages.lines.gameOverDismiss");
    clearPressedKeys();
    audioEngine.finishRound({ hasWinner: Boolean(winnerRunner) });

    playerCount.textContent = winnerText;

    state.runners.forEach((runner) => {
      const chip = chipElements.get(runner.player.id);

      chip.classList.toggle("is-winner", runner === winnerRunner);
      chip.classList.toggle("is-eliminated", runner !== winnerRunner);
      chip.dataset.status = t(
        runner === winnerRunner ? "pages.lines.winnerStatus" : "pages.lines.out",
      );
    });

    state.gameOverTimeoutId = window.setTimeout(() => {
      state.canDismissGameOver = true;
      gameOver.classList.add("is-dismissible");
      gameOverHint.setAttribute("aria-hidden", "false");
      gameOverHint.textContent = t("pages.lines.gameOverDismiss");
    }, gameOverLockDuration);
  }

  function animateGame(now) {
    if (!state.lastFrameAt) {
      state.lastFrameAt = now;
    }

    const elapsed = Math.min(0.05, (now - state.lastFrameAt) / 1000);
    state.lastFrameAt = now;

    const moves = state.runners
      .filter((runner) => runner.alive)
      .map((runner) => {
        if (runner.queuedDirection) {
          runner.direction = runner.queuedDirection;
          runner.queuedDirection = null;
        }

        const from = { x: runner.x, y: runner.y };
        const nextPoint = {
          x: runner.x + runner.direction.x * playerSpeed * elapsed,
          y: runner.y + runner.direction.y * playerSpeed * elapsed,
        };
        const clampedPoint = clampToCanvas(nextPoint);

        return {
          runner,
          from,
          to: clampedPoint,
          inBounds:
            clampedPoint.x === nextPoint.x &&
            clampedPoint.y === nextPoint.y &&
            state.width > 1 &&
            state.height > 1,
        };
      });

    moves.forEach((move) => {
      move.crashed =
        !move.inBounds ||
        doesMoveHitTrail(move.runner, move.from, move.to) ||
        doesMoveHitCurrentMoves(move, moves);
    });

    const eliminatedRunners = moves
      .filter((move) => move.crashed && move.runner.alive)
      .map((move) => move.runner);

    moves.forEach((move) => {
      const { runner, to } = move;

      runner.x = to.x;
      runner.y = to.y;
      runner.survivalTime += elapsed;
      runner.path.push(to);
      runner.alive = !move.crashed;
    });

    if (eliminatedRunners.length > 0) {
      audioEngine.playerEliminated(eliminatedRunners.map((runner) => runner.player.id));
    }

    drawGame();

    if (state.runners.filter((runner) => runner.alive).length <= 1) {
      finishGame();
      return;
    }

    updateAudioDanger(now);
    state.animationId = window.requestAnimationFrame(animateGame);
  }

  function resetRound() {
    window.cancelAnimationFrame(state.countdownAnimationId);
    window.cancelAnimationFrame(state.animationId);
    window.clearTimeout(state.gameOverTimeoutId);
    state.phase = "registration";
    state.registeredPlayerIds.clear();
    state.countdownAnimationId = 0;
    state.countdownStartedAt = 0;
    state.animationId = 0;
    state.lastFrameAt = 0;
    state.gameOverTimeoutId = 0;
    state.canDismissGameOver = false;
    state.runners = [];
    state.lastDangerSampleAt = 0;
    gameOver.hidden = true;
    gameOver.classList.remove("is-dismissible");
    gameOverResults.replaceChildren();
    gameOverHint.setAttribute("aria-hidden", "true");
    gameOverHint.textContent = t("pages.lines.gameOverDismiss");
    overlay.hidden = false;
    showRegistrationPrompt();
    stage.classList.remove("is-game-running");
    clearPressedKeys();
    ctx.clearRect(0, 0, state.width, state.height);
    audioEngine.stop();
    updateRegistrationUi();
  }

  function startGame() {
    if (state.phase === "running") return;

    state.phase = "running";
    window.cancelAnimationFrame(state.countdownAnimationId);
    hideCountdownStatus();
    overlay.hidden = true;
    stage.classList.add("is-game-running");
    activeKeys.forEach((keyElement) => keyElement.classList.remove("is-pressed"));

    resizeCanvas();
    initialiseRunners();
    drawGame();
    state.lastFrameAt = 0;
    state.lastDangerSampleAt = 0;
    audioEngine.setDangerLevel(0);
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
    showCountdownTimer();
    audioEngine.startRound();
    updateRegistrationUi();
    tickCountdown(state.countdownStartedAt);
  }

  function registerPlayer(player) {
    if (
      state.phase === "running" ||
      state.phase === "game-over" ||
      state.registeredPlayerIds.has(player.id)
    ) {
      return;
    }

    state.registeredPlayerIds.add(player.id);
    updateRegistrationUi();

    if (state.registeredPlayerIds.size >= 2 && state.phase === "registration") {
      startCountdown();
    }
  }

  function queuePlayerDirection(player, direction) {
    if (state.phase !== "running") return;

    const runner = state.runners.find((currentRunner) => currentRunner.player.id === player.id);

    if (!runner || !runner.alive || isOppositeDirection(runner.direction, direction)) {
      return;
    }

    runner.queuedDirection = direction;
  }

  function setPressedKey(event, isPressed) {
    const control = controlByKeyCode.get(event.code);
    const keyElement = activeKeys.get(event.code);

    if (!control || event.altKey || event.ctrlKey || event.metaKey) return;

    event.preventDefault();

    if (keyElement) {
      keyElement.classList.toggle("is-pressed", isPressed);
    }

    if (isPressed) {
      queuePlayerDirection(control.player, control.direction);
      registerPlayer(control.player);
    }
  }

  function dismissGameOver(event) {
    if (state.phase !== "game-over" || !state.canDismissGameOver) {
      return false;
    }

    event.preventDefault();
    resetRound();
    return true;
  }

  function clearPressedKeys() {
    activeKeys.forEach((keyElement) => keyElement.classList.remove("is-pressed"));
  }

  const handleKeyDown = (event) => {
    if (dismissGameOver(event)) return;

    setPressedKey(event, true);
  };
  const handleKeyUp = (event) => setPressedKey(event, false);
  const resizeObserver = new ResizeObserver(resizeCanvas);

  resizeObserver.observe(stage);
  resizeCanvas();
  showRegistrationPrompt();
  updateRegistrationUi();
  window.addEventListener("keydown", handleKeyDown);
  window.addEventListener("keyup", handleKeyUp);
  window.addEventListener("blur", clearPressedKeys);

  return () => {
    window.cancelAnimationFrame(state.countdownAnimationId);
    window.cancelAnimationFrame(state.animationId);
    window.clearTimeout(state.gameOverTimeoutId);
    resizeObserver.disconnect();
    window.removeEventListener("keydown", handleKeyDown);
    window.removeEventListener("keyup", handleKeyUp);
    window.removeEventListener("blur", clearPressedKeys);
    audioEngine.dispose();
  };
}

window.gagunPageModules = window.gagunPageModules || [];
window.gagunPageModules.push({
  id: "lines",
  sectionId: "games",
  navKey: "pages.lines.navLabel",
  titleKey: "pages.lines.title",
  requiresDesktop: true,
  desktopOnlyMessageKey: "pages.lines.desktopOnlyMessage",
  theme: {
    background: "#dfe8f0",
    backgroundSoft: "#f7fbff",
    mathColor: "rgba(12, 32, 52, 0.12)",
    mathOpacity: "0.54",
  },
  render: renderLines,
});
