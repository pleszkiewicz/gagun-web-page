window.gagunTrafficRoadEvents = (() => {
  const defaults = { accidentRate: 2, accidentMinutes: 20, roadworkRate: .5, roadworkMinutes: 90 };
  const bounds = { accidentRate: [0, 12], accidentMinutes: [1, 120], roadworkRate: [0, 4], roadworkMinutes: [5, 360] };
  const types = ["accident", "roadwork"];

  function create(candidates) {
    const settings = { ...defaults }, active = new Map(), closedEdges = new Set();
    const nextAt = { accident: Infinity, roadwork: Infinity };
    let seed, nextId, revision, started, completed;
    function random() {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return (seed + .5) / 4294967296;
    }
    function schedule(type, time) {
      const rate = settings[`${type}Rate`];
      nextAt[type] = rate ? time - Math.log1p(-random()) * 3600 / rate : Infinity;
    }
    function configure(changes, time, reschedule = true) {
      for (const [key, [min, max]] of Object.entries(bounds)) {
        if (changes[key] === undefined) continue;
        const value = Number(changes[key]);
        if (!Number.isFinite(value)) continue;
        const next = Math.max(min, Math.min(max, value));
        if (next === settings[key]) continue;
        settings[key] = next;
        if (reschedule && key.endsWith("Rate")) schedule(key.slice(0, -4), time);
      }
    }
    function reset(time, changes = {}) {
      seed = 41926; nextId = 1; revision = 0; started = 0; completed = 0;
      active.clear(); closedEdges.clear();
      configure(changes, time, false);
      for (const type of types) schedule(type, time);
    }
    function finish(id) {
      const event = active.get(id);
      if (!event) return false;
      active.delete(id); closedEdges.delete(event.edgeId);
      completed++; revision++;
      return true;
    }
    function expire(time) {
      for (const event of active.values()) if (event.endsAt <= time) finish(event.id);
    }
    function advance(time, isClosed) {
      const before = revision;
      while (Math.min(...Object.values(nextAt)) <= time) {
        const type = nextAt.accident <= nextAt.roadwork ? "accident" : "roadwork";
        const at = nextAt[type];
        expire(at);
        const available = candidates.filter(edge => !isClosed(edge.id));
        const total = available.reduce((sum, edge) => sum + edge.length, 0);
        if (total > 0) {
          let remaining = random() * total;
          const edge = available.find(candidate => (remaining -= candidate.length) <= 0) || available.at(-1);
          const event = { id: nextId++, type, edgeId: edge.id, startedAt: at, endsAt: at + settings[`${type}Minutes`] * 60 };
          active.set(event.id, event); closedEdges.add(edge.id);
          started++; revision++;
        }
        schedule(type, at);
      }
      expire(time);
      return revision !== before;
    }
    function getState() {
      return { settings: { ...settings }, active: [...active.values()], revision, started, completed, eligibleSections: candidates.length };
    }
    reset(0);
    return { configure, reset, advance, finish, closedEdges, getState };
  }
  return { defaults, bounds, create };
})();
