function renderFourierEpicycles(container, { t }) {
  const TAU = Math.PI * 2;
  const sampleCount = 384;
  const traceSteps = 720;
  const maxDevicePixelRatio = 2;
  const maxEpicycleCount = 180;
  const animationSpeedScale = 0.5;
  const defaultEpicycleCount = 96;
  const defaultSpeed = 55;
  const builtInShapes = [
    {
      id: "dino",
      labelKey: "pages.fourierEpicycles.shapes.dino",
      createPoints: createDinoPoints,
    },
    {
      id: "dragon",
      labelKey: "pages.fourierEpicycles.shapes.dragon",
      createPoints: createDragonPoints,
    },
    {
      id: "octopus",
      labelKey: "pages.fourierEpicycles.shapes.octopus",
      createPoints: createOctopusPoints,
    },
    {
      id: "robot",
      labelKey: "pages.fourierEpicycles.shapes.robot",
      createPoints: createRobotPoints,
    },
  ];

  const shapeOptions = builtInShapes
    .map((shape) => `<option value="${shape.id}">${t(shape.labelKey)}</option>`)
    .join("");

  container.innerHTML = `
    <section class="fourier-page" aria-label="${t("pages.fourierEpicycles.pageLabel")}">
      <canvas
        class="fourier-canvas"
        id="fourierCanvas"
        aria-label="${t("pages.fourierEpicycles.canvasLabel")}"
      ></canvas>

      <aside class="fourier-panel" aria-label="${t("pages.fourierEpicycles.panelLabel")}">
        <header class="fourier-panel-header">
          <p class="eyebrow">${t("pages.fourierEpicycles.eyebrow")}</p>
          <h1>${t("pages.fourierEpicycles.heading")}</h1>
        </header>

        <div class="fourier-readout">
          <code id="fourierReadout"></code>
          <span id="fourierStatus" aria-live="polite"></span>
        </div>

        <label class="fourier-control" for="fourierShape">
          <span>${t("pages.fourierEpicycles.shapeLabel")}</span>
          <select class="fourier-select" id="fourierShape">
            ${shapeOptions}
          </select>
        </label>

        <div class="fourier-button-row">
          <button class="fourier-secondary-button" id="fourierRandom" type="button">
            ${t("pages.fourierEpicycles.randomShape")}
          </button>
          <input
            class="fourier-file-input"
            id="fourierUpload"
            type="file"
            accept="image/*"
          >
          <label class="fourier-file-button" for="fourierUpload">
            ${t("pages.fourierEpicycles.uploadImage")}
          </label>
        </div>

        <label class="fourier-control" for="fourierEpicycleCount">
          <span>
            ${t("pages.fourierEpicycles.epicyclesLabel")}
            <output id="fourierEpicycleValue" for="fourierEpicycleCount"></output>
          </span>
          <input
            class="fourier-slider"
            id="fourierEpicycleCount"
            type="range"
            min="1"
            max="${maxEpicycleCount}"
            step="1"
            value="${defaultEpicycleCount}"
          >
        </label>

        <label class="fourier-control" for="fourierSpeed">
          <span>
            ${t("pages.fourierEpicycles.speedLabel")}
            <output id="fourierSpeedValue" for="fourierSpeed"></output>
          </span>
          <input
            class="fourier-slider"
            id="fourierSpeed"
            type="range"
            min="5"
            max="120"
            step="5"
            value="${defaultSpeed}"
          >
        </label>

        <button class="fourier-playback" id="fourierPlayback" type="button">
          ${t("pages.fourierEpicycles.pause")}
        </button>
      </aside>
    </section>
  `;

  const canvas = container.querySelector("#fourierCanvas");
  const panel = container.querySelector(".fourier-panel");
  const shapeSelect = container.querySelector("#fourierShape");
  const randomButton = container.querySelector("#fourierRandom");
  const uploadInput = container.querySelector("#fourierUpload");
  const epicycleSlider = container.querySelector("#fourierEpicycleCount");
  const epicycleValue = container.querySelector("#fourierEpicycleValue");
  const speedSlider = container.querySelector("#fourierSpeed");
  const speedValue = container.querySelector("#fourierSpeedValue");
  const playbackButton = container.querySelector("#fourierPlayback");
  const readout = container.querySelector("#fourierReadout");
  const status = container.querySelector("#fourierStatus");
  const ctx = canvas.getContext("2d", { alpha: false });

  const state = {
    animationId: 0,
    coefficients: [],
    customShape: null,
    dpr: 1,
    epicycleCount: defaultEpicycleCount,
    lastFrameAt: 0,
    paused: false,
    phase: 0,
    shapeId: "dino",
    shapeLabel: t("pages.fourierEpicycles.shapes.dino"),
    sourcePoints: [],
    speed: defaultSpeed / 100,
    trace: [],
  };

  function createDinoPoints() {
    return [
      { x: -1.42, y: -0.22 },
      { x: -1.31, y: -0.16 },
      { x: -1.18, y: -0.08 },
      { x: -1.04, y: -0.04 },
      { x: -0.91, y: -0.03 },
      { x: -0.76, y: 0.05 },
      { x: -0.65, y: 0.17 },
      { x: -0.51, y: 0.29 },
      { x: -0.33, y: 0.36 },
      { x: -0.15, y: 0.38 },
      { x: -0.01, y: 0.48 },
      { x: 0.12, y: 0.61 },
      { x: 0.31, y: 0.69 },
      { x: 0.49, y: 0.72 },
      { x: 0.68, y: 0.68 },
      { x: 0.86, y: 0.58 },
      { x: 1.05, y: 0.6 },
      { x: 1.19, y: 0.53 },
      { x: 1.27, y: 0.42 },
      { x: 1.13, y: 0.38 },
      { x: 0.99, y: 0.36 },
      { x: 1.15, y: 0.27 },
      { x: 0.96, y: 0.26 },
      { x: 1.08, y: 0.18 },
      { x: 0.88, y: 0.18 },
      { x: 0.79, y: 0.08 },
      { x: 0.63, y: 0.05 },
      { x: 0.52, y: -0.05 },
      { x: 0.46, y: -0.15 },
      { x: 0.55, y: -0.24 },
      { x: 0.44, y: -0.25 },
      { x: 0.36, y: -0.2 },
      { x: 0.33, y: -0.31 },
      { x: 0.23, y: -0.2 },
      { x: 0.08, y: -0.28 },
      { x: 0.13, y: -0.42 },
      { x: 0.28, y: -0.6 },
      { x: 0.5, y: -0.66 },
      { x: 0.63, y: -0.62 },
      { x: 0.48, y: -0.56 },
      { x: 0.34, y: -0.45 },
      { x: 0.27, y: -0.31 },
      { x: 0.12, y: -0.38 },
      { x: -0.07, y: -0.42 },
      { x: -0.14, y: -0.6 },
      { x: -0.02, y: -0.74 },
      { x: -0.2, y: -0.77 },
      { x: -0.36, y: -0.63 },
      { x: -0.43, y: -0.45 },
      { x: -0.57, y: -0.39 },
      { x: -0.75, y: -0.36 },
      { x: -0.96, y: -0.38 },
      { x: -1.17, y: -0.34 },
      { x: -1.32, y: -0.3 },
    ];
  }

  function createDragonPoints() {
    return [
      { x: -1.46, y: -0.2 },
      { x: -1.28, y: -0.08 },
      { x: -1.1, y: -0.01 },
      { x: -0.95, y: 0.08 },
      { x: -0.82, y: 0.02 },
      { x: -0.72, y: 0.17 },
      { x: -0.6, y: 0.09 },
      { x: -0.45, y: 0.26 },
      { x: -0.26, y: 0.28 },
      { x: -0.1, y: 0.36 },
      { x: -0.06, y: 0.77 },
      { x: -0.22, y: 0.98 },
      { x: 0.04, y: 0.87 },
      { x: 0.33, y: 1.04 },
      { x: 0.26, y: 0.74 },
      { x: 0.49, y: 0.58 },
      { x: 0.75, y: 0.73 },
      { x: 0.64, y: 0.48 },
      { x: 0.78, y: 0.42 },
      { x: 0.9, y: 0.55 },
      { x: 1.02, y: 0.45 },
      { x: 0.93, y: 0.34 },
      { x: 1.12, y: 0.31 },
      { x: 1.31, y: 0.19 },
      { x: 1.13, y: 0.12 },
      { x: 1.28, y: 0.04 },
      { x: 1.05, y: 0.0 },
      { x: 0.93, y: -0.08 },
      { x: 0.83, y: -0.2 },
      { x: 0.94, y: -0.31 },
      { x: 0.76, y: -0.28 },
      { x: 0.65, y: -0.4 },
      { x: 0.48, y: -0.28 },
      { x: 0.3, y: -0.34 },
      { x: 0.21, y: -0.53 },
      { x: 0.33, y: -0.7 },
      { x: 0.12, y: -0.66 },
      { x: 0.0, y: -0.48 },
      { x: -0.19, y: -0.43 },
      { x: -0.36, y: -0.55 },
      { x: -0.55, y: -0.52 },
      { x: -0.43, y: -0.38 },
      { x: -0.62, y: -0.32 },
      { x: -0.82, y: -0.31 },
      { x: -1.04, y: -0.37 },
      { x: -1.26, y: -0.32 },
    ];
  }

  function createOctopusPoints() {
    return [
      { x: -0.79, y: 0.05 },
      { x: -0.78, y: 0.26 },
      { x: -0.7, y: 0.48 },
      { x: -0.55, y: 0.68 },
      { x: -0.34, y: 0.8 },
      { x: -0.1, y: 0.86 },
      { x: 0.14, y: 0.85 },
      { x: 0.38, y: 0.77 },
      { x: 0.59, y: 0.61 },
      { x: 0.72, y: 0.4 },
      { x: 0.79, y: 0.16 },
      { x: 0.9, y: -0.09 },
      { x: 0.78, y: -0.3 },
      { x: 0.96, y: -0.47 },
      { x: 0.8, y: -0.63 },
      { x: 0.59, y: -0.49 },
      { x: 0.51, y: -0.25 },
      { x: 0.39, y: -0.45 },
      { x: 0.46, y: -0.72 },
      { x: 0.26, y: -0.8 },
      { x: 0.1, y: -0.54 },
      { x: 0.02, y: -0.29 },
      { x: -0.1, y: -0.55 },
      { x: -0.27, y: -0.78 },
      { x: -0.45, y: -0.66 },
      { x: -0.37, y: -0.42 },
      { x: -0.48, y: -0.25 },
      { x: -0.61, y: -0.49 },
      { x: -0.82, y: -0.59 },
      { x: -0.93, y: -0.4 },
      { x: -0.75, y: -0.22 },
      { x: -0.86, y: -0.07 },
    ];
  }

  function createRobotPoints() {
    return [
      { x: -0.18, y: 1.03 },
      { x: -0.07, y: 0.9 },
      { x: -0.11, y: 0.75 },
      { x: -0.48, y: 0.73 },
      { x: -0.55, y: 0.5 },
      { x: -0.8, y: 0.45 },
      { x: -1.02, y: 0.26 },
      { x: -0.91, y: 0.09 },
      { x: -0.66, y: 0.18 },
      { x: -0.58, y: -0.02 },
      { x: -0.79, y: -0.22 },
      { x: -0.93, y: -0.49 },
      { x: -0.72, y: -0.62 },
      { x: -0.53, y: -0.38 },
      { x: -0.34, y: -0.48 },
      { x: -0.36, y: -0.76 },
      { x: -0.53, y: -0.83 },
      { x: -0.45, y: -0.97 },
      { x: -0.14, y: -0.97 },
      { x: -0.07, y: -0.76 },
      { x: 0.12, y: -0.76 },
      { x: 0.18, y: -0.97 },
      { x: 0.49, y: -0.97 },
      { x: 0.57, y: -0.82 },
      { x: 0.39, y: -0.76 },
      { x: 0.37, y: -0.48 },
      { x: 0.56, y: -0.37 },
      { x: 0.74, y: -0.62 },
      { x: 0.94, y: -0.49 },
      { x: 0.8, y: -0.21 },
      { x: 0.59, y: -0.01 },
      { x: 0.66, y: 0.18 },
      { x: 0.91, y: 0.09 },
      { x: 1.02, y: 0.27 },
      { x: 0.8, y: 0.45 },
      { x: 0.55, y: 0.51 },
      { x: 0.48, y: 0.73 },
      { x: 0.13, y: 0.75 },
      { x: 0.07, y: 0.9 },
      { x: 0.18, y: 1.03 },
      { x: 0.0, y: 1.11 },
    ];
  }

  function getBuiltInShape(id) {
    return builtInShapes.find((shape) => shape.id === id) || builtInShapes[0];
  }

  function getDistance(first, second) {
    return Math.hypot(second.x - first.x, second.y - first.y);
  }

  function resampleClosedPath(points, count) {
    const cleanPoints = points.filter(
      (point) => Number.isFinite(point.x) && Number.isFinite(point.y),
    );

    if (cleanPoints.length < 3) {
      return [];
    }

    const segmentLengths = cleanPoints.map((point, index) =>
      getDistance(point, cleanPoints[(index + 1) % cleanPoints.length]),
    );
    const totalLength = segmentLengths.reduce((total, length) => total + length, 0);

    if (totalLength <= 0) {
      return [];
    }

    const sampled = [];
    let segmentIndex = 0;
    let segmentStartDistance = 0;

    for (let index = 0; index < count; index += 1) {
      const targetDistance = (totalLength * index) / count;

      while (
        segmentIndex < segmentLengths.length - 1 &&
        segmentStartDistance + segmentLengths[segmentIndex] < targetDistance
      ) {
        segmentStartDistance += segmentLengths[segmentIndex];
        segmentIndex += 1;
      }

      const start = cleanPoints[segmentIndex];
      const end = cleanPoints[(segmentIndex + 1) % cleanPoints.length];
      const segmentLength = segmentLengths[segmentIndex] || 1;
      const progress = (targetDistance - segmentStartDistance) / segmentLength;

      sampled.push({
        x: start.x + (end.x - start.x) * progress,
        y: start.y + (end.y - start.y) * progress,
      });
    }

    return sampled;
  }

  function getBounds(points) {
    return points.reduce(
      (bounds, point) => ({
        minX: Math.min(bounds.minX, point.x),
        maxX: Math.max(bounds.maxX, point.x),
        minY: Math.min(bounds.minY, point.y),
        maxY: Math.max(bounds.maxY, point.y),
      }),
      {
        minX: Infinity,
        maxX: -Infinity,
        minY: Infinity,
        maxY: -Infinity,
      },
    );
  }

  function normalizePoints(points) {
    const bounds = getBounds(points);
    const width = bounds.maxX - bounds.minX || 1;
    const height = bounds.maxY - bounds.minY || 1;
    const centerX = bounds.minX + width / 2;
    const centerY = bounds.minY + height / 2;
    const scale = 1.72 / Math.max(width, height);

    return points.map((point) => ({
      x: (point.x - centerX) * scale,
      y: (point.y - centerY) * scale,
    }));
  }

  function computeFourierCoefficients(points) {
    const pointTotal = points.length;
    const coefficients = [];

    for (let k = 0; k < pointTotal; k += 1) {
      let real = 0;
      let imaginary = 0;

      for (let n = 0; n < pointTotal; n += 1) {
        const angle = (TAU * k * n) / pointTotal;
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);
        const point = points[n];

        real += point.x * cos + point.y * sin;
        imaginary += point.y * cos - point.x * sin;
      }

      real /= pointTotal;
      imaginary /= pointTotal;

      coefficients.push({
        amplitude: Math.hypot(real, imaginary),
        frequency: k <= pointTotal / 2 ? k : k - pointTotal,
        phase: Math.atan2(imaginary, real),
      });
    }

    return coefficients.sort((first, second) => second.amplitude - first.amplitude);
  }

  function getEndpointAt(time, count) {
    let x = 0;
    let y = 0;
    const limit = Math.min(count, state.coefficients.length);

    for (let index = 0; index < limit; index += 1) {
      const coefficient = state.coefficients[index];
      const angle = coefficient.frequency * time + coefficient.phase;

      x += coefficient.amplitude * Math.cos(angle);
      y += coefficient.amplitude * Math.sin(angle);
    }

    return { x, y };
  }

  function getEpicycleSegments(time, count) {
    const segments = [];
    let x = 0;
    let y = 0;
    const limit = Math.min(count, state.coefficients.length);

    for (let index = 0; index < limit; index += 1) {
      const coefficient = state.coefficients[index];
      const startX = x;
      const startY = y;
      const angle = coefficient.frequency * time + coefficient.phase;

      x += coefficient.amplitude * Math.cos(angle);
      y += coefficient.amplitude * Math.sin(angle);

      segments.push({
        endX: x,
        endY: y,
        radius: coefficient.amplitude,
        startX,
        startY,
      });
    }

    return {
      point: { x, y },
      segments,
    };
  }

  function buildTrace(count) {
    const points = [];

    for (let index = 0; index <= traceSteps; index += 1) {
      points.push(getEndpointAt((TAU * index) / traceSteps, count));
    }

    return points;
  }

  function normalizePhase(phase) {
    return ((phase % TAU) + TAU) % TAU;
  }

  function setStatus(message) {
    status.textContent = message || "";
  }

  function syncReadout() {
    readout.textContent = t("pages.fourierEpicycles.readout", {
      count: state.epicycleCount,
      shape: state.shapeLabel,
    });
    epicycleValue.textContent = String(state.epicycleCount);
    speedValue.textContent = `${state.speed.toFixed(2)}x`;
  }

  function syncEpicycleSlider() {
    const maxCount = Math.min(maxEpicycleCount, state.coefficients.length);

    epicycleSlider.max = String(maxCount);
    state.epicycleCount = Math.min(Math.max(1, state.epicycleCount), maxCount);
    epicycleSlider.value = String(state.epicycleCount);
    state.trace = buildTrace(state.epicycleCount);
    syncReadout();
  }

  function setShape(points, label, id) {
    const normalizedPoints = normalizePoints(resampleClosedPath(points, sampleCount));

    if (normalizedPoints.length < 3) {
      setStatus(t("pages.fourierEpicycles.uploadFailed"));
      return;
    }

    state.shapeId = id;
    state.shapeLabel = label;
    state.sourcePoints = normalizedPoints;
    state.coefficients = computeFourierCoefficients(normalizedPoints);
    state.phase = 0;
    state.lastFrameAt = performance.now();
    syncEpicycleSlider();
    setStatus("");
  }

  function setBuiltInShape(id) {
    const shape = getBuiltInShape(id);

    setShape(shape.createPoints(), t(shape.labelKey), shape.id);
  }

  function setRandomShape() {
    const candidates = builtInShapes.filter((shape) => shape.id !== state.shapeId);
    const nextShape = candidates[Math.floor(Math.random() * candidates.length)] || builtInShapes[0];

    shapeSelect.value = nextShape.id;
    setBuiltInShape(nextShape.id);
  }

  function updateEpicycleCount() {
    state.epicycleCount = Number(epicycleSlider.value);
    state.trace = buildTrace(state.epicycleCount);
    syncReadout();
  }

  function updateSpeed() {
    state.speed = Number(speedSlider.value) / 100;
    syncReadout();
  }

  function togglePlayback() {
    state.paused = !state.paused;
    playbackButton.textContent = t(
      state.paused ? "pages.fourierEpicycles.resume" : "pages.fourierEpicycles.pause",
    );
    state.lastFrameAt = performance.now();
  }

  function resizeCanvas(cssWidth, cssHeight, devicePixelRatio) {
    const width = Math.max(1, Math.round(cssWidth * devicePixelRatio));
    const height = Math.max(1, Math.round(cssHeight * devicePixelRatio));

    if (canvas.width === width && canvas.height === height) {
      return;
    }

    canvas.width = width;
    canvas.height = height;
  }

  function drawBackground(cssWidth, cssHeight) {
    const gradient = ctx.createLinearGradient(0, 0, cssWidth, cssHeight);

    gradient.addColorStop(0, "#f9fbff");
    gradient.addColorStop(0.48, "#fffaf0");
    gradient.addColorStop(1, "#f5fdff");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, cssWidth, cssHeight);

    ctx.save();
    ctx.strokeStyle = "rgba(34, 63, 86, 0.08)";
    ctx.lineWidth = 1;

    for (let x = 0; x <= cssWidth; x += 36) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, cssHeight);
      ctx.stroke();
    }

    for (let y = 0; y <= cssHeight; y += 36) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(cssWidth, y);
      ctx.stroke();
    }

    ctx.restore();
  }

  function getSafeDrawingArea(cssWidth, cssHeight) {
    const canvasRect = canvas.getBoundingClientRect();
    const panelRect = panel.getBoundingClientRect();
    const gutter = Math.max(16, Math.min(cssWidth, cssHeight) * 0.035);
    const area = {
      height: cssHeight,
      width: cssWidth,
      x: 0,
      y: 0,
    };
    const overlapsCanvas =
      panelRect.right > canvasRect.left &&
      panelRect.left < canvasRect.right &&
      panelRect.bottom > canvasRect.top &&
      panelRect.top < canvasRect.bottom;

    if (!overlapsCanvas) {
      return area;
    }

    const panelLeft = panelRect.left - canvasRect.left;
    const panelTop = panelRect.top - canvasRect.top;
    const panelWidthRatio = panelRect.width / Math.max(1, cssWidth);

    if (panelWidthRatio > 0.72 || cssWidth < 760) {
      const topHeight = Math.max(0, panelTop - gutter);

      if (topHeight > cssHeight * 0.3) {
        area.height = topHeight;
      }
    } else {
      const leftWidth = Math.max(0, panelLeft - gutter);

      if (leftWidth > cssWidth * 0.34) {
        area.width = leftWidth;
      }
    }

    return area;
  }

  function getFitTransform(points, area) {
    const bounds = getBounds(points);
    const modelWidth = bounds.maxX - bounds.minX || 1;
    const modelHeight = bounds.maxY - bounds.minY || 1;
    const margin = Math.max(20, Math.min(area.width, area.height) * 0.1);
    const usableWidth = Math.max(1, area.width - margin * 2);
    const usableHeight = Math.max(1, area.height - margin * 2);
    const scale = Math.min(usableWidth / modelWidth, usableHeight / modelHeight);
    const drawnWidth = modelWidth * scale;
    const drawnHeight = modelHeight * scale;

    return {
      originX: area.x + (area.width - drawnWidth) / 2 - bounds.minX * scale,
      originY: area.y + (area.height - drawnHeight) / 2 + bounds.maxY * scale,
      scale,
    };
  }

  function toScreen(point, transform) {
    return {
      x: transform.originX + point.x * transform.scale,
      y: transform.originY - point.y * transform.scale,
    };
  }

  function drawPath(points, transform, strokeStyle, lineWidth) {
    if (points.length < 2) {
      return;
    }

    const firstPoint = toScreen(points[0], transform);

    ctx.beginPath();
    ctx.moveTo(firstPoint.x, firstPoint.y);

    for (let index = 1; index < points.length; index += 1) {
      const point = toScreen(points[index], transform);

      ctx.lineTo(point.x, point.y);
    }

    ctx.closePath();
    ctx.strokeStyle = strokeStyle;
    ctx.lineWidth = lineWidth;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.stroke();
  }

  function drawTrace(transform, progressPoint) {
    const visibleStep = Math.max(0, Math.floor((normalizePhase(state.phase) / TAU) * traceSteps));

    if (visibleStep < 1) {
      return;
    }

    const firstPoint = toScreen(state.trace[0], transform);

    ctx.beginPath();
    ctx.moveTo(firstPoint.x, firstPoint.y);

    for (let index = 1; index <= visibleStep; index += 1) {
      const point = toScreen(state.trace[index], transform);

      ctx.lineTo(point.x, point.y);
    }

    const currentPoint = toScreen(progressPoint, transform);

    ctx.lineTo(currentPoint.x, currentPoint.y);
    ctx.strokeStyle = "#d64f44";
    ctx.lineWidth = 3;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.stroke();
  }

  function drawEpicycles(epicycleData, transform) {
    ctx.save();
    ctx.lineWidth = 1;
    ctx.strokeStyle = "rgba(29, 45, 58, 0.22)";

    epicycleData.segments.forEach((segment) => {
      const center = toScreen({ x: segment.startX, y: segment.startY }, transform);
      const radius = Math.abs(segment.radius * transform.scale);

      if (radius < 0.55) {
        return;
      }

      ctx.beginPath();
      ctx.arc(center.x, center.y, radius, 0, TAU);
      ctx.stroke();
    });

    ctx.strokeStyle = "rgba(0, 121, 145, 0.62)";
    ctx.lineWidth = 1.6;
    ctx.beginPath();

    epicycleData.segments.forEach((segment, index) => {
      const start = toScreen({ x: segment.startX, y: segment.startY }, transform);
      const end = toScreen({ x: segment.endX, y: segment.endY }, transform);

      if (index === 0) {
        ctx.moveTo(start.x, start.y);
      } else {
        ctx.moveTo(start.x, start.y);
      }

      ctx.lineTo(end.x, end.y);
    });

    ctx.stroke();

    const endpoint = toScreen(epicycleData.point, transform);

    ctx.fillStyle = "#0a7286";
    ctx.beginPath();
    ctx.arc(endpoint.x, endpoint.y, 4.2, 0, TAU);
    ctx.fill();
    ctx.restore();
  }

  function drawFrame(now) {
    const rect = canvas.getBoundingClientRect();
    const cssWidth = Math.max(1, rect.width);
    const cssHeight = Math.max(1, rect.height);
    const devicePixelRatio = Math.min(window.devicePixelRatio || 1, maxDevicePixelRatio);

    state.dpr = devicePixelRatio;
    resizeCanvas(cssWidth, cssHeight, devicePixelRatio);
    ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);

    if (!state.lastFrameAt) {
      state.lastFrameAt = now;
    }

    const elapsed = Math.min(0.08, (now - state.lastFrameAt) / 1000);
    state.lastFrameAt = now;

    if (!state.paused) {
      state.phase += elapsed * TAU * state.speed * animationSpeedScale;
    }

    drawBackground(cssWidth, cssHeight);

    if (state.sourcePoints.length > 0) {
      const area = getSafeDrawingArea(cssWidth, cssHeight);
      const transform = getFitTransform(state.sourcePoints, area);
      const epicycleData = getEpicycleSegments(normalizePhase(state.phase), state.epicycleCount);

      drawPath(state.sourcePoints, transform, "rgba(48, 71, 86, 0.17)", 2);
      drawTrace(transform, epicycleData.point);
      drawEpicycles(epicycleData, transform);
    }

    state.animationId = window.requestAnimationFrame(drawFrame);
  }

  function getBorderAverageColor(data, width, height) {
    const color = { blue: 0, count: 0, green: 0, red: 0 };

    function addPixel(x, y) {
      const offset = (y * width + x) * 4;

      color.red += data[offset];
      color.green += data[offset + 1];
      color.blue += data[offset + 2];
      color.count += 1;
    }

    for (let x = 0; x < width; x += 1) {
      addPixel(x, 0);
      addPixel(x, height - 1);
    }

    for (let y = 1; y < height - 1; y += 1) {
      addPixel(0, y);
      addPixel(width - 1, y);
    }

    return {
      blue: color.blue / color.count,
      green: color.green / color.count,
      red: color.red / color.count,
    };
  }

  function colorDistance(data, offset, color) {
    return Math.hypot(
      data[offset] - color.red,
      data[offset + 1] - color.green,
      data[offset + 2] - color.blue,
    );
  }

  function createMaskFromImageData(imageData) {
    const { data, height, width } = imageData;
    const mask = new Uint8Array(width * height);
    const hasTransparency = data.some((value, index) => index % 4 === 3 && value < 240);

    if (hasTransparency) {
      for (let index = 0; index < width * height; index += 1) {
        mask[index] = data[index * 4 + 3] > 32 ? 1 : 0;
      }

      return mask;
    }

    const backgroundColor = getBorderAverageColor(data, width, height);
    let distanceTotal = 0;
    let distanceSquaredTotal = 0;

    for (let index = 0; index < width * height; index += 1) {
      const distance = colorDistance(data, index * 4, backgroundColor);

      distanceTotal += distance;
      distanceSquaredTotal += distance * distance;
    }

    const totalPixels = width * height;
    const mean = distanceTotal / totalPixels;
    const variance = Math.max(0, distanceSquaredTotal / totalPixels - mean * mean);
    const threshold = Math.max(28, mean + Math.sqrt(variance) * 0.62);
    let selectedPixels = 0;

    for (let index = 0; index < totalPixels; index += 1) {
      const distance = colorDistance(data, index * 4, backgroundColor);

      if (distance > threshold) {
        mask[index] = 1;
        selectedPixels += 1;
      }
    }

    const selectedRatio = selectedPixels / totalPixels;

    if (selectedRatio > 0.02 && selectedRatio < 0.86) {
      return mask;
    }

    return createEdgeMask(imageData);
  }

  function createEdgeMask(imageData) {
    const { data, height, width } = imageData;
    const luminance = new Float32Array(width * height);
    const gradients = new Float32Array(width * height);
    const sortedGradients = [];

    for (let index = 0; index < width * height; index += 1) {
      const offset = index * 4;

      luminance[index] = data[offset] * 0.2126 + data[offset + 1] * 0.7152 + data[offset + 2] * 0.0722;
    }

    for (let y = 1; y < height - 1; y += 1) {
      for (let x = 1; x < width - 1; x += 1) {
        const topLeft = luminance[(y - 1) * width + x - 1];
        const top = luminance[(y - 1) * width + x];
        const topRight = luminance[(y - 1) * width + x + 1];
        const left = luminance[y * width + x - 1];
        const right = luminance[y * width + x + 1];
        const bottomLeft = luminance[(y + 1) * width + x - 1];
        const bottom = luminance[(y + 1) * width + x];
        const bottomRight = luminance[(y + 1) * width + x + 1];
        const gradientX = -topLeft - 2 * left - bottomLeft + topRight + 2 * right + bottomRight;
        const gradientY = -topLeft - 2 * top - topRight + bottomLeft + 2 * bottom + bottomRight;
        const gradient = Math.hypot(gradientX, gradientY);

        gradients[y * width + x] = gradient;
        sortedGradients.push(gradient);
      }
    }

    sortedGradients.sort((first, second) => first - second);

    const threshold =
      sortedGradients[Math.floor(sortedGradients.length * 0.86)] || Number.POSITIVE_INFINITY;
    const mask = new Uint8Array(width * height);

    for (let index = 0; index < gradients.length; index += 1) {
      if (gradients[index] >= threshold && gradients[index] > 18) {
        mask[index] = 1;
      }
    }

    return mask;
  }

  function countMaskPixels(mask) {
    return mask.reduce((total, value) => total + value, 0);
  }

  function dilateMask(mask, width, height, radius) {
    const result = new Uint8Array(width * height);

    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        let hasNearbyPixel = false;

        for (let offsetY = -radius; offsetY <= radius && !hasNearbyPixel; offsetY += 1) {
          for (let offsetX = -radius; offsetX <= radius; offsetX += 1) {
            const sampleX = x + offsetX;
            const sampleY = y + offsetY;

            if (hasMaskPixel(mask, width, height, sampleX, sampleY)) {
              hasNearbyPixel = true;
              break;
            }
          }
        }

        result[y * width + x] = hasNearbyPixel ? 1 : 0;
      }
    }

    return result;
  }

  function createExteriorShapeMask(mask, width, height) {
    const totalPixels = width * height;
    const originalPixelCount = countMaskPixels(mask);
    const barrierMask = dilateMask(mask, width, height, 1);
    const outsideMask = new Uint8Array(totalPixels);
    const queue = [];

    function pushOutsidePixel(x, y) {
      if (x < 0 || x >= width || y < 0 || y >= height) {
        return;
      }

      const index = y * width + x;

      if (outsideMask[index] || barrierMask[index]) {
        return;
      }

      outsideMask[index] = 1;
      queue.push(index);
    }

    for (let x = 0; x < width; x += 1) {
      pushOutsidePixel(x, 0);
      pushOutsidePixel(x, height - 1);
    }

    for (let y = 1; y < height - 1; y += 1) {
      pushOutsidePixel(0, y);
      pushOutsidePixel(width - 1, y);
    }

    for (let index = 0; index < queue.length; index += 1) {
      const pixelIndex = queue[index];
      const x = pixelIndex % width;
      const y = Math.floor(pixelIndex / width);

      pushOutsidePixel(x + 1, y);
      pushOutsidePixel(x - 1, y);
      pushOutsidePixel(x, y + 1);
      pushOutsidePixel(x, y - 1);
    }

    const exteriorMask = new Uint8Array(totalPixels);
    let exteriorPixelCount = 0;

    for (let index = 0; index < totalPixels; index += 1) {
      if (!outsideMask[index]) {
        exteriorMask[index] = 1;
        exteriorPixelCount += 1;
      }
    }

    const exteriorRatio = exteriorPixelCount / totalPixels;

    if (
      exteriorPixelCount < Math.max(28, originalPixelCount) ||
      exteriorRatio > 0.92
    ) {
      return mask;
    }

    return exteriorMask;
  }

  function hasMaskPixel(mask, width, height, x, y) {
    return x >= 0 && x < width && y >= 0 && y < height && mask[y * width + x] === 1;
  }

  function createPoint(x, y) {
    return {
      key: `${x},${y}`,
      x,
      y,
    };
  }

  function addBoundarySegment(segments, startX, startY, endX, endY) {
    segments.push({
      end: createPoint(endX, endY),
      index: segments.length,
      start: createPoint(startX, startY),
      vector: {
        x: endX - startX,
        y: endY - startY,
      },
    });
  }

  function createBoundarySegments(mask, width, height) {
    const segments = [];

    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        if (!hasMaskPixel(mask, width, height, x, y)) {
          continue;
        }

        if (!hasMaskPixel(mask, width, height, x, y - 1)) {
          addBoundarySegment(segments, x, y, x + 1, y);
        }

        if (!hasMaskPixel(mask, width, height, x + 1, y)) {
          addBoundarySegment(segments, x + 1, y, x + 1, y + 1);
        }

        if (!hasMaskPixel(mask, width, height, x, y + 1)) {
          addBoundarySegment(segments, x + 1, y + 1, x, y + 1);
        }

        if (!hasMaskPixel(mask, width, height, x - 1, y)) {
          addBoundarySegment(segments, x, y + 1, x, y);
        }
      }
    }

    return segments;
  }

  function getNextBoundarySegment(candidates, previousVector) {
    return candidates
      .map((segment) => {
        const dot =
          previousVector.x * segment.vector.x + previousVector.y * segment.vector.y;
        const cross =
          previousVector.x * segment.vector.y - previousVector.y * segment.vector.x;

        return {
          segment,
          turn: Math.abs(Math.atan2(cross, dot)),
        };
      })
      .sort((first, second) => first.turn - second.turn)[0]?.segment;
  }

  function getPolygonArea(points) {
    let area = 0;

    for (let index = 0; index < points.length; index += 1) {
      const point = points[index];
      const nextPoint = points[(index + 1) % points.length];

      area += point.x * nextPoint.y - nextPoint.x * point.y;
    }

    return area / 2;
  }

  function removeCollinearPoints(points) {
    if (points.length < 3) {
      return points;
    }

    return points.filter((point, index) => {
      const previousPoint = points[(index - 1 + points.length) % points.length];
      const nextPoint = points[(index + 1) % points.length];
      const firstVector = {
        x: point.x - previousPoint.x,
        y: point.y - previousPoint.y,
      };
      const secondVector = {
        x: nextPoint.x - point.x,
        y: nextPoint.y - point.y,
      };

      return firstVector.x * secondVector.y - firstVector.y * secondVector.x !== 0;
    });
  }

  function traceBoundaryLoops(mask, width, height) {
    const segments = createBoundarySegments(mask, width, height);
    const outgoingSegments = new Map();
    const usedSegments = new Uint8Array(segments.length);
    const loops = [];

    segments.forEach((segment) => {
      const existingSegments = outgoingSegments.get(segment.start.key) || [];

      existingSegments.push(segment);
      outgoingSegments.set(segment.start.key, existingSegments);
    });

    segments.forEach((segment) => {
      if (usedSegments[segment.index]) {
        return;
      }

      const startKey = segment.start.key;
      const path = [segment.start];
      let currentSegment = segment;
      let guard = 0;

      while (
        currentSegment &&
        !usedSegments[currentSegment.index] &&
        guard < segments.length + 1
      ) {
        usedSegments[currentSegment.index] = 1;
        path.push(currentSegment.end);

        if (currentSegment.end.key === startKey) {
          break;
        }

        const candidates = (outgoingSegments.get(currentSegment.end.key) || []).filter(
          (candidate) => !usedSegments[candidate.index],
        );

        currentSegment = getNextBoundarySegment(candidates, currentSegment.vector);
        guard += 1;
      }

      if (path.length > 8 && path[path.length - 1].key === startKey) {
        path.pop();
        loops.push(path.map((point) => ({ x: point.x, y: point.y })));
      }
    });

    return loops;
  }

  function traceLargestContour(mask, width, height) {
    const loops = traceBoundaryLoops(mask, width, height)
      .map(removeCollinearPoints)
      .filter((loop) => loop.length >= 8)
      .sort(
        (firstLoop, secondLoop) =>
          Math.abs(getPolygonArea(secondLoop)) - Math.abs(getPolygonArea(firstLoop)),
      );

    const largestLoop = loops[0] || [];

    return largestLoop.map((point) => ({
      x: point.x,
      y: height - point.y,
    }));
  }

  async function loadImage(file) {
    if ("createImageBitmap" in window) {
      return window.createImageBitmap(file);
    }

    return new Promise((resolve, reject) => {
      const image = new Image();
      const url = URL.createObjectURL(file);

      image.onload = () => {
        URL.revokeObjectURL(url);
        resolve(image);
      };
      image.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error("Image load failed"));
      };
      image.src = url;
    });
  }

  async function extractContourFromImage(file) {
    const image = await loadImage(file);
    const sourceWidth = image.width || image.naturalWidth;
    const sourceHeight = image.height || image.naturalHeight;
    const maxSize = 192;
    const scale = Math.min(1, maxSize / Math.max(sourceWidth, sourceHeight));
    const width = Math.max(24, Math.round(sourceWidth * scale));
    const height = Math.max(24, Math.round(sourceHeight * scale));
    const offscreen = document.createElement("canvas");
    const offscreenContext = offscreen.getContext("2d", { willReadFrequently: true });

    offscreen.width = width;
    offscreen.height = height;
    offscreenContext.clearRect(0, 0, width, height);
    offscreenContext.drawImage(image, 0, 0, width, height);

    const imageData = offscreenContext.getImageData(0, 0, width, height);
    const mask = createMaskFromImageData(imageData);
    const exteriorMask = createExteriorShapeMask(mask, width, height);
    const orderedPoints = traceLargestContour(exteriorMask, width, height);

    if (orderedPoints.length < 28) {
      throw new Error("Contour unavailable");
    }

    return orderedPoints;
  }

  async function handleUpload() {
    const file = uploadInput.files?.[0];

    if (!file) {
      return;
    }

    setStatus(t("pages.fourierEpicycles.processingImage"));

    try {
      const points = await extractContourFromImage(file);
      const label = file.name.replace(/\.[^.]+$/, "") || t("pages.fourierEpicycles.customShape");
      let customOption = shapeSelect.querySelector('option[value="custom"]');

      if (!customOption) {
        customOption = document.createElement("option");
        customOption.value = "custom";
        shapeSelect.append(customOption);
      }

      customOption.textContent = label;
      state.customShape = { label, points };
      shapeSelect.value = "custom";
      setShape(points, label, "custom");
      setStatus(t("pages.fourierEpicycles.imageLoaded"));
    } catch (_error) {
      setStatus(t("pages.fourierEpicycles.uploadFailed"));
    } finally {
      uploadInput.value = "";
    }
  }

  shapeSelect.addEventListener("change", () => {
    if (shapeSelect.value === "custom" && state.customShape) {
      setShape(state.customShape.points, state.customShape.label, "custom");
      return;
    }

    setBuiltInShape(shapeSelect.value);
  });
  randomButton.addEventListener("click", setRandomShape);
  uploadInput.addEventListener("change", handleUpload);
  epicycleSlider.addEventListener("input", updateEpicycleCount);
  speedSlider.addEventListener("input", updateSpeed);
  playbackButton.addEventListener("click", togglePlayback);

  const resizeObserver = new ResizeObserver(() => {
    state.lastFrameAt = performance.now();
  });

  resizeObserver.observe(canvas);
  resizeObserver.observe(panel);
  setBuiltInShape(state.shapeId);
  updateSpeed();
  state.animationId = window.requestAnimationFrame(drawFrame);

  return () => {
    window.cancelAnimationFrame(state.animationId);
    resizeObserver.disconnect();
  };
}

window.gagunPageModules = window.gagunPageModules || [];
window.gagunPageModules.push({
  id: "fourier-epicycles",
  sectionId: "mathematics",
  navKey: "pages.fourierEpicycles.navLabel",
  titleKey: "pages.fourierEpicycles.title",
  theme: {
    background: "#eef8fb",
    backgroundSoft: "#fff7ea",
    mathColor: "rgba(15, 92, 122, 0.17)",
    mathOpacity: "0.72",
  },
  render: renderFourierEpicycles,
});
