function renderBomberman(container, { t }) {
  const game = window.gagunBomberman;
  const text = (key, values) => t(`pages.bomberman.${key}`, values);
  const readSetting = (name, fallback) => {
    try { return localStorage.getItem(`gagun.bomberman.${name}`) ?? fallback; } catch (_) { return fallback; }
  };
  const saveSetting = (name, value) => {
    try { localStorage.setItem(`gagun.bomberman.${name}`, String(value)); } catch (_) { /* Settings are optional in private browsing. */ }
  };
  const query = new URLSearchParams(window.location.search);
  const preferredTheme = query.get("theme") || "arcade";
  let theme = Object.hasOwn(game.themes, preferredTheme) ? preferredTheme : "arcade";
  const soundVolume = 0.35;
  let muted = readSetting("muted", "false") === "true";
  let phase = "lobby";
  let round = null;
  let roundNumber = 0;
  let countdown = 0;
  let countdownTick = 0;
  let animationId = 0;
  let lastFrame = 0;
  let lastUiUpdate = 0;
  let disposed = false;
  const joined = new Set();
  const scores = [0, 0, 0, 0];
  const held = new Map();
  const queuedMoves = new Map();
  const lobbyState = game.createRound([0, 1, 2, 3]).state;
  const audio = game.createAudio(muted ? 0 : soundVolume);
  const controlByCode = new Map(game.controls.flatMap(player => [
    ...player.movement.map((code, direction) => [code, { id: player.id, direction }]),
    [player.bomb, { id: player.id, bomb: true }],
  ]));
  const icons = {
    sound: '<path d="M4 9h4l5-4v14l-5-4H4z"/><path d="M17 8c3 2 3 6 0 8m3-11c5 4 5 10 0 14"/>',
    pause: '<path d="M8 5v14M16 5v14"/>',
    expand: '<path d="M9 4H4v5m11-5h5v5M4 15v5h5m11-5v5h-5"/>',
    help: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 1 1 4 2c-1.5 1-1.5 1-1.5 3m0 3h.01"/>',
    arrow: '<path d="M5 12h14m-5-5 5 5-5 5"/>',
  };
  const icon = name => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name]}</svg>`;
  const avatar = id => `<img data-avatar="${id}" src="${game.themes[theme].textures.players[id]}" alt="" width="48" height="48">`;
  const key = (label, code, extra = "") => `<kbd${code ? ` data-code="${code}"` : ""} class="${extra}">${label}</kbd>`;
  const moveKeys = player => `<span class="bm-move-keys">${[0, 3, 2, 1].map(index => key(player.keys[index], player.movement[index])).join("")}</span>`;
  const bombKey = player => key(player.bombLabel, player.bomb, "bm-bomb-key");

  container.innerHTML = `
    <section class="bm-page" data-theme="${theme}" data-phase="${phase}" aria-label="${text("pageLabel")}" tabindex="-1">
      <header class="bm-header">
        <div class="bm-heading">
          <h1>Bomberman<span class="bm-title-dot">.</span></h1>
        </div>
        <div class="bm-theme-options" role="group" aria-label="${text("style")}">
          ${Object.entries(game.themes).map(([id, skin]) => `<button type="button" data-theme-option="${id}" aria-pressed="${id === theme}"><span class="bm-theme-swatch bm-swatch-${id}"></span><span>${skin.label}</span></button>`).join("")}
        </div>
        <div class="bm-tools" role="group" aria-label="${text("tools")}">
          <button type="button" class="bm-tool" data-action="sound" aria-label="${text("mute")}" aria-pressed="${!muted}">${icon("sound")}<span data-sound-label>${text("soundOn")}</span></button>
          <button type="button" class="bm-tool" data-action="pause" disabled aria-label="${text("pause")}" title="${text("pause")}">${icon("pause")}</button>
          <button type="button" class="bm-tool" data-action="fullscreen" aria-label="${text("fullscreen")}" title="${text("fullscreen")}">${icon("expand")}</button>
        </div>
      </header>

      <div class="bm-layout">
        <section class="bm-arena-panel" aria-label="${text("arena")}">
          <div class="bm-arena-header">
            <span class="bm-round-label"><i></i><span data-round-label>${text("lobby")}</span></span>
            <span class="bm-arena-status" data-arena-status>${text("localPlayers")}</span>
            <span class="bm-clock" data-clock aria-label="${text("timeLeft")}">02:30</span>
          </div>
          <div class="bm-stage">
            <canvas class="bm-canvas" aria-label="${text("canvas")}" role="img"></canvas>
            <div class="bm-overlay"></div>
          </div>
        </section>

        <aside class="bm-sidebar" aria-label="${text("playersAndItems")}">
          <section class="bm-lineup">
            <div class="bm-section-heading"><h2>${text("lineup")}</h2><span data-ready-count>0 / 4</span></div>
            <div class="bm-player-list">
              ${game.controls.map(player => `
                <div class="bm-player" data-player="${player.id}" style="--player-color:${player.color}">
                  <div class="bm-avatar">${avatar(player.id)}<span>P${player.id + 1}</span></div>
                  <div class="bm-player-info">
                    <div class="bm-player-name"><strong>${player.name}</strong><span class="bm-player-status" data-player-status>${text("waiting")}</span></div>
                    <div class="bm-player-controls">${moveKeys(player)}<span class="bm-controls-divider"></span>${bombKey(player)}</div>
                    <div class="bm-player-stats" data-player-stats hidden></div>
                  </div>
                  <div class="bm-score" data-score aria-label="${text("wins")}">0</div>
                </div>`).join("")}
            </div>
            <p class="bm-score-note">${text("firstToThree")}</p>
          </section>
          <section class="bm-powerups">
            <div class="bm-section-heading"><h2>${text("powerups")}</h2><span class="bm-section-number">+4</span></div>
            <div class="bm-powerup-list">
              ${["flame", "bomb", "speed", "shield"].map(type => `<div class="bm-powerup"><img src="${game.itemTextures[type]}" alt="" width="40" height="40"><div><h3>${text(`${type}Title`)}</h3><p>${text(`${type}Description`)}</p></div></div>`).join("")}
            </div>
          </section>
          <button type="button" class="bm-tool bm-help-button" data-action="help" aria-label="${text("howToPlay")}" title="${text("howToPlay")}">${icon("help")}<span>${text("howToPlay")}</span></button>
        </aside>
      </div>

      <p class="bm-announcement" role="status" aria-live="polite"></p>
      <dialog class="bm-help">
        <div class="bm-section-heading"><p class="bm-eyebrow">${text("quickGuide")}</p><button type="button" class="bm-tool" data-action="close-help" aria-label="${text("close")}">×</button></div>
        <h2>${text("howToPlay")}</h2>
        <ol>${["ruleMove", "ruleBomb", "ruleBlast", "rulePowerup", "ruleWin"].map(rule => `<li>${text(rule)}</li>`).join("")}</ol>
        <div class="bm-help-keys">${game.controls.map(player => `<div style="--player-color:${player.color}"><strong>P${player.id + 1}</strong>${moveKeys(player)}<span>${text("bombControl")}</span>${bombKey(player)}</div>`).join("")}</div>
        <p class="bm-keyboard-note">${text("keyboardNote")}</p>
        <p class="bm-sources">${text("inspiredBy")} <a href="https://dds.konami.com/games/manual/sbro/multi/en/pc/page04.html" target="_blank" rel="noopener">Konami</a> · <a href="https://bombermaaan.sourceforge.net/features.php.html" target="_blank" rel="noopener">Bombermaaan</a></p>
      </dialog>
    </section>`;

  const page = container.querySelector(".bm-page");
  const canvas = page.querySelector("canvas");
  const renderer = game.createRenderer(canvas);
  const overlay = page.querySelector(".bm-overlay");
  const help = page.querySelector("dialog");
  const announcement = page.querySelector(".bm-announcement");
  const pauseButton = page.querySelector('[data-action="pause"]');
  const clock = page.querySelector("[data-clock]");
  const playerRows = [...page.querySelectorAll(".bm-player")];
  const layout = page.querySelector(".bm-layout");
  const arena = page.querySelector(".bm-arena-panel");
  const stage = page.querySelector(".bm-stage");
  const sidebar = page.querySelector(".bm-sidebar");

  function fitOverlay() {
    const card = overlay.firstElementChild;
    if (overlay.hidden || !card) return;
    const style = getComputedStyle(overlay);
    const width = overlay.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
    const height = overlay.clientHeight - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom);
    const scale = Math.max(0, Math.min(1, width / card.offsetWidth, height / card.offsetHeight));
    card.style.transform = `scale(${scale})`;
  }

  function fitLayout() {
    if (disposed || !layout.clientHeight) return;
    sidebar.style.zoom = "1";
    const sidebarScale = Math.min(1, layout.clientHeight / sidebar.offsetHeight);
    sidebar.style.zoom = String(sidebarScale);
    const gap = parseFloat(getComputedStyle(layout).columnGap);
    const frameWidth = arena.offsetWidth - stage.offsetWidth;
    const frameHeight = arena.offsetHeight - stage.offsetHeight;
    const availableWidth = layout.clientWidth - sidebar.getBoundingClientRect().width - gap - frameWidth;
    const availableHeight = layout.clientHeight - frameHeight;
    const boardWidth = Math.max(0, Math.floor(Math.min(availableWidth, availableHeight * game.rules.columns / game.rules.rows)));
    arena.style.width = `${boardWidth + frameWidth}px`;
    fitOverlay();
    renderer.resize();
    const displayState = phase === "lobby" ? lobbyState : round.state;
    renderer.draw(displayState, { theme, time: displayState.elapsed });
  }

  function updateSound() {
    const on = !muted;
    const button = page.querySelector('[data-action="sound"]');
    button.setAttribute("aria-pressed", String(on));
    button.setAttribute("aria-label", text(on ? "mute" : "unmute"));
    page.querySelector("[data-sound-label]").textContent = text(on ? "soundOn" : "soundOff");
    audio.setVolume(on ? soundVolume : 0);
    saveSetting("muted", muted);
  }

  function updatePlayers() {
    const isLobby = phase === "lobby";
    page.querySelector("[data-ready-count]").textContent = `${joined.size} / 4`;
    playerRows.forEach((row, id) => {
      const player = round?.state.players.find(candidate => candidate.id === id);
      const active = joined.has(id);
      row.classList.toggle("is-ready", active);
      row.classList.toggle("is-out", active && !isLobby && player && !player.alive);
      row.querySelector("[data-player-status]").textContent = text(!active ? "waiting" : isLobby ? "ready" : player?.alive ? "inGame" : "out");
      row.querySelector("[data-score]").textContent = scores[id];
      const stats = row.querySelector("[data-player-stats]");
      stats.hidden = isLobby || !active || !player;
      row.querySelector(".bm-player-controls").hidden = !stats.hidden;
      const values = player ? `${player.capacity},${player.range},${player.speed},${player.shield}` : "";
      if (!stats.hidden && stats.dataset.values !== values) {
        stats.dataset.values = values;
        stats.innerHTML = `<span><img src="${game.itemTextures.bomb}" alt="${text("bombTitle")}">${player.capacity}</span><span><img src="${game.itemTextures.flame}" alt="${text("flameTitle")}">${player.range}</span><span><img src="${game.itemTextures.speed}" alt="${text("speedTitle")}">${player.speed}</span>${player.shield ? `<span><img src="${game.itemTextures.shield}" alt="${text("shieldTitle")}">1</span>` : ""}`;
      }
    });
    page.querySelectorAll("[data-join]").forEach(button => {
      const ready = joined.has(Number(button.dataset.join));
      button.classList.toggle("is-ready", ready);
      button.setAttribute("aria-pressed", String(ready));
      button.querySelector(".bm-join-status").textContent = text(ready ? "ready" : "pressToJoin");
    });
  }

  function updateClock() {
    const remaining = round?.state.remaining ?? game.rules.roundDuration;
    const seconds = Math.ceil(remaining);
    const label = `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
    clock.textContent = label;
    clock.classList.toggle("is-urgent", remaining <= 20 && phase !== "lobby");
    canvas.setAttribute("aria-label", text("canvasStatus", { time: label, alive: phase === "lobby" ? joined.size : round.state.players.filter(player => player.alive).length }));
  }

  function updateCountdown() {
    const status = page.querySelector("[data-countdown]");
    const start = page.querySelector('[data-action="start"]');
    if (!status || !start) return;
    status.textContent = countdown > 0 ? text("startsIn", { seconds: Math.ceil(countdown) }) : text("joinCount", { count: joined.size });
    start.disabled = joined.size < 2;
    start.querySelector("span").textContent = text(joined.size < 2 ? "waitingForPlayers" : "startNow");
  }

  function renderOverlay() {
    page.dataset.phase = phase;
    overlay.hidden = phase === "running";
    pauseButton.disabled = !["running", "paused"].includes(phase);
    pauseButton.setAttribute("aria-label", text(phase === "paused" ? "resume" : "pause"));
    pauseButton.title = text(phase === "paused" ? "resume" : "pause");
    page.querySelector("[data-round-label]").textContent = phase === "lobby" ? text("lobby") : text("roundNumber", { number: String(roundNumber).padStart(2, "0") });
    page.querySelector("[data-arena-status]").textContent = text(phase === "paused" ? "paused" : phase === "result" ? "roundComplete" : "localPlayers");
    if (phase === "lobby") {
      overlay.innerHTML = `<section class="bm-lobby-card" aria-label="${text("joinPlayers")}">
        <p class="bm-eyebrow">${text("localPlayers")}</p>
        <h2>${text("readySetBoom")}</h2>
        <p class="bm-lobby-description">${text("joinPrompt")}</p>
        <div class="bm-join-grid">${game.controls.map(player => `<button type="button" class="bm-join" data-join="${player.id}" aria-pressed="${joined.has(player.id)}" style="--player-color:${player.color}"><span class="bm-join-person">${avatar(player.id)}<strong>P${player.id + 1}</strong><span class="bm-join-status">${text("pressToJoin")}</span></span><span class="bm-join-controls">${moveKeys(player)}<span class="bm-join-bomb">${bombKey(player)}</span></span></button>`).join("")}</div>
        <p class="bm-countdown" data-countdown role="status"></p>
        <button type="button" class="bm-primary" data-action="start"><span></span>${key("Space")}${icon("arrow")}</button>
      </section>`;
      updateCountdown();
    } else if (phase === "paused") {
      overlay.innerHTML = `<section class="bm-message-card"><span class="bm-message-symbol">Ⅱ</span><p class="bm-eyebrow">${text("paused")}</p><h2>${text("pauseTitle")}</h2><p>${text("pauseDescription")}</p><button type="button" class="bm-primary" data-action="resume">${text("resume")}${key("Esc")}${icon("arrow")}</button><button type="button" class="bm-text-button" data-action="lobby">${text("changePlayers")}</button></section>`;
    } else if (phase === "result") {
      const winner = round.state.winnerId;
      const matchWon = winner !== null && scores[winner] >= 3;
      overlay.innerHTML = `<section class="bm-message-card bm-result-card">${winner !== null ? `<div class="bm-result-avatar">${avatar(winner)}</div>` : '<span class="bm-message-symbol">↔</span>'}<p class="bm-eyebrow">${text(matchWon ? "matchComplete" : "roundComplete")}</p><h2>${winner === null ? text("draw") : text(matchWon ? "matchWinner" : "roundWinner", { player: `P${winner + 1}` })}</h2><p>${text(winner === null ? "drawDescription" : matchWon ? "matchDescription" : "nextRoundDescription")}</p><button type="button" class="bm-primary" data-action="next"><span>${text(matchWon ? "newMatch" : "nextRound")}</span>${key("Space")}${icon("arrow")}</button><button type="button" class="bm-text-button" data-action="lobby">${text("changePlayers")}</button></section>`;
    }
    updatePlayers();
    updateClock();
    fitLayout();
  }

  function clearInput() {
    held.clear();
    queuedMoves.clear();
    page.querySelectorAll(".is-pressed").forEach(element => element.classList.remove("is-pressed"));
  }

  function joinPlayer(id, toggle = false) {
    if (phase !== "lobby") return;
    if (joined.has(id)) {
      if (!toggle) return;
      joined.delete(id);
    } else {
      joined.add(id);
      audio.play("join");
    }
    countdown = joined.size >= 2 ? 5 : 0;
    countdownTick = Math.ceil(countdown);
    announcement.textContent = text("joinCount", { count: joined.size });
    updatePlayers();
    updateCountdown();
  }

  function startRound() {
    if (joined.size < 2) return;
    clearInput();
    countdown = 0;
    round = game.createRound([...joined].sort());
    roundNumber++;
    phase = "running";
    renderOverlay();
    page.focus({ preventScroll: true });
    audio.play("start");
    announcement.textContent = text("roundStarted", { number: roundNumber });
  }

  function showLobby() {
    clearInput();
    phase = "lobby";
    round = null;
    roundNumber = 0;
    scores.fill(0);
    joined.clear();
    countdown = 0;
    renderOverlay();
  }

  function pause() {
    clearInput();
    if (phase !== "running") return;
    phase = "paused";
    renderOverlay();
  }

  function resume() {
    if (phase !== "paused" || help.open || document.body.classList.contains("is-navigation-open")) return;
    clearInput();
    phase = "running";
    lastFrame = 0;
    renderOverlay();
  }

  function nextRound() {
    if (scores.some(score => score >= 3)) {
      scores.fill(0);
      roundNumber = 0;
    }
    startRound();
  }

  function setTheme(id) {
    if (!Object.hasOwn(game.themes, id)) return;
    theme = id;
    page.dataset.theme = theme;
    page.querySelectorAll("[data-theme-option]").forEach(button => button.setAttribute("aria-pressed", String(button.dataset.themeOption === theme)));
    page.querySelectorAll("[data-avatar]").forEach(image => { image.src = game.themes[theme].textures.players[Number(image.dataset.avatar)]; });
  }

  function handleClick(event) {
    const join = event.target.closest("[data-join]");
    const themeButton = event.target.closest("[data-theme-option]");
    const action = event.target.closest("[data-action]")?.dataset.action;
    if (!join && !themeButton && !action) return;
    audio.unlock();
    if (join) joinPlayer(Number(join.dataset.join), true);
    if (themeButton) setTheme(themeButton.dataset.themeOption);
    if (action === "start") startRound();
    if (action === "next") nextRound();
    if (action === "lobby") showLobby();
    if (action === "resume") resume();
    if (action === "pause") phase === "paused" ? resume() : pause();
    if (action === "sound") {
      muted = !muted;
      updateSound();
      if (!muted) audio.play("join");
    }
    if (action === "help") {
      pause();
      help.showModal();
    }
    if (action === "close-help") help.close();
    if (action === "fullscreen") {
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
      else if (page.requestFullscreen) page.requestFullscreen().catch(() => { announcement.textContent = text("fullscreenUnavailable"); });
    }
  }

  function handleKeyDown(event) {
    if (help.open || document.body.classList.contains("is-navigation-open")
      || event.ctrlKey || event.altKey || event.metaKey
      || event.target.closest("input, select, textarea, [contenteditable='true']")) return;
    if (["Space", "Enter"].includes(event.code) && event.target.closest("button, a")) return;
    if (event.code === "Escape") {
      if (phase === "running") { event.preventDefault(); pause(); }
      else if (phase === "paused") { event.preventDefault(); resume(); }
      return;
    }
    if (event.code === "Space") {
      event.preventDefault();
      if (event.repeat) return;
      audio.unlock();
      if (phase === "lobby" && joined.size >= 2) startRound();
      else if (phase === "result") nextRound();
      return;
    }
    const control = controlByCode.get(event.code);
    if (!control) return;
    event.preventDefault();
    audio.unlock();
    page.querySelectorAll(`[data-code="${event.code}"]`).forEach(element => element.classList.add("is-pressed"));
    if (phase === "lobby" && !event.repeat) joinPlayer(control.id);
    if (phase === "running" && !event.repeat) {
      if (control.bomb) round.placeBomb(control.id);
      else {
        const player = round.state.players.find(player => player.id === control.id);
        if (player?.moving) queuedMoves.set(control.id, control.direction);
        else round.move(control.id, ...game.directions[control.direction]);
        held.set(event.code, control);
      }
    }
  }

  function handleKeyUp(event) {
    held.delete(event.code);
    if (!controlByCode.has(event.code)) return;
    page.querySelectorAll(`[data-code="${event.code}"]`).forEach(element => element.classList.remove("is-pressed"));
  }

  function suspend() {
    pause();
    if (phase === "lobby" && countdown > 0) {
      countdown = 0;
      updateCountdown();
    }
  }
  const onVisibility = () => { if (document.hidden) suspend(); };
  const onResize = () => fitLayout();
  const layoutObserver = new ResizeObserver(fitLayout);
  const menuObserver = new MutationObserver(() => {
    if (document.body.classList.contains("is-navigation-open")) suspend();
  });

  function frame(timestamp) {
    if (disposed) return;
    const delta = lastFrame ? Math.min(0.05, (timestamp - lastFrame) / 1000) : 0;
    lastFrame = timestamp;
    if (phase === "lobby" && countdown > 0) {
      countdown = Math.max(0, countdown - delta);
      const tick = Math.ceil(countdown);
      if (tick !== countdownTick) {
        countdownTick = tick;
        if (tick > 0) audio.play("countdown");
        updateCountdown();
      }
      if (countdown === 0) startRound();
    }
    if (phase === "running") {
      const latest = new Map();
      for (const control of held.values()) latest.set(control.id, control.direction);
      for (const [id, direction] of queuedMoves) latest.set(id, direction);
      for (const [id, direction] of latest) {
        const player = round.state.players.find(player => player.id === id);
        if (!player?.moving) {
          round.move(id, ...game.directions[direction]);
          queuedMoves.delete(id);
        }
      }
      round.advance(delta);
      const played = new Set();
      for (const event of round.drainEvents()) {
        if (!played.has(event.type) && Object.hasOwn(game.sounds, event.type)) {
          audio.play(event.type);
          played.add(event.type);
        }
      }
      if (round.state.phase === "finished") {
        clearInput();
        phase = "result";
        if (round.state.winnerId !== null) scores[round.state.winnerId]++;
        renderOverlay();
        audio.play(round.state.winnerId === null ? "draw" : "victory");
        announcement.textContent = round.state.winnerId === null ? text("draw") : text("roundWinner", { player: `P${round.state.winnerId + 1}` });
      }
    }
    const displayState = phase === "lobby" ? lobbyState : round.state;
    renderer.draw(displayState, { theme, time: displayState.elapsed });
    if (timestamp - lastUiUpdate > 150) {
      lastUiUpdate = timestamp;
      updateClock();
      if (phase === "running") updatePlayers();
    }
    animationId = requestAnimationFrame(frame);
  }

  page.addEventListener("click", handleClick);
  window.addEventListener("keydown", handleKeyDown);
  window.addEventListener("keyup", handleKeyUp);
  window.addEventListener("blur", suspend);
  window.addEventListener("resize", onResize);
  document.addEventListener("visibilitychange", onVisibility);
  menuObserver.observe(document.body, { attributes: true, attributeFilter: ["class"] });
  layoutObserver.observe(layout);
  renderOverlay();
  updateSound();
  animationId = requestAnimationFrame(frame);

  return () => {
    disposed = true;
    cancelAnimationFrame(animationId);
    menuObserver.disconnect();
    layoutObserver.disconnect();
    window.removeEventListener("keydown", handleKeyDown);
    window.removeEventListener("keyup", handleKeyUp);
    window.removeEventListener("blur", suspend);
    window.removeEventListener("resize", onResize);
    document.removeEventListener("visibilitychange", onVisibility);
    page.removeEventListener("click", handleClick);
    if (help.open) help.close();
    audio.dispose();
  };
}

window.gagunPageModules = window.gagunPageModules || [];
window.gagunPageModules.push({
  id: "bomberman",
  sectionId: "games",
  navKey: "pages.bomberman.navLabel",
  titleKey: "pages.bomberman.title",
  requiresDesktop: true,
  desktopOnlyMessageKey: "pages.bomberman.desktopOnlyMessage",
  theme: { background: "#f3f4ed", backgroundSoft: "#f3f4ed", mathOpacity: "0" },
  render: renderBomberman,
});
