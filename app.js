const DEFAULT_LOCALE = "en";

const appState = {
  locale: DEFAULT_LOCALE,
  activePageId: "",
  pageCleanup: null,
  collapsedSectionIds: new Set(),
};

const navigationSections = [
  {
    id: "mathematics",
    titleKey: "navigation.sections.mathematics",
  },
  {
    id: "fractals",
    titleKey: "navigation.sections.fractals",
  },
  {
    id: "chemistry",
    titleKey: "navigation.sections.chemistry",
  },
];

const pageThemeVariables = {
  background: "--page-background",
  backgroundSoft: "--page-background-soft",
  mathColor: "--page-math-color",
  mathOpacity: "--page-math-opacity",
};

const shell = {
  menuToggle: document.querySelector("#menuToggle"),
  navClose: document.querySelector("#navClose"),
  navScrim: document.querySelector("#navScrim"),
  sideNav: document.querySelector("#siteNavigation"),
  pageList: document.querySelector("#pageList"),
  pageHost: document.querySelector("#pageHost"),
  pageViewport: document.querySelector("#pageViewport"),
};

const pageModules = window.gagunPageModules || [];

function readTranslation(key) {
  return key.split(".").reduce((value, segment) => {
    if (value && Object.hasOwn(value, segment)) {
      return value[segment];
    }
    return undefined;
  }, window.gagunLocales?.[appState.locale]);
}

function t(key, replacements = {}) {
  const template = readTranslation(key);
  const text = typeof template === "string" ? template : key;

  return text.replace(/\{([a-zA-Z0-9_]+)\}/g, (_match, name) => {
    return Object.hasOwn(replacements, name) ? String(replacements[name]) : "";
  });
}

function applyStaticTranslations() {
  document.documentElement.lang = appState.locale;

  document.querySelectorAll("[data-i18n]").forEach((element) => {
    element.textContent = t(element.dataset.i18n);
  });

  document.querySelectorAll("[data-i18n-title]").forEach((element) => {
    element.title = t(element.dataset.i18nTitle);
  });

  document.querySelectorAll("[data-i18n-aria-label]").forEach((element) => {
    element.setAttribute("aria-label", t(element.dataset.i18nAriaLabel));
  });
}

function setDocumentTitle(page) {
  document.title = page ? `${t(page.titleKey)} | ${t("app.title")}` : t("app.title");
}

function applyPageTheme(page) {
  Object.values(pageThemeVariables).forEach((property) => {
    shell.pageViewport.style.removeProperty(property);
  });

  shell.pageViewport.dataset.pageId = page?.id || "unavailable";

  Object.entries(page?.theme || {}).forEach(([key, value]) => {
    const property = pageThemeVariables[key];
    if (property) {
      shell.pageViewport.style.setProperty(property, value);
    }
  });
}

function getHashPageId() {
  const rawHash = window.location.hash.replace(/^#\/?/, "").trim();
  return rawHash ? decodeURIComponent(rawHash) : "";
}

function getActivePage() {
  const hashPageId = getHashPageId();
  if (!hashPageId) {
    return pageModules[0] || null;
  }
  return pageModules.find((page) => page.id === hashPageId) || null;
}

function setNavigationInteractivity(isInteractive) {
  if ("inert" in shell.sideNav) {
    shell.sideNav.inert = !isInteractive;
  }

  shell.sideNav.querySelectorAll("a, button").forEach((element) => {
    if (isInteractive) {
      const originalTabIndex = element.dataset.originalTabIndex;
      if (originalTabIndex === "") {
        element.removeAttribute("tabindex");
      } else if (originalTabIndex !== undefined) {
        element.setAttribute("tabindex", originalTabIndex);
      }
      delete element.dataset.originalTabIndex;
      return;
    }

    if (!Object.hasOwn(element.dataset, "originalTabIndex")) {
      element.dataset.originalTabIndex = element.getAttribute("tabindex") ?? "";
    }
    element.tabIndex = -1;
  });
}

function openNavigation() {
  shell.navScrim.hidden = false;
  setNavigationInteractivity(true);
  shell.sideNav.setAttribute("aria-hidden", "false");
  shell.menuToggle.setAttribute("aria-expanded", "true");
  document.body.classList.add("is-navigation-open");
  shell.sideNav.querySelector("a, button")?.focus();
}

function closeNavigation({ restoreFocus = true } = {}) {
  shell.navScrim.hidden = true;
  setNavigationInteractivity(false);
  shell.sideNav.setAttribute("aria-hidden", "true");
  shell.menuToggle.setAttribute("aria-expanded", "false");
  document.body.classList.remove("is-navigation-open");

  if (restoreFocus) {
    shell.menuToggle.focus();
  } else {
    shell.pageViewport.focus({ preventScroll: true });
  }
}

function createPageLink(page) {
  const link = document.createElement("a");
  link.className = "page-link";
  link.href = `#${encodeURIComponent(page.id)}`;
  link.textContent = t(page.navKey);

  if (page.id === appState.activePageId) {
    link.classList.add("is-active");
    link.setAttribute("aria-current", "page");
  }

  link.addEventListener("click", () => closeNavigation({ restoreFocus: false }));
  return link;
}

function compareNavigationLabels(first, second) {
  return new Intl.Collator(appState.locale, { sensitivity: "base" }).compare(first, second);
}

function getSectionedPages() {
  const pagesBySection = new Map(navigationSections.map((section) => [section.id, []]));

  pageModules.forEach((page) => {
    const sectionId = page.sectionId || "mathematics";
    const sectionPages = pagesBySection.get(sectionId) || pagesBySection.get("mathematics");

    sectionPages.push(page);
  });

  return navigationSections
    .map((section) => ({
      ...section,
      pages: [...(pagesBySection.get(section.id) || [])].sort((firstPage, secondPage) =>
        compareNavigationLabels(t(firstPage.navKey), t(secondPage.navKey)),
      ),
    }))
    .filter((section) => section.pages.length > 0)
    .sort((firstSection, secondSection) =>
      compareNavigationLabels(t(firstSection.titleKey), t(secondSection.titleKey)),
    );
}

function renderNavigationSection(section) {
  const isExpanded = !appState.collapsedSectionIds.has(section.id);
  const pagesId = `nav-section-pages-${section.id}`;

  const sectionElement = document.createElement("section");
  sectionElement.className = "nav-section";
  sectionElement.classList.toggle("is-collapsed", !isExpanded);

  const toggle = document.createElement("button");
  toggle.className = "nav-section-toggle";
  toggle.type = "button";
  toggle.setAttribute("aria-expanded", String(isExpanded));
  toggle.setAttribute("aria-controls", pagesId);

  const label = document.createElement("span");
  label.textContent = t(section.titleKey);

  const chevron = document.createElement("span");
  chevron.className = "nav-section-chevron";
  chevron.setAttribute("aria-hidden", "true");

  const pages = document.createElement("div");
  pages.className = "nav-section-pages";
  pages.id = pagesId;
  pages.hidden = !isExpanded;
  section.pages.forEach((page) => pages.append(createPageLink(page)));

  toggle.append(label, chevron);
  toggle.addEventListener("click", () => {
    const nextIsExpanded = toggle.getAttribute("aria-expanded") !== "true";

    toggle.setAttribute("aria-expanded", String(nextIsExpanded));
    pages.hidden = !nextIsExpanded;
    sectionElement.classList.toggle("is-collapsed", !nextIsExpanded);

    if (nextIsExpanded) {
      appState.collapsedSectionIds.delete(section.id);
    } else {
      appState.collapsedSectionIds.add(section.id);
    }
  });

  sectionElement.append(toggle, pages);
  shell.pageList.append(sectionElement);
}

function renderNavigation() {
  shell.pageList.replaceChildren();
  getSectionedPages().forEach(renderNavigationSection);
  setNavigationInteractivity(document.body.classList.contains("is-navigation-open"));
}

function showUnavailablePage() {
  const emptyState = document.createElement("section");
  emptyState.className = "empty-page";

  const heading = document.createElement("h1");
  heading.textContent = t("navigation.unavailableTitle");

  const message = document.createElement("p");
  message.textContent = t("navigation.unavailableMessage");

  emptyState.append(heading, message);
  shell.pageHost.replaceChildren(emptyState);
  setDocumentTitle(null);
}

function renderActivePage() {
  const page = getActivePage();

  if (appState.pageCleanup) {
    appState.pageCleanup();
    appState.pageCleanup = null;
  }

  appState.activePageId = page?.id || "";
  applyPageTheme(page);
  renderNavigation();

  if (!page) {
    showUnavailablePage();
    return;
  }

  const pageContext = {
    locale: appState.locale,
    t,
  };

  shell.pageHost.replaceChildren();
  setDocumentTitle(page);
  const result = page.render(shell.pageHost, pageContext);

  if (typeof result === "function") {
    appState.pageCleanup = result;
  }

  shell.pageViewport.focus({ preventScroll: true });
}

function setLocale(locale) {
  if (!window.gagunLocales?.[locale]) return;

  appState.locale = locale;
  applyStaticTranslations();
  renderActivePage();
}

window.gagunApp = {
  get locale() {
    return appState.locale;
  },
  setLocale,
  t,
};

applyStaticTranslations();
renderActivePage();
setNavigationInteractivity(false);

shell.menuToggle.addEventListener("click", openNavigation);
shell.navClose.addEventListener("click", closeNavigation);
shell.navScrim.addEventListener("click", () => closeNavigation());

window.addEventListener("hashchange", renderActivePage);

window.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && document.body.classList.contains("is-navigation-open")) {
    closeNavigation();
  }
});
