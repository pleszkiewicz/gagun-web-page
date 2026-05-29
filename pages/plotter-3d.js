function renderPlotter3D(container, { t }) {
  container.innerHTML = `
    <section class="plotter-page plotter-3d-page" aria-label="${t("pages.plotter3d.title")}">
      <section class="plot-area plot-area-3d" aria-label="${t("pages.plotter3d.plotAreaLabel")}">
        <div class="plot-toolbar" aria-label="${t("pages.plotter3d.toolbarLabel")}">
          <button class="tool-button" id="zoomOut3dButton" type="button" title="${t("pages.plotter3d.zoomOut")}">-</button>
          <button class="tool-button" id="zoomIn3dButton" type="button" title="${t("pages.plotter3d.zoomIn")}">+</button>
          <button class="tool-button reset-button" id="resetView3dButton" type="button">${t("pages.plotter3d.resetView")}</button>
        </div>
        <div class="plotter-3d-viewport" id="plotter3dViewport" aria-label="${t("pages.plotter3d.canvasLabel")}"></div>
      </section>

      <aside class="control-panel" aria-label="${t("pages.plotter3d.functionsLabel")}">
        <header class="panel-header">
          <p class="eyebrow">${t("pages.plotter3d.eyebrow")}</p>
          <h1>${t("pages.plotter3d.heading")}</h1>
        </header>

        <form class="add-form" id="addSurfaceForm">
          <label for="surfaceInput">${t("pages.plotter3d.newFunction")}</label>
          <div class="input-row">
            <input
              id="surfaceInput"
              name="surfaceInput"
              type="text"
              autocomplete="off"
              spellcheck="false"
              placeholder="f(x, y) = sin(x) * cos(y)"
            >
            <button type="submit">${t("pages.plotter3d.addFunction")}</button>
          </div>
          <p class="form-error" id="surfaceFormError" role="alert"></p>
        </form>

        <section class="functions-section" aria-label="${t("pages.plotter3d.functionsLabel")}">
          <div class="section-heading">
            <h2>${t("pages.plotter3d.functionsHeading")}</h2>
            <span id="surfaceCount">0</span>
          </div>
          <div class="function-list" id="surfaceList"></div>
        </section>

        <section class="syntax-panel" aria-label="${t("pages.plotter3d.syntaxLabel")}">
          <h2>${t("pages.plotter3d.syntaxHeading")}</h2>
          <div class="syntax-grid">
            <span>sin(x) * cos(y)</span>
            <span>x^2 - y^2</span>
            <span>sqrt(x^2 + y^2)</span>
            <span>z = x * y / 4</span>
            <span>0.25 * sin(x * y)</span>
          </div>
        </section>
      </aside>
    </section>
  `;

  const viewport = container.querySelector("#plotter3dViewport");
  const addForm = container.querySelector("#addSurfaceForm");
  const surfaceInput = container.querySelector("#surfaceInput");
  const surfaceList = container.querySelector("#surfaceList");
  const formError = container.querySelector("#surfaceFormError");
  const surfaceCount = container.querySelector("#surfaceCount");
  const zoomInButton = container.querySelector("#zoomIn3dButton");
  const zoomOutButton = container.querySelector("#zoomOut3dButton");
  const resetViewButton = container.querySelector("#resetView3dButton");

  const colors = [
    "#d43d2f",
    "#1769c2",
    "#00856f",
    "#7d3bb2",
    "#c68d09",
    "#3751c8",
    "#d95f13",
    "#2c7b39",
    "#7a5238",
    "#be2b71",
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

  const allowedSymbols = new Set(["x", "y", "pi", "e", "Infinity"]);
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

  const safeNodeTypes = new Set([
    "ConstantNode",
    "OperatorNode",
    "ParenthesisNode",
    "FunctionNode",
    "SymbolNode",
  ]);
  const verticalPitchLimit = Math.PI / 2 - 0.035;
  const minCameraPitch = -verticalPitchLimit;
  const maxCameraPitch = verticalPitchLimit;

  const state = {
    width: 0,
    height: 0,
    functions: [],
    nextIndex: 0,
    nextId: 1,
    scene: null,
    camera: null,
    renderer: null,
    surfacesGroup: null,
    gridGroup: null,
    cameraDistance: 15,
    yaw: -0.72,
    pitch: 0.68,
    target: null,
    domain: 5,
    zLimit: 6,
    resolution: 62,
    webglReady: false,
  };

  const activePointers = new Map();
  const drag = {
    active: false,
    x: 0,
    y: 0,
  };
  const pinch = {
    active: false,
    lastDistance: 0,
  };

  function getFunctionName(index) {
    if (index === 0) return "f";
    if (index === 1) return "g";
    if (index === 2) return "h";
    return `f${index - 2}`;
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

  function isSurfaceReference(expression) {
    const trimmed = expression.trim();
    const functionMatch = trimmed.match(
      /^([a-zA-Z][a-zA-Z0-9_]*)\s*\(\s*x\s*,\s*y\s*\)$/u,
    );

    return (
      /^z$/iu.test(trimmed) ||
      (Boolean(functionMatch) && !allowedFunctions.has(functionMatch[1].toLowerCase()))
    );
  }

  function parseExpressionDefinition(rawExpression) {
    const expression = rawExpression.trim().replaceAll("≥", ">=").replaceAll("≤", "<=");
    const relation = findTopLevelRelation(expression);

    if (!relation) {
      return expression;
    }

    if (relation.operator !== "=") {
      throw new Error(t("pages.plotter3d.inequalitiesUnsupported"));
    }

    const leftIsSurface = isSurfaceReference(relation.left);
    const rightIsSurface = isSurfaceReference(relation.right);

    if (!leftIsSurface && !rightIsSurface) {
      throw new Error(t("pages.plotter3d.equalityNeedsSurface"));
    }

    return leftIsSurface ? relation.right : relation.left;
  }

  function validateNode(node) {
    node.traverse((child, _path, parent) => {
      if (child.type === "OperatorNode" && !allowedOperators.has(child.op)) {
        throw new Error(
          t("pages.plotter3d.unsupportedOperator", { operator: child.op }),
        );
      }

      if (child.type === "FunctionNode") {
        const functionName = child.name || child.fn?.name;
        if (!allowedFunctions.has(functionName?.toLowerCase())) {
          throw new Error(
            t("pages.plotter3d.unsupportedFunction", { name: functionName }),
          );
        }
        return;
      }

      if (child.type === "SymbolNode") {
        const isFunctionName = parent?.type === "FunctionNode" && parent.fn === child;
        if (!isFunctionName && !allowedSymbols.has(child.name)) {
          throw new Error(t("pages.plotter3d.unknownSymbol", { name: child.name }));
        }
        return;
      }

      if (!safeNodeTypes.has(child.type)) {
        throw new Error(t("pages.plotter3d.unsupportedElement", { type: child.type }));
      }
    });
  }

  function formatExpressionNode(node) {
    return node
      .toString({ parenthesis: "auto", implicit: "hide" })
      .replace(/\s+/g, " ")
      .trim();
  }

  function evaluateCompiled(compiled, x, y) {
    const value = compiled.evaluate({ ...baseScope, x, y });
    if (typeof value !== "number") return Number.NaN;
    return value;
  }

  function compileExpression(rawExpression) {
    if (!window.math) {
      throw new Error(t("pages.plotter3d.mathNotLoaded"));
    }

    const expression = parseExpressionDefinition(rawExpression);
    if (!expression) {
      throw new Error(t("pages.plotter3d.enterExpression"));
    }

    const node = window.math.parse(expression);
    validateNode(node);
    const compiled = node.compile();

    return {
      expression: formatExpressionNode(node),
      evaluate(x, y) {
        return evaluateCompiled(compiled, x, y);
      },
    };
  }

  function addFunction(rawExpression) {
    const compiled = compileExpression(rawExpression);
    const functionIndex = state.nextIndex;
    state.nextIndex += 1;

    state.functions.push({
      id: `surface-${state.nextId++}`,
      name: getFunctionName(functionIndex),
      color: colors[functionIndex % colors.length],
      expression: compiled.expression,
      evaluator: compiled.evaluate,
      isVisible: true,
    });

    renderFunctionList();
    updateSurfaces();
    renderScene();
  }

  function deleteFunction(id) {
    state.functions = state.functions.filter((item) => item.id !== id);
    renderFunctionList();
    updateSurfaces();
    renderScene();
  }

  function toggleFunctionVisibility(id) {
    const fn = state.functions.find((item) => item.id === id);
    if (!fn) return;

    fn.isVisible = !fn.isVisible;
    renderFunctionList();
    updateSurfaces();
    renderScene();
  }

  function renderFunctionList() {
    surfaceList.replaceChildren();
    surfaceCount.textContent = String(state.functions.length);

    state.functions.forEach((fn) => {
      const item = document.createElement("article");
      item.className = "function-item";
      item.classList.toggle("is-hidden", !fn.isVisible);
      item.dataset.id = fn.id;
      item.addEventListener("click", (event) => {
        if (event.target.closest(".function-delete-button")) return;

        toggleFunctionVisibility(fn.id);
      });

      const deleteButton = document.createElement("button");
      deleteButton.type = "button";
      deleteButton.className = "function-delete-button";
      deleteButton.textContent = "×";
      deleteButton.setAttribute("aria-label", t("pages.plotter3d.delete"));
      deleteButton.title = t("pages.plotter3d.delete");
      deleteButton.addEventListener("click", (event) => {
        event.stopPropagation();
        deleteFunction(fn.id);
      });

      const title = document.createElement("div");
      title.className = "function-title";

      const toggleButton = document.createElement("button");
      toggleButton.type = "button";
      toggleButton.className = "function-toggle-button";
      toggleButton.setAttribute("aria-pressed", String(fn.isVisible));
      toggleButton.setAttribute(
        "aria-label",
        t(fn.isVisible ? "pages.plotter3d.hideSurface" : "pages.plotter3d.showSurface", {
          name: fn.name,
        }),
      );
      toggleButton.title = t(
        fn.isVisible ? "pages.plotter3d.hideSurface" : "pages.plotter3d.showSurface",
        { name: fn.name },
      );
      toggleButton.addEventListener("click", (event) => {
        event.stopPropagation();
        toggleFunctionVisibility(fn.id);
      });

      const name = document.createElement("span");
      name.className = "function-name";

      const dot = document.createElement("span");
      dot.className = "color-dot";
      dot.style.background = fn.color;

      const label = document.createElement("span");
      label.textContent = `${fn.name}(x, y)`;

      const operatorLabel = document.createElement("span");
      operatorLabel.className = "function-relation";
      operatorLabel.textContent = "=";

      const expression = document.createElement("span");
      expression.className = "function-expression";
      expression.textContent = fn.expression;

      name.append(dot, label, operatorLabel, expression);
      toggleButton.append(name);
      title.append(toggleButton, deleteButton);
      item.append(title);
      surfaceList.append(item);
    });
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function disposeMaterial(material) {
    if (material.map) {
      material.map.dispose();
    }

    material.dispose();
  }

  function disposeObject(object) {
    object.traverse((child) => {
      if (child.geometry) {
        child.geometry.dispose();
      }

      if (Array.isArray(child.material)) {
        child.material.forEach(disposeMaterial);
      } else if (child.material) {
        disposeMaterial(child.material);
      }
    });
  }

  function clearGroup(group) {
    if (!group) return;

    while (group.children.length) {
      const child = group.children[0];
      group.remove(child);
      disposeObject(child);
    }
  }

  function createLabelSprite(text, position, color) {
    const labelCanvas = document.createElement("canvas");
    labelCanvas.width = 128;
    labelCanvas.height = 128;
    const labelContext = labelCanvas.getContext("2d");

    labelContext.clearRect(0, 0, labelCanvas.width, labelCanvas.height);
    labelContext.font = "700 54px Inter, system-ui, sans-serif";
    labelContext.textAlign = "center";
    labelContext.textBaseline = "middle";
    labelContext.fillStyle = color;
    labelContext.fillText(text, 64, 64);

    const texture = new THREE.CanvasTexture(labelCanvas);
    texture.minFilter = THREE.LinearFilter;

    const material = new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      depthTest: false,
    });
    const sprite = new THREE.Sprite(material);
    sprite.position.copy(position);
    sprite.scale.set(0.72, 0.72, 0.72);
    return sprite;
  }

  function makeLine(points, color, opacity = 1) {
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const material = new THREE.LineBasicMaterial({
      color,
      transparent: opacity < 1,
      opacity,
    });
    return new THREE.Line(geometry, material);
  }

  function makeAxis(start, end, color) {
    const direction = new THREE.Vector3().subVectors(end, start);
    const length = direction.length();
    const geometry = new THREE.CylinderGeometry(0.02, 0.02, length, 14);
    const material = new THREE.MeshBasicMaterial({ color });
    const axis = new THREE.Mesh(geometry, material);
    const midpoint = new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5);

    axis.position.copy(midpoint);
    axis.quaternion.setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      direction.normalize(),
    );

    return axis;
  }

  function interpolateSurfacePoint(first, second, height) {
    const denominator = second.height - first.height;
    const factor =
      Math.abs(denominator) < Number.EPSILON
        ? 0
        : clamp((height - first.height) / denominator, 0, 1);

    return {
      x: first.x + (second.x - first.x) * factor,
      height,
      depth: first.depth + (second.depth - first.depth) * factor,
    };
  }

  function clipSurfacePolygon(points, isInside, boundaryHeight) {
    if (!points.length) return [];

    const clipped = [];
    let previous = points.at(-1);
    let previousInside = isInside(previous);

    points.forEach((current) => {
      const currentInside = isInside(current);

      if (currentInside) {
        if (!previousInside) {
          clipped.push(interpolateSurfacePoint(previous, current, boundaryHeight));
        }
        clipped.push(current);
      } else if (previousInside) {
        clipped.push(interpolateSurfacePoint(previous, current, boundaryHeight));
      }

      previous = current;
      previousInside = currentInside;
    });

    return clipped;
  }

  function clipTriangleToHeightRange(points, minHeight, maxHeight) {
    const belowMax = clipSurfacePolygon(
      points,
      (point) => point.height <= maxHeight,
      maxHeight,
    );

    return clipSurfacePolygon(
      belowMax,
      (point) => point.height >= minHeight,
      minHeight,
    );
  }

  function appendSurfaceTriangle(vertices, first, second, third) {
    vertices.push(
      first.x,
      first.height,
      first.depth,
      second.x,
      second.height,
      second.depth,
      third.x,
      third.height,
      third.depth,
    );
  }

  function appendClippedSurfaceTriangle(vertices, points, zLimit, jumpLimit) {
    if (!points.every(Boolean)) return;

    const heights = points.map((point) => point.height);
    const minHeight = Math.min(...heights);
    const maxHeight = Math.max(...heights);
    const hasOutOfRangePoint = minHeight < -zLimit || maxHeight > zLimit;

    if (!hasOutOfRangePoint && maxHeight - minHeight > jumpLimit) return;

    const clipped = clipTriangleToHeightRange(points, -zLimit, zLimit);
    if (clipped.length < 3) return;

    for (let index = 1; index < clipped.length - 1; index += 1) {
      appendSurfaceTriangle(vertices, clipped[0], clipped[index], clipped[index + 1]);
    }
  }

  function getSurfaceVertexKey(position, index) {
    return [
      position.getX(index).toFixed(5),
      position.getY(index).toFixed(5),
      position.getZ(index).toFixed(5),
    ].join(":");
  }

  function computeSmoothSurfaceNormals(geometry) {
    const position = geometry.getAttribute("position");
    const normalValues = new Float32Array(position.count * 3);
    const accumulatedNormals = new Map();
    const first = new THREE.Vector3();
    const second = new THREE.Vector3();
    const third = new THREE.Vector3();
    const edgeOne = new THREE.Vector3();
    const edgeTwo = new THREE.Vector3();
    const faceNormal = new THREE.Vector3();

    function addNormal(index, normal) {
      const key = getSurfaceVertexKey(position, index);
      const accumulated = accumulatedNormals.get(key) || new THREE.Vector3();

      accumulated.add(normal);
      accumulatedNormals.set(key, accumulated);
    }

    for (let index = 0; index < position.count; index += 3) {
      first.fromBufferAttribute(position, index);
      second.fromBufferAttribute(position, index + 1);
      third.fromBufferAttribute(position, index + 2);
      edgeOne.subVectors(second, first);
      edgeTwo.subVectors(third, first);
      faceNormal.crossVectors(edgeOne, edgeTwo);

      if (faceNormal.lengthSq() <= Number.EPSILON) continue;

      addNormal(index, faceNormal);
      addNormal(index + 1, faceNormal);
      addNormal(index + 2, faceNormal);
    }

    for (let index = 0; index < position.count; index += 1) {
      const normal = accumulatedNormals.get(getSurfaceVertexKey(position, index));

      if (!normal) {
        normalValues[index * 3 + 1] = 1;
        continue;
      }

      normal.normalize();
      normalValues[index * 3] = normal.x;
      normalValues[index * 3 + 1] = normal.y;
      normalValues[index * 3 + 2] = normal.z;
    }

    geometry.setAttribute("normal", new THREE.BufferAttribute(normalValues, 3));
  }

  function createGridAndAxes() {
    if (!state.gridGroup) return;

    clearGroup(state.gridGroup);

    const gridColor = 0xa9b4c2;
    const axisXColor = 0xc93636;
    const axisYColor = 0x1769c2;
    const axisZColor = 0x17845f;
    const domain = state.domain;
    const zLimit = state.zLimit;

    for (let value = -domain; value <= domain; value += 1) {
      state.gridGroup.add(
        makeLine(
          [new THREE.Vector3(-domain, 0, value), new THREE.Vector3(domain, 0, value)],
          gridColor,
          1,
        ),
      );

      state.gridGroup.add(
        makeLine(
          [new THREE.Vector3(value, 0, -domain), new THREE.Vector3(value, 0, domain)],
          gridColor,
          1,
        ),
      );
    }

    state.gridGroup.add(
      makeAxis(
        new THREE.Vector3(-domain, 0, 0),
        new THREE.Vector3(domain + 0.65, 0, 0),
        axisXColor,
      ),
    );
    state.gridGroup.add(
      makeAxis(
        new THREE.Vector3(0, 0, -domain),
        new THREE.Vector3(0, 0, domain + 0.65),
        axisYColor,
      ),
    );
    state.gridGroup.add(
      makeAxis(
        new THREE.Vector3(0, -zLimit, 0),
        new THREE.Vector3(0, zLimit + 0.65, 0),
        axisZColor,
      ),
    );

    state.gridGroup.add(
      createLabelSprite("x", new THREE.Vector3(domain + 1.05, 0, 0), "#c93636"),
    );
    state.gridGroup.add(
      createLabelSprite("y", new THREE.Vector3(0, 0, domain + 1.05), "#1769c2"),
    );
    state.gridGroup.add(
      createLabelSprite("z", new THREE.Vector3(0, zLimit + 1.05, 0), "#17845f"),
    );
  }

  function createSurfaceGeometry(evaluator) {
    const segments = state.resolution;
    const vertexCount = (segments + 1) * (segments + 1);
    const samples = Array.from({ length: vertexCount }, () => null);
    const domain = state.domain;
    const zLimit = state.zLimit;
    const step = (domain * 2) / segments;
    const jumpLimit = zLimit * 1.25;

    for (let row = 0; row <= segments; row += 1) {
      const y = -domain + row * step;

      for (let column = 0; column <= segments; column += 1) {
        const x = -domain + column * step;
        const index = row * (segments + 1) + column;
        const rawZ = evaluator(x, y);

        if (Number.isFinite(rawZ)) {
          samples[index] = {
            x,
            height: rawZ,
            depth: y,
          };
        }
      }
    }

    const vertices = [];
    for (let row = 0; row < segments; row += 1) {
      for (let column = 0; column < segments; column += 1) {
        const topLeft = row * (segments + 1) + column;
        const topRight = topLeft + 1;
        const bottomLeft = topLeft + segments + 1;
        const bottomRight = bottomLeft + 1;

        appendClippedSurfaceTriangle(
          vertices,
          [samples[topLeft], samples[bottomLeft], samples[topRight]],
          zLimit,
          jumpLimit,
        );
        appendClippedSurfaceTriangle(
          vertices,
          [samples[topRight], samples[bottomLeft], samples[bottomRight]],
          zLimit,
          jumpLimit,
        );
      }
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
      "position",
      new THREE.BufferAttribute(new Float32Array(vertices), 3),
    );
    computeSmoothSurfaceNormals(geometry);
    return geometry;
  }

  function createSurface(fn) {
    const group = new THREE.Group();
    const geometry = createSurfaceGeometry(fn.evaluator);
    const color = new THREE.Color(fn.color);
    const mesh = new THREE.Mesh(
      geometry,
      new THREE.MeshStandardMaterial({
        color,
        side: THREE.DoubleSide,
        transparent: false,
        opacity: 1,
        roughness: 0.62,
        metalness: 0.02,
      }),
    );

    const wireframe = new THREE.LineSegments(
      new THREE.WireframeGeometry(geometry),
      new THREE.LineBasicMaterial({
        color,
        transparent: true,
        opacity: 0.16,
      }),
    );

    group.add(mesh, wireframe);
    return group;
  }

  function updateSurfaces() {
    if (!state.webglReady || !state.surfacesGroup) return;

    clearGroup(state.surfacesGroup);
    state.functions.forEach((fn) => {
      if (!fn.isVisible) return;

      state.surfacesGroup.add(createSurface(fn));
    });
  }

  function updateCamera() {
    if (!state.camera || !state.target) return;

    const horizontalDistance = state.cameraDistance * Math.cos(state.pitch);
    state.camera.position.set(
      state.target.x + horizontalDistance * Math.sin(state.yaw),
      state.target.y + state.cameraDistance * Math.sin(state.pitch),
      state.target.z + horizontalDistance * Math.cos(state.yaw),
    );
    state.camera.up.set(0, 1, 0);

    if (Math.abs(horizontalDistance) < 0.0001) {
      state.camera.up.set(0, 0, state.pitch > 0 ? -1 : 1);
    }

    state.camera.lookAt(state.target);
  }

  function renderScene() {
    if (!state.webglReady || !state.renderer || !state.scene || !state.camera) return;

    updateCamera();
    state.renderer.render(state.scene, state.camera);
  }

  function resizeRenderer() {
    if (!state.webglReady || !state.renderer || !state.camera) return;

    const rect = viewport.getBoundingClientRect();
    state.width = rect.width;
    state.height = rect.height;
    state.renderer.setSize(rect.width, rect.height, false);
    state.camera.aspect = rect.width / Math.max(rect.height, 1);
    state.camera.updateProjectionMatrix();
    renderScene();
  }

  function resetView() {
    state.cameraDistance = 15;
    state.yaw = -0.72;
    state.pitch = 0.68;
    renderScene();
  }

  function zoom(factor) {
    state.cameraDistance = clamp(state.cameraDistance * factor, 5.2, 34);
    renderScene();
  }

  function getPointerPosition(event) {
    const rect = viewport.getBoundingClientRect();
    return {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    };
  }

  function getPinchDistance() {
    const pointers = Array.from(activePointers.values()).slice(0, 2);
    if (pointers.length < 2) return 0;

    return Math.hypot(pointers[1].x - pointers[0].x, pointers[1].y - pointers[0].y);
  }

  function handlePointerDown(event) {
    if (event.pointerType === "mouse" && event.button !== 0) return;

    event.preventDefault();
    const pointer = getPointerPosition(event);
    activePointers.set(event.pointerId, pointer);
    viewport.setPointerCapture(event.pointerId);
    viewport.classList.add("is-dragging");

    if (activePointers.size >= 2) {
      drag.active = false;
      pinch.active = true;
      pinch.lastDistance = Math.max(getPinchDistance(), 1);
      return;
    }

    drag.active = true;
    drag.x = pointer.x;
    drag.y = pointer.y;
  }

  function handlePointerMove(event) {
    if (!activePointers.has(event.pointerId)) return;

    event.preventDefault();
    const pointer = getPointerPosition(event);
    activePointers.set(event.pointerId, pointer);

    if (activePointers.size >= 2) {
      const distance = Math.max(getPinchDistance(), 1);
      if (pinch.active) {
        zoom(clamp(pinch.lastDistance / distance, 0.76, 1.32));
      }
      pinch.active = true;
      pinch.lastDistance = distance;
      return;
    }

    if (!drag.active) {
      drag.active = true;
      drag.x = pointer.x;
      drag.y = pointer.y;
      return;
    }

    state.yaw -= (pointer.x - drag.x) * 0.008;
    state.pitch = clamp(
      state.pitch + (pointer.y - drag.y) * 0.006,
      minCameraPitch,
      maxCameraPitch,
    );
    drag.x = pointer.x;
    drag.y = pointer.y;
    renderScene();
  }

  function endPointerInteraction(event) {
    if (activePointers.has(event.pointerId)) {
      event.preventDefault();
      activePointers.delete(event.pointerId);
    }

    if (viewport.hasPointerCapture(event.pointerId)) {
      viewport.releasePointerCapture(event.pointerId);
    }

    if (activePointers.size >= 2) {
      pinch.active = true;
      pinch.lastDistance = Math.max(getPinchDistance(), 1);
      return;
    }

    if (activePointers.size === 1) {
      const pointer = Array.from(activePointers.values())[0];
      pinch.active = false;
      drag.active = true;
      drag.x = pointer.x;
      drag.y = pointer.y;
      return;
    }

    drag.active = false;
    pinch.active = false;
    viewport.classList.remove("is-dragging");
  }

  function handleWheel(event) {
    event.preventDefault();
    zoom(Math.exp(event.deltaY * 0.0012));
  }

  function handleSubmit(event) {
    event.preventDefault();
    formError.textContent = "";

    try {
      addFunction(surfaceInput.value);
      surfaceInput.value = "";
      surfaceInput.focus();
    } catch (error) {
      formError.textContent = error.message;
    }
  }

  function initialiseScene() {
    if (!window.THREE) {
      formError.textContent = t("pages.plotter3d.threeNotLoaded");
      return;
    }

    try {
      state.scene = new THREE.Scene();
      state.scene.background = new THREE.Color(0xf8fbff);
      state.camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
      state.renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: false,
        preserveDrawingBuffer: true,
      });
      state.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      state.renderer.domElement.className = "plotter-3d-canvas";
      state.renderer.domElement.setAttribute("aria-hidden", "true");
      viewport.append(state.renderer.domElement);

      state.target = new THREE.Vector3(0, 0.4, 0);
      state.surfacesGroup = new THREE.Group();
      state.gridGroup = new THREE.Group();
      state.scene.add(state.gridGroup, state.surfacesGroup);

      const ambient = new THREE.HemisphereLight(0xffffff, 0xdbe3ef, 0.75);
      const keyLight = new THREE.DirectionalLight(0xffffff, 1.05);
      keyLight.position.set(6, 9, 4);
      const fillLight = new THREE.DirectionalLight(0xbfdcff, 0.18);
      fillLight.position.set(-7, 3, -5);
      const rimLight = new THREE.DirectionalLight(0xffffff, 0.42);
      rimLight.position.set(-5, 6, 8);
      state.scene.add(ambient, keyLight, fillLight, rimLight);

      state.webglReady = true;
      createGridAndAxes();
      updateSurfaces();
      resizeRenderer();
    } catch (error) {
      formError.textContent = t("pages.plotter3d.webglUnavailable");
    }
  }

  addForm.addEventListener("submit", handleSubmit);
  viewport.addEventListener("wheel", handleWheel, { passive: false });
  viewport.addEventListener("pointerdown", handlePointerDown);
  viewport.addEventListener("pointermove", handlePointerMove);
  viewport.addEventListener("pointerup", endPointerInteraction);
  viewport.addEventListener("pointercancel", endPointerInteraction);
  zoomInButton.addEventListener("click", () => zoom(0.82));
  zoomOutButton.addEventListener("click", () => zoom(1.22));
  resetViewButton.addEventListener("click", resetView);

  const resizeObserver = new ResizeObserver(resizeRenderer);
  resizeObserver.observe(viewport);

  initialiseScene();

  try {
    addFunction("f(x, y) = sin(x) * cos(y)");
    addFunction("g(x, y) = 0.25 * sin(x * y)");
  } catch (error) {
    formError.textContent = error.message;
    renderFunctionList();
    updateSurfaces();
    renderScene();
  }

  return () => {
    resizeObserver.disconnect();
    clearGroup(state.surfacesGroup);
    clearGroup(state.gridGroup);
    if (state.renderer) {
      state.renderer.dispose();
      state.renderer.domElement.remove();
    }
  };
}

window.gagunPageModules = window.gagunPageModules || [];
window.gagunPageModules.push({
  id: "plotter-3d",
  sectionId: "mathematics",
  navKey: "pages.plotter3d.navLabel",
  titleKey: "pages.plotter3d.title",
  theme: {
    background: "#edf5f7",
    backgroundSoft: "#f7fbff",
    mathColor: "rgba(18, 76, 98, 0.2)",
    mathOpacity: "0.94",
  },
  render: renderPlotter3D,
});
