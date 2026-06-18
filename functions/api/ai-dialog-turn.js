const JSON_HEADERS = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store",
};

const ALLOWED_MODELS = {
  openai: new Set(["gpt-5.5", "gpt-5.4", "gpt-5.4-mini", "gpt-5.4-nano"]),
  gemini: new Set([
    "gemini-3.5-flash",
    "gemini-3.1-pro",
    "gemini-3.1-flash-lite",
    "gemini-2.5-flash",
    "gemini-2.5-pro",
  ]),
  anthropic: new Set([
    "claude-opus-4-8",
    "claude-sonnet-4-6",
    "claude-haiku-4-5",
    "claude-fable-5",
  ]),
  xai: new Set(["grok-4.3"]),
};

const PROVIDER_TIMEOUT_MS = 45000;
const MAX_TOPIC_LENGTH = 4000;
const MAX_HISTORY_MESSAGES = 24;

class PublicError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: JSON_HEADERS,
  });
}

export async function onRequestPost({ request }) {
  try {
    const body = await readJson(request);
    const input = validateRequest(body);
    const speaker = input.participants.find((participant) => participant.id === input.speakerId);
    const prompt = buildTurnPrompt(input, speaker);
    const adapter = providerAdapters[speaker.provider];
    const result = await adapter({
      speaker,
      prompt,
      settings: input.settings,
    });

    return jsonResponse({
      message: {
        speakerId: speaker.id,
        provider: speaker.provider,
        model: speaker.model,
        content: result.content,
        createdAt: new Date().toISOString(),
      },
      usage: result.usage,
    });
  } catch (error) {
    if (error instanceof PublicError) {
      return errorResponse(error.status, error.code, error.message);
    }

    return errorResponse(
      502,
      "provider_error",
      "The model request failed. Check the selected model, key, quota, or provider status.",
    );
  }
}

async function readJson(request) {
  try {
    return await request.json();
  } catch (_error) {
    throw new PublicError(400, "invalid_json", "Request body must be valid JSON.");
  }
}

function validateRequest(body) {
  if (!body || typeof body !== "object") {
    throw new PublicError(400, "invalid_request", "Request body is required.");
  }

  const topic = normalizeText(body.topic);
  if (!topic) {
    throw new PublicError(400, "missing_topic", "Topic is required.");
  }

  if (topic.length > MAX_TOPIC_LENGTH) {
    throw new PublicError(400, "topic_too_long", "Topic is too long.");
  }

  if (!Array.isArray(body.participants) || body.participants.length !== 2) {
    throw new PublicError(400, "invalid_participants", "Exactly two participants are required.");
  }

  const participants = body.participants.map(validateParticipant);
  const participantIds = new Set(participants.map((participant) => participant.id));
  if (participantIds.size !== participants.length) {
    throw new PublicError(400, "duplicate_participant", "Participant IDs must be unique.");
  }

  const speakerId = normalizeText(body.speakerId);
  if (!participantIds.has(speakerId)) {
    throw new PublicError(400, "invalid_speaker", "Speaker must be one of the participants.");
  }

  const history = validateHistory(body.history);
  const settings = validateSettings(body.settings);

  return {
    topic,
    participants,
    speakerId,
    history,
    settings,
  };
}

function validateParticipant(value) {
  if (!value || typeof value !== "object") {
    throw new PublicError(400, "invalid_participant", "Participant is invalid.");
  }

  const id = normalizeText(value.id);
  const provider = normalizeText(value.provider);
  const model = normalizeText(value.model);
  const apiKey = normalizeText(value.apiKey);

  if (!/^[a-z0-9-]{3,40}$/i.test(id)) {
    throw new PublicError(400, "invalid_participant_id", "Participant ID is invalid.");
  }

  if (!Object.hasOwn(ALLOWED_MODELS, provider)) {
    throw new PublicError(400, "unsupported_provider", "Provider is not supported.");
  }

  if (!ALLOWED_MODELS[provider].has(model)) {
    throw new PublicError(400, "unsupported_model", "Model is not enabled for this provider.");
  }

  if (!apiKey || apiKey.length > 4096) {
    throw new PublicError(400, "missing_api_key", "API key is required for each participant.");
  }

  return {
    id,
    provider,
    model,
    apiKey,
  };
}

function validateHistory(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.slice(-MAX_HISTORY_MESSAGES).map((message) => ({
    speakerId: normalizeText(message?.speakerId).slice(0, 40),
    provider: normalizeText(message?.provider).slice(0, 40),
    model: normalizeText(message?.model).slice(0, 80),
    content: normalizeText(message?.content).slice(0, 5000),
    createdAt: normalizeText(message?.createdAt).slice(0, 40),
  }));
}

function validateSettings(value) {
  const settings = value && typeof value === "object" ? value : {};

  return {
    maxOutputTokens: clampNumber(settings.maxOutputTokens, 120, 1200, 350),
    temperature: clampNumber(settings.temperature, 0, 1, 0.6),
  };
}

function clampNumber(value, min, max, fallback) {
  const numberValue = Number(value);

  if (!Number.isFinite(numberValue)) {
    return fallback;
  }

  return Math.min(max, Math.max(min, numberValue));
}

function normalizeText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function buildTurnPrompt(input, speaker) {
  const otherParticipants = input.participants
    .filter((participant) => participant.id !== speaker.id)
    .map((participant) => `${participant.provider}/${participant.model}`)
    .join(", ");
  const transcript = input.history.length
    ? input.history
        .map((message) => {
          const label = message.speakerId === speaker.id ? "You earlier" : message.speakerId;
          return `${label}: ${message.content}`;
        })
        .join("\n\n")
    : "No prior messages.";

  return [
    "You are participating in a moderated, turn-based discussion between AI models.",
    `You are ${speaker.provider}/${speaker.model}.`,
    `Other participant: ${otherParticipants}.`,
    "",
    "Rules:",
    "- Be concise and concrete.",
    "- Prefer 2-5 short sentences or tight bullets.",
    "- Do not add filler, disclaimers, or meta commentary.",
    "- Respond to the topic and the previous message when there is one.",
    "- If you disagree, state the specific reason and the practical implication.",
    "- Ask at most one focused question, only when it changes the next step.",
    "",
    `Topic: ${input.topic}`,
    "",
    "Transcript so far:",
    transcript,
    "",
    "Your next turn:",
  ].join("\n");
}

const providerAdapters = {
  openai: requestOpenAi,
  gemini: requestGemini,
  anthropic: requestAnthropic,
  xai: requestXai,
};

async function requestOpenAi({ speaker, prompt, settings }) {
  const data = await fetchJson(
    "https://api.openai.com/v1/responses",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${speaker.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: speaker.model,
        input: prompt,
        max_output_tokens: settings.maxOutputTokens,
        temperature: settings.temperature,
        store: false,
      }),
    },
    "openai",
  );

  return {
    content: extractOpenAiText(data),
    usage: {
      inputTokens: data.usage?.input_tokens || 0,
      outputTokens: data.usage?.output_tokens || 0,
    },
  };
}

async function requestGemini({ speaker, prompt, settings }) {
  const data = await fetchJson(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
      speaker.model,
    )}:generateContent`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": speaker.apiKey,
      },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [{ text: prompt }],
          },
        ],
        generationConfig: {
          maxOutputTokens: settings.maxOutputTokens,
          temperature: settings.temperature,
        },
      }),
    },
    "gemini",
  );

  const content = data.candidates?.[0]?.content?.parts
    ?.map((part) => part.text || "")
    .join("")
    .trim();

  return {
    content: requireContent(content),
    usage: {
      inputTokens: data.usageMetadata?.promptTokenCount || 0,
      outputTokens: data.usageMetadata?.candidatesTokenCount || 0,
    },
  };
}

async function requestAnthropic({ speaker, prompt, settings }) {
  const data = await fetchJson(
    "https://api.anthropic.com/v1/messages",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": speaker.apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: speaker.model,
        max_tokens: settings.maxOutputTokens,
        temperature: settings.temperature,
        messages: [
          {
            role: "user",
            content: prompt,
          },
        ],
      }),
    },
    "anthropic",
  );

  const content = data.content
    ?.map((part) => (part.type === "text" ? part.text : ""))
    .join("")
    .trim();

  return {
    content: requireContent(content),
    usage: {
      inputTokens: data.usage?.input_tokens || 0,
      outputTokens: data.usage?.output_tokens || 0,
    },
  };
}

async function requestXai({ speaker, prompt, settings }) {
  const data = await fetchJson(
    "https://api.x.ai/v1/chat/completions",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${speaker.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: speaker.model,
        messages: [
          {
            role: "user",
            content: prompt,
          },
        ],
        max_tokens: settings.maxOutputTokens,
        temperature: settings.temperature,
      }),
    },
    "xai",
  );

  const content = data.choices?.[0]?.message?.content;

  return {
    content: requireContent(content),
    usage: {
      inputTokens: data.usage?.prompt_tokens || 0,
      outputTokens: data.usage?.completion_tokens || 0,
    },
  };
}

async function fetchJson(url, options, provider) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), PROVIDER_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new PublicError(
        response.status >= 400 && response.status < 500 ? 400 : 502,
        "provider_rejected",
        `${provider} rejected the request. Check the API key, selected model, quota, or provider access.`,
      );
    }

    return await response.json();
  } catch (error) {
    if (error instanceof PublicError) {
      throw error;
    }

    if (error.name === "AbortError") {
      throw new PublicError(504, "provider_timeout", `${provider} did not respond in time.`);
    }

    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

function extractOpenAiText(data) {
  if (typeof data.output_text === "string") {
    return requireContent(data.output_text);
  }

  const outputText = data.output
    ?.flatMap((item) => item.content || [])
    .map((part) => part.text || "")
    .join("")
    .trim();

  return requireContent(outputText);
}

function requireContent(value) {
  const content = normalizeText(value);

  if (!content) {
    throw new PublicError(502, "empty_provider_response", "The provider returned an empty response.");
  }

  return content;
}

function jsonResponse(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: JSON_HEADERS,
  });
}

function errorResponse(status, code, message) {
  return jsonResponse(
    {
      error: {
        code,
        message,
      },
    },
    status,
  );
}
