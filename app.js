const canvas = document.querySelector("#plotCanvas");
const ctx = canvas.getContext("2d");
const addForm = document.querySelector("#addFunctionForm");
const functionInput = document.querySelector("#functionInput");
const functionList = document.querySelector("#functionList");
const formError = document.querySelector("#formError");
const functionCount = document.querySelector("#functionCount");
const plotStatus = document.querySelector("#plotStatus");
const zoomInButton = document.querySelector("#zoomInButton");
const zoomOutButton = document.querySelector("#zoomOutButton");
const resetViewButton = document.querySelector("#resetViewButton");

const colors = [
  "#e53935",
  "#1565c0",
  "#00897b",
  "#8e24aa",
  "#f9a825",
  "#3949ab",
  "#ef6c00",
  "#2e7d32",
  "#6d4c41",
  "#c2185b",
];

const allowedFunctions = new Set([
  "abs",
  "acos",
  "asin",
  "atan",
  "atan2",
  "ceil",
  "cos",
  "cosh",
  "cbrt",
  "cot",
  "coth",
  "csc",
  "csch",
  "exp",
  "floor",
  "ln",
  "log",
  "log10",
  "log2",
  "max",
  "min",
  "pow",
  "round",
  "sec",
  "sech",
  "sign",
  "sin",
  "sinh",
  "sqrt",
  "tan",
  "tanh",
]);

const allowedSymbols = new Set(["x", "pi", "e", "Infinity"]);
const allowedOperators = new Set(["+", "-", "*", "/", "^", "%"]);

const baseScope = Object.freeze({
  abs: Math.abs,
  acos: Math.acos,
  asin: Math.asin,
  atan: Math.atan,
  atan2: Math.atan2,
  ceil: Math.ceil,
  cos: Math.cos,
  cosh: Math.cosh,
  cbrt: Math.cbrt,
  cot: (x) => 1 / Math.tan(x),
  coth: (x) => 1 / Math.tanh(x),
  csc: (x) => 1 / Math.sin(x),
  csch: (x) => 1 / Math.sinh(x),
  e: Math.E,
  exp: Math.exp,
  floor: Math.floor,
  Infinity,
  ln: Math.log,
  log: Math.log,
  log10: Math.log10,
  log2: Math.log2,
  max: Math.max,
  min: Math.min,
  pi: Math.PI,
  pow: Math.pow,
  round: Math.round,
  sec: (x) => 1 / Math.cos(x),
  sech: (x) => 1 / Math.cosh(x),
  sign: Math.sign,
  sin: Math.sin,
  sinh: Math.sinh,
  sqrt: Math.sqrt,
  tan: Math.tan,
  tanh: Math.tanh,
});

const state = {
  width: 0,
  height: 0,
  scale: 60,
  minScale: 8,
  maxScale: 1200,
  origin: { x: 0, y: 0 },
  functions: [],
  nextIndex: 0,
  nextId: 1,
};

const drag = {
  active: false,
  x: 0,
  y: 0,
};

const safeNodeTypes = new Set([
  "ConstantNode",
  "OperatorNode",
  "ParenthesisNode",
  "FunctionNode",
  "SymbolNode",
]);

function getFunctionName(index) {
  if (index === 0) return "f";
  if (index === 1) return "g";
  if (index === 2) return "h";
  return `f${index - 2}`;
}

function stripDefinition(rawExpression) {
  const expression = rawExpression.trim();
  const functionMatch = expression.match(
    /^[a-zA-Z][a-zA-Z0-9_]*\s*\(\s*x\s*\)\s*=\s*(.+)$/u,
  );
  if (functionMatch) return functionMatch[1].trim();

  const yMatch = expression.match(/^y\s*=\s*(.+)$/iu);
  if (yMatch) return yMatch[1].trim();

  return expression;
}

function validateNode(node) {
  node.traverse((child, _path, parent) => {
    if (child.type === "OperatorNode" && !allowedOperators.has(child.op)) {
      throw new Error(`Operator "${child.op}" nie jest obsługiwany.`);
    }

    if (child.type === "FunctionNode") {
      const functionName = child.name || child.fn?.name;
      if (!allowedFunctions.has(functionName)) {
        throw new Error(`Funkcja "${functionName}" nie jest obsługiwana.`);
      }
      return;
    }

    if (child.type === "SymbolNode") {
      const isFunctionName = parent?.type === "FunctionNode" && parent.fn === child;
      if (!isFunctionName && !allowedSymbols.has(child.name)) {
        throw new Error(`Nieznany symbol "${child.name}".`);
      }
      return;
    }

    if (!safeNodeTypes.has(child.type)) {
      throw new Error(`Element "${child.type}" nie jest obsługiwany.`);
    }
  });
}

function formatExpressionNode(node) {
  return node
    .toString({ parenthesis: "auto", implicit: "hide" })
    .replace(/\s+/g, " ")
    .trim();
}

function evaluateCompiled(compiled, x) {
  const value = compiled.evaluate({ ...baseScope, x });
  if (typeof value !== "number") return Number.NaN;
  return value;
}

function compileDerivative(node) {
  try {
    const derivativeNode = window.math.derivative(node, "x", { simplify: true });
    validateNode(derivativeNode);
    const compiled = derivativeNode.compile();

    return {
      expression: formatExpressionNode(derivativeNode),
      error: "",
      evaluate(x) {
        return evaluateCompiled(compiled, x);
      },
    };
  } catch (error) {
    return {
      expression: "",
      error: `Pochodna niedostępna: ${error.message}`,
      evaluate: null,
    };
  }
}

function compileExpression(rawExpression) {
  if (!window.math) {
    throw new Error("Biblioteka math.js nie została załadowana.");
  }

  const expression = stripDefinition(rawExpression);
  if (!expression) {
    throw new Error("Wpisz wyrażenie funkcji.");
  }

  const node = window.math.parse(expression);
  validateNode(node);
  const compiled = node.compile();
  const derivative = compileDerivative(node);

  return {
    expression,
    derivative,
    evaluate(x) {
      return evaluateCompiled(compiled, x);
    },
  };
}

function addFunction(rawExpression) {
  const compiled = compileExpression(rawExpression);
  const functionIndex = state.nextIndex;
  state.nextIndex += 1;

  state.functions.push({
    id: `function-${state.nextId++}`,
    name: getFunctionName(functionIndex),
    color: colors[functionIndex % colors.length],
    expression: compiled.expression,
    evaluator: compiled.evaluate,
    derivativeExpression: compiled.derivative.expression,
    derivativeEvaluator: compiled.derivative.evaluate,
    derivativeError: compiled.derivative.error,
    showDerivative: false,
    error: "",
  });

  renderFunctionList();
  draw();
}

function updateFunction(id, rawExpression) {
  const target = state.functions.find((item) => item.id === id);
  if (!target) return;

  try {
    const compiled = compileExpression(rawExpression);
    target.expression = compiled.expression;
    target.evaluator = compiled.evaluate;
    target.derivativeExpression = compiled.derivative.expression;
    target.derivativeEvaluator = compiled.derivative.evaluate;
    target.derivativeError = compiled.derivative.error;
    target.showDerivative = target.showDerivative && Boolean(target.derivativeEvaluator);
    target.error = "";
  } catch (error) {
    target.expression = rawExpression.trim();
    target.evaluator = null;
    target.derivativeExpression = "";
    target.derivativeEvaluator = null;
    target.derivativeError = "";
    target.showDerivative = false;
    target.error = error.message;
  }

  renderFunctionList();
  draw();
}

function deleteFunction(id) {
  state.functions = state.functions.filter((item) => item.id !== id);
  renderFunctionList();
  draw();
}

function renderFunctionList() {
  functionList.replaceChildren();
  functionCount.textContent = String(state.functions.length);

  state.functions.forEach((fn) => {
    const item = document.createElement("article");
    item.className = "function-item";
    item.dataset.id = fn.id;

    const title = document.createElement("div");
    title.className = "function-title";

    const name = document.createElement("div");
    name.className = "function-name";

    const dot = document.createElement("span");
    dot.className = "color-dot";
    dot.style.background = fn.color;

    const label = document.createElement("span");
    label.textContent = `${fn.name}(x)`;

    name.append(dot, label);

    const derivativeSwitch = document.createElement("label");
    derivativeSwitch.className = "switch-control";
    derivativeSwitch.classList.toggle("is-disabled", !fn.derivativeEvaluator);

    const derivativeCheckbox = document.createElement("input");
    derivativeCheckbox.type = "checkbox";
    derivativeCheckbox.checked = fn.showDerivative;
    derivativeCheckbox.disabled = !fn.derivativeEvaluator;
    derivativeCheckbox.setAttribute("role", "switch");
    derivativeCheckbox.setAttribute(
      "aria-label",
      `Pokaż pochodną ${fn.name}(x)`,
    );
    derivativeCheckbox.addEventListener("change", () => {
      fn.showDerivative = derivativeCheckbox.checked;
      draw();
    });

    const switchTrack = document.createElement("span");
    switchTrack.className = "switch-track";

    const switchLabel = document.createElement("span");
    switchLabel.className = "switch-label";
    switchLabel.textContent = "Pochodna";

    derivativeSwitch.append(derivativeCheckbox, switchTrack, switchLabel);

    title.append(name);
    title.append(derivativeSwitch);

    const actions = document.createElement("div");
    actions.className = "function-actions";

    const input = document.createElement("input");
    input.type = "text";
    input.value = `${fn.name}(x) = ${fn.expression}`;
    input.autocomplete = "off";
    input.spellcheck = false;
    input.setAttribute("aria-label", `${fn.name}(x)`);

    const saveButton = document.createElement("button");
    saveButton.type = "button";
    saveButton.textContent = "Zapisz";
    saveButton.addEventListener("click", () => updateFunction(fn.id, input.value));

    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        updateFunction(fn.id, input.value);
      }
    });

    const deleteButton = document.createElement("button");
    deleteButton.type = "button";
    deleteButton.className = "delete-button";
    deleteButton.textContent = "Usuń";
    deleteButton.addEventListener("click", () => deleteFunction(fn.id));

    actions.append(input, saveButton, deleteButton);

    const derivativeInfo = document.createElement("p");
    derivativeInfo.className = "derivative-expression";
    derivativeInfo.style.borderLeftColor = fn.color;

    if (fn.derivativeExpression) {
      derivativeInfo.textContent = `${fn.name}'(x) = ${fn.derivativeExpression}`;
    } else {
      derivativeInfo.classList.add("is-unavailable");
      derivativeInfo.textContent = fn.derivativeError || "Pochodna niedostępna.";
    }

    const rowError = document.createElement("p");
    rowError.className = "row-error";
    rowError.textContent = fn.error;

    item.append(title, actions, derivativeInfo, rowError);
    functionList.append(item);
  });
}

function screenToWorld(screenX, screenY) {
  return {
    x: (screenX - state.origin.x) / state.scale,
    y: (state.origin.y - screenY) / state.scale,
  };
}

function worldToScreen(x, y) {
  return {
    x: state.origin.x + x * state.scale,
    y: state.origin.y - y * state.scale,
  };
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function niceStep(rawStep) {
  const exponent = Math.floor(Math.log10(rawStep));
  const base = 10 ** exponent;
  const fraction = rawStep / base;

  if (fraction <= 1) return base;
  if (fraction <= 2) return 2 * base;
  if (fraction <= 5) return 5 * base;
  return 10 * base;
}

function formatTick(value, step) {
  if (Math.abs(value) < step / 1000) return "0";
  if (Math.abs(value) >= 10000 || Math.abs(value) < 0.001) {
    return value.toExponential(1);
  }

  const decimals = clamp(Math.ceil(-Math.log10(step)) + 1, 0, 6);
  return Number(value.toFixed(decimals)).toString();
}

function clearCanvas() {
  ctx.clearRect(0, 0, state.width, state.height);
}

function drawGrid() {
  const step = niceStep(82 / state.scale);
  const minorStep = step / 5;
  const topLeft = screenToWorld(0, 0);
  const bottomRight = screenToWorld(state.width, state.height);
  const minX = topLeft.x;
  const maxX = bottomRight.x;
  const minY = bottomRight.y;
  const maxY = topLeft.y;

  ctx.save();
  ctx.lineWidth = 1;

  if (minorStep * state.scale >= 12) {
    ctx.strokeStyle = "#edf1f5";
    drawGridLines(minX, maxX, minY, maxY, minorStep);
  }

  ctx.strokeStyle = "#dce3eb";
  drawGridLines(minX, maxX, minY, maxY, step);

  drawAxes(step, minX, maxX, minY, maxY);
  ctx.restore();

  plotStatus.textContent = `1 kratka = ${formatTick(step, step)} | ${Math.round(
    state.scale,
  )} px/j`;
}

function drawGridLines(minX, maxX, minY, maxY, step) {
  const startX = Math.floor(minX / step) * step;
  const startY = Math.floor(minY / step) * step;

  ctx.beginPath();
  for (let x = startX; x <= maxX + step / 2; x += step) {
    const screen = worldToScreen(x, 0);
    ctx.moveTo(screen.x, 0);
    ctx.lineTo(screen.x, state.height);
  }

  for (let y = startY; y <= maxY + step / 2; y += step) {
    const screen = worldToScreen(0, y);
    ctx.moveTo(0, screen.y);
    ctx.lineTo(state.width, screen.y);
  }
  ctx.stroke();
}

function drawAxes(step, minX, maxX, minY, maxY) {
  const xAxisY = state.origin.y;
  const yAxisX = state.origin.x;

  ctx.strokeStyle = "#566174";
  ctx.lineWidth = 1.6;
  ctx.beginPath();

  if (xAxisY >= 0 && xAxisY <= state.height) {
    ctx.moveTo(0, xAxisY);
    ctx.lineTo(state.width, xAxisY);
  }

  if (yAxisX >= 0 && yAxisX <= state.width) {
    ctx.moveTo(yAxisX, 0);
    ctx.lineTo(yAxisX, state.height);
  }

  ctx.stroke();

  const labelY = clamp(xAxisY, 18, state.height - 18);
  const labelX = clamp(yAxisX, 30, state.width - 36);
  const tickSize = 5;

  ctx.fillStyle = "#445064";
  ctx.strokeStyle = "#566174";
  ctx.lineWidth = 1.2;
  ctx.font = "12px Inter, system-ui, sans-serif";
  ctx.textBaseline = "top";

  const startX = Math.floor(minX / step) * step;
  for (let x = startX; x <= maxX + step / 2; x += step) {
    const screen = worldToScreen(x, 0);
    ctx.beginPath();
    ctx.moveTo(screen.x, labelY - tickSize);
    ctx.lineTo(screen.x, labelY + tickSize);
    ctx.stroke();

    if (Math.abs(x) > step / 1000) {
      ctx.fillText(formatTick(x, step), screen.x + 4, labelY + 7);
    }
  }

  const startY = Math.floor(minY / step) * step;
  ctx.textBaseline = "middle";
  for (let y = startY; y <= maxY + step / 2; y += step) {
    const screen = worldToScreen(0, y);
    ctx.beginPath();
    ctx.moveTo(labelX - tickSize, screen.y);
    ctx.lineTo(labelX + tickSize, screen.y);
    ctx.stroke();

    if (Math.abs(y) > step / 1000) {
      ctx.fillText(formatTick(y, step), labelX + 8, screen.y);
    }
  }

  ctx.fillText("0", labelX + 8, labelY + 14);
}

function drawFunctions() {
  state.functions.forEach((fn) => {
    drawFunctionGraph(fn.evaluator, fn.color, { dash: [], lineWidth: 2.4 });

    if (fn.showDerivative) {
      drawFunctionGraph(fn.derivativeEvaluator, fn.color, {
        dash: [9, 7],
        lineWidth: 2,
      });
    }
  });
}

function drawFunctionGraph(evaluator, color, options) {
  if (!evaluator) return;

  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = options.lineWidth;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.setLineDash(options.dash);
  ctx.beginPath();

  let hasPoint = false;
  let lastY = 0;
  const sampleStep = Math.max(1, Math.floor(2 / window.devicePixelRatio));

  for (let screenX = 0; screenX <= state.width; screenX += sampleStep) {
    const x = screenToWorld(screenX, 0).x;
    const y = evaluator(x);
    const screen = worldToScreen(x, y);
    const isDrawable =
      Number.isFinite(y) &&
      Number.isFinite(screen.y) &&
      Math.abs(screen.y) < state.height * 20;

    if (!isDrawable) {
      hasPoint = false;
      continue;
    }

    const isJump = hasPoint && Math.abs(screen.y - lastY) > state.height * 1.6;
    if (!hasPoint || isJump) {
      ctx.moveTo(screenX, screen.y);
    } else {
      ctx.lineTo(screenX, screen.y);
    }

    hasPoint = true;
    lastY = screen.y;
  }

  ctx.stroke();
  ctx.restore();
}

function draw() {
  clearCanvas();
  drawGrid();
  drawFunctions();
}

function resizeCanvas() {
  const previousWidth = state.width;
  const previousHeight = state.height;
  const previousCenter =
    previousWidth && previousHeight
      ? screenToWorld(previousWidth / 2, previousHeight / 2)
      : { x: 0, y: 0 };

  const rect = canvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  state.width = rect.width;
  state.height = rect.height;
  canvas.width = Math.round(rect.width * dpr);
  canvas.height = Math.round(rect.height * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  if (!previousWidth || !previousHeight) {
    state.origin.x = state.width / 2;
    state.origin.y = state.height / 2;
  } else {
    state.origin.x = state.width / 2 - previousCenter.x * state.scale;
    state.origin.y = state.height / 2 + previousCenter.y * state.scale;
  }

  draw();
}

function zoomAt(screenX, screenY, factor) {
  const before = screenToWorld(screenX, screenY);
  state.scale = clamp(state.scale * factor, state.minScale, state.maxScale);
  state.origin.x = screenX - before.x * state.scale;
  state.origin.y = screenY + before.y * state.scale;
  draw();
}

function zoomAtCenter(factor) {
  zoomAt(state.width / 2, state.height / 2, factor);
}

function resetView() {
  state.scale = 60;
  state.origin.x = state.width / 2;
  state.origin.y = state.height / 2;
  draw();
}

function getPointerPosition(event) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: event.clientX - rect.left,
    y: event.clientY - rect.top,
  };
}

canvas.addEventListener(
  "wheel",
  (event) => {
    event.preventDefault();
    const pointer = getPointerPosition(event);
    const factor = Math.exp(-event.deltaY * 0.0012);
    zoomAt(pointer.x, pointer.y, factor);
  },
  { passive: false },
);

canvas.addEventListener("pointerdown", (event) => {
  const pointer = getPointerPosition(event);
  drag.active = true;
  drag.x = pointer.x;
  drag.y = pointer.y;
  canvas.classList.add("is-dragging");
  canvas.setPointerCapture(event.pointerId);
});

canvas.addEventListener("pointermove", (event) => {
  if (!drag.active) return;

  const pointer = getPointerPosition(event);
  state.origin.x += pointer.x - drag.x;
  state.origin.y += pointer.y - drag.y;
  drag.x = pointer.x;
  drag.y = pointer.y;
  draw();
});

function endDrag(event) {
  drag.active = false;
  canvas.classList.remove("is-dragging");
  if (canvas.hasPointerCapture(event.pointerId)) {
    canvas.releasePointerCapture(event.pointerId);
  }
}

canvas.addEventListener("pointerup", endDrag);
canvas.addEventListener("pointercancel", endDrag);

zoomInButton.addEventListener("click", () => zoomAtCenter(1.25));
zoomOutButton.addEventListener("click", () => zoomAtCenter(0.8));
resetViewButton.addEventListener("click", resetView);

addForm.addEventListener("submit", (event) => {
  event.preventDefault();
  formError.textContent = "";

  try {
    addFunction(functionInput.value);
    functionInput.value = "";
    functionInput.focus();
  } catch (error) {
    formError.textContent = error.message;
  }
});

new ResizeObserver(resizeCanvas).observe(canvas);

window.addEventListener("load", () => {
  try {
    addFunction("f(x) = sin(x)");
    addFunction("g(x) = x^2 / 8 - 2");
  } catch (error) {
    formError.textContent = error.message;
    renderFunctionList();
    draw();
  }
});
