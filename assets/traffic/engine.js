window.gagunTraffic = (() => {
  let dataPromise;

  function loadData() {
    if (window.gagunTrafficData) return Promise.resolve(window.gagunTrafficData);
    if (!dataPromise) {
      dataPromise = new Promise((resolve, reject) => {
        const script = document.createElement("script");
        script.src = "assets/traffic/elk-data.js?v=4";
        script.onload = () => resolve(window.gagunTrafficData);
        script.onerror = () => {
          script.remove();
          dataPromise = null;
          reject(new Error("Traffic data unavailable"));
        };
        document.head.append(script);
      });
    }
    return dataPromise;
  }

  class Heap {
    items = [];
    push(value, priority) {
      const item = { value, priority };
      let i = this.items.length;
      this.items.push(item);
      while (i > 0) {
        const parent = (i - 1) >> 1;
        if (this.items[parent].priority <= priority) break;
        this.items[i] = this.items[parent];
        i = parent;
      }
      this.items[i] = item;
    }
    pop() {
      const first = this.items[0];
      const last = this.items.pop();
      if (this.items.length) {
        let i = 0;
        while (i * 2 + 1 < this.items.length) {
          let child = i * 2 + 1;
          if (child + 1 < this.items.length && this.items[child + 1].priority < this.items[child].priority) child++;
          if (this.items[child].priority >= last.priority) break;
          this.items[i] = this.items[child];
          i = child;
        }
        this.items[i] = last;
      }
      return first.value;
    }
  }

  function componentPool(adjacency, arcs, nodes) {
    const reverse = nodes.map(() => []);
    arcs.forEach(a => { if (a) reverse[a.to].push(a.from); });
    const visited = new Set(), order = [];
    for (let start = 0; start < nodes.length; start++) {
      if (visited.has(start) || !adjacency[start].length) continue;
      const stack = [[start, 0]];
      visited.add(start);
      while (stack.length) {
        const top = stack[stack.length - 1];
        if (top[1] < adjacency[top[0]].length) {
          const to = arcs[adjacency[top[0]][top[1]++]].to;
          if (!visited.has(to)) { visited.add(to); stack.push([to, 0]); }
        } else { order.push(top[0]); stack.pop(); }
      }
    }
    visited.clear();
    let largest = [];
    for (const start of order.reverse()) {
      if (visited.has(start)) continue;
      const group = [], stack = [start];
      visited.add(start);
      while (stack.length) {
        const n = stack.pop();
        group.push(n);
        for (const v of reverse[n]) if (!visited.has(v)) { visited.add(v); stack.push(v); }
      }
      if (group.length > largest.length) largest = group;
    }
    return largest.filter(i => Math.hypot(nodes[i][0], nodes[i][1]) <= 4900);
  }

  function createSimulation(data, options = {}) {
    if (data.version !== 4 || !data.nodes.length || !data.edges.length) throw new Error("Unsupported traffic snapshot");
    const nodes = data.nodes;
    const roadArcs = [], footArcs = [], bikeArcs = [], scooterArcs = [];
    const roadAdj = nodes.map(() => []), footAdj = nodes.map(() => []), bikeAdj = nodes.map(() => []), scooterAdj = nodes.map(() => []);
    const graphs = { car: { arcs: roadArcs, adjacency: roadAdj }, pedestrian: { arcs: footArcs, adjacency: footAdj }, bike: { arcs: bikeArcs, adjacency: bikeAdj }, scooter: { arcs: scooterArcs, adjacency: scooterAdj } };
    const edges = data.edges.map((e, id) => {
      const cumulative = [0];
      for (let j = 2; j < e[7].length; j += 2) cumulative.push(cumulative.at(-1) + Math.hypot(e[7][j] - e[7][j - 2], e[7][j + 1] - e[7][j - 1]));
      const edge = { id, from: e[0], to: e[1], name: data.names[e[2]], kind: e[3], drive: e[4], walk: Boolean(e[5]), speed: e[6], points: e[7], cumulative, length: cumulative.at(-1), lanes: e[8].slice(0, 2), laneSource: e[8][2], shared: Boolean(e[8][2] & 16), osmId: e[10], cycling: e[11] };
      edge.width = (edge.shared ? 1 : Math.max(1, edge.lanes[0] + edge.lanes[1])) * 3.3;
      for (let direction = 0; direction < 2; direction++) {
        const bit = direction ? 2 : 1;
        const arc = { id: id * 2 + direction, edge, from: e[direction ? 1 : 0], to: e[direction ? 0 : 1], reverse: Boolean(direction), length: edge.length, laneIndices: Array.from({ length: e[8][direction] }, (_, i) => i), turnLanes: e[9][direction], facility: e[11][2 + direction], bikeRide: Boolean(e[11][0] & bit), scooterRide: Boolean(e[11][1] & bit), bikePush: Boolean(e[11][4] & bit), scooterPush: Boolean(e[11][5] & bit) };
        arc.allTurns = arc.turnLanes.every(mask => mask === 15);
        if (e[4] & (direction ? 2 : 1)) { roadArcs[arc.id] = arc; roadAdj[arc.from].push(arc.id); }
        if (e[5]) { footArcs[arc.id] = arc; footAdj[arc.from].push(arc.id); }
        if (arc.bikeRide || arc.bikePush) { bikeArcs[arc.id] = arc; bikeAdj[arc.from].push(arc.id); }
        if (arc.scooterRide || arc.scooterPush) { scooterArcs[arc.id] = arc; scooterAdj[arc.from].push(arc.id); }
      }
      return edge;
    });
    const turnBans = new Map();
    for (const [a, b] of data.turns) {
      if (!turnBans.has(a)) turnBans.set(a, new Set());
      turnBans.get(a).add(b);
    }
    const pools = Object.fromEntries(Object.entries(graphs).map(([mode, graph]) => {
      const pool = componentPool(graph.adjacency, graph.arcs, nodes);
      if (mode === "car" || mode === "pedestrian") return [mode, pool];
      const ridingNodes = pool.filter(node => graph.adjacency[node].some(id => graph.arcs[id][`${mode}Ride`]));
      return [mode, ridingNodes.length > 1 ? ridingNodes : pool];
    }));
    const closures = new Set(), manualClosures = new Set();
    const eventCandidates = edges.filter(edge => {
      if (!edge.drive || edge.kind > 2 || edge.length < 15) return false;
      const point = positionOnArc({ edge, reverse: false }, edge.length / 2);
      return Math.hypot(point.x, point.y) <= (data.radius || 5000);
    });
    const roadEvents = window.gagunTrafficRoadEvents.create(eventCandidates);
    let cars = [], pedestrians = [], bikes = [], scooters = [], buses = [], schedule = [], nextDeparture = 0, lineTrips = {};
    let time = 27000, date = "2026-11-12", seed = 12026, rerouted = 0, completed = 0, routingVersion = 0, actorId = 0;
    const settings = { ...window.gagunTrafficDemand.defaults, rain: 0, dailyCycle: true };
    const sceneLimits = { car: 1600, pedestrian: 2000, bike: 600, scooter: 400 };
    const emptyCounts = () => ({ car: 0, pedestrian: 0, bike: 0, scooter: 0, bus: 0 });
    let demand, profileAt = -Infinity, credits = emptyCounts(), started = emptyCounts();
    const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
    const passengers = window.gagunTrafficPassengers(data.transit, random, data.radius);

    function allowedLanes(id, next) {
      const arc = roadArcs[id];
      if (next === undefined || arc.allTurns) return arc.laneIndices;
      const a = positionOnArc(arc, arc.length), b = positionOnArc(roadArcs[next], 0);
      const angle = Math.atan2(Math.sin(b.angle - a.angle), Math.cos(b.angle - a.angle));
      const turn = Math.abs(angle) > 2.5 ? 8 : angle > .4 ? 4 : angle < -.4 ? 1 : 2;
      return arc.laneIndices.filter(lane => arc.turnLanes[lane] & turn);
    }
    function refreshDemand() {
      demand = window.gagunTrafficDemand.profile({ ...settings, time, date, busAvailable: passengers.hasService(time) });
      profileAt = time;
    }
    function updateSettings(changes) {
      for (const [key, [min, max]] of Object.entries(window.gagunTrafficDemand.bounds)) {
        if (changes[key] === undefined) continue;
        const value = Number(changes[key]);
        if (Number.isFinite(value)) settings[key] = Math.max(min, Math.min(max, key === "population" || key === "fleet" ? Math.round(value) : value));
      }
      if (changes.dailyCycle !== undefined) settings.dailyCycle = Boolean(changes.dailyCycle);
    }
    function setDemand(changes) {
      updateSettings(changes);
      refreshDemand();
    }

    function riding(arc, mode, escapeEdge = -1) {
      return arc[`${mode}Ride`] && (!closures.has(arc.edge.id) || !arc.edge.drive || arc.facility === 2 || arc.edge.id === escapeEdge);
    }
    function travelSpeed(arc, mode, escapeEdge = -1) {
      if (mode === "car") return arc.edge.speed;
      if (mode === "pedestrian") return 1.35;
      if (riding(arc, mode, escapeEdge)) return mode === "bike" ? (arc.facility || arc.edge.drive ? 5.2 : 3.5) : 4.7;
      return arc[`${mode}Push`] ? 1.25 : 0;
    }
    function roadRider(arc, mode, escapeEdge = -1) {
      return Boolean(arc.edge.drive && arc.facility === 0 && riding(arc, mode, escapeEdge));
    }
    function riderLimit(rider, arc) {
      const isRiding = riding(arc, rider.mode, rider.escapeEdge);
      const weather = isRiding ? 1 - (rider.mode === "bike" ? .25 : .35) * demand.wet : 1 - .1 * demand.wet;
      return Math.min(rider.mode === "scooter" ? 20 / 3.6 : 7, travelSpeed(arc, rider.mode, rider.escapeEdge) * (isRiding ? rider.desired : 1) * weather);
    }

    function route(from, to, mode = "car", incoming = -1) {
      if (from === to) return [];
      const graph = graphs[mode];
      if (!graph) throw new Error("Unsupported travel mode");
      const { adjacency, arcs } = graph;
      const frontier = new Heap();
      const costs = new Map([[incoming, 0]]), previous = new Map();
      frontier.push({ key: incoming, node: from, cost: 0 }, 0);
      while (frontier.items.length) {
        const current = frontier.pop();
        if (current.cost !== costs.get(current.key)) continue;
        if (current.node === to) {
          const result = [];
          let key = current.key;
          while (key !== incoming) { result.push(key); key = previous.get(key); }
          return result.reverse();
        }
        for (const id of adjacency[current.node]) {
          const arc = arcs[id];
          if (mode === "car" && (closures.has(arc.edge.id) || turnBans.get(current.key)?.has(id))) continue;
          if (mode === "car" && current.key >= 0 && !allowedLanes(current.key, id).length) continue;
          const speed = travelSpeed(arc, mode);
          if (!speed) continue;
          const micro = mode === "bike" || mode === "scooter";
          if (micro && current.key >= 0 && turnBans.get(current.key)?.has(id) && roadRider(arcs[current.key], mode) && roadRider(arc, mode)) continue;
          const preference = micro ? (riding(arc, mode) ? (arc.facility ? 1 : arc.edge.speed > 14 ? 1.8 : 1.25) : 1.2) : 1;
          const cost = current.cost + arc.length / speed * preference;
          if (cost >= (costs.get(id) ?? Infinity)) continue;
          costs.set(id, cost); previous.set(id, current.key);
          const destination = nodes[arc.to], target = nodes[to];
          const heuristic = Math.hypot(destination[0] - target[0], destination[1] - target[1]) / (mode === "car" ? 40 : mode === "pedestrian" ? 1.35 : 7);
          frontier.push({ key: id, node: arc.to, cost }, cost + heuristic);
        }
      }
      return null;
    }

    function positionOnArc(arc, distance, lateral = 0) {
      const edge = arc.edge;
      const along = Math.max(0, Math.min(edge.length, arc.reverse ? edge.length - distance : distance));
      let lo = 0, hi = edge.cumulative.length - 1;
      while (lo + 1 < hi) { const mid = (lo + hi) >> 1; if (edge.cumulative[mid] <= along) lo = mid; else hi = mid; }
      const x = edge.points[lo * 2], y = edge.points[lo * 2 + 1];
      const dx = edge.points[hi * 2] - x, dy = edge.points[hi * 2 + 1] - y;
      const length = Math.hypot(dx, dy) || 1;
      const fraction = (along - edge.cumulative[lo]) / (edge.cumulative[hi] - edge.cumulative[lo] || 1);
      const sign = arc.reverse ? -1 : 1;
      return { x: x + dx * fraction - dy / length * lateral * sign, y: y + dy * fraction + dx / length * lateral * sign, angle: Math.atan2(dy * sign, dx * sign) };
    }

    function chooseJourney(mode) {
      const pool = pools[mode];
      for (let attempt = 0; attempt < 15; attempt++) {
        const origin = pool[Math.floor(random() * pool.length)];
        const destination = pool[Math.floor(random() * pool.length)];
        if (origin === undefined || destination === undefined) continue;
        const distance = Math.hypot(nodes[origin][0] - nodes[destination][0], nodes[origin][1] - nodes[destination][1]);
        if (distance < (mode === "car" ? 600 : mode === "bike" ? 400 : mode === "scooter" ? 300 : 180)) continue;
        if (distance > (mode === "car" ? Infinity : mode === "pedestrian" ? 1800 : mode === "bike" ? 4000 : 3000)) continue;
        const path = route(origin, destination, mode);
        if (path?.length) return { id: actorId++, mode, path, cursor: 0, distance: 0, speed: 0, destination, desired: mode === "car" ? .8 + random() * .2 : mode === "pedestrian" ? 1.05 + random() * .55 : .85 + random() * .25, waiting: false, lane: 0, escapeEdge: -1 };
      }
      return null;
    }

    function arcFor(agent) { return graphs[agent.mode].arcs[agent.path[agent.cursor]]; }
    function listFor(mode) { return mode === "car" ? cars : mode === "pedestrian" ? pedestrians : mode === "bike" ? bikes : scooters; }
    function place(agent) {
      const arc = arcFor(agent);
      let offset;
      if (agent.mode === "car") offset = arc.edge.shared ? 0 : arc.edge.width / 2 - (agent.lane + .5) * 3.3;
      else if (agent.mode === "pedestrian") offset = arc.edge.kind < 4 ? arc.edge.width / 2 + (arc.facility ? 3 : 1.1) : .7;
      else {
        agent.pushing = !riding(arc, agent.mode, agent.escapeEdge);
        offset = !arc.edge.drive ? .55 : agent.pushing ? arc.edge.width / 2 + (arc.facility ? 3 : 1.1) : arc.facility ? arc.edge.width / 2 + (arc.facility === 2 ? 2 : .7) : arc.edge.shared ? 0 : arc.edge.width / 2 - .55;
      }
      agent.lateral = agent.lateral === undefined ? offset : agent.lateral + (offset - agent.lateral) * .4;
      Object.assign(agent, positionOnArc(arc, agent.distance, agent.lateral));
    }
    function spawnActor(mode, warm = false) {
      const list = listFor(mode);
      if (list.length >= (mode === "car" ? Math.min(settings.fleet, sceneLimits.car) : sceneLimits[mode])) return false;
      const actor = chooseJourney(mode);
      if (!actor) return false;
      if (warm) actor.cursor = Math.floor(random() * actor.path.length);
      const arc = arcFor(actor);
      actor.distance = warm ? random() * arc.length : 0;
      if (mode === "car") {
        const lanes = allowedLanes(arc.id, actor.path[actor.cursor + 1]);
        const available = lanes.filter(lane => !cars.some(other => {
          const otherArc = arcFor(other);
          return (otherArc.id === arc.id && other.lane === lane && Math.abs(other.distance - actor.distance) < 13) || (arc.edge.shared && otherArc.edge === arc.edge && otherArc.reverse !== arc.reverse);
        }) && !buses.some(bus => bus.arc === arc.id && lane === 0 && Math.abs(bus.roadPosition - actor.distance) < 20));
        if (!available.length) return false;
        actor.lane = available[Math.floor(random() * available.length)];
        actor.speed = warm ? arc.edge.speed * actor.desired * .6 : 0;
      } else if (mode === "bike" || mode === "scooter") {
        if (riding(arc, mode)) {
          const sharedRoad = roadRider(arc, mode);
          const others = sharedRoad ? [...cars, ...bikes, ...scooters] : [...bikes, ...scooters];
          if (others.some(other => {
            const otherArc = arcFor(other);
            const sameLane = other.mode === "car" ? other.lane === 0 : riding(otherArc, other.mode, other.escapeEdge) && roadRider(otherArc, other.mode, other.escapeEdge) === sharedRoad;
            return sameLane && ((otherArc.id === arc.id && Math.abs(other.distance - actor.distance) < (sharedRoad ? 10 : 6)) || (sharedRoad && arc.edge.shared && otherArc.edge === arc.edge && otherArc.reverse !== arc.reverse));
          }) || (sharedRoad && buses.some(bus => bus.arc === arc.id && Math.abs(bus.roadPosition - actor.distance) < 18))) return false;
        }
        actor.speed = warm ? travelSpeed(arc, mode) * actor.desired * .6 : 0;
      }
      place(actor); list.push(actor);
      return true;
    }
    function createNewTrips(dt) {
      credits.car += demand.car * dt / 3600;
      credits.pedestrian += demand.walk * dt / 3600;
      credits.bike += demand.bike * dt / 3600;
      credits.scooter += demand.scooter * dt / 3600;
      credits.bus += demand.bus * dt / 3600;
      for (const mode of ["car", "pedestrian", "bike", "scooter"]) {
        for (let count = 0; count < 2 && credits[mode] >= 1; count++) {
          if (!spawnActor(mode)) break;
          credits[mode]--; started[mode]++;
        }
      }
      const count = Math.floor(credits.bus);
      if (count) { passengers.enqueue(count, time); credits.bus -= count; started.bus += count; }
    }

    function shapePosition(shape, progress) {
      let lo = 0, hi = shape.length - 1;
      while (lo + 1 < hi) { const m = (lo + hi) >> 1; if (shape[m][2] <= progress) lo = m; else hi = m; }
      const a = shape[lo], b = shape[hi];
      const f = Math.max(0, Math.min(1, (progress - a[2]) / (b[2] - a[2] || 1)));
      const mapped = f < .5 ? a : b;
      const x = a[0] + (b[0] - a[0]) * f, y = a[1] + (b[1] - a[1]) * f;
      const arc = roadArcs[mapped[3]];
      let roadPosition = 0, bestDistance = Infinity;
      if (arc) for (let i = 0; i < arc.edge.points.length - 2; i += 2) {
        const points = arc.edge.points, dx = points[i + 2] - points[i], dy = points[i + 3] - points[i + 1];
        const fraction = Math.max(0, Math.min(1, ((x - points[i]) * dx + (y - points[i + 1]) * dy) / (dx * dx + dy * dy || 1)));
        const distance = Math.hypot(x - points[i] - dx * fraction, y - points[i + 1] - dy * fraction);
        if (distance < bestDistance) {
          bestDistance = distance;
          const position = arc.edge.cumulative[i / 2] + fraction * Math.hypot(dx, dy);
          roadPosition = arc.reverse ? arc.length - position : position;
        }
      }
      const angle = Math.atan2(b[1] - a[1], b[0] - a[0]);
      const lateral = arc && !arc.edge.shared ? arc.edge.width / 2 - 1.65 : 0;
      return { x: x - Math.sin(angle) * lateral, y: y + Math.cos(angle) * lateral, angle, segment: lo, arc: mapped[3], roadPosition };
    }
    function scheduledProgress(trip, clock) {
      const stops = trip[2];
      if (clock <= stops[0][2]) return 0;
      for (let i = 1; i < stops.length; i++) {
        const previous = stops[i - 1], next = stops[i];
        const arrival = Math.max(previous[2] + 1, next[1] - (i < stops.length - 1 ? 5 : 0));
        if (clock <= next[2]) return previous[3] + (next[3] - previous[3]) * Math.max(0, Math.min(1, (clock - previous[2]) / (arrival - previous[2])));
      }
      return stops.at(-1)[3];
    }
    function spawnBuses(warm = false) {
      const activeCount = warm ? schedule.filter(i => data.transit.trips[i][2][0][2] <= time && data.transit.trips[i][2].at(-1)[1] >= time).length : 0;
      while (nextDeparture < schedule.length && data.transit.trips[schedule[nextDeparture]][2][0][2] <= time) {
        const tripIndex = schedule[nextDeparture++], trip = data.transit.trips[tripIndex];
        if (trip[2].at(-1)[1] < time) continue;
        const progress = scheduledProgress(trip, time);
        const bus = { tripIndex, trip, lineId: trip[3], shape: data.transit.shapes[trip[1]], progress, delay: 0, escapeEdge: -1, waiting: false, dwellUntil: 0, lane: 0, nextStop: Math.max(0, trip[2].findIndex(s => s[3] >= progress - .1)), ...shapePosition(data.transit.shapes[trip[1]], progress) };
        bus.passengers = passengers.register(trip, progress, warm ? demand.bus / 3 / Math.max(1, activeCount) : 0);
        if (progress < .1) { bus.dwellUntil = time + passengers.arrive(bus.passengers, trip, 0, demand.wet); bus.nextStop = 1; }
        buses.push(bus);
      }
    }
    function reset(overrides = {}) {
      const nextDate = overrides.date ?? date;
      if (!Object.hasOwn(data.transit.dates, nextDate)) throw new Error("Date outside timetable snapshot");
      date = nextDate;
      time = Math.max(0, Math.min(86399, overrides.time ?? time));
      seed = 12026; rerouted = 0; completed = 0;
      actorId = 0; credits = emptyCounts(); started = emptyCounts();
      updateSettings(overrides);
      cars = []; pedestrians = []; bikes = []; scooters = []; buses = []; nextDeparture = 0;
      roadEvents.reset(time, overrides); syncClosures();
      schedule = [...data.transit.dates[date]].sort((a, b) => data.transit.trips[a][2][0][2] - data.transit.trips[b][2][0][2]);
      lineTrips = Object.fromEntries(data.transit.lines.map(line => [line.id, 0]));
      for (const id of schedule) lineTrips[data.transit.trips[id][3]]++;
      passengers.reset(schedule, time, 0); refreshDemand();
      passengers.enqueue(Math.round(demand.bus / 6), time);
      for (const [mode, count] of [["car", Math.min(settings.fleet, sceneLimits.car, Math.round(demand.car * 8 / 60))], ["pedestrian", Math.min(sceneLimits.pedestrian, Math.round(demand.walk * 18 / 60))], ["bike", Math.min(sceneLimits.bike, Math.round(demand.bike * 12 / 60))], ["scooter", Math.min(sceneLimits.scooter, Math.round(demand.scooter * 10 / 60))]]) {
        for (let i = 0, attempts = 0; i < count && attempts < count * 4; attempts++) if (spawnActor(mode, true)) i++;
      }
      spawnBuses(true);
      for (const bus of buses) {
        const edgeId = Math.floor(bus.shape[bus.segment][3] / 2);
        if (closures.has(edgeId)) bus.escapeEdge = edgeId;
      }
    }
    function syncClosures() {
      const next = new Set([...manualClosures, ...roadEvents.closedEdges]);
      const added = new Set([...next].filter(id => !closures.has(id)));
      const removed = [...closures].filter(id => !next.has(id));
      if (!added.size && !removed.length) return;
      closures.clear();
      for (const id of next) closures.add(id);
      routingVersion++;
      for (const bus of buses) if (added.size) {
        const current = Math.floor(bus.arc / 2), sample = Math.floor(bus.shape[bus.segment][3] / 2);
        if (added.has(current)) bus.escapeEdge = current;
        else if (added.has(sample)) bus.escapeEdge = sample;
      }
      for (const actor of [...cars, ...bikes, ...scooters]) {
        const arc = arcFor(actor);
        if (added.has(arc.edge.id)) actor.escapeEdge = arc.edge.id;
        if (!actor.path.slice(actor.cursor + 1).some(id => closures.has(Math.floor(id / 2)))) continue;
        const replacement = route(arc.to, actor.destination, actor.mode, arc.id);
        if (replacement) { actor.path = [arc.id, ...replacement]; actor.cursor = 0; rerouted++; }
        actor.blockedVersion = routingVersion;
      }
    }
    function setClosures(edgeIds, closed) {
      let changed = false;
      for (const id of edgeIds) {
        if (!Number.isInteger(id) || !edges[id]?.drive || manualClosures.has(id) === closed) continue;
        if (closed) manualClosures.add(id); else manualClosures.delete(id);
        changed = true;
      }
      if (!changed) return false;
      syncClosures();
      return true;
    }
    function setClosure(edgeId, closed) { return setClosures([edgeId], closed); }
    function setRoadEvents(changes) { roadEvents.configure(changes, time); }
    function finishRoadEvent(id) {
      if (!roadEvents.finish(id)) return false;
      syncClosures();
      return true;
    }

    function advance(dt) {
      if (time >= 86399) return;
      dt = Math.min(dt, 86399 - time);
      time += dt;
      if (roadEvents.advance(time, id => manualClosures.has(id) || roadEvents.closedEdges.has(id))) syncClosures();
      if (time - profileAt >= 1) refreshDemand();
      spawnBuses();
      createNewTrips(dt);
      const lanes = new Map(), cycleLanes = new Map();
      const laneKey = (arc, lane) => `${arc}:${lane}`;
      function occupy(arc, lane, distance, length, owner) {
        if (arc < 0) return;
        const key = laneKey(arc, lane);
        if (!lanes.has(key)) lanes.set(key, []);
        lanes.get(key).push({ distance, length, owner });
      }
      for (const car of cars) occupy(car.path[car.cursor], car.lane, car.distance, 4.5, car);
      for (const bus of buses) occupy(bus.arc, 0, bus.roadPosition, 12, bus);
      for (const rider of [...bikes, ...scooters]) {
        const arc = arcFor(rider);
        if (!riding(arc, rider.mode, rider.escapeEdge)) continue;
        if (roadRider(arc, rider.mode, rider.escapeEdge)) occupy(arc.id, 0, rider.distance, 2, rider);
        else {
          if (!cycleLanes.has(arc.id)) cycleLanes.set(arc.id, []);
          cycleLanes.get(arc.id).push({ distance: rider.distance, length: 2, owner: rider });
        }
      }
      const leaders = new Map();
      for (const lane of [...lanes.values(), ...cycleLanes.values()]) {
        lane.sort((a, b) => a.distance - b.distance);
        for (let i = 0; i + 1 < lane.length; i++) leaders.set(lane[i].owner, lane[i + 1]);
      }
      const junctions = new Map();
      const sharedAdmissions = new Map();
      function nextLane(id, following, preference) {
        const available = allowedLanes(id, following);
        return available.reduce((best, lane) => {
          const gap = lanes.get(laneKey(id, lane))?.[0]?.distance ?? Infinity;
          const bestGap = lanes.get(laneKey(id, best))?.[0]?.distance ?? Infinity;
          return gap > bestGap || (gap === bestGap && lane === preference % roadArcs[id].laneIndices.length) ? lane : best;
        }, available[0]);
      }
      for (const car of cars) {
        const arc = arcFor(car), remaining = arc.length - car.distance;
        const nextId = car.path[car.cursor + 1];
        let gap = Infinity;
        const leader = leaders.get(car);
        if (leader) gap = leader.distance - car.distance - leader.length;
        let entryLane = 0;
        if (nextId !== undefined) {
          if (closures.has(Math.floor(nextId / 2))) {
            if (car.blockedVersion !== routingVersion) {
              const replacement = route(arc.to, car.destination, "car", arc.id);
              if (replacement) { car.path = [arc.id, ...replacement]; car.cursor = 0; rerouted++; }
              car.blockedVersion = routingVersion;
            }
            if (closures.has(Math.floor(car.path[car.cursor + 1] / 2))) gap = Math.min(gap, remaining - 3);
          }
          const upcoming = car.path[car.cursor + 1];
          entryLane = nextLane(upcoming, car.path[car.cursor + 2], car.id);
          const nextQueue = lanes.get(laneKey(upcoming, entryLane));
          if (nextQueue?.length) gap = Math.min(gap, remaining + nextQueue[0].distance - nextQueue[0].length);
          if (roadArcs[upcoming].edge.shared && (lanes.get(laneKey(upcoming ^ 1, 0))?.length || (sharedAdmissions.has(Math.floor(upcoming / 2)) && sharedAdmissions.get(Math.floor(upcoming / 2)) !== upcoming))) gap = Math.min(gap, remaining - 3);
          const turnLanes = allowedLanes(arc.id, upcoming);
          if (!turnLanes.includes(car.lane)) {
            const free = turnLanes.find(lane => !(lanes.get(laneKey(arc.id, lane)) || []).some(vehicle => Math.abs(vehicle.distance - car.distance) < 16));
            if (free !== undefined) car.lane = free;
            else gap = Math.min(gap, remaining - 3);
          }
        }
        if (nodes[arc.to][2]) {
          const end = positionOnArc(arc, arc.length);
          const vertical = Math.abs(Math.sin(end.angle)) > .7;
          const phase = (time + arc.to % 7) % 60;
          if (!(vertical ? phase >= 30 && phase < 55 : phase < 25)) gap = Math.min(gap, remaining - 3);
        }
        const limit = arc.edge.speed * car.desired * (1 - .2 * demand.wet);
        const desiredGap = 3 + car.speed * (1.3 + .7 * demand.wet);
        const acceleration = 1.5 * (1 - (car.speed / Math.max(1, limit)) ** 4 - (desiredGap / Math.max(.1, gap)) ** 2);
        car.speed = Math.max(0, Math.min(limit, car.speed + Math.max(-6, acceleration) * dt));
        let movement = Math.min(car.speed * dt, Math.max(0, gap - 2));
        if (movement >= remaining && (junctions.has(arc.to) || (car.path[car.cursor + 1] !== undefined && closures.has(Math.floor(car.path[car.cursor + 1] / 2))))) movement = Math.max(0, remaining - 2);
        if (movement >= remaining) {
          junctions.set(arc.to, true);
          if (car.path[car.cursor + 1] !== undefined && roadArcs[car.path[car.cursor + 1]].edge.shared) sharedAdmissions.set(Math.floor(car.path[car.cursor + 1] / 2), car.path[car.cursor + 1]);
        }
        car.waiting = movement < .1;
        car.distance += movement;
        if (car.distance >= arc.length) {
          const overflow = car.distance - arc.length;
          if (car.cursor + 1 < car.path.length) { car.cursor++; car.lane = entryLane; car.distance = Math.min(overflow, arcFor(car).length * .9); }
          else { car.finished = true; completed++; car.distance = arc.length; }
        }
        place(car);
      }
      for (const pedestrian of pedestrians) {
        const arc = arcFor(pedestrian);
        pedestrian.distance += pedestrian.desired * (1 - .1 * demand.wet) * dt;
        if (pedestrian.distance >= arc.length) {
          const overflow = pedestrian.distance - arc.length;
          if (pedestrian.cursor + 1 < pedestrian.path.length) { pedestrian.cursor++; pedestrian.distance = Math.min(overflow, arcFor(pedestrian).length * .9); }
          else { pedestrian.finished = true; pedestrian.distance = arc.length; completed++; }
        }
        place(pedestrian);
      }
      for (const rider of [...bikes, ...scooters]) {
        const arc = arcFor(rider), remaining = arc.length - rider.distance;
        if (rider.escapeEdge !== arc.edge.id) rider.escapeEdge = -1;
        let upcoming = rider.path[rider.cursor + 1];
        if (upcoming !== undefined && !travelSpeed(graphs[rider.mode].arcs[upcoming], rider.mode) && rider.blockedVersion !== routingVersion) {
          const replacement = route(arc.to, rider.destination, rider.mode, arc.id);
          if (replacement) { rider.path = [arc.id, ...replacement]; rider.cursor = 0; rerouted++; }
          rider.blockedVersion = routingVersion; upcoming = rider.path[rider.cursor + 1];
        }
        const isRiding = riding(arc, rider.mode, rider.escapeEdge);
        let gap = Infinity;
        const leader = isRiding ? leaders.get(rider) : null;
        if (leader) gap = leader.distance - rider.distance - leader.length;
        let nextRoad = false;
        if (upcoming !== undefined) {
          const next = graphs[rider.mode].arcs[upcoming];
          if (!travelSpeed(next, rider.mode)) gap = Math.min(gap, remaining - 1.5);
          nextRoad = roadRider(next, rider.mode);
          const queue = nextRoad ? lanes.get(laneKey(upcoming, 0)) : riding(next, rider.mode) ? cycleLanes.get(upcoming) : null;
          if (queue?.length) gap = Math.min(gap, remaining + queue[0].distance - queue[0].length);
          if (nextRoad && next.edge.shared && (lanes.get(laneKey(upcoming ^ 1, 0))?.length || (sharedAdmissions.has(next.edge.id) && sharedAdmissions.get(next.edge.id) !== upcoming))) gap = Math.min(gap, remaining - 1.5);
        }
        if (isRiding && nodes[arc.to][2]) {
          const end = positionOnArc(arc, arc.length), vertical = Math.abs(Math.sin(end.angle)) > .7;
          const phase = (time + arc.to % 7) % 60;
          if (!(vertical ? phase >= 30 && phase < 55 : phase < 25)) gap = Math.min(gap, remaining - 1.5);
        }
        const limit = riderLimit(rider, arc);
        const desiredGap = 2 + rider.speed * (.8 + .5 * demand.wet);
        const acceleration = 1.2 * (1 - (rider.speed / Math.max(.1, limit)) ** 4 - (desiredGap / Math.max(.1, gap)) ** 2);
        rider.speed = Math.max(0, Math.min(limit, rider.speed + Math.max(-5, acceleration) * dt));
        let movement = Math.min(rider.speed * dt, Math.max(0, gap - 1));
        if (movement >= remaining && isRiding && junctions.has(arc.to)) movement = Math.max(0, remaining - 1);
        if (movement >= remaining && isRiding) junctions.set(arc.to, true);
        if (movement >= remaining && nextRoad && graphs[rider.mode].arcs[upcoming].edge.shared) sharedAdmissions.set(Math.floor(upcoming / 2), upcoming);
        rider.waiting = movement < .05; rider.distance += movement;
        if (rider.distance >= arc.length) {
          const overflow = rider.distance - arc.length;
          if (rider.cursor + 1 < rider.path.length) { rider.cursor++; rider.distance = Math.min(overflow, arcFor(rider).length * .9); }
          else { rider.finished = true; completed++; rider.distance = arc.length; }
        }
        rider.speed = Math.min(rider.speed, riderLimit(rider, arcFor(rider)));
        place(rider);
      }
      for (const bus of buses) {
        const target = scheduledProgress(bus.trip, time - bus.delay);
        let progress = target;
        if (time < bus.dwellUntil) progress = bus.progress;
        const busArc = roadArcs[bus.arc];
        if (busArc) progress = Math.min(progress, bus.progress + busArc.edge.speed * (1 - .2 * demand.wet) * dt);
        if (bus.escapeEdge >= 0 && Math.floor(bus.arc / 2) !== bus.escapeEdge && Math.floor(bus.shape[bus.segment][3] / 2) !== bus.escapeEdge) bus.escapeEdge = -1;
        for (let i = bus.segment; i < bus.shape.length - 1 && bus.shape[i][2] <= target + 8; i++) {
          const point = bus.shape[i], edgeId = Math.floor(point[3] / 2);
          if (point[3] >= 0 && closures.has(edgeId) && edgeId !== bus.escapeEdge) { progress = Math.min(progress, Math.max(bus.progress, point[2] - 8)); break; }
        }
        const leader = leaders.get(bus);
        if (leader && ["car", "bike", "scooter"].includes(leader.owner.mode)) {
          const dx = leader.owner.x - bus.x, dy = leader.owner.y - bus.y;
          const forward = dx * Math.cos(bus.angle) + dy * Math.sin(bus.angle);
          if (forward > 0 && Math.cos(leader.owner.angle - bus.angle) > .6) progress = Math.min(progress, bus.progress + Math.max(0, forward - leader.length - 6));
        }
        // Shape variants can cross an OSM edge boundary at different samples.
        // Keep their physical queues continuous across that boundary.
        for (const other of buses) {
          if (other === bus || Math.cos(other.angle - bus.angle) < .85) continue;
          const dx = other.x - bus.x, dy = other.y - bus.y;
          const forward = dx * Math.cos(bus.angle) + dy * Math.sin(bus.angle);
          const lateral = Math.abs(dy * Math.cos(bus.angle) - dx * Math.sin(bus.angle));
          if (forward > 0 && forward < 50 && lateral < 4) progress = Math.min(progress, bus.progress + Math.max(0, forward - 18));
        }
        progress = Math.max(bus.progress, progress);
        const wanted = target - bus.progress;
        const stop = bus.trip[2][bus.nextStop];
        if (stop && progress >= stop[3] - .01) {
          progress = Math.max(bus.progress, stop[3]);
          bus.dwellUntil = time + passengers.arrive(bus.passengers, bus.trip, bus.nextStop, demand.wet);
          bus.nextStop++;
        }
        if (wanted > .01 && progress < target - .01) bus.delay += dt * (1 - (progress - bus.progress) / wanted);
        bus.atStop = time < bus.dwellUntil;
        bus.waiting = !bus.atStop && wanted > .01 && progress - bus.progress < .05;
        bus.progress = progress;
        Object.assign(bus, shapePosition(bus.shape, progress));
      }
      cars = cars.filter(car => !car.finished); pedestrians = pedestrians.filter(person => !person.finished);
      bikes = bikes.filter(rider => !rider.finished); scooters = scooters.filter(rider => !rider.finished);
      buses = buses.filter(bus => {
        const active = bus.progress < bus.trip[2].at(-1)[3] - .1 || time < Math.max(bus.dwellUntil, bus.trip[2].at(-1)[2] + bus.delay);
        if (!active) passengers.release(bus.passengers);
        return active;
      });
    }

    function getDepartures(lineIds, limit = 3) {
      const result = [];
      for (let i = nextDeparture; i < schedule.length && result.length < limit; i++) {
        const trip = data.transit.trips[schedule[i]];
        if (!lineIds || lineIds.has(trip[3])) result.push(trip);
      }
      return result;
    }
    function getFrame() {
      return { time, date, cars, pedestrians, bikes, scooters, buses, closures, manualClosures, closureVersion: routingVersion, roadEvents: roadEvents.getState(), rerouted, completed, dailyTrips: schedule.length, lineTrips, queued: cars.filter(a => a.speed < .5).length,
        demand, settings: { ...settings }, sceneLimits, passengers: passengers.report(), started: { ...started }, pendingStarts: Math.floor(credits.car) + Math.floor(credits.pedestrian) + Math.floor(credits.bike) + Math.floor(credits.scooter),
        departures: getDepartures() };
    }
    reset(options);
    return { data, edges, route, positionOnArc, advance, reset, setDemand, setClosure, setClosures, setRoadEvents, finishRoadEvent, getFrame, getDepartures };
  }

  return { loadData, createSimulation };
})();
