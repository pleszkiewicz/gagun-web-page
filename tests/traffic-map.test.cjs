const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

function fixture() {
  let rect = { width: 390, height: 420 };
  let notify;
  const window = { gagunTraffic: {}, devicePixelRatio: 2 };
  function canvas() {
    const surface = { painted: false, resets: 0 };
    const ctx = new Proxy({ fillRect() { surface.painted = true; } }, {
      get(target, key) { return target[key] ?? (() => {}); },
    });
    let width = 300, height = 150;
    return {
      surface,
      get width() { return width; },
      set width(value) { width = value; surface.painted = false; surface.resets++; },
      get height() { return height; },
      set height(value) { height = value; surface.painted = false; surface.resets++; },
      getContext() { return ctx; },
      addEventListener() {},
    };
  }
  const base = canvas(), agents = canvas();
  const stage = {
    querySelector(selector) { return selector === ".traffic-basemap" ? base : agents; },
    getBoundingClientRect() { return rect; },
  };
  const context = vm.createContext({
    window, AbortController, Path2D: class {},
    ResizeObserver: class {
      constructor(callback) { notify = callback; }
      observe() {}
      disconnect() {}
    },
  });
  vm.runInContext(fs.readFileSync(path.join(__dirname, "../assets/traffic/map.js"), "utf8"), context);
  const simulation = {
    edges: [],
    data: { selected: null, radius: 5000, water: [], land: [], boundary: [], places: [], transit: { lines: [], stops: [], shapes: [] } },
  };
  const frame = {
    closureVersion: 0, roadEvents: { revision: 0, active: [] }, closures: new Set(), manualClosures: new Set(),
    passengers: { stopWaiting: [] }, pedestrians: [], cars: [{ x: 0, y: 0, angle: 0 }], bikes: [], scooters: [], buses: [],
  };
  let zoom;
  const map = window.gagunTraffic.createMap(stage, simulation, { onZoom(value) { zoom = value; }, onSelect() {}, visibleLines: new Set() });
  return {
    base, agents, window, map,
    draw() { map.draw(frame, .016); },
    resize(width = rect.width, height = rect.height) { rect = { width, height }; notify(); },
    get zoom() { return zoom; },
  };
}

test("resizing leaves both map layers painted until the next animation frame", () => {
  const view = fixture();
  view.draw();
  for (const height of [430, 440, 450, 440, 430, 420]) {
    view.resize(390, height);
    assert.ok(view.base.surface.painted, "basemap disappeared between frames");
    assert.ok(view.agents.surface.painted, "vehicles disappeared between frames");
    view.draw();
    for (const canvas of [view.base, view.agents]) {
      assert.equal(canvas.height, height * 2);
      assert.ok(canvas.surface.painted, "resized layer was not repainted");
    }
  }
  view.map.destroy();
});

test("unchanged size notifications preserve the map bitmap", () => {
  const view = fixture();
  view.draw();
  const resets = [view.base.surface.resets, view.agents.surface.resets];
  for (let i = 0; i < 3; i++) {
    view.resize();
    assert.ok(view.base.surface.painted);
    assert.ok(view.agents.surface.painted);
    view.draw();
  }
  assert.deepEqual([view.base.surface.resets, view.agents.surface.resets], resets);
  view.map.destroy();
});

test("a real resize redraws at the current pixel density and preserves zoom", () => {
  const view = fixture();
  view.draw();
  view.map.zoom(2);
  for (let i = 0; i < 100; i++) view.draw();
  assert.equal(view.zoom, "2.0×");
  view.window.devicePixelRatio = 1;
  view.resize(844, 390);
  view.draw();
  for (const canvas of [view.base, view.agents]) {
    assert.equal(canvas.width, 844);
    assert.equal(canvas.height, 390);
    assert.ok(canvas.surface.painted);
  }
  assert.equal(view.zoom, "2.0×");
  view.map.destroy();
});
