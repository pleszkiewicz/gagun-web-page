const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const path = require("node:path");
const root = path.join(__dirname, "..");
const context = vm.createContext({ window: {} });
for (const name of ["city-data", "demand", "passengers", "road-events", "engine"]) vm.runInContext(fs.readFileSync(path.join(root, `assets/traffic/${name}.js`), "utf8"), context);
vm.runInContext(fs.readFileSync(path.join(root, "assets/traffic/elk-data.js"), "utf8"), context);
const { createSimulation } = context.window.gagunTraffic;
const snapshot = context.window.gagunTrafficData;
const city = context.window.gagunTrafficCityData;
function stockForHourlyRate(rate) {
  const population = rate * 12;
  return { population, fleet: population * city.passengerCars / city.population, tripsPerResident: 2 };
}
const plain = value => JSON.parse(JSON.stringify(value));

function fixture(turns = []) {
  const nodes = [[0, 0, 0], [1000, 0, 0], [2000, 0, 0], [1000, 1000, 0]];
  const edge = (a, b, mask = 3) => [a, b, 0, 2, mask, 1, 10, [...nodes[a].slice(0, 2), ...nodes[b].slice(0, 2)], [1, mask === 3 ? 1 : 0, 7], [[15], mask === 3 ? [15] : []], 100 + a * 10 + b, [mask, 0, 0, 0, 3, 3]];
  return { version: 4, nodes, names: ["Test road"], edges: [edge(0, 1), edge(1, 2), edge(1, 3), edge(3, 2), edge(2, 0, 1)], turns,
    transit: { lines: [{ id: "12", number: "12", name: "Test line", color: "#3268d4", shapes: [0], stops: [0, 1] }], stops: [["Origin", 0, 0], ["Destination", 2000, 0]], shapes: [[[0, 0, 0, 0, 0], [900, 0, 900, 0, 900], [1000, 0, 1000, 2, 0], [1900, 0, 1900, 2, 900], [2000, 0, 2000, 2, 1000]]], trips: [["source-trip", 0, [[0, 0, 0, 0], [1, 200, 200, 2000]] , "12"]], dates: { "2026-11-12": [0], "2026-11-13": [] } } };
}
function simulation(data = fixture(), extra = {}) { return createSimulation(data, { date: "2026-11-12", time: 0, tripsPerResident: 0, dailyCycle: false, accidentRate: 0, roadworkRate: 0, ...extra }); }
function advance(sim, seconds) { for (let i = 0; i < Math.round(seconds * 5); i++) sim.advance(.2); }

test("a closure changes the vehicle journey; pedestrian access remains available", () => {
  const sim = simulation();
  const walkingRoute = plain(sim.route(0, 2, "pedestrian"));
  assert.deepEqual(plain(sim.route(0, 2)), [0, 2]);
  sim.setClosure(1, true);
  assert.deepEqual(plain(sim.route(0, 2)), [0, 4, 6]);
  assert.deepEqual(plain(sim.route(0, 2, "pedestrian")), walkingRoute);
  sim.setClosure(1, true);
  assert.equal(sim.getFrame().closures.size, 1);
  sim.setClosure(1, false);
  assert.deepEqual(plain(sim.route(0, 2)), [0, 2]);
});

test("routing respects one-way travel and prohibited turns", () => {
  const sim = simulation(fixture([[0, 2]]));
  assert.deepEqual(plain(sim.route(0, 2)), [0, 4, 6]);
  assert.deepEqual(plain(sim.route(2, 0)), [8]);
  sim.setClosure(2, true);
  assert.equal(sim.route(0, 2), null);
});

test("a scheduled bus waits before a closure, carries delay and resumes on reopening", () => {
  const sim = simulation();
  advance(sim, 40);
  assert.ok(Math.abs(sim.getFrame().buses[0].progress - 400) < 1);
  sim.setClosure(1, true);
  advance(sim, 90);
  let bus = sim.getFrame().buses[0];
  assert.ok(bus.progress <= 992.1, `bus entered closure: ${bus.progress}`);
  assert.ok(bus.waiting);
  assert.ok(bus.delay > 20);
  const before = bus.progress;
  sim.setClosure(1, false);
  advance(sim, 5);
  bus = sim.getFrame().buses[0];
  assert.ok(bus.progress > before);
  assert.ok(bus.progress - before < 70, "reopening must not teleport the bus to its timetable position");
  assert.ok(bus.delay > 20);
});

test("continuously departing cars respect turn restrictions until finishing their trips", () => {
  const forbidden = [[0, 2], [7, 5]];
  const sim = simulation(fixture(forbidden), { ...stockForHourlyRate(900) });
  const previous = new Map(sim.getFrame().cars.map(car => [car, car.path[car.cursor]]));
  for (let i = 0; i < 4000; i++) {
    sim.advance(.2);
    for (const car of sim.getFrame().cars) {
      const arc = car.path[car.cursor];
      assert.ok(!forbidden.some(([a, b]) => previous.get(car) === a && arc === b), "a new trip ignored the incoming turn restriction");
      previous.set(car, arc);
    }
  }
  assert.ok(sim.getFrame().completed > 0);
});

test("a bus already in a closing section clears the whole section", () => {
  const sim = simulation();
  advance(sim, 60);
  sim.setClosure(0, true);
  advance(sim, 80);
  assert.ok(sim.getFrame().buses[0].progress > 1300);
});

test("vehicles wait when closures remove every exit and never enter a new closed section", () => {
  const sim = simulation(fixture(), { ...stockForHourlyRate(900) });
  sim.setClosure(0, true);
  sim.setClosure(1, true);
  sim.setClosure(3, true);
  const previous = new Map(sim.getFrame().cars.map(car => [car, Math.floor(car.path[car.cursor] / 2)]));
  for (let i = 0; i < 1200; i++) {
    sim.advance(.2);
    for (const car of sim.getFrame().cars) {
      const id = Math.floor(car.path[car.cursor] / 2);
      assert.ok(!sim.getFrame().closures.has(id) || previous.get(car) === id, "a car entered a closed section");
      assert.ok(Number.isFinite(car.x) && Number.isFinite(car.y));
      previous.set(car, id);
    }
  }
  assert.ok(sim.getFrame().queued > 0);
});

test("real service dates govern departures and invalid dates leave the scenario intact", () => {
  const sim = simulation();
  assert.equal(sim.getFrame().dailyTrips, 1);
  sim.reset({ date: "2026-11-13", time: 0, tripsPerResident: 0 });
  assert.equal(sim.getFrame().buses.length, 0);
  assert.equal(sim.getFrame().dailyTrips, 0);
  assert.throws(() => sim.reset({ date: "2030-01-01" }), /outside timetable/);
  assert.equal(sim.getFrame().date, "2026-11-13");
});

test("the bundled MZK network retains every line, variant, calendar and city road connection", () => {
  assert.equal(snapshot.version, 4);
  assert.deepEqual(plain(snapshot.transit.lines.map(line => line.id)), ["1", "2", "3", "4", "5", "6", "7", "8", "10", "11", "12", "13", "14", "16", "17", "18"]);
  const line12 = snapshot.transit.lines.find(line => line.id === "12");
  assert.equal(line12.shapes.length, 5);
  assert.equal(line12.stops.length, 39);
  assert.equal(snapshot.transit.shapes.length, 117);
  assert.equal(snapshot.transit.stops.length, 296);
  assert.equal(snapshot.transit.trips.length, 2083);
  assert.equal(new Set(snapshot.transit.lines.map(line => line.color)).size, 16);
  assert.equal(snapshot.transit.dates["2026-11-12"].length, 360);
  assert.equal(snapshot.transit.dates["2026-11-12"].filter(id => snapshot.transit.trips[id][3] === "12").length, 53);
  assert.notEqual(snapshot.transit.dates["2026-11-11"].length, 360);
  const lines = new Map(snapshot.transit.lines.map(line => [line.id, line]));
  for (const line of lines.values()) {
    assert.ok(line.shapes.every(id => snapshot.transit.shapes[id]));
    assert.ok(line.stops.every(id => snapshot.transit.stops[id]));
  }
  for (const e of snapshot.edges) {
    assert.ok(snapshot.nodes[e[0]] && snapshot.nodes[e[1]]);
    assert.ok(e[7].length >= 4 && e[7].every(Number.isFinite));
    assert.ok(e[6] > 0);
    for (let direction = 0; direction < 2; direction++) {
      assert.equal(e[9][direction].length, e[8][direction]);
      assert.ok(e[8][direction] >= (e[4] & (direction ? 2 : 1) ? 1 : 0));
      assert.ok(e[9][direction].every(mask => mask > 0 && mask <= 15));
    }
  }
  for (const shape of snapshot.transit.shapes) {
    let previous = -1;
    for (const point of shape) {
      assert.ok(point[2] >= previous);
      previous = point[2];
      assert.ok(point[3] >= -1);
      if (Math.hypot(point[0], point[1]) <= snapshot.radius) assert.ok(point[3] >= 0, "city GTFS point lacks a legal road connection");
      if (point[3] >= 0) assert.ok(snapshot.edges[Math.floor(point[3] / 2)][4] & (point[3] % 2 ? 2 : 1));
    }
  }
  for (const [date, active] of Object.entries(snapshot.transit.dates)) for (const id of active) {
    const trip = snapshot.transit.trips[id];
    assert.ok(trip && snapshot.transit.shapes[trip[1]], `missing trip on ${date}`);
    assert.ok(lines.get(trip[3])?.shapes.includes(trip[1]), "trip is attached to the wrong line shape");
    assert.ok(trip[2].every(s => lines.get(trip[3]).stops.includes(s[0])), "line stop selection omitted a real variant stop");
    assert.ok(trip[2].every(s => snapshot.transit.stops[s[0]] && s[2] >= s[1]));
  }
});

test("real-network travellers move along finite, permitted road geometry and reset reproducibly", () => {
  const sim = createSimulation(snapshot, { date: "2026-11-12", time: 27000, ...stockForHourlyRate(600), dailyCycle: false });
  assert.equal(sim.getFrame().cars.length, Math.round(600 * .55 * 8 / 60));
  assert.equal(sim.getFrame().pedestrians.length, Math.round(600 * .22 * 18 / 60));
  const initial = plain(sim.getFrame().cars.map(a => [a.x, a.y]));
  advance(sim, 60);
  for (const agent of [...sim.getFrame().cars, ...sim.getFrame().pedestrians, ...sim.getFrame().bikes, ...sim.getFrame().scooters, ...sim.getFrame().buses]) {
    assert.ok(Number.isFinite(agent.x) && Number.isFinite(agent.y));
  }
  assert.notDeepEqual(plain(sim.getFrame().cars.map(a => [a.x, a.y])), initial);
  sim.setClosure(snapshot.selected, true);
  for (const car of sim.getFrame().cars) {
    assert.ok(car.path.slice(car.cursor + 1).every(id => Math.floor(id / 2) !== snapshot.selected), "a legal detour must avoid a newly closed section");
  }
  advance(sim, 60);
  sim.setClosure(snapshot.selected, false);
  sim.reset({ date: "2026-11-12", time: 27000, ...stockForHourlyRate(600), dailyCycle: false });
  assert.deepEqual(plain(sim.getFrame().cars.map(a => [a.x, a.y])), initial);
});

test("actual line 12 variants form a physical queue at the default closure and resume without teleporting", () => {
  const sim = createSimulation(snapshot, { date: "2026-11-12", time: 27000, tripsPerResident: 0 });
  sim.setClosure(snapshot.selected, true);
  advance(sim, 7200);
  const waiting = sim.getFrame().buses.filter(b => b.lineId === "12" && b.waiting);
  assert.ok(waiting.length >= 2);
  for (let i = 0; i < waiting.length; i++) for (let j = i + 1; j < waiting.length; j++) {
    if (Math.cos(waiting[i].angle - waiting[j].angle) > .85) assert.ok(Math.hypot(waiting[i].x - waiting[j].x, waiting[i].y - waiting[j].y) > 12, "buses overlap at the closure");
  }
  const bus = waiting[0], before = bus.progress, delay = bus.delay;
  assert.ok(delay > 300);
  sim.setClosure(snapshot.selected, false);
  advance(sim, 10);
  assert.ok(bus.progress > before && bus.progress - before < 180);
  assert.ok(bus.delay >= delay - 1);
});

const profile = extra => context.window.gagunTrafficDemand.profile({ date: "2026-11-12", time: 12 * 3600, ...stockForHourlyRate(1200), ...extra });

test("weekday commute peaks exceed midday demand; nights, weekends and holidays stay quieter", () => {
  const noon = profile({}), morning = profile({ time: 7.5 * 3600 }), afternoon = profile({ time: 16 * 3600 });
  assert.equal(morning.phase, "morningPeak");
  assert.equal(afternoon.phase, "afternoonPeak");
  assert.ok(morning.total > noon.total * 1.5 && afternoon.total > noon.total * 1.5);
  assert.ok(profile({ time: 2 * 3600 }).total < noon.total / 3);
  for (const date of ["2026-11-14", "2026-11-15", "2026-11-11", "2026-12-24"]) {
    const day = profile({ date, time: 7.5 * 3600 });
    assert.equal(day.workingDay, false);
    assert.ok(day.total < morning.total);
    assert.notEqual(day.phase, "morningPeak");
  }
  for (const hour of [2, 7.5, 12, 16, 23]) assert.equal(profile({ time: hour * 3600, dailyCycle: false }).total, 1200);
});

test("rain shifts new walking trips to cars and bus passengers while conserving total demand", () => {
  const dry = profile({ rain: 0 }), wet = profile({ rain: 100 });
  assert.equal(dry.total, wet.total);
  assert.ok(wet.walk < dry.walk && wet.car > dry.car && wet.bus > dry.bus);
  for (const rain of [0, 10, 50, 100]) for (const busAvailable of [true, false]) {
    for (const rate of [0, 1, 2, 3, 17, 100, 1200, 3600]) {
      const p = profile({ ...stockForHourlyRate(rate), rain, busAvailable });
      assert.equal(p.car + p.walk + p.bus + p.bike + p.scooter, p.total);
      assert.ok(Math.abs(p.shares.reduce((sum, n) => sum + n, 0) - 1) < 1e-10);
      assert.ok(p.car >= 0 && p.walk >= 0 && p.bus >= 0);
      if (!busAvailable) assert.equal(p.bus, 0);
    }
  }
});

test("changing rain and demand preserves existing travellers, clock, closures and real bus departures", () => {
  const sim = createSimulation(snapshot, { date: "2026-11-12", time: 27000, ...stockForHourlyRate(600) });
  sim.setClosure(snapshot.selected, true);
  const before = sim.getFrame(), locations = plain([...before.cars, ...before.pedestrians, ...before.bikes, ...before.scooters, ...before.buses].map(a => [a.id ?? a.tripIndex, a.x, a.y]));
  const passengers = before.passengers.created;
  sim.setDemand({ rain: 100, ...stockForHourlyRate(1200) });
  const after = sim.getFrame();
  assert.deepEqual(plain([...after.cars, ...after.pedestrians, ...after.bikes, ...after.scooters, ...after.buses].map(a => [a.id ?? a.tripIndex, a.x, a.y])), locations);
  assert.equal(after.time, before.time);
  assert.equal(after.passengers.created, passengers);
  assert.ok(after.closures.has(snapshot.selected));
  assert.equal(after.dailyTrips, 360);
  assert.deepEqual(plain(after.departures), plain(before.departures));
  assert.ok(after.demand.shares[1] < before.demand.shares[1]);
  sim.reset({ time: 16 * 3600 });
  assert.equal(sim.getFrame().settings.rain, 100);
  assert.equal(sim.getFrame().demand.phase, "afternoonPeak");
});

test("rain changes actual new departures and bus ridership without removing ongoing trips", () => {
  function scenario(rain) {
    const data = fixture();
    data.transit.trips = Array.from({ length: 13 }, (_, i) => [`trip-${i}`, 0, [[0, i * 600, i * 600, 0], [1, i * 600 + 200, i * 600 + 200, 2000]], "12"]);
    data.transit.dates["2026-11-12"] = data.transit.trips.map((_, i) => i);
    const sim = simulation(data, { ...stockForHourlyRate(600), rain });
    const initial = sim.getFrame().cars.length + sim.getFrame().pedestrians.length + sim.getFrame().bikes.length + sim.getFrame().scooters.length;
    advance(sim, 600);
    const frame = sim.getFrame();
    assert.equal(initial + frame.started.car + frame.started.pedestrian + frame.started.bike + frame.started.scooter, frame.cars.length + frame.pedestrians.length + frame.bikes.length + frame.scooters.length + frame.completed);
    assert.equal(frame.passengers.created, frame.passengers.completed + frame.passengers.waiting + frame.passengers.onboard);
    assert.ok(frame.buses.every(bus => bus.passengers.load <= 80));
    return frame;
  }
  const dry = scenario(0), wet = scenario(100);
  assert.ok(wet.started.car > dry.started.car);
  assert.ok(wet.started.pedestrian < dry.started.pedestrian);
  assert.ok(wet.started.bus > dry.started.bus);
  assert.ok(wet.started.bike < dry.started.bike);
  assert.ok(wet.started.scooter < dry.started.scooter);
  assert.equal(wet.dailyTrips, dry.dailyTrips);
  assert.deepEqual(plain(wet.departures), plain(dry.departures));
});

test("passenger queues conserve people, enforce bus capacity and serve only reachable destinations", () => {
  const trip = ["full-route", 0, [[0, 0, 0, 0], [1, 100, 100, 1000], [2, 200, 200, 2000]]];
  const shortTrip = ["short-route", 0, trip[2].slice(0, 2)];
  const transit = { stops: [["A"], ["B"], ["C"]], trips: [trip] };
  const passengers = context.window.gagunTrafficPassengers(transit, () => .99);
  passengers.reset([0], 0, 0);
  passengers.enqueue(200, 0); // All choose B -> C, which the short variant cannot serve.
  const short = passengers.register(shortTrip, 0);
  passengers.arrive(short, shortTrip, 1, 0);
  assert.equal(short.load, 0);
  assert.equal(passengers.report().waiting, 200);
  const full = passengers.register(trip, 0);
  assert.ok(passengers.arrive(full, trip, 1, 1) > 0);
  assert.equal(full.load, 80);
  assert.equal(passengers.report().waiting, 120);
  passengers.arrive(full, trip, 2, 1);
  const report = passengers.report();
  assert.equal(full.load, 0);
  assert.equal(report.completed, 80);
  assert.equal(report.created, report.completed + report.waiting + report.onboard);
});

test("boarding dwell grows with rain; passengers wait when no service is available", () => {
  function boarding(wet) {
    const transit = fixture().transit, passengers = context.window.gagunTrafficPassengers(transit, () => 0);
    passengers.reset([0], 0, 0);
    passengers.enqueue(20, 0);
    const bus = passengers.register(transit.trips[0], 0);
    const dwell = passengers.arrive(bus, transit.trips[0], 0, wet);
    assert.equal(bus.load, 20);
    passengers.release(bus);
    assert.equal(passengers.report().created, passengers.report().completed);
    passengers.enqueue(5, 5000);
    assert.equal(passengers.report().waiting, 5);
    return dwell;
  }
  assert.ok(boarding(1) > boarding(0));
});

test("vehicles use parallel lanes independently and remain within the directional lane count", () => {
  const data = fixture();
  data.edges.forEach(edge => { edge[8] = [2, edge[4] === 3 ? 2 : 0, 7]; edge[9] = [[15, 15], edge[4] === 3 ? [15, 15] : []]; });
  const sim = simulation(data, { ...stockForHourlyRate(2400) });
  assert.ok(sim.getFrame().cars.some(car => car.lane === 0));
  assert.ok(sim.getFrame().cars.some(car => car.lane === 1));
  advance(sim, 120);
  for (const car of sim.getFrame().cars) {
    const arc = car.path[car.cursor], edge = sim.edges[Math.floor(arc / 2)];
    assert.ok(car.lane >= 0 && car.lane < edge.lanes[arc % 2]);
  }
  const parallel = sim.getFrame().cars.some((a, i, all) => all.slice(i + 1).some(b => a.path[a.cursor] === b.path[b.cursor] && a.lane !== b.lane && Math.abs(a.distance - b.distance) < 12));
  assert.ok(parallel, "cars in separate lanes should be able to travel side by side");
});

test("OSM lane turn markings prevent a journey with no permitted approach lane", () => {
  const data = fixture();
  data.edges[0][9][0] = [4]; // The approach permits a right turn towards node 3, not straight to node 2.
  const sim = simulation(data);
  assert.deepEqual(plain(sim.route(0, 2)), [0, 4, 6]);
});

test("a shared single-track road holds opposing car entries until its occupants clear", () => {
  const data = fixture();
  data.edges[0][8] = [1, 1, 20];
  data.transit.dates["2026-11-12"] = [];
  const sim = simulation(data, { ...stockForHourlyRate(1200) });
  for (let i = 0; i < 1500; i++) {
    sim.advance(.2);
    const directions = new Set(sim.getFrame().cars.filter(car => Math.floor(car.path[car.cursor] / 2) === 0).map(car => car.path[car.cursor] % 2));
    assert.ok(directions.size <= 1, "opposing cars occupied the same physical lane");
  }
  assert.ok(sim.getFrame().completed > 0);
});

test("actual MZK passenger exchanges conserve people through wet peak traffic and new bus departures", () => {
  const sim = createSimulation(snapshot, { date: "2026-11-12", time: 16 * 3600, ...stockForHourlyRate(600), rain: 80 });
  const before = sim.getFrame();
  for (let minute = 0; minute < 15; minute++) {
    advance(sim, 60);
    const frame = sim.getFrame(), passengers = frame.passengers;
    assert.equal(passengers.created, passengers.completed + passengers.waiting + passengers.onboard);
    for (const bus of frame.buses) {
      assert.ok(bus.passengers.load >= 0 && bus.passengers.load <= bus.passengers.capacity);
      assert.equal(bus.passengers.load, bus.passengers.destinations.reduce((a, b) => a + b, 0));
      assert.ok(bus.progress >= 0 && bus.progress <= bus.trip[2].at(-1)[3]);
    }
    for (const actor of [...frame.cars, ...frame.pedestrians, ...frame.bikes, ...frame.scooters, ...frame.buses]) assert.ok(Number.isFinite(actor.x) && Number.isFinite(actor.y));
  }
  const after = sim.getFrame();
  assert.ok(after.passengers.created > before.passengers.created);
  assert.ok(after.passengers.completed > 0);
  assert.ok(after.started.bus > 0 && after.completed > 0);
  assert.equal(after.dailyTrips, 360);
});

test("the city baseline distinguishes measured city population from a county-derived fleet estimate", () => {
  assert.equal(city.asOf, "2025-12-31");
  assert.equal(city.population, 58889);
  assert.equal(city.county.population, 87671);
  assert.equal(city.county.passengerCars, 41765);
  assert.equal(city.passengerCars, Math.round(city.population * city.county.passengerCars / city.county.population));
  assert.equal(city.passengerCars, 28054);
  assert.equal(city.passengerCarsEstimated, true);
  assert.equal(city.sources.cityPopulation.unitId, "042815505011");
  assert.equal(city.sources.countyPassengerCars.unitId, "042815505000");
  assert.equal(city.sources.countyPassengerCars.variableId, 32561);
});

test("population and fleet scale travel independently, with stable shares when both grow together", () => {
  const base = profile({ population: city.population, fleet: city.passengerCars, dailyCycle: false });
  const doubled = profile({ population: city.population * 2, fleet: city.passengerCars * 2, dailyCycle: false });
  assert.ok(Math.abs(doubled.total - base.total * 2) <= 1);
  assert.deepEqual(plain(doubled.shares), plain(base.shares));
  const moreResidents = profile({ population: city.population * 2, fleet: city.passengerCars, dailyCycle: false });
  assert.ok(Math.abs(moreResidents.car - base.car) <= 1, "unchanged fleet should not invent extra dry car-trip capacity");
  assert.ok(moreResidents.walk > base.walk && moreResidents.bus > base.bus);
  const moreCars = profile({ population: city.population, fleet: city.passengerCars * 1.5, dailyCycle: false });
  assert.equal(moreCars.total, base.total);
  assert.ok(moreCars.car > base.car && moreCars.walk < base.walk);
});

test("the daily curve distributes the resident trip budget without creating extra rush-hour trips", () => {
  for (const date of ["2026-11-12", "2026-11-14", "2026-11-11"]) {
    for (const dailyCycle of [true, false]) {
      const settings = { population: city.population, fleet: city.passengerCars, tripsPerResident: 2, date, dailyCycle };
      let trips = 0;
      for (let minute = 0; minute < 1440; minute++) trips += profile({ ...settings, time: (minute + .5) * 60 }).total / 60;
      const expected = profile({ ...settings }).dailyTrips;
      assert.ok(Math.abs(trips - expected) < 20, `${date}: generated ${trips}, expected ${expected}`);
    }
  }
  assert.equal(profile({ population: city.population }).dailyTrips, city.population * 2);
});

test("empty populations and zero car fleets never generate ghost car demand, even in rain", () => {
  for (const rain of [0, 50, 100]) for (const busAvailable of [true, false]) {
    const empty = profile({ population: 0, fleet: 100000, rain, busAvailable });
    assert.equal(empty.total, 0);
    assert.equal(empty.car + empty.walk + empty.bus + empty.bike + empty.scooter, 0);
    const carFree = profile({ population: city.population, fleet: 0, rain, busAvailable });
    assert.equal(carFree.car, 0);
    assert.equal(carFree.walk + carFree.bus + carFree.bike + carFree.scooter, carFree.total);
    assert.ok(carFree.shares.every(Number.isFinite));
  }
  const sim = simulation(fixture(), { ...stockForHourlyRate(600), fleet: 0, rain: 100 });
  advance(sim, 120);
  assert.equal(sim.getFrame().cars.length, 0);
  assert.equal(sim.getFrame().started.car, 0);
});

test("departure filtering preserves full-network service and every line's real calendar", () => {
  const sim = createSimulation(snapshot, { date: "2026-11-12", time: 27000, ...stockForHourlyRate(600) });
  const frame = sim.getFrame();
  assert.equal(frame.dailyTrips, 360);
  assert.equal(frame.lineTrips["12"], 53);
  assert.equal(frame.lineTrips["8"], 66);
  assert.equal(Object.values(frame.lineTrips).reduce((a, b) => a + b, 0), frame.dailyTrips);
  const before = plain(frame.buses.map(bus => [bus.tripIndex, bus.lineId, bus.progress]));
  for (const line of snapshot.transit.lines) {
    const departures = sim.getDepartures(new Set([line.id]), 5);
    assert.ok(departures.every(trip => trip[3] === line.id));
    assert.ok(departures.every((trip, i) => !i || trip[2][0][2] >= departures[i - 1][2][0][2]));
  }
  assert.equal(sim.getDepartures(new Set()).length, 0);
  assert.deepEqual(plain(sim.getFrame().buses.map(bus => [bus.tripIndex, bus.lineId, bus.progress])), before);
  assert.equal(sim.getFrame().time, frame.time);
});

test("city controls preserve ongoing journeys and restoration uses the exact saved baseline", () => {
  const sim = simulation(fixture(), { ...stockForHourlyRate(600) });
  sim.setClosure(1, true);
  const before = sim.getFrame(), cars = plain(before.cars.map(a => [a.id, a.x, a.y]));
  sim.setDemand({ population: 100000, fleet: 0, tripsPerResident: 3, rain: 100 });
  assert.deepEqual(plain(sim.getFrame().cars.map(a => [a.id, a.x, a.y])), cars);
  advance(sim, 30);
  assert.equal(sim.getFrame().started.car, 0);
  assert.ok(sim.getFrame().closures.has(1));
  const clock = sim.getFrame().time;
  sim.setDemand(context.window.gagunTrafficDemand.defaults);
  const after = sim.getFrame();
  assert.equal(after.settings.population, city.population);
  assert.equal(after.settings.fleet, city.passengerCars);
  assert.equal(after.settings.tripsPerResident, 2);
  assert.equal(after.settings.rain, 100);
  assert.equal(after.time, clock);
  assert.ok(after.closures.has(1));
});

test("invalid city control values stay finite and respect the displayed bounds", () => {
  const sim = simulation();
  sim.setDemand({ population: -5, fleet: Infinity, tripsPerResident: NaN });
  assert.equal(sim.getFrame().settings.population, 0);
  assert.equal(sim.getFrame().settings.fleet, city.passengerCars);
  assert.equal(sim.getFrame().settings.tripsPerResident, 0);
  sim.setDemand({ population: 200000, fleet: 999999, tripsPerResident: 9 });
  const frame = sim.getFrame();
  assert.equal(frame.settings.population, 150000);
  assert.equal(frame.settings.fleet, 120000);
  assert.equal(frame.settings.tripsPerResident, 4);
  assert.ok(Number.isFinite(frame.demand.total));
});

test("city passenger demand stays inside the study area when bus routes continue into rural stops", () => {
  const trip = ["outbound", 0, [[0, 0, 0, 0], [1, 100, 100, 1000], [2, 1000, 1000, 10000]], "1"];
  const transit = { stops: [["City A", 0, 0], ["City B", 1000, 0], ["Rural", 10000, 0]], trips: [trip] };
  const passengers = context.window.gagunTrafficPassengers(transit, () => .99, 5000);
  passengers.reset([0], 0, 0);
  passengers.enqueue(100, 0);
  assert.deepEqual(plain(passengers.report().stopWaiting), [100, 0, 0]);
  const bus = passengers.register(trip, 0);
  passengers.arrive(bus, trip, 0, 0);
  assert.equal(bus.load, 80);
  passengers.arrive(bus, trip, 1, 0);
  assert.equal(bus.load, 0);
  assert.equal(passengers.hasService(120), false);
  assert.equal(passengers.report().created, passengers.report().completed + passengers.report().waiting);
});

test("passengers at a shared stop can board another line that serves their destination", () => {
  const trips = [["line-1", 0, [[0, 0, 0, 0], [1, 100, 100, 1000]], "1"], ["line-2", 0, [[0, 10, 10, 0], [1, 110, 110, 1000]], "2"]];
  const passengers = context.window.gagunTrafficPassengers({ stops: [["A"], ["B"]], trips }, () => 0);
  passengers.reset([0, 1], 0, 0);
  passengers.enqueue(20, 0);
  const bus = passengers.register(trips[1], 0);
  passengers.arrive(bus, trips[1], 0, 0);
  assert.equal(bus.load, 20);
  assert.equal(passengers.report().waiting, 0);
  passengers.arrive(bus, trips[1], 1, 0);
  assert.equal(passengers.report().completed, 20);
});

function cyclingFixture() {
  const data = fixture();
  data.nodes[3] = [1000, 150, 0];
  const edge = (a, b, track) => [a, b, 0, track ? 4 : 2, track ? 0 : 3, 1, 10, [...data.nodes[a].slice(0, 2), ...data.nodes[b].slice(0, 2)], track ? [0, 0, 0] : [1, 1, 7], track ? [[], []] : [[15], [15]], 100 + a * 10 + b, track ? [3, 3, 2, 2, 3, 3] : [3, 0, 0, 0, 3, 3]];
  data.edges = [edge(0, 1, false), edge(1, 2, false), edge(0, 3, true), edge(3, 2, true)];
  return data;
}

test("bikes and scooters prefer connected cycle tracks while cars stay on carriageways", () => {
  const sim = simulation(cyclingFixture());
  assert.deepEqual(plain(sim.route(0, 2, "car")), [0, 2]);
  assert.deepEqual(plain(sim.route(0, 2, "bike")), [4, 6]);
  assert.deepEqual(plain(sim.route(0, 2, "scooter")), [4, 6]);
  sim.setClosures([0, 1], true);
  assert.equal(sim.route(0, 2, "car"), null);
  assert.deepEqual(plain(sim.route(0, 2, "bike")), [4, 6]);
  assert.deepEqual(plain(sim.route(0, 2, "scooter")), [4, 6]);
});

test("rider routing respects directional access and can use permitted walking links", () => {
  const data = cyclingFixture();
  data.edges[2][11] = [1, 1, 2, 0, 0, 0];
  const sim = simulation(data);
  assert.ok(!sim.route(3, 0, "bike").includes(5), "a rider rode against a one-way cycle track");
  assert.ok(!sim.route(3, 0, "scooter").includes(5));
  data.edges[2][11][4] = 2;
  data.edges[3][11][0] = 0;
  data.edges[3][11][4] = 0;
  const withWalking = simulation(data);
  const reverse = withWalking.route(3, 0, "bike");
  assert.deepEqual(plain(reverse), [5], "the only remaining connection requires walking with the bike");
  assert.throws(() => sim.route(0, 2, "aircraft"), /Unsupported travel mode/);
});

test("five modal rates and displayed percentages conserve the trip budget at rounding boundaries", () => {
  const allocation = context.window.gagunTrafficDemand.allocate;
  for (const rate of [0, 1, 2, 3, 5, 13, 17, 111, 1200]) for (const rain of [0, 30, 100]) for (const busAvailable of [true, false]) {
    const p = profile({ ...stockForHourlyRate(rate), dailyCycle: false, rain, busAvailable });
    assert.equal(p.car + p.walk + p.bus + p.bike + p.scooter, p.total);
    assert.ok([p.car, p.walk, p.bus, p.bike, p.scooter].every(n => Number.isInteger(n) && n >= 0));
    assert.equal(plain(allocation(1000, p.shares)).reduce((a, b) => a + b, 0), 1000);
    if (!busAvailable) assert.equal(p.bus, 0);
  }
  assert.ok(profile({ rain: 100 }).bike < profile({ rain: 0 }).bike);
  assert.ok(profile({ rain: 100 }).scooter < profile({ rain: 0 }).scooter);
});

test("batch closures change all requested sections together without resetting current journeys", () => {
  const sim = simulation(fixture(), stockForHourlyRate(900));
  const before = sim.getFrame(), actors = [...before.cars, ...before.pedestrians, ...before.bikes, ...before.scooters];
  const positions = plain(actors.map(a => [a.id, a.x, a.y]));
  assert.equal(sim.setClosures([0, 1, -1, 999, "bad"], true), true);
  const after = sim.getFrame();
  assert.deepEqual(plain([...after.closures].sort()), [0, 1]);
  assert.deepEqual(plain([...after.cars, ...after.pedestrians, ...after.bikes, ...after.scooters].map(a => [a.id, a.x, a.y])), positions);
  assert.equal(after.time, before.time);
  assert.ok(after.rerouted - before.rerouted <= actors.length, "batch change rerouted a traveller repeatedly");
  assert.equal(sim.setClosures([0, 1], true), false);
  assert.equal(sim.setClosures([0, 1], false), true);
  assert.equal(sim.getFrame().closures.size, 0);
});

test("bundled cycling data retain real facilities separately from rider permissions", () => {
  assert.equal(snapshot.version, 4);
  assert.ok(snapshot.cyclingStats.dedicatedTrackMeters > 0);
  assert.ok(snapshot.cyclingStats.paintedLaneMeters > 0);
  for (const edge of snapshot.edges) {
    assert.equal(edge[11].length, 6);
    for (const i of [0, 1, 4, 5]) assert.ok(Number.isInteger(edge[11][i]) && edge[11][i] >= 0 && edge[11][i] <= 3);
    for (const i of [2, 3]) assert.ok(Number.isInteger(edge[11][i]) && edge[11][i] >= 0 && edge[11][i] <= 2);
  }
});

test("real riders respect mapped access through multiple closures with finite coordinates and scooter speed limits", () => {
  const sim = createSimulation(snapshot, { date: "2026-11-12", time: 27000, ...stockForHourlyRate(900) });
  assert.ok(sim.getFrame().bikes.length > 0 && sim.getFrame().scooters.length > 0);
  const before = plain([...sim.getFrame().bikes, ...sim.getFrame().scooters].map(a => [a.id, a.x, a.y]));
  const roads = sim.edges.filter(edge => edge.drive && ["Wojska Polskiego", "Suwalska"].includes(edge.name));
  sim.setClosures(roads.map(edge => edge.id), true);
  for (let minute = 0; minute < 3; minute++) {
    advance(sim, 60);
    const frame = sim.getFrame();
    for (const rider of [...frame.bikes, ...frame.scooters]) {
      assert.ok(Number.isFinite(rider.x) && Number.isFinite(rider.y) && Number.isFinite(rider.speed));
      const arc = rider.path[rider.cursor], edge = snapshot.edges[Math.floor(arc / 2)], bit = arc % 2 ? 2 : 1;
      const field = rider.mode === "bike" ? rider.pushing ? 4 : 0 : rider.pushing ? 5 : 1;
      assert.ok(edge[11][field] & bit, "rider used an unavailable riding/walking direction");
      if (rider.mode === "scooter") assert.ok(rider.speed <= 20 / 3.6 + 1e-9);
      if (rider.pushing) assert.ok(rider.speed <= 1.25 + 1e-9);
    }
  }
  assert.notDeepEqual(plain([...sim.getFrame().bikes, ...sim.getFrame().scooters].map(a => [a.id, a.x, a.y])), before);
  sim.setClosures([...sim.getFrame().closures], false);
  assert.equal(sim.getFrame().closures.size, 0);
});

function eventFixture(edgeId = 1) {
  const data = fixture();
  data.edges.forEach((edge, id) => { edge[3] = id === edgeId ? 2 : 3; });
  data.transit.trips[0][2][1][1] = 450;
  data.transit.trips[0][2][1][2] = 450;
  return data;
}
function firstRoadEvent(sim) {
  for (let seconds = 0; seconds < 3600; seconds++) {
    advance(sim, 1);
    if (sim.getFrame().roadEvents.active.length) return { ...sim.getFrame().roadEvents.active[0] };
  }
  assert.fail("no random road event was generated in an hour at the maximum frequency");
}

test("an accident closes a real section and automatically releases a waiting scheduled bus", () => {
  const sim = simulation(eventFixture(), { accidentRate: 12, accidentMinutes: 1 });
  const event = firstRoadEvent(sim);
  assert.equal(event.type, "accident");
  assert.equal(event.edgeId, 1);
  assert.ok(sim.getFrame().closures.has(1));
  assert.equal(sim.getFrame().manualClosures.size, 0);
  assert.deepEqual(plain(sim.route(0, 2)), [0, 4, 6]);
  sim.setRoadEvents({ accidentRate: 0 });
  advance(sim, 35);
  const before = sim.getFrame().buses[0].progress;
  assert.ok(sim.getFrame().buses[0].waiting);
  assert.ok(before < 1000);
  advance(sim, Math.ceil(event.endsAt - sim.getFrame().time) + 5);
  assert.equal(sim.getFrame().closures.size, 0);
  assert.equal(sim.getFrame().roadEvents.completed, 1);
  assert.deepEqual(plain(sim.route(0, 2)), [0, 2]);
  assert.ok(sim.getFrame().buses[0].progress > before);
});

test("a roadwork timer uses simulated minutes and frequency zero preserves its original end", () => {
  const sim = simulation(eventFixture(), { ...stockForHourlyRate(900), roadworkRate: 4, roadworkMinutes: 5 });
  const event = firstRoadEvent(sim), frame = sim.getFrame();
  assert.equal(event.type, "roadwork");
  assert.equal(event.endsAt - event.startedAt, 300);
  const journeys = plain([...frame.cars, ...frame.pedestrians].map(actor => [actor.id, actor.x, actor.y]));
  assert.ok(journeys.length > 0);
  sim.setRoadEvents({ roadworkRate: 0, roadworkMinutes: 360 });
  assert.equal(sim.getFrame().time, frame.time);
  assert.deepEqual(plain([...sim.getFrame().cars, ...sim.getFrame().pedestrians].map(actor => [actor.id, actor.x, actor.y])), journeys);
  assert.equal(sim.getFrame().roadEvents.active[0].endsAt, event.endsAt);
  for (let i = 0; i < 10; i++) assert.equal(sim.getFrame().roadEvents.active[0].endsAt, event.endsAt);
  advance(sim, Math.floor(event.endsAt - frame.time));
  assert.ok(sim.getFrame().closures.has(1), "the section reopened before the configured duration");
  advance(sim, 1);
  assert.equal(sim.getFrame().closures.size, 0);
  advance(sim, 600);
  assert.equal(sim.getFrame().roadEvents.started, 1);
});

test("manual and timed blocks retain separate ownership on the same section", () => {
  const sim = simulation(eventFixture(), { accidentRate: 12, accidentMinutes: 1 });
  const event = firstRoadEvent(sim);
  sim.setRoadEvents({ accidentRate: 0 });
  assert.equal(sim.setClosure(event.edgeId, true), true);
  sim.setClosure(event.edgeId, false);
  assert.ok(sim.getFrame().closures.has(event.edgeId), "clearing a manual block cancelled the accident");
  sim.setClosure(event.edgeId, true);
  advance(sim, Math.ceil(event.endsAt - sim.getFrame().time));
  assert.equal(sim.getFrame().roadEvents.active.length, 0);
  assert.ok(sim.getFrame().closures.has(event.edgeId), "timer expiry erased a manual block");
  assert.ok(sim.getFrame().manualClosures.has(event.edgeId));
  sim.setClosure(event.edgeId, false);
  assert.equal(sim.getFrame().closures.size, 0);
});

test("ending an event early is idempotent and never removes a separate manual block", () => {
  const sim = simulation(eventFixture(), { accidentRate: 12 });
  const event = firstRoadEvent(sim);
  sim.setClosure(event.edgeId, true);
  assert.equal(sim.finishRoadEvent(event.id), true);
  assert.equal(sim.finishRoadEvent(event.id), false);
  assert.equal(sim.getFrame().roadEvents.completed, 1);
  assert.ok(sim.getFrame().closures.has(event.edgeId));
});

test("time and date changes discard timed events, preserve manual closures and restart future timers", () => {
  const sim = simulation(eventFixture(), { accidentRate: 12, accidentMinutes: 1 });
  firstRoadEvent(sim);
  sim.setClosure(0, true);
  sim.reset({ time: 27000 });
  assert.deepEqual(plain([...sim.getFrame().closures]), [0]);
  assert.equal(sim.getFrame().roadEvents.active.length, 0);
  assert.equal(sim.getFrame().roadEvents.started, 0);
  const event = firstRoadEvent(sim);
  assert.ok(event.startedAt > 27000, "a clock reset replayed events from the skipped hours");
  sim.reset({ date: "2026-11-13" });
  assert.deepEqual(plain([...sim.getFrame().closures]), [0]);
  assert.equal(sim.getFrame().roadEvents.active.length, 0);
  assert.equal(sim.getFrame().roadEvents.settings.accidentRate, 12);
});

test("random event times are reproducible and independent of playback step size", () => {
  const create = () => {
    const events = context.window.gagunTrafficRoadEvents.create(Array.from({ length: 40 }, (_, id) => ({ id, length: 100 + id })));
    events.reset(1000, { accidentRate: 12, roadworkRate: 4, accidentMinutes: 30, roadworkMinutes: 60 });
    return events;
  };
  const fine = create(), coarse = create();
  for (let at = 1001; at <= 5000; at++) fine.advance(at, id => fine.closedEdges.has(id));
  coarse.advance(5000, id => coarse.closedEdges.has(id));
  assert.deepEqual(plain(fine.getState()), plain(coarse.getState()));
  assert.ok(fine.getState().started > 5);
  assert.equal(new Set(fine.getState().active.map(event => event.edgeId)).size, fine.getState().active.length);
  assert.ok(fine.getState().active.some(event => event.type === "accident"));
  assert.ok(fine.getState().active.some(event => event.type === "roadwork"));
  fine.reset(1000);
  fine.advance(5000, id => fine.closedEdges.has(id));
  assert.deepEqual(plain(fine.getState()), plain(coarse.getState()));
});

test("event controls stay finite and a fully closed network produces no phantom events", () => {
  const sim = simulation(eventFixture(), { accidentRate: 12 });
  sim.setRoadEvents({ accidentRate: Infinity, accidentMinutes: -50, roadworkRate: 500, roadworkMinutes: NaN });
  assert.deepEqual(plain(sim.getFrame().roadEvents.settings), { accidentRate: 12, accidentMinutes: 1, roadworkRate: 4, roadworkMinutes: 90 });
  sim.setClosure(1, true);
  advance(sim, 3600);
  assert.equal(sim.getFrame().roadEvents.started, 0);
  assert.deepEqual(plain([...sim.getFrame().closures]), [1]);
});

test("real random event locations stay on public carriageways within the five-kilometre study area", () => {
  const sim = createSimulation(snapshot, { date: "2026-11-12", time: 27000, population: 0, fleet: 0, accidentRate: 12, roadworkRate: 4, accidentMinutes: 1, roadworkMinutes: 5 });
  const event = firstRoadEvent(sim), edge = sim.edges[event.edgeId];
  assert.ok(sim.getFrame().roadEvents.eligibleSections > 100);
  assert.ok(edge.drive && edge.kind <= 2 && edge.length >= 15);
  const point = sim.positionOnArc({ edge, reverse: false }, edge.length / 2);
  assert.ok(Math.hypot(point.x, point.y) <= 5000);
  sim.setRoadEvents({ accidentRate: 0, roadworkRate: 0 });
  advance(sim, Math.ceil(event.endsAt - sim.getFrame().time));
  assert.ok(!sim.getFrame().closures.has(event.edgeId));
});
