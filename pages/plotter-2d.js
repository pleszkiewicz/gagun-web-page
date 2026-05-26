function renderPlotter2D(container, { t }) {
  container.innerHTML = `
    <section class="plotter-page" aria-label="${t("pages.plotter2d.title")}">
      <section class="plot-area" aria-label="${t("pages.plotter2d.plotAreaLabel")}">
        <div class="plot-toolbar" aria-label="${t("pages.plotter2d.toolbarLabel")}">
          <button class="tool-button" id="zoomOutButton" type="button" title="${t("pages.plotter2d.zoomOut")}">-</button>
          <button class="tool-button" id="zoomInButton" type="button" title="${t("pages.plotter2d.zoomIn")}">+</button>
          <button class="tool-button reset-button" id="resetViewButton" type="button">${t("pages.plotter2d.resetView")}</button>
        </div>
        <canvas id="plotCanvas" aria-label="${t("pages.plotter2d.canvasLabel")}"></canvas>
      </section>

      <aside class="control-panel" aria-label="${t("pages.plotter2d.functionsLabel")}">
        <header class="panel-header">
          <p class="eyebrow">${t("pages.plotter2d.eyebrow")}</p>
          <h1>${t("pages.plotter2d.heading")}</h1>
        </header>

        <form class="add-form" id="addFunctionForm">
          <label for="functionInput">${t("pages.plotter2d.newFunction")}</label>
          <div class="input-row">
            <input
              id="functionInput"
              name="functionInput"
              type="text"
              autocomplete="off"
              spellcheck="false"
              placeholder="f(x) = sin(x) + x^2 / 4"
            >
            <button type="submit">${t("pages.plotter2d.addFunction")}</button>
          </div>
          <p class="form-error" id="formError" role="alert"></p>
        </form>

        <section class="functions-section" aria-label="${t("pages.plotter2d.functionsLabel")}">
          <div class="section-heading">
            <h2>${t("pages.plotter2d.functionsHeading")}</h2>
            <span id="functionCount">0</span>
          </div>
          <div class="function-list" id="functionList"></div>
        </section>

        <section class="syntax-panel" aria-label="${t("pages.plotter2d.syntaxLabel")}">
          <h2>${t("pages.plotter2d.syntaxHeading")}</h2>
          <div class="syntax-grid">
            <span>sin(x)</span>
            <span>cos(x)</span>
            <span>tan(x)</span>
            <span>sqrt(x)</span>
            <span>log(x)</span>
            <span>abs(x)</span>
            <span>pi</span>
            <span>e</span>
            <span>x^2</span>
            <span>f(x) &gt; 2x</span>
          </div>
        </section>
      </aside>
    </section>
  `;

  const canvas = container.querySelector("#plotCanvas");
  const plotArea = container.querySelector(".plot-area");
  const ctx = canvas.getContext("2d");
  const addForm = container.querySelector("#addFunctionForm");
  const functionInput = container.querySelector("#functionInput");
  const functionList = container.querySelector("#functionList");
  const formError = container.querySelector("#formError");
  const functionCount = container.querySelector("#functionCount");
  const zoomInButton = container.querySelector("#zoomInButton");
  const zoomOutButton = container.querySelector("#zoomOutButton");
  const resetViewButton = container.querySelector("#resetViewButton");

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

  function findTopLevelRelation(expression) {
    let depth = 0;

    for (let index = 0; index < expression.length; index += 1) {
      const char = expression[index];

      if (char === "(") {
        depth += 1;
        continue;
      }

      if (char === ")") {
        depth = Math.max(0, depth - 1);
        continue;
      }

      if (depth !== 0) continue;

      const nextChar = expression[index + 1];
      if ((char === ">" || char === "<") && nextChar === "=") {
        return {
          left: expression.slice(0, index).trim(),
          operator: `${char}=`,
          right: expression.slice(index + 2).trim(),
        };
      }

      if (char === ">" || char === "<" || char === "=") {
        return {
          left: expression.slice(0, index).trim(),
          operator: char,
          right: expression.slice(index + 1).trim(),
        };
      }
    }

    return null;
  }

  function isYAxisReference(expression) {
    const functionMatch = expression.match(
      /^([a-zA-Z][a-zA-Z0-9_]*)\s*\(\s*x\s*\)$/u,
    );

    return (
      /^y$/iu.test(expression) ||
      (Boolean(functionMatch) && !allowedFunctions.has(functionMatch[1].toLowerCase()))
    );
  }

  function invertRelationOperator(operator) {
    return {
      ">": "<",
      ">=": "<=",
      "<": ">",
      "<=": ">=",
      "=": "=",
    }[operator];
  }

  function getFillDirection(operator) {
    if (operator === ">" || operator === ">=") return "above";
    if (operator === "<" || operator === "<=") return "below";
    return null;
  }

  function getFunctionLineDash(fn) {
    if (fn.fillDirection && !fn.relationOperator.includes("=")) {
      return [9, 7];
    }

    return [];
  }

  function parseExpressionDefinition(rawExpression) {
    const expression = rawExpression.trim().replaceAll("≥", ">=").replaceAll("≤", "<=");
    const relation = findTopLevelRelation(expression);

    if (!relation) {
      return {
        expression: stripDefinition(expression),
        relationOperator: "=",
        fillDirection: null,
      };
    }

    const leftIsYAxis = isYAxisReference(relation.left);
    const rightIsYAxis = isYAxisReference(relation.right);

    if (!leftIsYAxis && !rightIsYAxis) {
      throw new Error(t("pages.plotter2d.inequalityNeedsYAxis"));
    }

    const normalizedOperator = rightIsYAxis
      ? invertRelationOperator(relation.operator)
      : relation.operator;

    return {
      expression: leftIsYAxis ? relation.right : relation.left,
      relationOperator: normalizedOperator,
      fillDirection: getFillDirection(normalizedOperator),
    };
  }

  function validateNode(node) {
    node.traverse((child, _path, parent) => {
      if (child.type === "OperatorNode" && !allowedOperators.has(child.op)) {
        throw new Error(
          t("pages.plotter2d.unsupportedOperator", { operator: child.op }),
        );
      }

      if (child.type === "FunctionNode") {
        const functionName = child.name || child.fn?.name;
        if (!allowedFunctions.has(functionName)) {
          throw new Error(
            t("pages.plotter2d.unsupportedFunction", { name: functionName }),
          );
        }
        return;
      }

      if (child.type === "SymbolNode") {
        const isFunctionName = parent?.type === "FunctionNode" && parent.fn === child;
        if (!isFunctionName && !allowedSymbols.has(child.name)) {
          throw new Error(t("pages.plotter2d.unknownSymbol", { name: child.name }));
        }
        return;
      }

      if (!safeNodeTypes.has(child.type)) {
        throw new Error(t("pages.plotter2d.unsupportedElement", { type: child.type }));
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
        error: t("pages.plotter2d.derivativeUnavailableWithReason", {
          reason: error.message,
        }),
        evaluate: null,
      };
    }
  }

  function compileExpression(rawExpression) {
    if (!window.math) {
      throw new Error(t("pages.plotter2d.mathNotLoaded"));
    }

    const parsedExpression = parseExpressionDefinition(rawExpression);
    if (!parsedExpression.expression) {
      throw new Error(t("pages.plotter2d.enterExpression"));
    }

    const node = window.math.parse(parsedExpression.expression);
    validateNode(node);
    const compiled = node.compile();
    const derivative = compileDerivative(node);

    return {
      expression: formatExpressionNode(node),
      relationOperator: parsedExpression.relationOperator,
      fillDirection: parsedExpression.fillDirection,
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
      relationOperator: compiled.relationOperator,
      fillDirection: compiled.fillDirection,
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
      target.relationOperator = compiled.relationOperator;
      target.fillDirection = compiled.fillDirection;
      target.evaluator = compiled.evaluate;
      target.derivativeExpression = compiled.derivative.expression;
      target.derivativeEvaluator = compiled.derivative.evaluate;
      target.derivativeError = compiled.derivative.error;
      target.showDerivative = target.showDerivative && Boolean(target.derivativeEvaluator);
      target.error = "";
    } catch (error) {
      target.expression = rawExpression.trim();
      target.relationOperator = "=";
      target.fillDirection = null;
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

      title.append(name);

      const actions = document.createElement("div");
      actions.className = "function-actions";

      const input = document.createElement("input");
      input.type = "text";
      input.value = `${fn.name}(x) ${fn.relationOperator} ${fn.expression}`;
      input.autocomplete = "off";
      input.spellcheck = false;
      input.setAttribute("aria-label", `${fn.name}(x)`);

      const saveButton = document.createElement("button");
      saveButton.type = "button";
      saveButton.textContent = t("pages.plotter2d.save");
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
      deleteButton.textContent = t("pages.plotter2d.delete");
      deleteButton.addEventListener("click", () => deleteFunction(fn.id));

      actions.append(input, saveButton, deleteButton);

      const derivativeInfo = document.createElement("button");
      derivativeInfo.type = "button";
      derivativeInfo.className = "derivative-expression derivative-toggle-button";
      derivativeInfo.disabled = !fn.derivativeEvaluator;
      derivativeInfo.style.borderLeftColor = fn.color;
      derivativeInfo.setAttribute("aria-pressed", String(fn.showDerivative));
      derivativeInfo.setAttribute(
        "aria-label",
        t("pages.plotter2d.toggleDerivative", { name: fn.name }),
      );
      derivativeInfo.classList.toggle("is-active", fn.showDerivative);
      derivativeInfo.addEventListener("click", () => {
        fn.showDerivative = !fn.showDerivative;
        renderFunctionList();
        draw();
      });

      const derivativeExpressionText = document.createElement("span");
      derivativeExpressionText.className = "derivative-expression-text";

      const derivativeToggleLabel = document.createElement("span");
      derivativeToggleLabel.className = "derivative-toggle-label";
      derivativeToggleLabel.textContent = fn.showDerivative
        ? t("pages.plotter2d.hideDerivativeAction")
        : t("pages.plotter2d.showDerivativeAction");

      if (fn.derivativeExpression) {
        derivativeExpressionText.textContent = `${fn.name}'(x) = ${fn.derivativeExpression}`;
        derivativeInfo.append(derivativeExpressionText, derivativeToggleLabel);
      } else {
        derivativeInfo.classList.add("is-unavailable");
        derivativeExpressionText.textContent =
          fn.derivativeError || t("pages.plotter2d.derivativeUnavailable");
        derivativeToggleLabel.textContent = t("pages.plotter2d.derivativeUnavailableAction");
        derivativeInfo.append(derivativeExpressionText, derivativeToggleLabel);
      }

      item.append(title, actions, derivativeInfo);

      if (fn.error) {
        const rowError = document.createElement("p");
        rowError.className = "row-error";
        rowError.textContent = fn.error;
        item.append(rowError);
      }

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
      if (fn.fillDirection) {
        drawInequalityFill(fn.evaluator, fn.color, fn.fillDirection);
      }
    });

    state.functions.forEach((fn) => {
      drawFunctionGraph(fn.evaluator, fn.color, {
        dash: getFunctionLineDash(fn),
        lineWidth: 2.4,
      });

      if (fn.showDerivative) {
        drawFunctionGraph(fn.derivativeEvaluator, fn.color, {
          dash: [1, 7],
          lineWidth: 2,
        });
      }
    });
  }

  function drawInequalityFill(evaluator, color, direction) {
    if (!evaluator) return;

    ctx.save();
    ctx.globalAlpha = 0.1;
    ctx.fillStyle = color;

    for (let screenX = 0; screenX <= state.width; screenX += 1) {
      const x = screenToWorld(screenX, 0).x;
      const y = evaluator(x);
      const screen = worldToScreen(x, y);

      if (!Number.isFinite(y) || !Number.isFinite(screen.y)) continue;

      if (direction === "above") {
        const fillHeight = clamp(screen.y, 0, state.height);
        if (fillHeight > 0) {
          ctx.fillRect(screenX, 0, 1, fillHeight);
        }
      }

      if (direction === "below") {
        const fillStart = clamp(screen.y, 0, state.height);
        const fillHeight = state.height - fillStart;
        if (fillHeight > 0) {
          ctx.fillRect(screenX, fillStart, 1, fillHeight);
        }
      }
    }

    ctx.restore();
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

    const rect = plotArea.getBoundingClientRect();
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

  function handleWheel(event) {
    event.preventDefault();
    const pointer = getPointerPosition(event);
    const factor = Math.exp(-event.deltaY * 0.0012);
    zoomAt(pointer.x, pointer.y, factor);
  }

  function handlePointerDown(event) {
    const pointer = getPointerPosition(event);
    drag.active = true;
    drag.x = pointer.x;
    drag.y = pointer.y;
    canvas.classList.add("is-dragging");
    canvas.setPointerCapture(event.pointerId);
  }

  function handlePointerMove(event) {
    if (!drag.active) return;

    const pointer = getPointerPosition(event);
    state.origin.x += pointer.x - drag.x;
    state.origin.y += pointer.y - drag.y;
    drag.x = pointer.x;
    drag.y = pointer.y;
    draw();
  }

  function endDrag(event) {
    drag.active = false;
    canvas.classList.remove("is-dragging");
    if (canvas.hasPointerCapture(event.pointerId)) {
      canvas.releasePointerCapture(event.pointerId);
    }
  }

  function handleSubmit(event) {
    event.preventDefault();
    formError.textContent = "";

    try {
      addFunction(functionInput.value);
      functionInput.value = "";
      functionInput.focus();
    } catch (error) {
      formError.textContent = error.message;
    }
  }

  canvas.addEventListener("wheel", handleWheel, { passive: false });
  canvas.addEventListener("pointerdown", handlePointerDown);
  canvas.addEventListener("pointermove", handlePointerMove);
  canvas.addEventListener("pointerup", endDrag);
  canvas.addEventListener("pointercancel", endDrag);
  zoomInButton.addEventListener("click", () => zoomAtCenter(1.25));
  zoomOutButton.addEventListener("click", () => zoomAtCenter(0.8));
  resetViewButton.addEventListener("click", resetView);
  addForm.addEventListener("submit", handleSubmit);

  const resizeObserver = new ResizeObserver(resizeCanvas);
  resizeObserver.observe(plotArea);

  try {
    addFunction("f(x) = sin(x)");
    addFunction("g(x) = x^2 / 8 - 2");
  } catch (error) {
    formError.textContent = error.message;
    renderFunctionList();
    draw();
  }

  resizeCanvas();

  return () => {
    resizeObserver.disconnect();
  };
}

window.gagunPageModules = window.gagunPageModules || [];
window.gagunPageModules.push({
  id: "plotter-2d",
  navKey: "pages.plotter2d.navLabel",
  titleKey: "pages.plotter2d.title",
  theme: {
    background: "#eef7f4",
    backgroundSoft: "#f8fbff",
    mathColor: "rgba(23, 78, 110, 0.2)",
    mathOpacity: "0.94",
  },
  render: renderPlotter2D,
});
