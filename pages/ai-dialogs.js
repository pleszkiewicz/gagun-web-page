function renderAiDialogs(container, { t }) {
  const providerCatalog = [
    {
      provider: "openai",
      label: "OpenAI",
      id: "openai",
      models: ["gpt-5.4-mini", "gpt-5.5", "gpt-5.4", "gpt-5.4-nano"],
      accent: "#0f6bff",
    },
    {
      provider: "gemini",
      label: "Gemini",
      id: "gemini",
      models: [
        "gemini-3.5-flash",
        "gemini-3.1-pro",
        "gemini-3.1-flash-lite",
        "gemini-2.5-flash",
        "gemini-2.5-pro",
      ],
      accent: "#1aa37a",
    },
    {
      provider: "anthropic",
      label: "Claude",
      id: "claude",
      models: [
        "claude-sonnet-4-6",
        "claude-haiku-4-5",
        "claude-opus-4-8",
        "claude-fable-5",
      ],
      accent: "#a05a2c",
    },
    {
      provider: "xai",
      label: "Grok",
      id: "grok",
      models: ["grok-4.3"],
      accent: "#141821",
    },
  ];

  const state = {
    phase: "setup",
    participants: [],
    history: [],
    topic: "",
    startedAt: "",
    endedAt: "",
    activeController: null,
    turnIndex: 0,
    stopRequested: false,
    settings: {
      maxRounds: 6,
      maxOutputTokens: 350,
      temperature: 0.6,
      turnTimeoutMs: 45000,
    },
  };

  container.innerHTML = `
    <section class="ai-dialogs-page" aria-label="${t("pages.aiDialogs.pageLabel")}">
      <header class="ai-dialogs-hero">
        <div>
          <p class="eyebrow">${t("pages.aiDialogs.eyebrow")}</p>
          <h1>${t("pages.aiDialogs.heading")}</h1>
        </div>
        <p>${t("pages.aiDialogs.description")}</p>
      </header>

      <div class="ai-dialogs-layout">
        <section class="ai-dialogs-setup-panel" aria-label="${t("pages.aiDialogs.setupLabel")}">
          <label class="ai-dialogs-topic-field" for="aiDialogsTopic">
            <span>${t("pages.aiDialogs.topicLabel")}</span>
            <textarea
              id="aiDialogsTopic"
              rows="5"
              maxlength="4000"
              placeholder="${t("pages.aiDialogs.topicPlaceholder")}"
            ></textarea>
          </label>

          <div class="ai-dialogs-section-head">
            <div>
              <p class="eyebrow">${t("pages.aiDialogs.participantsEyebrow")}</p>
              <h2>${t("pages.aiDialogs.participantsHeading")}</h2>
            </div>
            <span id="aiDialogsSelectionCount">${t("pages.aiDialogs.selectionCount", { count: 0 })}</span>
          </div>

          <div class="ai-dialogs-provider-grid" id="aiDialogsProviderGrid"></div>

          <div class="ai-dialogs-settings">
            <label for="aiDialogsMaxRounds">
              <span>${t("pages.aiDialogs.maxRounds")}</span>
              <input id="aiDialogsMaxRounds" type="number" min="1" max="12" step="1" value="6">
            </label>
            <label for="aiDialogsMaxTokens">
              <span>${t("pages.aiDialogs.maxTokens")}</span>
              <input id="aiDialogsMaxTokens" type="number" min="120" max="1200" step="10" value="350">
            </label>
            <label for="aiDialogsTemperature">
              <span>${t("pages.aiDialogs.temperature")}</span>
              <output id="aiDialogsTemperatureValue" for="aiDialogsTemperature">0.6</output>
              <input id="aiDialogsTemperature" type="range" min="0" max="1" step="0.1" value="0.6">
            </label>
          </div>

          <p class="ai-dialogs-security-note">${t("pages.aiDialogs.securityNote")}</p>

          <div class="ai-dialogs-actions">
            <button class="ai-dialogs-primary-action" id="aiDialogsStart" type="button" disabled>
              ${t("pages.aiDialogs.start")}
            </button>
            <button class="ai-dialogs-danger-action" id="aiDialogsStop" type="button" hidden>
              ${t("pages.aiDialogs.stop")}
            </button>
            <button class="ai-dialogs-secondary-action" id="aiDialogsNew" type="button" hidden>
              ${t("pages.aiDialogs.newDiscussion")}
            </button>
            <button class="ai-dialogs-secondary-action" id="aiDialogsExportMd" type="button" disabled>
              ${t("pages.aiDialogs.exportMd")}
            </button>
            <button class="ai-dialogs-secondary-action" id="aiDialogsExportJson" type="button" disabled>
              ${t("pages.aiDialogs.exportJson")}
            </button>
          </div>

          <p class="ai-dialogs-status" id="aiDialogsStatus" role="status">
            ${t("pages.aiDialogs.statusReady")}
          </p>
        </section>

        <section class="ai-dialogs-transcript-panel" aria-label="${t("pages.aiDialogs.transcriptLabel")}">
          <div class="ai-dialogs-transcript-head">
            <div>
              <p class="eyebrow">${t("pages.aiDialogs.transcriptEyebrow")}</p>
              <h2>${t("pages.aiDialogs.transcriptHeading")}</h2>
            </div>
            <span id="aiDialogsRoundReadout">${t("pages.aiDialogs.roundReadout", { round: 0, total: 6 })}</span>
          </div>
          <div class="ai-dialogs-transcript" id="aiDialogsTranscript">
            <div class="ai-dialogs-empty-state">
              <h2>${t("pages.aiDialogs.emptyTitle")}</h2>
              <p>${t("pages.aiDialogs.emptyMessage")}</p>
            </div>
          </div>
        </section>
      </div>
    </section>
  `;

  const elements = {
    topic: container.querySelector("#aiDialogsTopic"),
    providerGrid: container.querySelector("#aiDialogsProviderGrid"),
    selectionCount: container.querySelector("#aiDialogsSelectionCount"),
    maxRounds: container.querySelector("#aiDialogsMaxRounds"),
    maxTokens: container.querySelector("#aiDialogsMaxTokens"),
    temperature: container.querySelector("#aiDialogsTemperature"),
    temperatureValue: container.querySelector("#aiDialogsTemperatureValue"),
    start: container.querySelector("#aiDialogsStart"),
    stop: container.querySelector("#aiDialogsStop"),
    newDiscussion: container.querySelector("#aiDialogsNew"),
    exportMd: container.querySelector("#aiDialogsExportMd"),
    exportJson: container.querySelector("#aiDialogsExportJson"),
    status: container.querySelector("#aiDialogsStatus"),
    transcript: container.querySelector("#aiDialogsTranscript"),
    roundReadout: container.querySelector("#aiDialogsRoundReadout"),
  };

  function createProviderCard(providerConfig) {
    const card = document.createElement("article");
    card.className = "ai-dialogs-provider-card";
    card.dataset.provider = providerConfig.provider;
    card.style.setProperty("--provider-accent", providerConfig.accent);

    const options = providerConfig.models
      .map((model) => `<option value="${model}">${model}</option>`)
      .join("");

    card.innerHTML = `
      <label class="ai-dialogs-provider-toggle">
        <input type="checkbox" data-role="enabled">
        <span class="ai-dialogs-provider-mark" aria-hidden="true"></span>
        <span>
          <strong>${providerConfig.label}</strong>
          <small>${t("pages.aiDialogs.providerHint")}</small>
        </span>
      </label>
      <label class="ai-dialogs-provider-field">
        <span>${t("pages.aiDialogs.modelLabel")}</span>
        <select data-role="model">${options}</select>
      </label>
      <label class="ai-dialogs-provider-field">
        <span>${t("pages.aiDialogs.apiKeyLabel")}</span>
        <span class="ai-dialogs-key-row">
          <input
            type="password"
            autocomplete="off"
            spellcheck="false"
            data-role="apiKey"
            placeholder="${t("pages.aiDialogs.apiKeyPlaceholder", { provider: providerConfig.label })}"
          >
          <button type="button" data-role="toggleKey" aria-label="${t("pages.aiDialogs.showKey")}">
            ${t("pages.aiDialogs.showKeyShort")}
          </button>
        </span>
      </label>
      <p class="ai-dialogs-provider-status" data-role="status">
        ${t("pages.aiDialogs.providerIdle")}
      </p>
    `;

    return card;
  }

  providerCatalog.forEach((providerConfig) => {
    const card = createProviderCard(providerConfig);
    elements.providerGrid.append(card);
  });

  const providerCards = [...elements.providerGrid.querySelectorAll(".ai-dialogs-provider-card")];

  function getProviderConfig(provider) {
    return providerCatalog.find((candidate) => candidate.provider === provider);
  }

  function setStatus(message, tone = "") {
    elements.status.textContent = message;
    elements.status.dataset.tone = tone;
  }

  function getCardData(card) {
    const provider = card.dataset.provider;
    const providerConfig = getProviderConfig(provider);
    const enabled = card.querySelector('[data-role="enabled"]').checked;
    const model = card.querySelector('[data-role="model"]').value;
    const apiKey = card.querySelector('[data-role="apiKey"]').value.trim();

    return {
      id: `${providerConfig.id}-1`,
      provider,
      label: providerConfig.label,
      model,
      apiKey,
      enabled,
    };
  }

  function getSelectedParticipants() {
    return providerCards.map(getCardData).filter((participant) => participant.enabled);
  }

  function getSettings() {
    return {
      maxRounds: clampNumber(Number(elements.maxRounds.value), 1, 12, 6),
      maxOutputTokens: clampNumber(Number(elements.maxTokens.value), 120, 1200, 350),
      temperature: clampNumber(Number(elements.temperature.value), 0, 1, 0.6),
      turnTimeoutMs: 45000,
    };
  }

  function clampNumber(value, min, max, fallback) {
    if (!Number.isFinite(value)) return fallback;
    return Math.min(max, Math.max(min, value));
  }

  function getValidationMessage(participants) {
    const topic = elements.topic.value.trim();

    if (!topic) {
      return t("pages.aiDialogs.validationTopic");
    }

    if (participants.length !== 2) {
      return t("pages.aiDialogs.validationParticipants");
    }

    const missingKey = participants.find((participant) => !participant.apiKey);
    if (missingKey) {
      return t("pages.aiDialogs.validationKey", { provider: missingKey.label });
    }

    return "";
  }

  function updateProviderCards() {
    providerCards.forEach((card) => {
      const data = getCardData(card);
      const status = card.querySelector('[data-role="status"]');
      const checkbox = card.querySelector('[data-role="enabled"]');
      const keyInput = card.querySelector('[data-role="apiKey"]');
      const modelSelect = card.querySelector('[data-role="model"]');

      card.classList.toggle("is-selected", data.enabled);
      status.textContent = data.enabled
        ? t(data.apiKey ? "pages.aiDialogs.providerReady" : "pages.aiDialogs.providerNeedsKey")
        : t("pages.aiDialogs.providerIdle");
      keyInput.disabled = state.phase === "running" || !data.enabled;
      modelSelect.disabled = state.phase === "running" || !data.enabled;
      checkbox.disabled = state.phase === "running";
    });
  }

  function updateControls() {
    const participants = getSelectedParticipants();
    const validationMessage = getValidationMessage(participants);
    const isRunning = state.phase === "running";
    const hasTranscript = state.history.length > 0;

    elements.selectionCount.textContent = t("pages.aiDialogs.selectionCount", {
      count: participants.length,
    });
    elements.start.disabled = Boolean(validationMessage) || isRunning;
    elements.stop.hidden = !isRunning;
    elements.newDiscussion.hidden = state.phase === "setup";
    elements.exportMd.disabled = !hasTranscript;
    elements.exportJson.disabled = !hasTranscript;
    elements.topic.disabled = isRunning;
    elements.maxRounds.disabled = isRunning;
    elements.maxTokens.disabled = isRunning;
    elements.temperature.disabled = isRunning;
    elements.temperatureValue.textContent = String(getSettings().temperature.toFixed(1));
    elements.roundReadout.textContent = t("pages.aiDialogs.roundReadout", {
      round: getCurrentRound(),
      total: getSettings().maxRounds,
    });

    updateProviderCards();

    if (state.phase === "setup") {
      setStatus(validationMessage || t("pages.aiDialogs.statusReady"));
    }
  }

  function getCurrentRound() {
    if (!state.history.length || !state.participants.length) {
      return 0;
    }

    return Math.min(
      state.settings.maxRounds,
      Math.ceil(state.history.length / state.participants.length),
    );
  }

  function renderTranscript() {
    elements.transcript.replaceChildren();

    if (!state.history.length && state.phase !== "running") {
      const emptyState = document.createElement("div");
      emptyState.className = "ai-dialogs-empty-state";

      const heading = document.createElement("h2");
      heading.textContent = t("pages.aiDialogs.emptyTitle");

      const message = document.createElement("p");
      message.textContent = t("pages.aiDialogs.emptyMessage");

      emptyState.append(heading, message);
      elements.transcript.append(emptyState);
      return;
    }

    state.history.forEach((message) => {
      elements.transcript.append(createMessageElement(message));
    });

    if (state.phase === "running") {
      elements.transcript.append(createThinkingElement());
    }

    elements.transcript.scrollTop = elements.transcript.scrollHeight;
  }

  function createMessageElement(message) {
    const participant = state.participants.find((candidate) => candidate.id === message.speakerId);
    const item = document.createElement("article");
    item.className = "ai-dialogs-message";
    item.classList.toggle("is-error", Boolean(message.error));

    const meta = document.createElement("header");
    meta.className = "ai-dialogs-message-meta";

    const speaker = document.createElement("strong");
    speaker.textContent = participant
      ? `${participant.label} / ${participant.model}`
      : `${message.provider} / ${message.model}`;

    const time = document.createElement("time");
    time.dateTime = message.createdAt;
    time.textContent = formatTime(message.createdAt);

    const body = document.createElement("p");
    body.textContent = message.content;

    meta.append(speaker, time);
    item.append(meta, body);
    return item;
  }

  function createThinkingElement() {
    const speaker = state.participants[state.turnIndex % state.participants.length];
    const item = document.createElement("article");
    item.className = "ai-dialogs-message is-thinking";

    const meta = document.createElement("header");
    meta.className = "ai-dialogs-message-meta";

    const label = document.createElement("strong");
    label.textContent = speaker
      ? t("pages.aiDialogs.thinking", { provider: speaker.label })
      : t("pages.aiDialogs.thinkingFallback");

    const dots = document.createElement("span");
    dots.className = "ai-dialogs-thinking-dots";
    dots.setAttribute("aria-hidden", "true");
    dots.textContent = "...";

    meta.append(label, dots);
    item.append(meta);
    return item;
  }

  function formatTime(value) {
    if (!value) return "";
    return new Intl.DateTimeFormat(undefined, {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    }).format(new Date(value));
  }

  async function startDiscussion() {
    const participants = getSelectedParticipants();
    const validationMessage = getValidationMessage(participants);

    if (validationMessage) {
      setStatus(validationMessage, "error");
      updateControls();
      return;
    }

    state.phase = "running";
    state.participants = participants;
    state.history = [];
    state.topic = elements.topic.value.trim();
    state.startedAt = new Date().toISOString();
    state.endedAt = "";
    state.turnIndex = 0;
    state.stopRequested = false;
    state.settings = getSettings();

    setStatus(t("pages.aiDialogs.statusRunning"), "active");
    updateControls();
    renderTranscript();

    await runDiscussionLoop();
  }

  async function runDiscussionLoop() {
    const maxTurns = state.participants.length * state.settings.maxRounds;

    while (state.phase === "running" && !state.stopRequested && state.turnIndex < maxTurns) {
      const speaker = state.participants[state.turnIndex % state.participants.length];
      setStatus(t("pages.aiDialogs.statusSpeaker", { provider: speaker.label }), "active");
      renderTranscript();

      try {
        const message = await requestTurn(speaker);

        if (state.phase !== "running" || state.stopRequested) {
          break;
        }

        state.history.push(message);
        state.turnIndex += 1;
      } catch (error) {
        if (state.stopRequested || error.name === "AbortError") {
          break;
        }

        state.history.push({
          speakerId: speaker.id,
          provider: speaker.provider,
          model: speaker.model,
          content: error.message || t("pages.aiDialogs.errorGeneric"),
          createdAt: new Date().toISOString(),
          error: true,
        });
        state.phase = "ended";
        state.endedAt = new Date().toISOString();
        setStatus(t("pages.aiDialogs.statusError"), "error");
        break;
      }

      updateControls();
      renderTranscript();
    }

    if (state.phase === "running") {
      state.phase = "ended";
      state.endedAt = new Date().toISOString();
      setStatus(
        state.stopRequested
          ? t("pages.aiDialogs.statusStopped")
          : t("pages.aiDialogs.statusComplete"),
        state.stopRequested ? "warn" : "",
      );
    }

    state.activeController = null;
    updateControls();
    renderTranscript();
  }

  async function requestTurn(speaker) {
    const controller = new AbortController();
    let timedOut = false;
    state.activeController = controller;

    const timeoutId = window.setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, state.settings.turnTimeoutMs);

    let response;
    try {
      response = await fetch("/api/ai-dialog-turn", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          topic: state.topic,
          participants: state.participants.map((participant) => ({
            id: participant.id,
            provider: participant.provider,
            model: participant.model,
            apiKey: participant.apiKey,
          })),
          speakerId: speaker.id,
          history: state.history.map((message) => ({
            speakerId: message.speakerId,
            provider: message.provider,
            model: message.model,
            content: message.content,
            createdAt: message.createdAt,
          })),
          settings: {
            maxOutputTokens: state.settings.maxOutputTokens,
            temperature: state.settings.temperature,
          },
        }),
        signal: controller.signal,
      });
    } catch (error) {
      if (timedOut && error.name === "AbortError") {
        throw new Error(t("pages.aiDialogs.errorTimeout"));
      }

      throw error;
    } finally {
      window.clearTimeout(timeoutId);
    }

    let data = null;
    try {
      data = await response.json();
    } catch (_error) {
      data = null;
    }

    if (!response.ok) {
      const message = data?.error?.message || t("pages.aiDialogs.errorEndpoint");
      throw new Error(message);
    }

    if (!data?.message?.content) {
      throw new Error(t("pages.aiDialogs.errorEmpty"));
    }

    return data.message;
  }

  function stopDiscussion() {
    state.stopRequested = true;
    state.phase = "ended";
    state.endedAt = new Date().toISOString();
    state.activeController?.abort();
    setStatus(t("pages.aiDialogs.statusStopped"), "warn");
    updateControls();
    renderTranscript();
  }

  function resetDiscussion() {
    state.phase = "setup";
    state.participants = [];
    state.history = [];
    state.topic = "";
    state.startedAt = "";
    state.endedAt = "";
    state.turnIndex = 0;
    state.stopRequested = false;
    state.activeController?.abort();
    state.activeController = null;

    elements.topic.value = "";
    providerCards.forEach((card) => {
      card.querySelector('[data-role="enabled"]').checked = false;
      card.querySelector('[data-role="apiKey"]').value = "";
      card.querySelector('[data-role="apiKey"]').type = "password";
      const toggle = card.querySelector('[data-role="toggleKey"]');

      toggle.textContent = t("pages.aiDialogs.showKeyShort");
      toggle.setAttribute("aria-label", t("pages.aiDialogs.showKey"));
    });

    setStatus(t("pages.aiDialogs.statusReady"));
    updateControls();
    renderTranscript();
  }

  function buildExportData() {
    return {
      topic: state.topic,
      startedAt: state.startedAt,
      endedAt: state.endedAt,
      participants: state.participants.map((participant) => ({
        id: participant.id,
        provider: participant.provider,
        label: participant.label,
        model: participant.model,
      })),
      settings: {
        maxRounds: state.settings.maxRounds,
        maxOutputTokens: state.settings.maxOutputTokens,
        temperature: state.settings.temperature,
      },
      messages: state.history.map((message) => ({
        speakerId: message.speakerId,
        provider: message.provider,
        model: message.model,
        content: message.content,
        createdAt: message.createdAt,
        error: Boolean(message.error),
      })),
    };
  }

  function exportMarkdown() {
    const data = buildExportData();
    const participantLines = data.participants
      .map((participant) => `- ${participant.label}: ${participant.model}`)
      .join("\n");
    const messageLines = data.messages
      .map((message) => {
        const participant = data.participants.find(
          (candidate) => candidate.id === message.speakerId,
        );
        const speaker = participant ? `${participant.label} / ${participant.model}` : message.model;
        return `## ${speaker}\n\n${message.content}`;
      })
      .join("\n\n");

    downloadText(
      "md",
      [
        "# AI Dialog",
        "",
        `Topic: ${data.topic}`,
        `Started: ${data.startedAt || "-"}`,
        `Ended: ${data.endedAt || "-"}`,
        "",
        "## Participants",
        "",
        participantLines || "- none",
        "",
        "## Settings",
        "",
        `- Max rounds: ${data.settings.maxRounds}`,
        `- Max output tokens: ${data.settings.maxOutputTokens}`,
        `- Temperature: ${data.settings.temperature}`,
        "",
        "# Transcript",
        "",
        messageLines || "_No messages._",
        "",
      ].join("\n"),
      "text/markdown",
    );
  }

  function exportJson() {
    downloadText("json", JSON.stringify(buildExportData(), null, 2), "application/json");
  }

  function downloadText(extension, text, type) {
    const blob = new Blob([text], { type });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");

    link.href = url;
    link.download = `ai-dialog-${stamp}.${extension}`;
    document.body.append(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  function handleProviderInput(event) {
    const toggle = event.target.closest('[data-role="toggleKey"]');

    if (toggle) {
      const card = toggle.closest(".ai-dialogs-provider-card");
      const input = card.querySelector('[data-role="apiKey"]');
      const isVisible = input.type === "text";

      input.type = isVisible ? "password" : "text";
      toggle.textContent = t(isVisible ? "pages.aiDialogs.showKeyShort" : "pages.aiDialogs.hideKeyShort");
      toggle.setAttribute(
        "aria-label",
        t(isVisible ? "pages.aiDialogs.showKey" : "pages.aiDialogs.hideKey"),
      );
      return;
    }

    updateControls();
  }

  elements.start.addEventListener("click", startDiscussion);
  elements.stop.addEventListener("click", stopDiscussion);
  elements.newDiscussion.addEventListener("click", resetDiscussion);
  elements.exportMd.addEventListener("click", exportMarkdown);
  elements.exportJson.addEventListener("click", exportJson);
  elements.topic.addEventListener("input", updateControls);
  elements.maxRounds.addEventListener("input", updateControls);
  elements.maxTokens.addEventListener("input", updateControls);
  elements.temperature.addEventListener("input", updateControls);
  elements.providerGrid.addEventListener("input", handleProviderInput);
  elements.providerGrid.addEventListener("change", handleProviderInput);
  elements.providerGrid.addEventListener("click", handleProviderInput);

  updateControls();
  renderTranscript();

  return () => {
    state.stopRequested = true;
    state.activeController?.abort();
  };
}

window.gagunPageModules = window.gagunPageModules || [];
window.gagunPageModules.push({
  id: "ai-dialogs",
  sectionId: "ai",
  navKey: "pages.aiDialogs.navLabel",
  titleKey: "pages.aiDialogs.title",
  theme: {
    background: "#eef3f4",
    backgroundSoft: "#ffffff",
    mathColor: "rgba(14, 47, 55, 0.14)",
    mathOpacity: "0.6",
  },
  render: renderAiDialogs,
});
