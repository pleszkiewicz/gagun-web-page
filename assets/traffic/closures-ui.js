window.gagunTraffic.createClosurePanel = function createClosurePanel(host, simulation, { tr, onChange, onFocus }) {
  const events = new AbortController();
  const collator = new Intl.Collator("pl", { numeric: true });
  const numbers = new Intl.NumberFormat("en");
  const fold = value => value.toLocaleLowerCase("pl").normalize("NFD").replace(/\p{Diacritic}/gu, "").replace(/ł/g, "l");
  const groupsByName = new Map();
  const edgesById = new Map(simulation.edges.map(edge => [edge.id, edge]));
  let lastClosures = null;
  let activeGroups = [];

  function element(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }
  function listen(node, type, fn) { node.addEventListener(type, fn, { signal: events.signal }); }
  function representative(ids) { return ids[Math.floor(ids.length / 2)]; }
  function change(ids, closed) {
    simulation.setClosures(ids, closed);
    refresh();
    onChange();
  }
  function findButton(road) {
    const button = element("button", "traffic-link-button traffic-closure-find", tr("closureFind"));
    button.type = "button";
    button.setAttribute("aria-label", tr("closureFindNamed", { road }));
    return button;
  }

  for (const edge of simulation.edges) {
    if (!edge.drive || !edge.name.trim()) continue;
    if (!groupsByName.has(edge.name)) groupsByName.set(edge.name, { name: edge.name, ids: [], meters: 0 });
    const group = groupsByName.get(edge.name);
    group.ids.push(edge.id); group.meters += edge.length;
  }
  const groups = [...groupsByName.values()].sort((a, b) => collator.compare(a.name, b.name));
  const panel = element("details", "traffic-closure-panel");
  const summary = element("summary");
  const heading = element("span", "", tr("closuresTitle"));
  const counter = element("output");
  summary.append(heading, counter); panel.append(summary);
  panel.append(element("p", "traffic-small traffic-closure-instructions", tr("closureInstructions")));
  const clear = element("button", "traffic-closure-clear", tr("closureClearAll"));
  clear.type = "button";
  listen(clear, "click", () => change([...simulation.getFrame().manualClosures], false));
  panel.append(clear);

  const activeSection = element("section", "traffic-closure-active");
  activeSection.setAttribute("aria-label", tr("closureActiveHeading"));
  activeSection.append(element("h3", "", tr("closureActiveHeading")));
  const emptyActive = element("p", "traffic-small", tr("closureNoActive"));
  const activeList = element("ul", "traffic-closure-active-list");
  activeSection.append(emptyActive, activeList); panel.append(activeSection);

  const searchLabel = element("label", "traffic-closure-search-label", tr("closureSearchLabel"));
  const search = element("input", "traffic-closure-search");
  search.type = "search"; search.placeholder = tr("closureSearchPlaceholder");
  search.disabled = !groups.length;
  searchLabel.append(search); panel.append(searchLabel);
  const results = element("output", "traffic-small traffic-closure-results");
  results.setAttribute("aria-live", "polite"); panel.append(results);
  const streetList = element("div", "traffic-closure-streets");
  streetList.setAttribute("role", "group");
  streetList.setAttribute("aria-label", tr("closuresTitle"));
  const emptySearch = element("p", "traffic-small traffic-closure-empty", tr("closureNoResults"));
  panel.append(streetList, emptySearch);

  for (const [index, group] of groups.entries()) {
    const row = element("div", "traffic-closure-row");
    const label = element("label", "traffic-closure-label");
    const input = element("input"); input.type = "checkbox";
    input.setAttribute("aria-label", tr("closureStreetToggle", { road: group.name }));
    const text = element("span", "traffic-closure-road-text");
    const name = element("span", "traffic-closure-name", group.name);
    const meta = element("span", "traffic-closure-meta", tr("closureStreetMeta", { count: group.ids.length, meters: numbers.format(Math.round(group.meters)) }));
    meta.id = `${host.id || "trafficClosures"}Street${index}Meta`;
    input.setAttribute("aria-describedby", meta.id);
    text.append(name, meta); label.append(input, text);
    const find = findButton(group.name);
    listen(find, "click", () => onFocus(representative(group.ids)));
    row.append(label, find); streetList.append(row);
    group.row = row; group.input = input; group.search = fold(group.name);
    listen(input, "change", () => change(group.ids, input.checked));
  }
  function filter() {
    const tokens = fold(search.value).trim().split(/\s+/).filter(Boolean);
    let count = 0;
    for (const group of groups) {
      group.row.hidden = !tokens.every(token => group.search.includes(token));
      if (!group.row.hidden) count++;
    }
    results.textContent = tr("closureStreetCount", { count });
    emptySearch.hidden = count > 0;
  }
  listen(search, "input", filter);
  listen(activeList, "click", event => {
    const button = event.target.closest("button[data-action]");
    if (!button || !activeList.contains(button)) return;
    const group = activeGroups[Number(button.dataset.entry)];
    if (button.dataset.action === "find") onFocus(representative(group.closedIds));
    else change(group.ids, false);
  });

  function refresh() {
    const closed = simulation.getFrame().manualClosures;
    const signature = [...closed].sort((a, b) => a - b).join(",");
    if (signature === lastClosures) return;
    lastClosures = signature;
    counter.textContent = tr("closureCount", { count: closed.size });
    clear.disabled = !closed.size;
    activeGroups = [];
    for (const group of groups) {
      const closedIds = group.ids.filter(id => closed.has(id));
      group.input.checked = closedIds.length === group.ids.length;
      group.input.indeterminate = closedIds.length > 0 && closedIds.length < group.ids.length;
      if (closedIds.length) activeGroups.push({ ...group, closedIds });
    }
    for (const id of closed) {
      const edge = edgesById.get(id);
      if (edge.name.trim()) continue;
      activeGroups.push({ name: tr("unnamedRoad"), ids: [id], closedIds: [id], meters: edge.length });
    }
    activeList.replaceChildren();
    emptyActive.hidden = activeGroups.length > 0;
    for (const [index, group] of activeGroups.entries()) {
      const item = element("li", "traffic-closure-active-item");
      const text = element("div", "traffic-closure-road-text");
      text.append(element("span", "traffic-closure-name", group.name), element("span", "traffic-closure-meta", tr("closureClosedMeta", {
        closed: group.closedIds.length, total: group.ids.length, meters: numbers.format(Math.round(group.closedIds.reduce((sum, id) => sum + edgesById.get(id).length, 0))),
      })));
      const actions = element("div", "traffic-closure-active-actions");
      const reopen = element("button", "traffic-closure-reopen", tr("reopen"));
      reopen.type = "button";
      reopen.setAttribute("aria-label", tr("reopenNamed", { road: group.name }));
      const find = findButton(group.name);
      find.dataset.action = "find"; find.dataset.entry = index;
      reopen.dataset.action = "reopen"; reopen.dataset.entry = index;
      actions.append(find, reopen);
      item.append(text, actions); activeList.append(item);
    }
  }

  host.replaceChildren(panel);
  filter(); refresh();
  return { refresh, destroy() { events.abort(); host.replaceChildren(); } };
};
