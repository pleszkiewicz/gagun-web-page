function renderTrafficSimulator(container, { t, locale }) {
  const tr = (key, values) => t(`pages.traffic.${key}`, values);
  const city = window.gagunTrafficCityData;
  const { defaults, bounds } = window.gagunTrafficDemand;
  const format = value => new Intl.NumberFormat(locale).format(value);
  container.innerHTML = `
    <section class="traffic-page" aria-label="${tr("pageLabel")}" aria-busy="true">
      <header class="traffic-header">
        <div><p class="eyebrow">EŁK · POLAND</p><h1>${tr("heading")}</h1></div>
        <div class="traffic-header-actions">
          <time class="traffic-clock" id="trafficClock">07:30:00</time>
          <button type="button" id="trafficPlayback" disabled>${tr("pause")}</button>
          <button type="button" class="traffic-secondary" id="trafficRestart" disabled>${tr("restart")}</button>
        </div>
      </header>
      <div class="traffic-layout">
        <div class="traffic-stage">
          <canvas class="traffic-basemap" aria-hidden="true"></canvas>
          <canvas class="traffic-agents" tabindex="0" role="img" aria-label="${tr("mapLabel")}" aria-describedby="trafficMapHint"></canvas>
          <div class="traffic-map-title"><span class="traffic-live-dot" aria-hidden="true"></span>Ełk <span>5 km</span></div>
          <output class="traffic-map-conditions" id="trafficMapConditions"></output>
          <div class="traffic-map-tools" role="group" aria-label="${tr("mapTools")}">
            <button type="button" id="trafficZoomIn" aria-label="${tr("zoomIn")}">+</button>
            <output id="trafficZoom" aria-label="${tr("zoomLevel")}">1.0×</output>
            <button type="button" id="trafficZoomOut" aria-label="${tr("zoomOut")}">−</button>
            <button type="button" id="trafficFit">${tr("cityView")}</button>
          </div>
          <div class="traffic-map-loading" id="trafficLoading" role="status">${tr("loading")}</div>
          <div class="traffic-attribution"><a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">© OpenStreetMap contributors</a> · <a href="https://mkuran.pl/gtfs/" target="_blank" rel="noopener">GTFS: mkuran.pl</a></div>
        </div>
        <aside class="traffic-panel" aria-label="${tr("controls")}">
          <div class="traffic-summary" aria-label="${tr("activeAgents")}">
            <div><span class="traffic-dot traffic-car-dot"></span><output id="trafficCarsCount">—</output><span>${tr("cars")}</span></div>
            <div><span class="traffic-dot traffic-walk-dot"></span><output id="trafficWalkCount">—</output><span>${tr("walkers")}</span></div>
            <div><span class="traffic-dot traffic-bus-dot"></span><output id="trafficBusCount">—</output><span>${tr("buses")}</span></div>
            <div><span class="traffic-dot traffic-bike-dot"></span><output id="trafficBikeCount">—</output><span>${tr("bikes")}</span></div>
            <div><span class="traffic-dot traffic-scooter-dot"></span><output id="trafficScooterCount">—</output><span>${tr("scooters")}</span></div>
          </div>
          <p class="traffic-small traffic-counter-note" id="trafficCounterNote">${tr("activeAgents")}</p>
          <label class="traffic-cycleway-toggle"><input type="checkbox" id="trafficCycleways" checked disabled><span>${tr("cycleways")}<small>${tr("cyclewayLegend")}</small></span></label>
          <details class="traffic-line-panel" id="trafficLinesPanel">
            <summary><span>${tr("busLines")}</span><output id="trafficLineSelection">—</output></summary>
            <p class="traffic-small">${tr("lineVisibilityNote")}</p>
            <div class="traffic-line-actions"><button type="button" id="trafficAllLines" disabled>${tr("showAllLines")}</button><button type="button" id="trafficNoLines" disabled>${tr("hideAllLines")}</button></div>
            <div class="traffic-line-list-heading"><span>${tr("lineRoute")}</span><span>${tr("tripsToday")}</span></div>
            <div id="trafficLineChoices" class="traffic-line-choices" role="group" aria-label="${tr("visibleBusLines")}"></div>
          </details>
          <div id="trafficEvents"></div>
          <div id="trafficClosures"></div>
          <fieldset class="traffic-controls" disabled>
            <div class="traffic-field-row">
              <label for="trafficDate">${tr("date")}<input type="date" id="trafficDate"></label>
              <label for="trafficSpeed">${tr("speed")}<select id="trafficSpeed"><option value="1">1×</option><option value="5">5×</option><option value="15" selected>15×</option><option value="30">30×</option><option value="60">60×</option></select></label>
            </div>
            <label class="traffic-range-label" for="trafficTime">${tr("time")}<output id="trafficTimeValue">07:30</output></label>
            <input type="range" id="trafficTime" min="0" max="1439" step="1" value="450">
            <label class="traffic-cycle"><input type="checkbox" id="trafficCycle" checked>${tr("dailyCycle")}</label>
            <div class="traffic-demand-phase"><output id="trafficPhase"></output><output id="trafficRate"></output></div>
            <div class="traffic-city-heading"><span id="trafficBaselineState">${tr("cityBaseline")}</span><button type="button" class="traffic-link-button" id="trafficBaseline">${tr("useBaseline")}</button></div>
            <label class="traffic-range-label" for="trafficPopulation">${tr("population")}<output id="trafficPopulationValue">${format(defaults.population)}</output></label>
            <input type="range" id="trafficPopulation" min="${bounds.population[0]}" max="${bounds.population[1]}" step="1" value="${defaults.population}">
            <label class="traffic-range-label" for="trafficFleet">${tr("passengerCars")}<output id="trafficFleetValue">≈${format(defaults.fleet)}</output></label>
            <input type="range" id="trafficFleet" min="${bounds.fleet[0]}" max="${bounds.fleet[1]}" step="1" value="${defaults.fleet}" aria-describedby="trafficFleetBasis">
            <p class="traffic-small traffic-fleet-basis" id="trafficFleetBasis">${tr("fleetEstimateShort")}</p>
            <p class="traffic-small traffic-city-demand" id="trafficCityDailyTrips"></p>
            <label class="traffic-range-label" for="trafficRain">${tr("rain")}<output id="trafficRainValue">${tr("dry")}</output></label>
            <input type="range" id="trafficRain" min="0" max="100" step="10" value="0">
            <div class="traffic-mode-choices" aria-label="${tr("newTripChoices")}">
              <p class="traffic-small">${tr("newTripChoices")}</p>
              <div class="traffic-mode-bar" role="img" id="trafficModeBar"><span></span><span></span><span></span><span></span><span></span></div>
              <div class="traffic-mode-values"><span><i class="traffic-dot traffic-car-dot"></i>${tr("cars")} <output id="trafficCarShare"></output></span><span><i class="traffic-dot traffic-walk-dot"></i>${tr("pedestrians")} <output id="trafficWalkShare"></output></span><span><i class="traffic-dot traffic-bus-dot"></i>${tr("busTrips")} <output id="trafficBusShare"></output></span><span><i class="traffic-dot traffic-bike-dot"></i>${tr("bikes")} <output id="trafficBikeShare"></output></span><span><i class="traffic-dot traffic-scooter-dot"></i>${tr("scooters")} <output id="trafficScooterShare"></output></span></div>
              <p class="traffic-small">${tr("newTripsNote")}</p>
              <p class="traffic-small traffic-demand-backlog" id="trafficPending" hidden></p>
            </div>
            <details class="traffic-city-sources"><summary>${tr("calibrationDetails")}</summary>
              <p>${tr("populationSource", { population: format(city.population) })} <a href="${city.sources.cityPopulation.url}" target="_blank" rel="noopener">GUS BDL ↗</a></p>
              <p>${tr("fleetSource", { cars: format(city.county.passengerCars), population: format(city.county.population), estimate: format(city.passengerCars) })} <a href="${city.sources.countyPassengerCars.url}" target="_blank" rel="noopener">${tr("countyCarsSource")} ↗</a> · <a href="${city.sources.countyPopulation.url}" target="_blank" rel="noopener">${tr("countyPopulationSource")} ↗</a></p>
              <p>${tr("calibrationLimit")}</p>
              <label class="traffic-range-label" for="trafficTrips">${tr("tripsPerResident")}<output id="trafficTripsValue">2.0</output></label>
              <input type="range" id="trafficTrips" min="${bounds.tripsPerResident[0]}" max="${bounds.tripsPerResident[1]}" step=".1" value="${defaults.tripsPerResident}">
              <p>${tr("tripRateAssumption")}</p>
            </details>
          </fieldset>
          <section class="traffic-section traffic-road-section" aria-labelledby="trafficRoadHeading">
            <div class="traffic-section-heading"><h2 id="trafficRoadHeading">${tr("selectedSection")}</h2><button type="button" class="traffic-link-button" id="trafficLocate" disabled>${tr("locate")}</button></div>
            <p class="traffic-road-name" id="trafficRoadName">—</p>
            <p class="traffic-small" id="trafficRoadInfo">${tr("selectHint")}</p>
            <p class="traffic-small traffic-lane-info" id="trafficRoadLanes"></p>
            <p class="traffic-small" id="trafficRoadCycling"></p>
            <a class="traffic-small traffic-osm-link" id="trafficRoadSource" target="_blank" rel="noopener">${tr("viewOsmRoad")} ↗</a>
            <button type="button" class="traffic-close-button" id="trafficClosure" disabled>${tr("closeRoad")}</button>
            <div class="traffic-road-metrics"><span>${tr("queued")} <output id="trafficQueued">0</output></span><span>${tr("rerouted")} <output id="trafficRerouted">0</output></span></div>
          </section>
          <section class="traffic-section" aria-labelledby="trafficTransitHeading">
            <div class="traffic-section-heading"><h2 id="trafficTransitHeading">MZK Ełk</h2><span class="traffic-small" id="trafficDailyTrips"></span></div>
            <p class="traffic-passenger-summary" id="trafficPassengers"></p>
            <p class="traffic-small">${tr("networkPassengerScope")}</p>
            <div id="trafficBusList" class="traffic-bus-list"></div>
            <p class="traffic-small traffic-departures-title">${tr("nextDepartures")}</p>
            <div id="trafficDepartures" class="traffic-departures"></div>
          </section>
          <details class="traffic-about"><summary>${tr("about")}</summary><p>${tr("modelNote")}</p><p id="trafficLaneCoverage"></p><p id="trafficCyclingCoverage"></p><p>${tr("snapshotNote")}</p><a href="https://rozklady.mzk.elk.pl/" target="_blank" rel="noopener">${tr("operatorTimetable")} ↗</a></details>
          <p id="trafficStatus" class="traffic-status" role="status" aria-live="polite"></p>
        </aside>
      </div>
      <footer class="traffic-footer"><p id="trafficMapHint">${tr("mapHint")}</p><span>${tr("prototype")}</span></footer>
    </section>`;

  const root = container.querySelector(".traffic-page");
  const el = id => root.querySelector(`#traffic${id}`);
  const events = new AbortController();
  let disposed = false, animation = 0, map = null, simulation = null, closurePanel = null, eventsPanel = null;
  let paused = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  let selected, lastFrame = 0, accumulator = 0, lastReadout = 0, scrubbing = false, lastClosureVersion = -1;
  const visibleLines = new Set(["12"]);
  let lineById = new Map();
  const clock = (seconds, full = false) => {
    const value = Math.max(0, Math.floor(seconds));
    return `${String(Math.floor(value / 3600)).padStart(2, "0")}:${String(Math.floor(value / 60) % 60).padStart(2, "0")}${full ? `:${String(value % 60).padStart(2, "0")}` : ""}`;
  };
  const name = edge => edge.name || tr("unnamedRoad");
  function on(element, type, fn) { element.addEventListener(type, fn, { signal: events.signal }); }
  function badge(id) {
    const line = lineById.get(id), span = document.createElement("span");
    span.className = "traffic-line-badge"; span.textContent = line.number; span.style.backgroundColor = line.color;
    return span;
  }

  function syncSelected() {
    const edge = simulation.edges[selected], frame = simulation.getFrame();
    const closed = frame.closures.has(selected);
    const manual = frame.manualClosures.has(selected);
    el("RoadName").textContent = name(edge);
    el("RoadInfo").textContent = `${Math.round(edge.length)} m · ${tr(closed ? "closed" : "open")}`;
    const count = edge.shared ? tr("sharedLane") : edge.drive === 3 ? tr("twoWayLanes", { forward: edge.lanes[0], backward: edge.lanes[1] }) : tr("oneWayLanes", { count: Math.max(...edge.lanes) });
    const source = edge.laneSource & 8 ? "uncertainLanes" : (edge.laneSource & edge.drive) === edge.drive ? "mappedLanes" : edge.laneSource & 4 ? "splitLanes" : "assumedLanes";
    el("RoadLanes").textContent = `${count} · ${tr(source)}`;
    const access = (ride, push) => tr(ride ? "ridingAccess" : push ? "pushingAccess" : "noRiderAccess");
    const openCyclingDirections = closed ? (edge.cycling[2] === 2 ? 1 : 0) | (edge.cycling[3] === 2 ? 2 : 0) : 3;
    el("RoadCycling").textContent = `${tr("bikes")}: ${access(edge.cycling[0] & openCyclingDirections, edge.cycling[4])} · ${tr("scooters")}: ${access(edge.cycling[1] & openCyclingDirections, edge.cycling[5])}`;
    el("RoadSource").href = `https://www.openstreetmap.org/way/${edge.osmId}`;
    el("Closure").textContent = tr(manual ? "reopenRoad" : "closeRoad");
    el("Closure").classList.toggle("is-closed", manual);
    el("Closure").setAttribute("aria-pressed", String(manual));
    if (closed && !manual) el("RoadInfo").textContent += ` · ${tr("eventClosure")}`;
    closurePanel?.refresh();
  }
  function readout() {
    const frame = simulation.getFrame();
    eventsPanel?.refresh(frame);
    if (lastClosureVersion !== frame.closureVersion) { syncSelected(); lastClosureVersion = frame.closureVersion; }
    el("Clock").textContent = clock(frame.time, true);
    el("Clock").dateTime = `${frame.date}T${clock(frame.time, true)}`;
    if (!scrubbing) { el("Time").value = Math.floor(frame.time / 60); el("TimeValue").textContent = clock(frame.time); }
    el("CarsCount").textContent = frame.cars.length;
    el("WalkCount").textContent = frame.pedestrians.length;
    el("BikeCount").textContent = frame.bikes.length;
    el("ScooterCount").textContent = frame.scooters.length;
    const visibleBuses = frame.buses.filter(bus => visibleLines.has(bus.lineId));
    el("BusCount").textContent = visibleBuses.length;
    el("CounterNote").textContent = tr("activeMapOnly", { shown: visibleBuses.length, total: frame.buses.length });
    el("Queued").textContent = frame.queued;
    el("Rerouted").textContent = frame.rerouted;
    const shownTrips = [...visibleLines].reduce((sum, id) => sum + frame.lineTrips[id], 0);
    el("DailyTrips").textContent = tr("visibleTrips", { shown: shownTrips, total: frame.dailyTrips });
    el("LineSelection").textContent = tr("visibleLineCount", { shown: visibleLines.size, total: lineById.size });
    for (const output of el("LineChoices").querySelectorAll("output")) {
      const count = frame.lineTrips[output.dataset.line];
      output.textContent = count; output.setAttribute("aria-label", tr("dailyTrips", { count }));
    }
    const profile = frame.demand;
    el("Phase").textContent = `${tr(profile.phase)} · ${profile.multiplier.toFixed(1)}×`;
    el("Rate").textContent = tr("cityHourlyDemand", { rate: format(profile.total) });
    el("PopulationValue").textContent = format(frame.settings.population);
    el("FleetValue").textContent = `${frame.settings.fleet === defaults.fleet ? "≈" : ""}${format(frame.settings.fleet)}`;
    el("TripsValue").textContent = frame.settings.tripsPerResident.toFixed(1);
    el("BaselineState").textContent = tr(frame.settings.population === defaults.population && frame.settings.fleet === defaults.fleet && frame.settings.tripsPerResident === defaults.tripsPerResident ? "cityBaseline" : "customScenario");
    el("FleetBasis").textContent = frame.settings.fleet === defaults.fleet ? tr("fleetEstimateShort") : tr("scenarioFleetNote", { baseline: format(defaults.fleet) });
    el("CityDailyTrips").textContent = frame.settings.population ? tr("cityDailyDemand", { trips: format(profile.dailyTrips), cars: profile.carsPerThousand.toFixed(1) }) : tr("noResidents");
    el("MapConditions").textContent = `${tr(profile.phase)} · ${frame.settings.rain ? `${tr("rain")} ${frame.settings.rain}%` : tr("dry")}`;
    el("Pending").hidden = !frame.pendingStarts;
    el("Pending").textContent = tr("pendingStarts", { count: frame.pendingStarts });
    const shares = window.gagunTrafficDemand.allocate(1000, profile.shares).map(value => value / 10);
    for (const [i, id] of ["CarShare", "WalkShare", "BusShare", "BikeShare", "ScooterShare"].entries()) el(id).textContent = `${shares[i]}%`;
    [...el("ModeBar").children].forEach((bar, i) => { bar.style.width = `${shares[i]}%`; });
    el("ModeBar").setAttribute("aria-label", tr("shareSummary", { car: shares[0], walk: shares[1], bus: shares[2], bike: shares[3], scooter: shares[4] }));
    el("Passengers").textContent = tr("passengerSummary", { onboard: frame.passengers.onboard, waiting: frame.passengers.waiting });
    const stops = simulation.data.transit.stops;
    el("BusList").replaceChildren();
    if (!visibleBuses.length) {
      const p = document.createElement("p"); p.className = "traffic-small"; p.textContent = tr(visibleLines.size ? "noBuses" : "noLinesSelected"); el("BusList").append(p);
    }
    for (const bus of visibleBuses) {
      const item = document.createElement("div"); item.className = "traffic-bus-item";
      item.style.borderColor = lineById.get(bus.lineId).color;
      const heading = document.createElement("p"); heading.append(badge(bus.lineId), document.createTextNode(` → ${stops[bus.trip[2].at(-1)[0]][0]}`));
      const detail = document.createElement("p"); detail.className = "traffic-small";
      const next = bus.trip[2].find(s => s[3] > bus.progress + .2) || bus.trip[2].at(-1);
      detail.textContent = tr("busNext", { stop: stops[next[0]][0] });
      const load = document.createElement("p"); load.className = "traffic-small traffic-bus-load";
      load.textContent = tr("busLoad", { load: bus.passengers.load, capacity: bus.passengers.capacity });
      const delay = document.createElement("span"); delay.className = bus.waiting ? "traffic-bus-delay is-waiting" : "traffic-bus-delay";
      delay.textContent = bus.delay >= 10 ? `+${Math.floor(bus.delay / 60)}:${String(Math.floor(bus.delay) % 60).padStart(2, "0")}` : tr("onTime");
      item.append(heading, detail, load, delay); el("BusList").append(item);
    }
    el("Departures").replaceChildren();
    const departures = simulation.getDepartures(visibleLines);
    for (const trip of departures) {
      const p = document.createElement("p"), time = document.createElement("time"), label = document.createElement("span");
      time.textContent = clock(trip[2][0][2]); label.textContent = stops[trip[2][0][0]][0];
      p.append(time, badge(trip[3]), label); el("Departures").append(p);
    }
    if (!departures.length) el("Departures").textContent = tr(visibleLines.size ? "noDepartures" : "noLinesSelected");
  }
  function animate(now) {
    if (disposed) return;
    const elapsed = Math.min(.1, Math.max(0, (now - (lastFrame || now)) / 1000));
    lastFrame = now;
    if (!paused && !document.hidden) {
      accumulator += elapsed * Number(el("Speed").value);
      while (accumulator >= .2) { simulation.advance(.2); accumulator -= .2; }
      if (simulation.getFrame().time >= 86399) { paused = true; syncPlayback(); el("Status").textContent = tr("dayEnd"); }
    } else accumulator = 0;
    map.draw(simulation.getFrame(), elapsed);
    if (now - lastReadout >= 500) { readout(); lastReadout = now; }
    animation = requestAnimationFrame(animate);
  }
  function syncPlayback() {
    el("Playback").textContent = tr(paused ? "resume" : "pause");
    el("Playback").setAttribute("aria-pressed", String(!paused));
  }
  window.gagunTraffic.loadData().then(data => {
    if (disposed) return;
    const dates = Object.keys(data.transit.dates).sort();
    const date = dates.includes("2026-11-12") ? "2026-11-12" : dates[0];
    simulation = window.gagunTraffic.createSimulation(data, { date });
    lineById = new Map(data.transit.lines.map(line => [line.id, line]));
    selected = data.selected;
    el("Date").min = dates[0]; el("Date").max = dates.at(-1); el("Date").value = date;
    el("LaneCoverage").textContent = tr("laneCoverage", { percent: data.laneStats.taggedPercent });
    el("CyclingCoverage").textContent = tr("cyclingCoverage", { tracks: (data.cyclingStats.dedicatedTrackMeters / 1000).toFixed(1), lanes: (data.cyclingStats.paintedLaneMeters / 1000).toFixed(1) });
    map = window.gagunTraffic.createMap(root.querySelector(".traffic-stage"), simulation, {
      onSelect(edge) { selected = edge.id; syncSelected(); },
      onZoom(value) { el("Zoom").textContent = value; },
      visibleLines,
    });
    function syncLines() {
      for (const input of el("LineChoices").querySelectorAll("input")) input.checked = visibleLines.has(input.value);
      map.invalidate(); readout();
    }
    for (const line of data.transit.lines) {
      const label = document.createElement("label"); label.className = "traffic-line-choice"; label.style.setProperty("--line-color", line.color);
      const input = document.createElement("input"); input.type = "checkbox"; input.value = line.id; input.checked = visibleLines.has(line.id);
      input.setAttribute("aria-label", tr("lineNamed", { number: line.number, route: line.name }));
      const route = document.createElement("span"); route.className = "traffic-line-name"; route.textContent = line.name;
      const count = document.createElement("output"); count.dataset.line = line.id;
      label.append(input, badge(line.id), route, count); el("LineChoices").append(label);
      on(input, "change", () => { if (input.checked) visibleLines.add(line.id); else visibleLines.delete(line.id); syncLines(); });
    }
    on(el("AllLines"), "click", () => { for (const id of lineById.keys()) visibleLines.add(id); syncLines(); });
    on(el("NoLines"), "click", () => { visibleLines.clear(); syncLines(); });
    on(el("Cycleways"), "change", () => map.setCyclingVisible(el("Cycleways").checked));
    closurePanel = window.gagunTraffic.createClosurePanel(el("Closures"), simulation, {
      tr,
      onChange() { syncSelected(); map.invalidate(); readout(); },
      onFocus(id) { selected = id; map.focus(id); syncSelected(); },
    });
    eventsPanel = window.gagunTraffic.createEventsPanel(el("Events"), simulation, {
      tr,
      onChange() { syncSelected(); map.invalidate(); readout(); },
      onFocus(id) { selected = id; map.focus(id); syncSelected(); },
    });
    on(el("ZoomIn"), "click", () => map.zoom(1.6));
    on(el("ZoomOut"), "click", () => map.zoom(1 / 1.6));
    on(el("Fit"), "click", () => map.fit());
    on(el("Locate"), "click", () => map.focus(selected));
    on(el("Playback"), "click", () => { paused = !paused; syncPlayback(); });
    on(el("Closure"), "click", () => {
      const closed = !simulation.getFrame().manualClosures.has(selected);
      simulation.setClosure(selected, closed); syncSelected(); map.invalidate(); readout();
      el("Status").textContent = tr(closed ? "closedStatus" : simulation.getFrame().closures.has(selected) ? "eventStillClosedStatus" : "reopenedStatus", { road: name(simulation.edges[selected]) });
    });
    function resetAt(time) {
      simulation.reset({ date: el("Date").value, time });
      accumulator = 0; syncSelected(); map.invalidate(); readout();
    }
    on(el("Restart"), "click", () => {
      simulation.setClosures([...simulation.getFrame().manualClosures], false);
      resetAt(27000); syncSelected(); map.invalidate(); el("Status").textContent = tr("restartedStatus");
    });
    on(el("Date"), "change", () => {
      if (!Object.hasOwn(data.transit.dates, el("Date").value)) { el("Date").value = simulation.getFrame().date; return; }
      resetAt(simulation.getFrame().time);
    });
    on(el("Time"), "input", () => { scrubbing = true; el("TimeValue").textContent = clock(Number(el("Time").value) * 60); });
    on(el("Time"), "change", () => { scrubbing = false; resetAt(Number(el("Time").value) * 60); });
    for (const [id, key] of [["Population", "population"], ["Fleet", "fleet"], ["Trips", "tripsPerResident"], ["Rain", "rain"]]) on(el(id), "input", () => {
      const value = Number(el(id).value);
      if (id === "Rain") el("RainValue").textContent = value ? `${value}%` : tr("dry");
      simulation.setDemand({ [key]: value }); readout(); map.invalidate();
    });
    on(el("Baseline"), "click", () => {
      simulation.setDemand(defaults);
      for (const [id, key] of [["Population", "population"], ["Fleet", "fleet"], ["Trips", "tripsPerResident"]]) el(id).value = defaults[key];
      readout();
    });
    on(el("Cycle"), "change", () => { simulation.setDemand({ dailyCycle: el("Cycle").checked }); readout(); map.invalidate(); });
    el("Date").closest("fieldset").disabled = false;
    for (const id of ["Playback", "Restart", "Closure", "Locate", "AllLines", "NoLines", "Cycleways"]) el(id).disabled = false;
    el("Loading").hidden = true; root.setAttribute("aria-busy", "false");
    syncSelected(); syncPlayback(); readout(); animation = requestAnimationFrame(animate);
  }).catch(error => {
    if (disposed) return;
    el("Loading").textContent = tr("loadError"); el("Loading").setAttribute("role", "alert");
    root.setAttribute("aria-busy", "false"); console.error(error);
  });
  return () => { disposed = true; cancelAnimationFrame(animation); events.abort(); map?.destroy(); closurePanel?.destroy(); eventsPanel?.destroy(); };
}

window.gagunPageModules = window.gagunPageModules || [];
window.gagunPageModules.push({
  id: "traffic-simulator",
  sectionId: "simulations",
  navKey: "pages.traffic.navLabel",
  titleKey: "pages.traffic.title",
  theme: { background: "#edf1eb", backgroundSoft: "#f5f6f0", mathOpacity: "0" },
  render: renderTrafficSimulator,
});
