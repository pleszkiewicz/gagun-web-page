window.gagunTraffic.createEventsPanel = function createEventsPanel(host, simulation, { tr, onChange, onFocus }) {
  const listeners = new AbortController();
  const controls = new Map(), entries = new Map();
  const { bounds } = window.gagunTrafficRoadEvents;
  function element(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }
  function listen(node, type, fn) { node.addEventListener(type, fn, { signal: listeners.signal }); }
  function clock(seconds) {
    const value = Math.ceil(seconds);
    return `${String(Math.floor(value / 3600) % 24).padStart(2, "0")}:${String(Math.floor(value / 60) % 60).padStart(2, "0")}${value >= 86400 ? " (+1d)" : ""}`;
  }
  const panel = element("details", "traffic-events-panel"); panel.open = true;
  const summary = element("summary"), count = element("output");
  summary.append(element("span", "", tr("eventsTitle")), count); panel.append(summary);
  panel.append(element("p", "traffic-small", tr("eventsInstructions")));
  for (const type of ["accident", "roadwork"]) {
    const fieldset = element("fieldset", "traffic-event-controls");
    fieldset.append(element("legend", `traffic-event-${type}`, tr(type)));
    for (const suffix of ["Rate", "Minutes"]) {
      const key = type + suffix, id = `traffic${key[0].toUpperCase()}${key.slice(1)}`;
      const label = element("label", "traffic-range-label", tr(suffix === "Rate" ? "eventFrequency" : "eventDuration"));
      label.htmlFor = id;
      const output = element("output"); output.id = `${id}Value`; label.append(output);
      const input = element("input"); input.type = "range"; input.id = id;
      input.min = bounds[key][0]; input.max = bounds[key][1];
      input.step = suffix === "Rate" ? type === "accident" ? .5 : .25 : type === "accident" ? 1 : 5;
      input.setAttribute("aria-label", `${tr(type)} · ${label.firstChild.textContent}`);
      input.setAttribute("aria-describedby", "trafficEventsNote");
      fieldset.append(label, input);
      controls.set(key, { input, output });
      listen(input, "input", () => { simulation.setRoadEvents({ [key]: Number(input.value) }); refresh(simulation.getFrame()); onChange(); });
    }
    panel.append(fieldset);
  }
  const note = element("p", "traffic-small", tr("eventsSettingsNote")); note.id = "trafficEventsNote"; panel.append(note);
  const stats = element("p", "traffic-small traffic-event-stats"); panel.append(stats);
  const empty = element("p", "traffic-small", tr("eventsEmpty")); panel.append(empty);
  const list = element("ul", "traffic-event-list"); list.setAttribute("aria-label", tr("eventsActive")); panel.append(list);
  listen(list, "click", event => {
    const button = event.target.closest("button[data-event]");
    if (!button || !list.contains(button)) return;
    const incident = simulation.getFrame().roadEvents.active.find(item => item.id === Number(button.dataset.event));
    if (!incident) return;
    if (button.dataset.action === "find") onFocus(incident.edgeId);
    else { simulation.finishRoadEvent(incident.id); refresh(simulation.getFrame()); onChange(); }
  });
  function refresh(frame) {
    const state = frame.roadEvents;
    count.textContent = tr("eventsCount", { count: state.active.length });
    stats.textContent = tr("eventsStats", { completed: state.completed });
    for (const [key, { input, output }] of controls) {
      input.value = state.settings[key];
      const text = tr(key.endsWith("Rate") ? "eventRateValue" : "eventDurationValue", { count: state.settings[key] });
      output.textContent = text; input.setAttribute("aria-valuetext", text);
    }
    empty.hidden = state.active.length > 0;
    for (const [id, entry] of entries) if (!state.active.some(item => item.id === id)) { entry.item.remove(); entries.delete(id); }
    for (const incident of state.active) {
      if (!entries.has(incident.id)) {
        const edge = simulation.edges[incident.edgeId], road = edge.name || tr("unnamedRoad");
        const item = element("li", `traffic-event-item traffic-event-${incident.type}`);
        item.append(element("span", "traffic-event-type", tr(incident.type)), element("span", "traffic-closure-name", road));
        item.append(element("span", "traffic-closure-meta", `${Math.round(edge.length)} m · ${tr("eventEndsAt", { time: clock(incident.endsAt) })}`));
        const remaining = element("output", "traffic-event-remaining"); item.append(remaining);
        const actions = element("div", "traffic-closure-active-actions");
        for (const action of ["find", "finish"]) {
          const button = element("button", action === "find" ? "traffic-link-button" : "traffic-closure-reopen", tr(action === "find" ? "closureFind" : "eventFinish"));
          button.type = "button"; button.dataset.action = action; button.dataset.event = incident.id;
          button.setAttribute("aria-label", tr(action === "find" ? "closureFindNamed" : "eventFinishNamed", { road }));
          actions.append(button);
        }
        item.append(actions); list.append(item); entries.set(incident.id, { item, remaining });
      }
      const seconds = Math.max(0, Math.ceil(incident.endsAt - frame.time));
      entries.get(incident.id).remaining.textContent = tr("eventRemaining", { time: `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}` });
    }
  }
  host.replaceChildren(panel); refresh(simulation.getFrame());
  return { refresh, destroy() { listeners.abort(); host.replaceChildren(); } };
};
