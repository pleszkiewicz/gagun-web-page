function renderBarnsleyFern(container, { locale, t }) {
  const pointCount = 145000;
  const bounds = {
    minX: -2.182,
    maxX: 2.656,
    minY: 0,
    maxY: 9.998,
  };
  const defaultProbabilities = [1, 85, 7, 7];
  const transforms = [
    { a: 0, b: 0, c: 0, d: 0.16, e: 0, f: 0 },
    { a: 0.85, b: 0.04, c: -0.04, d: 0.85, e: 0, f: 1.6 },
    { a: 0.2, b: -0.26, c: 0.23, d: 0.22, e: 0, f: 1.6 },
    { a: -0.15, b: 0.28, c: 0.26, d: 0.24, e: 0, f: 0.44 },
  ];
  const probabilityLabelKeys = [
    "pages.barnsleyFern.stemProbability",
    "pages.barnsleyFern.mainFrondProbability",
    "pages.barnsleyFern.leftLeafletsProbability",
    "pages.barnsleyFern.rightLeafletsProbability",
  ];
  const formattedPointCount = new Intl.NumberFormat(locale).format(pointCount);
  const probabilityControls = defaultProbabilities
    .map((probability, index) => {
      const controlId = `barnsleyProbability${index + 1}`;
      const outputId = `${controlId}Value`;

      return `
        <label class="barnsley-probability-control" for="${controlId}">
          <span>
            ${t(probabilityLabelKeys[index])}
            <output
              class="barnsley-probability-output"
              id="${outputId}"
              for="${controlId}"
            >${probability}%</output>
          </span>
          <input
            class="barnsley-probability-slider"
            id="${controlId}"
            type="range"
            min="0"
            max="100"
            step="1"
            value="${probability}"
          >
        </label>
      `;
    })
    .join("");

  container.innerHTML = `
    <section class="fractals-page barnsley-page" aria-label="${t("pages.barnsleyFern.pageLabel")}">
      <canvas
        class="fractal-canvas barnsley-canvas"
        id="barnsleyCanvas"
        aria-label="${t("pages.barnsleyFern.canvasLabel")}"
      ></canvas>

      <aside class="fractal-panel barnsley-panel" aria-label="${t("pages.barnsleyFern.panelLabel")}">
        <header class="fractal-panel-header">
          <p class="eyebrow">${t("pages.barnsleyFern.eyebrow")}</p>
          <h1>${t("pages.barnsleyFern.heading")}</h1>
        </header>

        <div class="fractal-readout barnsley-readout">
          <code>${t("pages.barnsleyFern.points", { count: formattedPointCount })}</code>
        </div>

        <div
          class="barnsley-probability-controls"
          role="group"
          aria-label="${t("pages.barnsleyFern.probabilityLabel")}"
        >
          <div class="barnsley-probability-heading">
            ${t("pages.barnsleyFern.probabilityLabel")}
          </div>
          ${probabilityControls}
        </div>
      </aside>
    </section>
  `;

  const canvas = container.querySelector("#barnsleyCanvas");
  const panel = container.querySelector(".barnsley-panel");
  const probabilityInputs = [...container.querySelectorAll(".barnsley-probability-slider")];
  const probabilityOutputs = [...container.querySelectorAll(".barnsley-probability-output")];
  const ctx = canvas.getContext("2d", { alpha: false });
  const maxDevicePixelRatio = 2;
  const state = {
    probabilities: [...defaultProbabilities],
  };
  let animationId = 0;

  function createSeededRandom(seed) {
    let value = seed >>> 0;

    return () => {
      value = (value * 1664525 + 1013904223) >>> 0;
      return value / 4294967296;
    };
  }

  function selectTransform(randomValue) {
    let cumulative = 0;

    for (let index = 0; index < transforms.length; index += 1) {
      cumulative += state.probabilities[index] / 100;

      if (randomValue <= cumulative) {
        return transforms[index];
      }
    }

    return transforms[transforms.length - 1];
  }

  function clampProbability(value) {
    if (!Number.isFinite(value)) {
      return 0;
    }

    return Math.max(0, Math.min(100, Math.round(value)));
  }

  function formatProbability(value) {
    return `${Math.round(value)}%`;
  }

  function syncProbabilityControls() {
    state.probabilities.forEach((probability, index) => {
      probabilityInputs[index].value = String(probability);
      probabilityOutputs[index].textContent = formatProbability(probability);
    });
  }

  function updateProbability(changedIndex) {
    const nextValue = clampProbability(Number(probabilityInputs[changedIndex].value));
    const probabilities = [...state.probabilities];
    const otherIndexes = probabilities
      .map((_probability, index) => index)
      .filter((index) => index !== changedIndex);
    const remainingTarget = 100 - nextValue;
    const otherTotal = otherIndexes.reduce((total, index) => total + probabilities[index], 0);
    const nextOtherProbabilities = otherIndexes.map((index) => {
      const rawValue =
        otherTotal > 0
          ? (probabilities[index] / otherTotal) * remainingTarget
          : remainingTarget / otherIndexes.length;
      const value = Math.floor(rawValue);

      return {
        index,
        remainder: rawValue - value,
        value,
      };
    });
    const distributed = nextOtherProbabilities.reduce((total, item) => total + item.value, 0);
    let remainder = remainingTarget - distributed;

    probabilities[changedIndex] = nextValue;

    nextOtherProbabilities
      .sort((left, right) => right.remainder - left.remainder)
      .forEach((item) => {
        if (remainder > 0) {
          item.value += 1;
          remainder -= 1;
        }
      });

    nextOtherProbabilities.forEach((item) => {
      probabilities[item.index] = clampProbability(item.value);
    });

    state.probabilities = probabilities;
    syncProbabilityControls();
    scheduleDraw();
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

  function getSafeDrawingArea(cssWidth, cssHeight) {
    const canvasRect = canvas.getBoundingClientRect();
    const panelRect = panel.getBoundingClientRect();
    const gutter = Math.max(14, Math.min(cssWidth, cssHeight) * 0.025);
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

    if (panelWidthRatio > 0.72 || cssWidth < 680) {
      const topHeight = Math.max(0, panelTop - gutter);

      if (topHeight > cssHeight * 0.34) {
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

  function drawBackground(cssWidth, cssHeight) {
    const gradient = ctx.createLinearGradient(0, 0, cssWidth, cssHeight);
    gradient.addColorStop(0, "#f5faed");
    gradient.addColorStop(0.58, "#eef7e7");
    gradient.addColorStop(1, "#fbfff8");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, cssWidth, cssHeight);
  }

  function drawFern() {
    const rect = canvas.getBoundingClientRect();
    const cssWidth = Math.max(1, rect.width);
    const cssHeight = Math.max(1, rect.height);
    const devicePixelRatio = Math.min(window.devicePixelRatio || 1, maxDevicePixelRatio);
    resizeCanvas(cssWidth, cssHeight, devicePixelRatio);

    ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
    drawBackground(cssWidth, cssHeight);

    const safeArea = getSafeDrawingArea(cssWidth, cssHeight);
    const margin = Math.max(16, Math.min(safeArea.width, safeArea.height) * 0.07);
    const usableWidth = Math.max(1, safeArea.width - margin * 2);
    const usableHeight = Math.max(1, safeArea.height - margin * 2);
    const scale = Math.min(
      usableWidth / (bounds.maxX - bounds.minX),
      usableHeight / (bounds.maxY - bounds.minY),
    );
    const fernWidth = (bounds.maxX - bounds.minX) * scale;
    const fernHeight = (bounds.maxY - bounds.minY) * scale;
    const originX = safeArea.x + (safeArea.width - fernWidth) / 2 - bounds.minX * scale;
    const originY = safeArea.y + (safeArea.height - fernHeight) / 2 + bounds.maxY * scale;
    const pointSize = cssWidth < 560 ? 1.18 : 0.92;
    const random = createSeededRandom(84231);
    let x = 0;
    let y = 0;

    ctx.fillStyle = "rgba(19, 118, 48, 0.58)";

    for (let index = 0; index < pointCount + 24; index += 1) {
      const transform = selectTransform(random());
      const nextX = transform.a * x + transform.b * y + transform.e;
      const nextY = transform.c * x + transform.d * y + transform.f;
      x = nextX;
      y = nextY;

      if (index < 24) {
        continue;
      }

      ctx.fillRect(originX + x * scale, originY - y * scale, pointSize, pointSize);
    }
  }

  function scheduleDraw() {
    if (animationId) {
      window.cancelAnimationFrame(animationId);
    }

    animationId = window.requestAnimationFrame(() => {
      animationId = 0;
      drawFern();
    });
  }

  const resizeObserver = new ResizeObserver(scheduleDraw);
  resizeObserver.observe(canvas);
  resizeObserver.observe(panel);
  probabilityInputs.forEach((input, index) => {
    input.addEventListener("input", () => updateProbability(index));
  });
  syncProbabilityControls();
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
  id: "barnsley-fern",
  navKey: "pages.barnsleyFern.navLabel",
  titleKey: "pages.barnsleyFern.title",
  theme: {
    background: "#eef7e7",
    backgroundSoft: "#f8fff2",
    mathColor: "rgba(41, 91, 37, 0.14)",
    mathOpacity: "0.5",
  },
  render: renderBarnsleyFern,
});
