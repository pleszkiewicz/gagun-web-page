function renderReactionDiffusion(container, { t }) {
  const controlDefinitions = [
    {
      key: "feed",
      labelKey: "pages.reactionDiffusion.feed",
      tooltipKey: "pages.reactionDiffusion.feedTooltip",
      min: 18,
      max: 48,
      step: 1,
      value: 29,
      format: (value) => (value / 1000).toFixed(3),
    },
    {
      key: "kill",
      labelKey: "pages.reactionDiffusion.kill",
      tooltipKey: "pages.reactionDiffusion.killTooltip",
      min: 48,
      max: 68,
      step: 1,
      value: 57,
      format: (value) => (value / 1000).toFixed(3),
    },
    {
      key: "diffusionB",
      labelKey: "pages.reactionDiffusion.diffusionB",
      tooltipKey: "pages.reactionDiffusion.diffusionBTooltip",
      min: 35,
      max: 70,
      step: 1,
      value: 50,
      format: (value) => (value / 100).toFixed(2),
    },
    {
      key: "speed",
      labelKey: "pages.reactionDiffusion.speed",
      tooltipKey: "pages.reactionDiffusion.speedTooltip",
      min: 1,
      max: 8,
      step: 1,
      value: 4,
      format: (value) => `${value}x`,
    },
    {
      key: "resolution",
      labelKey: "pages.reactionDiffusion.resolution",
      tooltipKey: "pages.reactionDiffusion.resolutionTooltip",
      min: 34,
      max: 72,
      step: 2,
      value: 56,
      format: (value) => `${value}%`,
    },
    {
      key: "threshold",
      labelKey: "pages.reactionDiffusion.threshold",
      tooltipKey: "pages.reactionDiffusion.thresholdTooltip",
      min: 14,
      max: 32,
      step: 1,
      value: 22,
      format: (value) => (value / 100).toFixed(2),
    },
  ];

  const controlsMarkup = controlDefinitions
    .map((definition) => {
      const id = `reaction${definition.key}`;
      const tooltipId = `${id}Tooltip`;

      return `
        <div class="fractal-control reaction-control">
          <div class="reaction-control-header">
            <label for="${id}">${t(definition.labelKey)}</label>
            <button
              class="reaction-help"
              type="button"
              aria-label="${t("pages.reactionDiffusion.tooltipButton", {
                parameter: t(definition.labelKey),
              })}"
              aria-describedby="${tooltipId}"
              aria-expanded="false"
              data-tooltip-key="${definition.key}"
            >i</button>
            <output id="${id}Value" for="${id}">${definition.format(definition.value)}</output>
            <span class="reaction-tooltip" id="${tooltipId}" role="tooltip">
              ${t(definition.tooltipKey)}
            </span>
          </div>
          <input
            class="reaction-slider"
            id="${id}"
            type="range"
            min="${definition.min}"
            max="${definition.max}"
            step="${definition.step}"
            value="${definition.value}"
            data-key="${definition.key}"
          >
        </div>
      `;
    })
    .join("");

  container.innerHTML = `
    <section class="fractals-page reaction-page" aria-label="${t("pages.reactionDiffusion.pageLabel")}">
      <canvas
        class="fractal-canvas reaction-canvas"
        id="reactionCanvas"
        aria-label="${t("pages.reactionDiffusion.canvasLabel")}"
      ></canvas>

      <aside class="fractal-panel reaction-panel" aria-label="${t("pages.reactionDiffusion.panelLabel")}">
        <header class="fractal-panel-header">
          <p class="eyebrow">${t("pages.reactionDiffusion.eyebrow")}</p>
          <h1>${t("pages.reactionDiffusion.heading")}</h1>
        </header>

        <div
          class="reaction-controls"
          role="group"
          aria-label="${t("pages.reactionDiffusion.parametersLabel")}"
        >
          ${controlsMarkup}
        </div>

        <div class="reaction-button-row">
          <button class="reaction-reset" id="reactionReset" type="button">
            ${t("pages.reactionDiffusion.reseed")}
          </button>
          <button class="reaction-playback" id="reactionPlayback" type="button">
            ${t("pages.reactionDiffusion.pause")}
          </button>
        </div>
      </aside>
    </section>
  `;

  const canvas = container.querySelector("#reactionCanvas");
  const resetButton = container.querySelector("#reactionReset");
  const playbackButton = container.querySelector("#reactionPlayback");
  const inputs = [...container.querySelectorAll(".reaction-slider")];
  const helpButtons = [...container.querySelectorAll(".reaction-help")];
  const ctx = canvas.getContext("2d", { alpha: false });
  const maxCells = 94000;
  const targetFrameInterval = 34;
  const state = {
    animationId: 0,
    a: null,
    b: null,
    nextA: null,
    nextB: null,
    imageData: null,
    width: 0,
    height: 0,
    lastFrameAt: 0,
    paused: false,
    seed: 41129,
    controls: Object.fromEntries(
      controlDefinitions.map((definition) => [definition.key, definition.value]),
    ),
  };
  const tooltipHideTimers = new Map();

  function clampUnit(value) {
    return Math.max(0, Math.min(1, value));
  }

  function createSeededRandom(seed) {
    let value = seed >>> 0;

    return () => {
      value = (value * 1664525 + 1013904223) >>> 0;
      return value / 4294967296;
    };
  }

  function getFeed() {
    return state.controls.feed / 1000;
  }

  function getKill() {
    return state.controls.kill / 1000;
  }

  function getDiffusionB() {
    return state.controls.diffusionB / 100;
  }

  function getThreshold() {
    return state.controls.threshold / 100;
  }

  function syncControlOutput(definition) {
    const output = container.querySelector(`#reaction${definition.key}Value`);

    if (output) {
      output.textContent = definition.format(state.controls[definition.key]);
    }
  }

  function resizeSimulation() {
    const rect = canvas.getBoundingClientRect();
    const rawWidth = Math.max(
      1,
      Math.round(rect.width * (state.controls.resolution / 100) * 0.55),
    );
    const rawHeight = Math.max(
      1,
      Math.round(rect.height * (state.controls.resolution / 100) * 0.55),
    );
    const scale = Math.min(1, Math.sqrt(maxCells / (rawWidth * rawHeight)));
    const width = Math.max(48, Math.round(rawWidth * scale));
    const height = Math.max(48, Math.round(rawHeight * scale));

    if (width === state.width && height === state.height && state.imageData) {
      return;
    }

    state.width = width;
    state.height = height;
    canvas.width = width;
    canvas.height = height;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    state.imageData = ctx.createImageData(width, height);
    state.a = new Float32Array(width * height);
    state.b = new Float32Array(width * height);
    state.nextA = new Float32Array(width * height);
    state.nextB = new Float32Array(width * height);
    seedSimulation();
  }

  function seedDisc(centerX, centerY, radius, bAmount) {
    const minX = Math.max(1, Math.floor(centerX - radius));
    const maxX = Math.min(state.width - 2, Math.ceil(centerX + radius));
    const minY = Math.max(1, Math.floor(centerY - radius));
    const maxY = Math.min(state.height - 2, Math.ceil(centerY + radius));
    const radiusSquared = radius * radius;

    for (let y = minY; y <= maxY; y += 1) {
      for (let x = minX; x <= maxX; x += 1) {
        const dx = x - centerX;
        const dy = y - centerY;

        if (dx * dx + dy * dy > radiusSquared) {
          continue;
        }

        const index = y * state.width + x;
        const edgeFade = 1 - Math.sqrt(dx * dx + dy * dy) / radius;
        const bValue = Math.max(state.b[index], bAmount * (0.66 + edgeFade * 0.34));

        state.a[index] = Math.min(state.a[index], 0.2 + (1 - edgeFade) * 0.22);
        state.b[index] = bValue;
      }
    }
  }

  function seedSimulation() {
    if (!state.a || !state.b) {
      return;
    }

    state.a.fill(1);
    state.b.fill(0);
    state.nextA.fill(1);
    state.nextB.fill(0);

    const random = createSeededRandom(state.seed);
    const shortSide = Math.min(state.width, state.height);
    const strokeCount = Math.max(26, Math.round(shortSide * 0.22));

    for (let stroke = 0; stroke < strokeCount; stroke += 1) {
      let x = random() * state.width;
      let y = random() * state.height;
      const radius = 2.6 + random() * Math.max(3.4, shortSide * 0.024);
      let angle = random() * Math.PI * 2;
      const length = 7 + random() * Math.max(12, shortSide * 0.18);

      for (let step = 0; step < length; step += 1) {
        seedDisc(x, y, radius, 1);
        angle += (random() - 0.5) * 0.56;
        x += Math.cos(angle) * radius * 0.72;
        y += Math.sin(angle) * radius * 0.72;

        if (x < 2 || x > state.width - 3) {
          angle = Math.PI - angle;
          x = Math.max(2, Math.min(state.width - 3, x));
        }

        if (y < 2 || y > state.height - 3) {
          angle = -angle;
          y = Math.max(2, Math.min(state.height - 3, y));
        }
      }
    }

    const warmupSteps = state.width * state.height > 70000 ? 28 : 38;

    for (let step = 0; step < warmupSteps; step += 1) {
      stepSimulation();
    }

    renderSimulation();
  }

  function copySimulationEdges() {
    const lastX = state.width - 1;
    const lastY = state.height - 1;

    for (let y = 1; y < lastY; y += 1) {
      const row = y * state.width;
      const left = row;
      const right = row + lastX;

      state.nextA[left] = state.nextA[left + 1];
      state.nextB[left] = state.nextB[left + 1];
      state.nextA[right] = state.nextA[right - 1];
      state.nextB[right] = state.nextB[right - 1];
    }

    for (let x = 0; x <= lastX; x += 1) {
      const top = x;
      const bottom = lastY * state.width + x;

      state.nextA[top] = state.nextA[top + state.width];
      state.nextB[top] = state.nextB[top + state.width];
      state.nextA[bottom] = state.nextA[bottom - state.width];
      state.nextB[bottom] = state.nextB[bottom - state.width];
    }
  }

  function stepSimulation() {
    const diffusionA = 1;
    const diffusionB = getDiffusionB();
    const feed = getFeed();
    const kill = getKill();
    const lastX = state.width - 1;
    const lastY = state.height - 1;

    for (let y = 1; y < lastY; y += 1) {
      const row = y * state.width;

      for (let x = 1; x < lastX; x += 1) {
        const index = row + x;
        const a = state.a[index];
        const b = state.b[index];
        const upper = index - state.width;
        const lower = index + state.width;
        const laplaceA =
          -a +
          (state.a[index - 1] + state.a[index + 1] + state.a[upper] + state.a[lower]) *
            0.2 +
          (state.a[upper - 1] +
            state.a[upper + 1] +
            state.a[lower - 1] +
            state.a[lower + 1]) *
            0.05;
        const laplaceB =
          -b +
          (state.b[index - 1] + state.b[index + 1] + state.b[upper] + state.b[lower]) *
            0.2 +
          (state.b[upper - 1] +
            state.b[upper + 1] +
            state.b[lower - 1] +
            state.b[lower + 1]) *
            0.05;
        const reaction = a * b * b;

        state.nextA[index] = clampUnit(a + diffusionA * laplaceA - reaction + feed * (1 - a));
        state.nextB[index] = clampUnit(
          b + diffusionB * laplaceB + reaction - (kill + feed) * b,
        );
      }
    }

    copySimulationEdges();
    [state.a, state.nextA] = [state.nextA, state.a];
    [state.b, state.nextB] = [state.nextB, state.b];
  }

  function renderSimulation() {
    if (!state.imageData) {
      return;
    }

    const data = state.imageData.data;
    const threshold = getThreshold();
    const contrast = 12;
    let offset = 0;

    for (let index = 0; index < state.b.length; index += 1) {
      const value = clampUnit((state.b[index] - threshold) * contrast + 0.5);
      const smoothValue = value * value * (3 - 2 * value);
      const shade = Math.round(smoothValue * 255);

      data[offset] = shade;
      data[offset + 1] = shade;
      data[offset + 2] = shade;
      data[offset + 3] = 255;
      offset += 4;
    }

    ctx.putImageData(state.imageData, 0, 0);
  }

  function animate(now) {
    if (!state.lastFrameAt) {
      state.lastFrameAt = now;
    }

    if (now - state.lastFrameAt >= targetFrameInterval) {
      if (!state.paused) {
        for (let step = 0; step < state.controls.speed; step += 1) {
          stepSimulation();
        }
      }

      renderSimulation();
      state.lastFrameAt = now;
    }

    state.animationId = window.requestAnimationFrame(animate);
  }

  function updateControl(event) {
    const input = event.currentTarget;
    const key = input.dataset.key;
    const definition = controlDefinitions.find((candidate) => candidate.key === key);

    if (!definition) {
      return;
    }

    state.controls[key] = Number(input.value);
    syncControlOutput(definition);

    if (key === "resolution") {
      resizeSimulation();
    } else if (key === "threshold") {
      renderSimulation();
    }
  }

  function getTooltipDuration(button) {
    const tooltip = button.parentElement?.querySelector(".reaction-tooltip");
    const textLength = tooltip?.textContent?.trim().length || 0;

    return Math.max(5000, Math.min(7600, textLength * 42));
  }

  function clearTooltipTimer(button) {
    const timerId = tooltipHideTimers.get(button);

    if (timerId) {
      window.clearTimeout(timerId);
      tooltipHideTimers.delete(button);
    }
  }

  function hideTooltip(button) {
    clearTooltipTimer(button);
    button.classList.remove("is-tooltip-visible");
    button.setAttribute("aria-expanded", "false");
  }

  function showTooltip(button, { autoHide = false } = {}) {
    helpButtons.forEach((candidate) => {
      if (candidate !== button) {
        hideTooltip(candidate);
      }
    });

    clearTooltipTimer(button);
    button.classList.add("is-tooltip-visible");
    button.setAttribute("aria-expanded", "true");

    if (autoHide) {
      const timerId = window.setTimeout(() => hideTooltip(button), getTooltipDuration(button));
      tooltipHideTimers.set(button, timerId);
    }
  }

  function handleHelpClick(event) {
    event.preventDefault();
    const button = event.currentTarget;

    if (button.classList.contains("is-tooltip-visible")) {
      hideTooltip(button);
      return;
    }

    showTooltip(button, { autoHide: true });
  }

  function hideTooltipsOnEscape(event) {
    if (event.key === "Escape") {
      helpButtons.forEach(hideTooltip);
    }
  }

  function reseed() {
    state.seed = Math.floor(Math.random() * 4294967295);
    seedSimulation();
  }

  function togglePlayback() {
    state.paused = !state.paused;
    playbackButton.textContent = t(
      state.paused ? "pages.reactionDiffusion.resume" : "pages.reactionDiffusion.pause",
    );
    state.lastFrameAt = performance.now();
  }

  inputs.forEach((input) => {
    input.addEventListener("input", updateControl);
    input.addEventListener("change", updateControl);
  });
  helpButtons.forEach((button) => {
    button.addEventListener("click", handleHelpClick);
    button.addEventListener("blur", () => hideTooltip(button));
  });
  window.addEventListener("keydown", hideTooltipsOnEscape);
  resetButton.addEventListener("click", reseed);
  playbackButton.addEventListener("click", togglePlayback);

  const resizeObserver = new ResizeObserver(resizeSimulation);
  resizeObserver.observe(canvas);
  controlDefinitions.forEach(syncControlOutput);
  resizeSimulation();
  state.animationId = window.requestAnimationFrame(animate);

  return () => {
    window.cancelAnimationFrame(state.animationId);
    helpButtons.forEach((button) => clearTooltipTimer(button));
    window.removeEventListener("keydown", hideTooltipsOnEscape);
    resizeObserver.disconnect();
  };
}

window.gagunPageModules = window.gagunPageModules || [];
window.gagunPageModules.push({
  id: "reaction-diffusion",
  sectionId: "mathematics",
  navKey: "pages.reactionDiffusion.navLabel",
  titleKey: "pages.reactionDiffusion.title",
  theme: {
    background: "#ececec",
    backgroundSoft: "#ffffff",
    mathColor: "rgba(0, 0, 0, 0.13)",
    mathOpacity: "0.52",
  },
  render: renderReactionDiffusion,
});
