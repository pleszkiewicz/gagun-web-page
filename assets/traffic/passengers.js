window.gagunTrafficPassengers = function createPassengerModel(transit, random, radius = Infinity) {
  const capacity = 80;
  let queues, stopTotals, states, schedule = [], created = 0, completed = 0, unassigned = 0, cachedAt = -Infinity, opportunities = [];
  const localStop = id => radius === Infinity || Math.hypot(transit.stops[id][1], transit.stops[id][2]) <= radius;

  function services(time) {
    if (time - cachedAt >= 30 || time < cachedAt) {
      cachedAt = time;
      opportunities = [];
      for (const id of schedule) {
        const stops = transit.trips[id][2];
        for (let i = 0; i < stops.length - 1; i++) {
          if (stops[i][2] < time || stops[i][2] > time + 3600 || !localStop(stops[i][0])) continue;
          const destinations = [...new Set(stops.slice(i + 1).filter(s => s[0] !== stops[i][0] && localStop(s[0])).map(s => s[0]))];
          if (destinations.length) opportunities.push([stops, i, destinations]);
        }
      }
    }
    return opportunities.filter(([stops, i]) => stops[i][2] >= time);
  }
  function enqueue(count, time, countCreated = true) {
    if (countCreated) created += count;
    const choices = services(time);
    if (!choices.length) { unassigned += count; return; }
    count += unassigned; unassigned = 0;
    for (let i = 0; i < count; i++) {
      const [stops, start, destinations] = choices[Math.floor(random() * choices.length)];
      const destination = destinations[Math.floor(random() * destinations.length)];
      queues[stops[start][0]][destination]++;
      stopTotals[stops[start][0]]++;
    }
  }
  function reset(trips, time, warmRate) {
    schedule = trips; states = new Set(); created = 0; completed = 0; unassigned = 0; cachedAt = -Infinity;
    queues = transit.stops.map(() => new Uint32Array(transit.stops.length));
    stopTotals = new Uint32Array(transit.stops.length);
    enqueue(Math.round(warmRate / 6), time);
  }
  function register(trip, progress, warmLoad = 0) {
    const state = { load: 0, capacity, destinations: new Uint32Array(transit.stops.length) };
    const future = trip[2].filter(s => s[3] > progress + .1 && localStop(s[0]));
    if (future.length) for (let i = 0; i < Math.min(capacity, Math.round(warmLoad)); i++) {
      const destination = future[Math.floor(random() * future.length)][0];
      state.destinations[destination]++; state.load++; created++;
    }
    states.add(state);
    return state;
  }
  function arrive(state, trip, stopIndex, wet) {
    const origin = trip[2][stopIndex][0];
    const alighted = state.destinations[origin];
    state.destinations[origin] = 0; state.load -= alighted; completed += alighted;
    let boarded = 0;
    const destinations = new Set(trip[2].slice(stopIndex + 1).map(s => s[0]));
    for (const destination of destinations) {
      if (destination === origin) continue;
      const amount = Math.min(queues[origin][destination], capacity - state.load);
      queues[origin][destination] -= amount; state.destinations[destination] += amount; state.load += amount; boarded += amount;
      stopTotals[origin] -= amount;
    }
    return boarded + alighted ? 3 + boarded * (1.2 + .3 * wet) + alighted * .7 : 0;
  }
  function release(state) {
    completed += state.load; state.load = 0; state.destinations.fill(0); states.delete(state);
  }
  function report() {
    const stopWaiting = Array.from(stopTotals);
    const onboard = [...states].reduce((sum, state) => sum + state.load, 0);
    return { onboard, waiting: stopWaiting.reduce((a, b) => a + b, unassigned), stopWaiting, created, completed, capacity };
  }
  return { reset, register, arrive, release, enqueue, report, hasService(time) { return services(time).length > 0; } };
};
