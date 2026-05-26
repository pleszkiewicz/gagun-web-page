function renderFractals(container, { t }) {
  container.innerHTML = `
    <section class="fractals-page" aria-label="${t("pages.fractals.pageLabel")}">
      <canvas
        class="fractal-canvas"
        id="juliaCanvas"
        aria-label="${t("pages.fractals.canvasLabel")}"
      ></canvas>

      <aside class="fractal-panel" aria-label="${t("pages.fractals.panelLabel")}">
        <header class="fractal-panel-header">
          <p class="eyebrow">${t("pages.fractals.eyebrow")}</p>
          <h1>${t("pages.fractals.heading")}</h1>
        </header>

        <div class="fractal-readout">
          <code id="juliaParameter">c = -0.100 + 0.651i</code>
          <span>${t("pages.fractals.loopLabel")}</span>
        </div>

        <label class="fractal-control" for="fractalResolution">
          <span>
            ${t("pages.fractals.resolution")}
            <output id="fractalResolutionValue" for="fractalResolution">60%</output>
          </span>
          <input
            class="fractal-resolution-slider"
            id="fractalResolution"
            type="range"
            min="20"
            max="85"
            step="5"
            value="60"
          >
        </label>

        <button class="fractal-playback" id="fractalPlaybackButton" type="button">
          ${t("pages.fractals.pause")}
        </button>
      </aside>
    </section>
  `;

  const canvas = container.querySelector("#juliaCanvas");
  const parameterReadout = container.querySelector("#juliaParameter");
  const playbackButton = container.querySelector("#fractalPlaybackButton");
  const resolutionSlider = container.querySelector("#fractalResolution");
  const resolutionValue = container.querySelector("#fractalResolutionValue");
  const ctx = canvas.getContext("2d", { alpha: false });

  const state = {
    animationId: 0,
    imageData: null,
    lastRenderAt: 0,
    lastTickAt: 0,
    phase: 0,
    paused: false,
    renderHeight: 0,
    renderWidth: 0,
    needsRender: true,
    resolutionPercent: Number(resolutionSlider.value),
  };

  const maxIterations = 92;
  const bailout = 16;
  const frameInterval = 120;
  const maxPixels = 900000;
  const interiorShade = 218;

  function clampByte(value) {
    return Math.max(0, Math.min(255, Math.round(value)));
  }

  function getJuliaParameter(phase) {
    return {
      re: -0.1 + 0.024 * Math.cos(phase * 0.23) + 0.007 * Math.cos(phase * 0.61),
      im: 0.651 + 0.026 * Math.sin(phase * 0.19),
    };
  }

  function formatJuliaParameter(parameter) {
    const sign = parameter.im < 0 ? "-" : "+";
    return `c = ${parameter.re.toFixed(3)} ${sign} ${Math.abs(parameter.im).toFixed(3)}i`;
  }

  function resizeCanvas() {
    const rect = canvas.getBoundingClientRect();
    const resolutionScale = state.resolutionPercent / 100;
    const rawWidth = Math.max(1, Math.round(rect.width * resolutionScale));
    const rawHeight = Math.max(1, Math.round(rect.height * resolutionScale));
    const scale = Math.min(1, Math.sqrt(maxPixels / (rawWidth * rawHeight)));
    const renderWidth = Math.max(1, Math.round(rawWidth * scale));
    const renderHeight = Math.max(1, Math.round(rawHeight * scale));

    if (renderWidth === state.renderWidth && renderHeight === state.renderHeight) {
      return;
    }

    state.renderWidth = renderWidth;
    state.renderHeight = renderHeight;
    canvas.width = renderWidth;
    canvas.height = renderHeight;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    state.imageData = ctx.createImageData(renderWidth, renderHeight);
    state.needsRender = true;
  }

  function updateResolution() {
    state.resolutionPercent = Number(resolutionSlider.value);
    resolutionValue.textContent = `${state.resolutionPercent}%`;
    resizeCanvas();
    state.needsRender = true;
  }

  function getShadeForPoint(startReal, startImaginary, parameter) {
    let real = startReal;
    let imaginary = startImaginary;
    let radiusSquared = 0;
    let iteration = 0;

    for (; iteration < maxIterations; iteration += 1) {
      radiusSquared = real * real + imaginary * imaginary;

      if (radiusSquared > bailout) {
        break;
      }

      const nextReal = real * real - imaginary * imaginary + parameter.re;
      const nextImaginary = 2 * real * imaginary + parameter.im;

      real = nextReal;
      imaginary = nextImaginary;
    }

    if (iteration === maxIterations) {
      return interiorShade;
    }

    const radius = Math.sqrt(radiusSquared);
    const smoothIteration =
      iteration + 1 - Math.log(Math.max(Math.log(radius), 0.000001)) / Math.LN2;
    const normalized = Math.max(0, Math.min(1, smoothIteration / maxIterations));
    const contour =
      Math.pow(0.5 + 0.5 * Math.cos(smoothIteration * 0.64), 7) * normalized * 0.16;
    const edgeInk = Math.pow(normalized, 1.32) * 0.92;
    const ink = Math.min(1, edgeInk + contour);

    return clampByte(255 - ink * 246);
  }

  function renderJulia(phase) {
    if (!state.imageData) return;

    const width = state.renderWidth;
    const height = state.renderHeight;
    const data = state.imageData.data;
    const parameter = getJuliaParameter(phase);
    const aspectRatio = width / height;
    const zoom = 1.08 + 0.045 * Math.sin(phase * 0.2);
    const viewHeight = 3.04 / zoom;
    const viewWidth = viewHeight * aspectRatio;
    const rotation = -0.72 + 0.065 * Math.sin(phase * 0.17);
    const cosRotation = Math.cos(rotation);
    const sinRotation = Math.sin(rotation);
    const panReal = 0.018 * Math.sin(phase * 0.11);
    const panImaginary = 0.014 * Math.cos(phase * 0.13);
    const invWidth = width > 1 ? 1 / (width - 1) : 0;
    const invHeight = height > 1 ? 1 / (height - 1) : 0;

    let offset = 0;
    for (let y = 0; y < height; y += 1) {
      const planeY = (0.5 - y * invHeight) * viewHeight + panImaginary;

      for (let x = 0; x < width; x += 1) {
        const planeX = (x * invWidth - 0.5) * viewWidth + panReal;
        const real = planeX * cosRotation - planeY * sinRotation;
        const imaginary = planeX * sinRotation + planeY * cosRotation;
        const shade = getShadeForPoint(real, imaginary, parameter);

        data[offset] = shade;
        data[offset + 1] = shade;
        data[offset + 2] = shade;
        data[offset + 3] = 255;
        offset += 4;
      }
    }

    ctx.putImageData(state.imageData, 0, 0);
    parameterReadout.textContent = formatJuliaParameter(parameter);
  }

  function animate(now) {
    if (!state.lastTickAt) {
      state.lastTickAt = now;
    }

    const elapsed = Math.min(0.08, (now - state.lastTickAt) / 1000);
    state.lastTickAt = now;

    if (!state.paused) {
      state.phase += elapsed;
    }

    if (state.needsRender || (!state.paused && now - state.lastRenderAt >= frameInterval)) {
      renderJulia(state.phase);
      state.lastRenderAt = now;
      state.needsRender = false;
    }

    state.animationId = window.requestAnimationFrame(animate);
  }

  function togglePlayback() {
    state.paused = !state.paused;
    playbackButton.textContent = t(
      state.paused ? "pages.fractals.resume" : "pages.fractals.pause",
    );
    state.lastTickAt = performance.now();
  }

  playbackButton.addEventListener("click", togglePlayback);
  resolutionSlider.addEventListener("input", updateResolution);
  resolutionSlider.addEventListener("change", updateResolution);

  const resizeObserver = new ResizeObserver(resizeCanvas);
  resizeObserver.observe(canvas);
  updateResolution();
  resizeCanvas();
  state.animationId = window.requestAnimationFrame(animate);

  return () => {
    window.cancelAnimationFrame(state.animationId);
    resizeObserver.disconnect();
  };
}

window.gagunPageModules = window.gagunPageModules || [];
window.gagunPageModules.push({
  id: "fractals",
  navKey: "pages.fractals.navLabel",
  titleKey: "pages.fractals.title",
  theme: {
    background: "#f3f3f1",
    backgroundSoft: "#ffffff",
    mathColor: "rgba(0, 0, 0, 0.1)",
    mathOpacity: "0.58",
  },
  render: renderFractals,
});
