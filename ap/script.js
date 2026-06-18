(() => {
  const DEFAULT_LANG = "pl";
  const SUPPORTED_LANGS = new Set((window.AP_LANGUAGES || []).map((language) => language.code));
  const messages = window.AP_MESSAGES || {};
  const formEndpoint = (window.AP_FORM_ENDPOINT || "").trim();

  const elements = {
    langButtons: document.querySelectorAll("[data-lang]"),
    form: document.querySelector("#contactForm"),
    formStatus: document.querySelector("[data-form-status]"),
    formLanguage: document.querySelector("[data-form-language]"),
    formConfigWarning: document.querySelector("[data-form-config-warning]"),
    privacyDialog: document.querySelector("[data-privacy-dialog]"),
    privacyOpenButtons: document.querySelectorAll("[data-privacy-open]"),
    privacyCloseButtons: document.querySelectorAll("[data-privacy-close]"),
  };

  let activeLang = getInitialLang();

  function getInitialLang() {
    const params = new URLSearchParams(window.location.search);
    const lang = params.get("lang");

    if (lang && SUPPORTED_LANGS.has(lang)) {
      return lang;
    }

    return DEFAULT_LANG;
  }

  function readMessage(key) {
    return key.split(".").reduce((value, segment) => {
      return value && Object.hasOwn(value, segment) ? value[segment] : undefined;
    }, messages[activeLang]);
  }

  function t(key) {
    const value = readMessage(key);
    return typeof value === "string" ? value : key;
  }

  function applyTranslations() {
    document.documentElement.lang = activeLang;
    document.title = t("meta.title");

    document.querySelectorAll("[data-i18n]").forEach((node) => {
      node.textContent = t(node.dataset.i18n);
    });

    document.querySelectorAll("[data-i18n-attr]").forEach((node) => {
      node.dataset.i18nAttr.split(",").forEach((instruction) => {
        const [attribute, key] = instruction.split(":").map((part) => part.trim());
        if (attribute && key) {
          node.setAttribute(attribute, t(key));
        }
      });
    });

    elements.langButtons.forEach((button) => {
      button.setAttribute("aria-pressed", String(button.dataset.lang === activeLang));
    });

    if (elements.formLanguage) {
      elements.formLanguage.value = activeLang;
    }
  }

  function setLang(lang) {
    if (!SUPPORTED_LANGS.has(lang) || lang === activeLang) return;

    activeLang = lang;
    const url = new URL(window.location.href);
    url.searchParams.set("lang", lang);
    history.replaceState(null, "", url);
    applyTranslations();
  }

  function isConfiguredEndpoint(endpoint) {
    return /^https:\/\/formspree\.io\/f\/[a-z0-9]+$/i.test(endpoint);
  }

  function setStatus(message, type = "neutral") {
    if (!elements.formStatus) return;
    elements.formStatus.textContent = message;
    elements.formStatus.dataset.status = type;
  }

  function setFormDisabled(isDisabled) {
    if (!elements.form) return;

    elements.form.querySelectorAll("input, textarea, button").forEach((control) => {
      if (control.classList.contains("honeypot")) return;
      control.disabled = isDisabled;
    });
  }

  async function handleFormSubmit(event) {
    event.preventDefault();

    if (!elements.form) return;

    if (!elements.form.checkValidity()) {
      elements.form.reportValidity();
      setStatus(t("form.validation"), "error");
      return;
    }

    if (!isConfiguredEndpoint(formEndpoint)) {
      setStatus(t("form.notConfigured"), "error");
      elements.formConfigWarning.hidden = false;
      return;
    }

    const formData = new FormData(elements.form);
    if (formData.get("website")) {
      elements.form.reset();
      setStatus(t("form.success"), "success");
      return;
    }

    formData.set("_subject", "Wiadomość ze strony kancelarii");
    formData.set("language", activeLang);

    setFormDisabled(true);
    setStatus(t("form.sending"), "neutral");

    try {
      const response = await fetch(formEndpoint, {
        method: "POST",
        body: formData,
        headers: {
          Accept: "application/json",
        },
      });

      if (!response.ok) {
        throw new Error(`Formspree returned ${response.status}`);
      }

      elements.form.reset();
      if (elements.formLanguage) {
        elements.formLanguage.value = activeLang;
      }
      setStatus(t("form.success"), "success");
    } catch (_error) {
      setStatus(t("form.error"), "error");
    } finally {
      setFormDisabled(false);
    }
  }

  function openPrivacyDialog() {
    if (!elements.privacyDialog) return;

    if (typeof elements.privacyDialog.showModal === "function") {
      elements.privacyDialog.showModal();
      return;
    }

    elements.privacyDialog.setAttribute("open", "");
  }

  function closePrivacyDialog() {
    if (!elements.privacyDialog) return;

    if (typeof elements.privacyDialog.close === "function") {
      elements.privacyDialog.close();
      return;
    }

    elements.privacyDialog.removeAttribute("open");
  }

  elements.langButtons.forEach((button) => {
    button.addEventListener("click", () => setLang(button.dataset.lang));
  });

  if (elements.form) {
    elements.form.addEventListener("submit", handleFormSubmit);
  }

  elements.privacyOpenButtons.forEach((button) => {
    button.addEventListener("click", (event) => {
      event.preventDefault();
      openPrivacyDialog();
    });
  });

  elements.privacyCloseButtons.forEach((button) => {
    button.addEventListener("click", closePrivacyDialog);
  });

  if (elements.privacyDialog) {
    elements.privacyDialog.addEventListener("click", (event) => {
      if (event.target === elements.privacyDialog) {
        closePrivacyDialog();
      }
    });
  }

  applyTranslations();
})();
