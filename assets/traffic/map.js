window.gagunTraffic.createMap = function createTrafficMap(stage, simulation, { onSelect, onZoom, visibleLines }) {
  const base = stage.querySelector(".traffic-basemap");
  const canvas = stage.querySelector(".traffic-agents");
  const bg = base.getContext("2d", { alpha: false });
  const ctx = canvas.getContext("2d");
  const data = simulation.data;
  const lines = new Map(data.transit.lines.map(line => [line.id, line]));
  const routePaths = new Map();
  let shownStops = new Set();
  const inContext = (x, y) => Math.abs(x) <= 6500 && Math.abs(y) <= 6500;
  const camera = { x: 0, y: 0, scale: .05 };
  const target = { ...camera };
  const pointers = new Map();
  const listeners = new AbortController();
  const roadPaths = new Map(), laneLines = new Path2D();
  const cycleTracks = new Path2D(), roadsideCycling = new Path2D();
  const water = new Path2D(), built = new Path2D(), forest = new Path2D(), boundary = new Path2D();
  const hitGrid = new Map(), labels = [];
  let width = 1, height = 1, ratio = 1, fitScale = .05, dirty = true, selected = data.selected;
  let dragDistance = 0, pinched = false, lastZoom = "", initialized = false, showCycling = true;
  let lastClosureVersion = -1, lastEventRevision = -1;

  function addPolyline(path, points, close = false) {
    if (!points.length) return;
    path.moveTo(points[0], points[1]);
    for (let i = 2; i < points.length; i += 2) path.lineTo(points[i], points[i + 1]);
    if (close) path.closePath();
  }
  function addLaneLine(edge, offset) {
    const points = edge.points, shifted = [];
    for (let i = 0; i < points.length; i += 2) {
      const before = Math.max(0, i - 2), after = Math.min(points.length - 2, i + 2);
      const dx = points[after] - points[before], dy = points[after + 1] - points[before + 1];
      const length = Math.hypot(dx, dy) || 1;
      shifted.push(points[i] - dy / length * offset, points[i + 1] + dx / length * offset);
    }
    addPolyline(laneLines, shifted);
  }
  const paths = simulation.edges.map(edge => {
    const p = new Path2D();
    addPolyline(p, edge.points);
    const key = `${edge.kind}:${edge.drive ? edge.width : 1.2}`;
    if (!roadPaths.has(key)) roadPaths.set(key, { kind: edge.kind, width: edge.drive ? edge.width : 1.2, path: new Path2D() });
    addPolyline(roadPaths.get(key).path, edge.points);
    if (edge.cycling[2] || edge.cycling[3]) addPolyline(edge.drive ? roadsideCycling : cycleTracks, edge.points);
    if (edge.drive) {
      if (!edge.shared) for (let lane = 1; lane < edge.lanes[0] + edge.lanes[1]; lane++) addLaneLine(edge, edge.width / 2 - lane * 3.3);
      const xs = edge.points.filter((_, i) => i % 2 === 0), ys = edge.points.filter((_, i) => i % 2 === 1);
      for (let x = Math.floor(Math.min(...xs) / 200); x <= Math.floor(Math.max(...xs) / 200); x++) {
        for (let y = Math.floor(Math.min(...ys) / 200); y <= Math.floor(Math.max(...ys) / 200); y++) {
          const key = `${x},${y}`;
          if (!hitGrid.has(key)) hitGrid.set(key, []);
          hitGrid.get(key).push(edge);
        }
      }
      if (edge.name && edge.kind < 3) labels.push({ edge, position: simulation.positionOnArc({ edge, reverse: false }, edge.length / 2) });
    }
    return p;
  });
  for (const polygon of data.water) for (const ring of polygon) addPolyline(water, ring.flat(), true);
  for (const [isForest, ring] of data.land) addPolyline(isForest ? forest : built, ring.flat(), true);
  for (const ring of data.boundary) addPolyline(boundary, ring.flat());
  for (const line of data.transit.lines) {
    const path = new Path2D();
    for (const id of line.shapes) addPolyline(path, data.transit.shapes[id].flatMap(p => p.slice(0, 2)));
    routePaths.set(line.id, path);
  }
  labels.sort((a, b) => b.edge.length - a.edge.length);

  function resize() {
    const rect = stage.getBoundingClientRect();
    const oldFit = fitScale;
    width = Math.max(1, rect.width); height = Math.max(1, rect.height);
    fitScale = Math.min(width, height) / 10800;
    ratio = Math.min(2, window.devicePixelRatio || 1);
    for (const c of [base, canvas]) { c.width = Math.round(width * ratio); c.height = Math.round(height * ratio); }
    if (!initialized) { camera.scale = fitScale; target.scale = fitScale; initialized = true; }
    else { camera.scale *= fitScale / oldFit; target.scale *= fitScale / oldFit; }
    dirty = true;
  }
  function screen(x, y) { return [(x - camera.x) * camera.scale + width / 2, (y - camera.y) * camera.scale + height / 2]; }
  function zoom(factor, x = width / 2, y = height / 2) {
    const worldX = target.x + (x - width / 2) / target.scale;
    const worldY = target.y + (y - height / 2) / target.scale;
    target.scale = Math.max(fitScale * .8, Math.min(fitScale * 80, target.scale * factor));
    target.x = worldX - (x - width / 2) / target.scale;
    target.y = worldY - (y - height / 2) / target.scale;
  }
  function fit() { Object.assign(target, { x: 0, y: 0, scale: fitScale }); }
  function focus(edgeId) {
    const edge = simulation.edges[edgeId];
    if (!edge) return;
    selected = edgeId; dirty = true;
    const p = simulation.positionOnArc({ edge, reverse: false }, edge.length / 2);
    Object.assign(target, { x: p.x, y: p.y, scale: Math.max(fitScale * 8, Math.min(1.3, Math.min(width, height) / (edge.length + 260))) });
  }
  function local(event) { const rect = canvas.getBoundingClientRect(); return [event.clientX - rect.left, event.clientY - rect.top]; }
  function nearest(point) {
    const world = [camera.x + (point[0] - width / 2) / camera.scale, camera.y + (point[1] - height / 2) / camera.scale];
    const radius = Math.min(160, 14 / camera.scale);
    let distance = radius, found;
    const candidates = new Set();
    for (let x = Math.floor((world[0] - radius) / 200); x <= Math.floor((world[0] + radius) / 200); x++) {
      for (let y = Math.floor((world[1] - radius) / 200); y <= Math.floor((world[1] + radius) / 200); y++) for (const e of hitGrid.get(`${x},${y}`) || []) candidates.add(e);
    }
    for (const edge of candidates) {
      const p = edge.points;
      for (let j = 0; j < p.length - 2; j += 2) {
        const dx = p[j + 2] - p[j], dy = p[j + 3] - p[j + 1];
        const f = Math.max(0, Math.min(1, ((world[0] - p[j]) * dx + (world[1] - p[j + 1]) * dy) / (dx * dx + dy * dy || 1)));
        const d = Math.hypot(world[0] - p[j] - dx * f, world[1] - p[j + 1] - dy * f);
        if (d < distance) { distance = d; found = edge; }
      }
    }
    return found;
  }
  function listen(type, fn, options = {}) { canvas.addEventListener(type, fn, { ...options, signal: listeners.signal }); }
  listen("wheel", event => {
    event.preventDefault();
    const [x, y] = local(event);
    zoom(Math.exp(-event.deltaY * (event.deltaMode === 1 ? .035 : .0025)), x, y);
  }, { passive: false });
  listen("pointerdown", event => {
    if (event.button !== 0) return;
    canvas.focus({ preventScroll: true });
    canvas.setPointerCapture(event.pointerId);
    pointers.set(event.pointerId, local(event));
    if (pointers.size === 1) { dragDistance = 0; pinched = false; }
    if (pointers.size > 1) pinched = true;
    canvas.classList.add("is-dragging");
  });
  listen("pointermove", event => {
    if (!pointers.has(event.pointerId)) return;
    const before = [...pointers.values()];
    const old = pointers.get(event.pointerId), point = local(event);
    dragDistance += Math.hypot(point[0] - old[0], point[1] - old[1]);
    pointers.set(event.pointerId, point);
    const after = [...pointers.values()];
    if (before.length === 2) {
      const previousDistance = Math.hypot(before[0][0] - before[1][0], before[0][1] - before[1][1]);
      const distance = Math.hypot(after[0][0] - after[1][0], after[0][1] - after[1][1]);
      const previousCenter = [(before[0][0] + before[1][0]) / 2, (before[0][1] + before[1][1]) / 2];
      zoom(distance / Math.max(1, previousDistance), ...previousCenter);
      target.x -= ((after[0][0] + after[1][0]) / 2 - previousCenter[0]) / target.scale;
      target.y -= ((after[0][1] + after[1][1]) / 2 - previousCenter[1]) / target.scale;
    } else {
      target.x -= (point[0] - old[0]) / target.scale;
      target.y -= (point[1] - old[1]) / target.scale;
    }
    target.x = Math.max(-6000, Math.min(6000, target.x));
    target.y = Math.max(-6000, Math.min(6000, target.y));
  });
  function release(event) {
    if (!pointers.has(event.pointerId)) return;
    pointers.delete(event.pointerId);
    if (!pointers.size) {
      canvas.classList.remove("is-dragging");
      if (!pinched && dragDistance < 6 && event.type === "pointerup") {
        const edge = nearest(local(event));
        if (edge) { selected = edge.id; dirty = true; onSelect(edge); }
      }
    }
  }
  listen("pointerup", release); listen("pointercancel", release); listen("lostpointercapture", release);
  listen("keydown", event => {
    const moves = { ArrowLeft: [-80, 0], ArrowRight: [80, 0], ArrowUp: [0, -80], ArrowDown: [0, 80] };
    if (moves[event.key]) { event.preventDefault(); target.x += moves[event.key][0] / target.scale; target.y += moves[event.key][1] / target.scale; }
    else if (["+", "=", "-", "Home"].includes(event.key)) { event.preventDefault(); if (event.key === "Home") fit(); else zoom(event.key === "-" ? 1 / 1.5 : 1.5); }
  });

  function drawBase(frame) {
    bg.setTransform(ratio, 0, 0, ratio, 0, 0);
    bg.fillStyle = "#f4f5ef"; bg.fillRect(0, 0, width, height);
    bg.translate(width / 2 - camera.x * camera.scale, height / 2 - camera.y * camera.scale);
    bg.scale(camera.scale, camera.scale);
    bg.fillStyle = "#e9ede4"; bg.fill(built);
    bg.fillStyle = "#dfe8d9"; bg.fill(forest);
    bg.fillStyle = "#cbdfe5"; bg.fill(water, "evenodd");
    bg.lineJoin = "round"; bg.lineCap = "round";
    for (const { kind, width: roadWidth, path } of [...roadPaths.values()].sort((a, b) => b.kind - a.kind)) {
      if (kind >= 3 && camera.scale < .10) continue;
      bg.lineWidth = Math.max(roadWidth + 1.2, (kind < 2 ? 2.5 : kind === 2 ? 1.2 : .7) / camera.scale);
      bg.strokeStyle = kind === 4 ? "#b8c4b7" : "#d0d4cc"; bg.stroke(path);
      if (kind < 4) {
        bg.lineWidth = Math.max(roadWidth, (kind < 2 ? 1.5 : .65) / camera.scale);
        bg.strokeStyle = "#ffffff"; bg.stroke(path);
      }
    }
    if (camera.scale > .65) {
      bg.strokeStyle = "#c8cec4"; bg.lineWidth = .6 / camera.scale;
      bg.setLineDash([3, 5]); bg.stroke(laneLines); bg.setLineDash([]);
    }
    if (showCycling) {
      bg.strokeStyle = "#299b8f"; bg.lineWidth = Math.max(1.3 / camera.scale, 1.8); bg.stroke(cycleTracks);
      bg.lineWidth = Math.max(1 / camera.scale, 1.2); bg.setLineDash([3 / camera.scale, 3 / camera.scale]); bg.stroke(roadsideCycling); bg.setLineDash([]);
    }
    bg.lineWidth = 1 / camera.scale; bg.strokeStyle = "#9ba79e"; bg.setLineDash([5 / camera.scale, 5 / camera.scale]); bg.stroke(boundary); bg.setLineDash([]);
    bg.beginPath(); bg.arc(0, 0, data.radius, 0, Math.PI * 2);
    bg.strokeStyle = "#bdc8c1"; bg.lineWidth = 1 / camera.scale; bg.setLineDash([3 / camera.scale, 6 / camera.scale]); bg.stroke(); bg.setLineDash([]);
    shownStops = new Set([...visibleLines].flatMap(id => lines.get(id).stops).filter(id => inContext(data.transit.stops[id][1], data.transit.stops[id][2])));
    bg.save(); bg.beginPath(); bg.rect(-6500, -6500, 13000, 13000); bg.clip();
    bg.lineWidth = Math.max(2.2 / camera.scale, 2);
    for (const id of visibleLines) {
      bg.strokeStyle = lines.get(id).color; bg.stroke(routePaths.get(id));
    }
    bg.restore();
    if (camera.scale > .12) for (const id of shownStops) {
      const stop = data.transit.stops[id];
      bg.beginPath(); bg.arc(stop[1], stop[2], 2.8 / camera.scale, 0, Math.PI * 2);
      bg.fillStyle = "#ffffff"; bg.fill(); bg.lineWidth = 1.1 / camera.scale; bg.strokeStyle = "#3067d6"; bg.stroke();
    }
    const eventByEdge = new Map(frame.roadEvents.active.map(event => [event.edgeId, event.type]));
    const closureColor = id => !frame.manualClosures.has(id) && eventByEdge.get(id) === "roadwork" ? "#b77c20" : "#cf4d47";
    for (const id of frame.closures) { bg.strokeStyle = closureColor(id); bg.lineWidth = 4 / camera.scale; bg.stroke(paths[id]); }
    if (selected !== null) {
      bg.strokeStyle = frame.closures.has(selected) ? "#b6332f" : "#bc8c23"; bg.lineWidth = 5 / camera.scale; bg.stroke(paths[selected]);
    }
    bg.setTransform(ratio, 0, 0, ratio, 0, 0);
    const occupied = [];
    function label(text, x, y, color = "#5c6e6b", weight = 400) {
      const [sx, sy] = screen(x, y);
      if (sx < 45 || sx > width - 45 || sy < 50 || sy > height - 40) return;
      bg.font = `${weight} 11px system-ui, sans-serif`;
      const w = bg.measureText(text).width + 10;
      const rect = { x: sx - w / 2, y: sy - 11, w, h: 20 };
      if (occupied.some(a => rect.x < a.x + a.w && rect.x + rect.w > a.x && rect.y < a.y + a.h && rect.y + rect.h > a.y)) return;
      occupied.push(rect);
      bg.textAlign = "center"; bg.lineWidth = 3; bg.strokeStyle = "#f4f5ef"; bg.strokeText(text, sx, sy);
      bg.fillStyle = color; bg.fillText(text, sx, sy);
      return true;
    }
    for (const [name, x, y, priority] of [...data.places].sort((a, b) => b[3] - a[3])) {
      if (!priority && camera.scale < .07) continue;
      label(name.replace("Osiedle ", "os. "), x, y, priority === 2 ? "#5c8390" : "#5c6e6b", name === "Ełk" ? 600 : 400);
    }
    if (camera.scale > .6) for (const id of shownStops) {
      const stop = data.transit.stops[id];
      label(stop[0], stop[1], stop[2] - 10 / camera.scale, "#3268d4");
    }
    if (camera.scale > .18) {
      const usedNames = new Set();
      for (const { edge, position } of labels) {
        if (occupied.length > 70) break;
        if (!usedNames.has(edge.name) && label(edge.name, position.x, position.y, "#7e8175")) usedNames.add(edge.name);
      }
    }
    const scaleMeters = camera.scale < .15 ? 1000 : camera.scale < .8 ? 200 : 50;
    const scalePixels = scaleMeters * camera.scale;
    bg.strokeStyle = "#506662"; bg.lineWidth = 1.5;
    bg.beginPath(); bg.moveTo(18, height - 39); bg.lineTo(18, height - 34); bg.lineTo(18 + scalePixels, height - 34); bg.lineTo(18 + scalePixels, height - 39); bg.stroke();
    bg.font = "11px system-ui, sans-serif"; bg.textAlign = "left"; bg.fillStyle = "#506662"; bg.fillText(scaleMeters >= 1000 ? "1 km" : `${scaleMeters} m`, 18, height - 43);
    bg.textAlign = "right"; bg.fillText("N ↑", width - 18, 28);
    const markerGrid = new Map();
    const closedIds = frame.closures.has(selected) ? [selected, ...[...frame.closures].filter(id => id !== selected)] : frame.closures;
    for (const id of closedIds) {
      const edge = simulation.edges[id], p = simulation.positionOnArc({ edge, reverse: false }, edge.length / 2);
      const [x, y] = screen(p.x, p.y);
      if (x < -7 || x > width + 7 || y < -7 || y > height + 7) continue;
      const gx = Math.floor(x / 32), gy = Math.floor(y / 32);
      let overlap = false;
      for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
        if ((markerGrid.get(`${gx + dx},${gy + dy}`) || []).some(point => Math.hypot(point[0] - x, point[1] - y) < 32)) overlap = true;
      }
      if (overlap) continue;
      const key = `${gx},${gy}`;
      if (!markerGrid.has(key)) markerGrid.set(key, []);
      markerGrid.get(key).push([x, y]);
      const type = frame.manualClosures.has(id) ? "manual" : eventByEdge.get(id);
      bg.fillStyle = closureColor(id); bg.beginPath(); bg.arc(x, y, 7, 0, Math.PI * 2); bg.fill();
      bg.strokeStyle = "#fff"; bg.lineWidth = 2; bg.beginPath();
      if (type === "accident") { bg.moveTo(x, y - 4); bg.lineTo(x, y + 1); bg.moveTo(x, y + 3); bg.lineTo(x, y + 4); }
      else if (type === "roadwork") { bg.moveTo(x - 3, y - 4); bg.lineTo(x - 3, y + 4); bg.moveTo(x + 2, y - 4); bg.lineTo(x + 2, y + 4); }
      else { bg.moveTo(x - 4, y); bg.lineTo(x + 4, y); }
      bg.stroke();
    }
  }
  function draw(frame, dt) {
    let changed = false;
    if (lastClosureVersion !== frame.closureVersion || lastEventRevision !== frame.roadEvents.revision) {
      dirty = true; lastClosureVersion = frame.closureVersion; lastEventRevision = frame.roadEvents.revision;
    }
    const blend = 1 - Math.exp(-18 * Math.min(.1, dt || .016));
    for (const key of ["x", "y", "scale"]) {
      const difference = target[key] - camera[key];
      if (Math.abs(difference) > (key === "scale" ? .00001 : .05)) { camera[key] += difference * blend; changed = true; }
      else camera[key] = target[key];
    }
    const zoomText = `${(camera.scale / fitScale).toFixed(1)}×`;
    if (zoomText !== lastZoom) { onZoom(zoomText); lastZoom = zoomText; }
    if (changed || dirty) { drawBase(frame); dirty = false; }
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0); ctx.clearRect(0, 0, width, height);
    if (camera.scale > .12) frame.passengers.stopWaiting.forEach((count, i) => {
      if (!count || !shownStops.has(i)) return;
      const stop = data.transit.stops[i], [x, y] = screen(stop[1], stop[2]);
      if (x < 0 || x > width || y < 0 || y > height) return;
      ctx.beginPath(); ctx.arc(x, y, Math.min(12, 4 + Math.sqrt(count)), 0, Math.PI * 2);
      ctx.fillStyle = "#c18a2b38"; ctx.fill();
      if (camera.scale > .6) {
        ctx.font = "600 10px system-ui,sans-serif"; ctx.textAlign = "left";
        ctx.strokeStyle = "#fff"; ctx.lineWidth = 3; ctx.strokeText(count, x + 6, y + 12);
        ctx.fillStyle = "#9b691a"; ctx.fillText(count, x + 6, y + 12);
      }
    });
    function marker(agent, color, isBus) {
      if (isBus && !inContext(agent.x, agent.y)) return;
      const [x, y] = screen(agent.x, agent.y);
      if (x < -20 || x > width + 20 || y < -20 || y > height + 20) return;
      ctx.save(); ctx.translate(x, y); ctx.rotate(agent.angle);
      const length = isBus ? Math.max(9, Math.min(24, 12 * camera.scale)) : Math.max(3, Math.min(15, 4.5 * camera.scale));
      const breadth = isBus ? Math.max(4.5, length * .35) : Math.max(2.2, length * .4);
      ctx.fillStyle = color; ctx.strokeStyle = "#fff"; ctx.lineWidth = isBus ? 1.2 : .6;
      ctx.fillRect(-length / 2, -breadth / 2, length, breadth); ctx.strokeRect(-length / 2, -breadth / 2, length, breadth); ctx.restore();
      if (isBus) {
        const line = lines.get(agent.lineId);
        ctx.font = "600 10px system-ui,sans-serif"; ctx.textAlign = "center"; ctx.strokeStyle = "#fff"; ctx.lineWidth = 3;
        ctx.strokeText(line.number, x, y - 8); ctx.fillStyle = line.color; ctx.fillText(line.number, x, y - 8);
      }
    }
    for (const p of frame.pedestrians) { const [x, y] = screen(p.x, p.y); if (x < 0 || x > width || y < 0 || y > height) continue; ctx.beginPath(); ctx.arc(x, y, Math.max(1.5, Math.min(3, camera.scale)), 0, Math.PI * 2); ctx.fillStyle = "#c18a2b"; ctx.fill(); }
    for (const car of frame.cars) marker(car, car.waiting ? "#bd6d38" : "#26966b", false);
    function microMarker(rider, color, scooter) {
      const [x, y] = screen(rider.x, rider.y);
      if (x < -10 || x > width + 10 || y < -10 || y > height + 10) return;
      const size = Math.max(2.6, Math.min(7, camera.scale * 2.5));
      ctx.save(); ctx.translate(x, y); ctx.rotate(rider.angle);
      ctx.strokeStyle = color; ctx.fillStyle = rider.pushing ? "#fff" : color; ctx.lineWidth = 1;
      ctx.beginPath();
      if (scooter) ctx.rect(-size, -size * .4, size * 2, size * .8);
      else { ctx.moveTo(-size, 0); ctx.lineTo(0, -size * .7); ctx.lineTo(size, 0); ctx.lineTo(0, size * .7); ctx.closePath(); }
      ctx.fill(); ctx.stroke();
      if (camera.scale > .8) {
        for (const dx of [-size, size]) { ctx.beginPath(); ctx.arc(dx, size * .6, 1.3, 0, Math.PI * 2); ctx.stroke(); }
      }
      ctx.restore();
    }
    for (const bike of frame.bikes) microMarker(bike, "#8057b5", false);
    for (const scooter of frame.scooters) microMarker(scooter, "#138f9c", true);
    for (const bus of frame.buses) if (visibleLines.has(bus.lineId)) marker(bus, bus.waiting ? "#ba4646" : lines.get(bus.lineId).color, true);
  }
  const observer = new ResizeObserver(resize);
  observer.observe(stage); resize();
  return { draw, zoom, fit, focus, setCyclingVisible(value) { showCycling = value; dirty = true; }, invalidate() { dirty = true; }, destroy() { listeners.abort(); observer.disconnect(); pointers.clear(); } };
};
