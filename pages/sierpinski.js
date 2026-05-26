function renderSierpinski(container, { locale, t }) {
  const modes = {
    triangle: {
      anchors: [
        { x: 0, y: Math.sqrt(3) / 2 },
        { x: -0.5, y: 0 },
        { x: 0.5, y: 0 },
      ],
      bounds: {
        minX: -0.5,
        maxX: 0.5,
        minY: 0,
        maxY: Math.sqrt(3) / 2,
      },
      pointCount: 120000,
      headingKey: "pages.sierpinski.triangleHeading",
    },
    square: {
      anchors: [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
        { x: 2, y: 0 },
        { x: 0, y: 1 },
        { x: 2, y: 1 },
        { x: 0, y: 2 },
        { x: 1, y: 2 },
        { x: 2, y: 2 },
      ],
      bounds: {
        minX: 0,
        maxX: 1,
        minY: 0,
        maxY: 1,
      },
      pointCount: 160000,
      headingKey: "pages.sierpinski.squareHeading",
    },
  };
  const seed = 73291;
  const defaultMode = "triangle";

  container.innerHTML = `
    <section class="fractals-page sierpinski-page" aria-label="${t("pages.sierpinski.pageLabel")}">
      <canvas
        class="fractal-canvas sierpinski-canvas"
        id="sierpinskiCanvas"
        aria-label="${t("pages.sierpinski.canvasLabel")}"
      ></canvas>

      <aside class="fractal-panel sierpinski-panel" aria-label="${t("pages.sierpinski.panelLabel")}">
        <header class="fractal-panel-header">
          <p class="eyebrow">${t("pages.sierpinski.eyebrow")}</p>
          <h1 id="sierpinskiHeading">${t(modes[defaultMode].headingKey)}</h1>
        </header>

        <div class="fractal-readout sierpinski-readout">
          <code id="sierpinskiPointCount"></code>
        </div>

        <div class="sierpinski-mode-control" role="radiogroup" aria-label="${t("pages.sierpinski.modeLabel")}">
          <div class="sierpinski-mode-heading">${t("pages.sierpinski.modeLabel")}</div>
          <div class="sierpinski-mode-options">
            <label class="sierpinski-mode-option">
              <input type="radio" name="sierpinskiMode" value="triangle" checked>
              <span>${t("pages.sierpinski.triangleMode")}</span>
            </label>
            <label class="sierpinski-mode-option">
              <input type="radio" name="sierpinskiMode" value="square">
              <span>${t("pages.sierpinski.squareMode")}</span>
            </label>
          </div>
        </div>
      </aside>
    </section>
  `;

  const canvas = container.querySelector("#sierpinskiCanvas");
  const panel = container.querySelector(".sierpinski-panel");
  const pageViewport = container.closest(".page-viewport");
  const heading = container.querySelector("#sierpinskiHeading");
  const pointCountReadout = container.querySelector("#sierpinskiPointCount");
  const modeInputs = [...container.querySelectorAll('input[name="sierpinskiMode"]')];
  const ctx = canvas.getContext("2d", { alpha: false });
  const maxDevicePixelRatio = 2;
  const state = {
    mode: defaultMode,
  };
  let animationId = 0;

  function resetViewportScroll() {
    if (!pageViewport) {
      return;
    }

    pageViewport.scrollTop = 0;
    pageViewport.scrollLeft = 0;
  }

  function createSeededRandom(seedValue) {
    let value = seedValue >>> 0;

    return () => {
      value = (value * 1664525 + 1013904223) >>> 0;
      return value / 4294967296;
    };
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
    gradient.addColorStop(0, "#eef9fa");
    gradient.addColorStop(0.48, "#f7f5ed");
    gradient.addColorStop(1, "#fbfffd");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, cssWidth, cssHeight);

    const radial = ctx.createRadialGradient(
      cssWidth * 0.26,
      cssHeight * 0.2,
      0,
      cssWidth * 0.26,
      cssHeight * 0.2,
      Math.max(cssWidth, cssHeight) * 0.72,
    );
    radial.addColorStop(0, "rgba(252, 210, 115, 0.22)");
    radial.addColorStop(1, "rgba(252, 210, 115, 0)");
    ctx.fillStyle = radial;
    ctx.fillRect(0, 0, cssWidth, cssHeight);
  }

  function getSafeDrawingArea(cssWidth, cssHeight) {
    const canvasRect = canvas.getBoundingClientRect();
    const panelRect = panel.getBoundingClientRect();
    const gutter = Math.max(14, Math.min(cssWidth, cssHeight) * 0.028);
    const area = {
      x: 0,
      y: 0,
      width: cssWidth,
      height: cssHeight,
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

    if (panelWidthRatio > 0.72 || cssWidth < 700) {
      const topHeight = Math.max(0, panelTop - gutter);

      if (topHeight > cssHeight * 0.28) {
        area.height = topHeight;
      }
    } else {
      const leftWidth = Math.max(0, panelLeft - gutter);

      if (leftWidth > cssWidth * 0.3) {
        area.width = leftWidth;
      }
    }

    return area;
  }

  function getFitTransform(bounds, area) {
    const margin = Math.max(16, Math.min(area.width, area.height) * 0.08);
    const usableWidth = Math.max(1, area.width - margin * 2);
    const usableHeight = Math.max(1, area.height - margin * 2);
    const modelWidth = bounds.maxX - bounds.minX;
    const modelHeight = bounds.maxY - bounds.minY;
    const scale = Math.min(usableWidth / modelWidth, usableHeight / modelHeight);
    const drawnWidth = modelWidth * scale;
    const drawnHeight = modelHeight * scale;

    return {
      scale,
      originX: area.x + (area.width - drawnWidth) / 2 - bounds.minX * scale,
      originY: area.y + (area.height - drawnHeight) / 2 + bounds.maxY * scale,
    };
  }

  function drawTriangle(geometry, transform, pointSize) {
    const random = createSeededRandom(seed);
    let x = 0;
    let y = 0.18;

    ctx.fillStyle = "rgba(8, 76, 100, 0.68)";

    for (let index = 0; index < geometry.pointCount + 18; index += 1) {
      const anchor = geometry.anchors[Math.floor(random() * geometry.anchors.length)];
      x = (x + anchor.x) * 0.5;
      y = (y + anchor.y) * 0.5;

      if (index < 18) {
        continue;
      }

      ctx.fillRect(
        transform.originX + x * transform.scale,
        transform.originY - y * transform.scale,
        pointSize,
        pointSize,
      );
    }
  }

  function drawSquare(geometry, transform, pointSize) {
    const random = createSeededRandom(seed + 147);
    let x = 0.37;
    let y = 0.61;

    ctx.fillStyle = "rgba(18, 91, 76, 0.62)";

    for (let index = 0; index < geometry.pointCount + 24; index += 1) {
      const anchor = geometry.anchors[Math.floor(random() * geometry.anchors.length)];
      x = (x + anchor.x) / 3;
      y = (y + anchor.y) / 3;

      if (index < 24) {
        continue;
      }

      ctx.fillRect(
        transform.originX + x * transform.scale,
        transform.originY - y * transform.scale,
        pointSize,
        pointSize,
      );
    }
  }

  function syncPanel() {
    const geometry = modes[state.mode];
    const formattedPointCount = new Intl.NumberFormat(locale).format(geometry.pointCount);

    modeInputs.forEach((input) => {
      input.checked = input.value === state.mode;
    });
    heading.textContent = t(geometry.headingKey);
    pointCountReadout.textContent = t("pages.sierpinski.points", {
      count: formattedPointCount,
    });
  }

  function drawSierpinski() {
    const geometry = modes[state.mode];
    const rect = canvas.getBoundingClientRect();
    const cssWidth = Math.max(1, rect.width);
    const cssHeight = Math.max(1, rect.height);
    const devicePixelRatio = Math.min(window.devicePixelRatio || 1, maxDevicePixelRatio);
    resizeCanvas(cssWidth, cssHeight, devicePixelRatio);

    ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
    drawBackground(cssWidth, cssHeight);

    const safeArea = getSafeDrawingArea(cssWidth, cssHeight);
    const transform = getFitTransform(geometry.bounds, safeArea);
    const pointSize = Math.max(0.72, Math.min(1.22, Math.min(cssWidth, cssHeight) / 760));

    if (state.mode === "square") {
      drawSquare(geometry, transform, pointSize);
    } else {
      drawTriangle(geometry, transform, pointSize);
    }
  }

  function scheduleDraw() {
    if (animationId) {
      window.cancelAnimationFrame(animationId);
    }

    animationId = window.requestAnimationFrame(() => {
      animationId = 0;
      resetViewportScroll();
      syncPanel();
      drawSierpinski();
    });
  }

  modeInputs.forEach((input) => {
    input.addEventListener("change", () => {
      if (!input.checked || !Object.hasOwn(modes, input.value)) {
        return;
      }

      state.mode = input.value;
      resetViewportScroll();
      scheduleDraw();
    });
  });

  const resizeObserver = new ResizeObserver(scheduleDraw);
  resizeObserver.observe(canvas);
  resizeObserver.observe(panel);
  scheduleDraw();

  return () => {
    if (animationId) {
      window.cancelAnimationFrame(animationId);
    }

    resizeObserver.disconnect();
  };
}

window.gagunPageModules = window.gagunPageModules || [];
window.gagunPageModules.push({
  id: "sierpinski",
  sectionId: "fractals",
  navKey: "pages.sierpinski.navLabel",
  titleKey: "pages.sierpinski.title",
  theme: {
    background: "#edf8f8",
    backgroundSoft: "#fffdf4",
    mathColor: "rgba(16, 99, 117, 0.15)",
    mathOpacity: "0.54",
  },
  render: renderSierpinski,
});
