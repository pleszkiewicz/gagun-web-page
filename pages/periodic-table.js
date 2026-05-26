const periodicCategoryKeys = [
  "alkali-metal",
  "alkaline-earth-metal",
  "transition-metal",
  "post-transition-metal",
  "metalloid",
  "nonmetal",
  "halogen",
  "noble-gas",
  "lanthanide",
  "actinide",
  "unknown",
];

const periodicElements = [
  { n: 1, s: "H", mass: "1.008", group: 1, period: 1, category: "nonmetal" },
  { n: 2, s: "He", mass: "4.0026", group: 18, period: 1, category: "noble-gas" },
  { n: 3, s: "Li", mass: "6.94", group: 1, period: 2, category: "alkali-metal" },
  { n: 4, s: "Be", mass: "9.0122", group: 2, period: 2, category: "alkaline-earth-metal" },
  { n: 5, s: "B", mass: "10.81", group: 13, period: 2, category: "metalloid" },
  { n: 6, s: "C", mass: "12.011", group: 14, period: 2, category: "nonmetal" },
  { n: 7, s: "N", mass: "14.007", group: 15, period: 2, category: "nonmetal" },
  { n: 8, s: "O", mass: "15.999", group: 16, period: 2, category: "nonmetal" },
  { n: 9, s: "F", mass: "18.998", group: 17, period: 2, category: "halogen" },
  { n: 10, s: "Ne", mass: "20.180", group: 18, period: 2, category: "noble-gas" },
  { n: 11, s: "Na", mass: "22.990", group: 1, period: 3, category: "alkali-metal" },
  { n: 12, s: "Mg", mass: "24.305", group: 2, period: 3, category: "alkaline-earth-metal" },
  { n: 13, s: "Al", mass: "26.982", group: 13, period: 3, category: "post-transition-metal" },
  { n: 14, s: "Si", mass: "28.085", group: 14, period: 3, category: "metalloid" },
  { n: 15, s: "P", mass: "30.974", group: 15, period: 3, category: "nonmetal" },
  { n: 16, s: "S", mass: "32.06", group: 16, period: 3, category: "nonmetal" },
  { n: 17, s: "Cl", mass: "35.45", group: 17, period: 3, category: "halogen" },
  { n: 18, s: "Ar", mass: "39.948", group: 18, period: 3, category: "noble-gas" },
  { n: 19, s: "K", mass: "39.098", group: 1, period: 4, category: "alkali-metal" },
  { n: 20, s: "Ca", mass: "40.078", group: 2, period: 4, category: "alkaline-earth-metal" },
  { n: 21, s: "Sc", mass: "44.956", group: 3, period: 4, category: "transition-metal" },
  { n: 22, s: "Ti", mass: "47.867", group: 4, period: 4, category: "transition-metal" },
  { n: 23, s: "V", mass: "50.942", group: 5, period: 4, category: "transition-metal" },
  { n: 24, s: "Cr", mass: "51.996", group: 6, period: 4, category: "transition-metal" },
  { n: 25, s: "Mn", mass: "54.938", group: 7, period: 4, category: "transition-metal" },
  { n: 26, s: "Fe", mass: "55.845", group: 8, period: 4, category: "transition-metal" },
  { n: 27, s: "Co", mass: "58.933", group: 9, period: 4, category: "transition-metal" },
  { n: 28, s: "Ni", mass: "58.693", group: 10, period: 4, category: "transition-metal" },
  { n: 29, s: "Cu", mass: "63.546", group: 11, period: 4, category: "transition-metal" },
  { n: 30, s: "Zn", mass: "65.38", group: 12, period: 4, category: "transition-metal" },
  { n: 31, s: "Ga", mass: "69.723", group: 13, period: 4, category: "post-transition-metal" },
  { n: 32, s: "Ge", mass: "72.630", group: 14, period: 4, category: "metalloid" },
  { n: 33, s: "As", mass: "74.922", group: 15, period: 4, category: "metalloid" },
  { n: 34, s: "Se", mass: "78.971", group: 16, period: 4, category: "nonmetal" },
  { n: 35, s: "Br", mass: "79.904", group: 17, period: 4, category: "halogen" },
  { n: 36, s: "Kr", mass: "83.798", group: 18, period: 4, category: "noble-gas" },
  { n: 37, s: "Rb", mass: "85.468", group: 1, period: 5, category: "alkali-metal" },
  { n: 38, s: "Sr", mass: "87.62", group: 2, period: 5, category: "alkaline-earth-metal" },
  { n: 39, s: "Y", mass: "88.906", group: 3, period: 5, category: "transition-metal" },
  { n: 40, s: "Zr", mass: "91.224", group: 4, period: 5, category: "transition-metal" },
  { n: 41, s: "Nb", mass: "92.906", group: 5, period: 5, category: "transition-metal" },
  { n: 42, s: "Mo", mass: "95.95", group: 6, period: 5, category: "transition-metal" },
  { n: 43, s: "Tc", mass: "[98]", group: 7, period: 5, category: "transition-metal" },
  { n: 44, s: "Ru", mass: "101.07", group: 8, period: 5, category: "transition-metal" },
  { n: 45, s: "Rh", mass: "102.91", group: 9, period: 5, category: "transition-metal" },
  { n: 46, s: "Pd", mass: "106.42", group: 10, period: 5, category: "transition-metal" },
  { n: 47, s: "Ag", mass: "107.87", group: 11, period: 5, category: "transition-metal" },
  { n: 48, s: "Cd", mass: "112.41", group: 12, period: 5, category: "transition-metal" },
  { n: 49, s: "In", mass: "114.82", group: 13, period: 5, category: "post-transition-metal" },
  { n: 50, s: "Sn", mass: "118.71", group: 14, period: 5, category: "post-transition-metal" },
  { n: 51, s: "Sb", mass: "121.76", group: 15, period: 5, category: "metalloid" },
  { n: 52, s: "Te", mass: "127.60", group: 16, period: 5, category: "metalloid" },
  { n: 53, s: "I", mass: "126.90", group: 17, period: 5, category: "halogen" },
  { n: 54, s: "Xe", mass: "131.29", group: 18, period: 5, category: "noble-gas" },
  { n: 55, s: "Cs", mass: "132.91", group: 1, period: 6, category: "alkali-metal" },
  { n: 56, s: "Ba", mass: "137.33", group: 2, period: 6, category: "alkaline-earth-metal" },
  { n: 57, s: "La", mass: "138.91", group: 3, period: 8, category: "lanthanide" },
  { n: 58, s: "Ce", mass: "140.12", group: 4, period: 8, category: "lanthanide" },
  { n: 59, s: "Pr", mass: "140.91", group: 5, period: 8, category: "lanthanide" },
  { n: 60, s: "Nd", mass: "144.24", group: 6, period: 8, category: "lanthanide" },
  { n: 61, s: "Pm", mass: "[145]", group: 7, period: 8, category: "lanthanide" },
  { n: 62, s: "Sm", mass: "150.36", group: 8, period: 8, category: "lanthanide" },
  { n: 63, s: "Eu", mass: "151.96", group: 9, period: 8, category: "lanthanide" },
  { n: 64, s: "Gd", mass: "157.25", group: 10, period: 8, category: "lanthanide" },
  { n: 65, s: "Tb", mass: "158.93", group: 11, period: 8, category: "lanthanide" },
  { n: 66, s: "Dy", mass: "162.50", group: 12, period: 8, category: "lanthanide" },
  { n: 67, s: "Ho", mass: "164.93", group: 13, period: 8, category: "lanthanide" },
  { n: 68, s: "Er", mass: "167.26", group: 14, period: 8, category: "lanthanide" },
  { n: 69, s: "Tm", mass: "168.93", group: 15, period: 8, category: "lanthanide" },
  { n: 70, s: "Yb", mass: "173.05", group: 16, period: 8, category: "lanthanide" },
  { n: 71, s: "Lu", mass: "174.97", group: 17, period: 8, category: "lanthanide" },
  { n: 72, s: "Hf", mass: "178.49", group: 4, period: 6, category: "transition-metal" },
  { n: 73, s: "Ta", mass: "180.95", group: 5, period: 6, category: "transition-metal" },
  { n: 74, s: "W", mass: "183.84", group: 6, period: 6, category: "transition-metal" },
  { n: 75, s: "Re", mass: "186.21", group: 7, period: 6, category: "transition-metal" },
  { n: 76, s: "Os", mass: "190.23", group: 8, period: 6, category: "transition-metal" },
  { n: 77, s: "Ir", mass: "192.22", group: 9, period: 6, category: "transition-metal" },
  { n: 78, s: "Pt", mass: "195.08", group: 10, period: 6, category: "transition-metal" },
  { n: 79, s: "Au", mass: "196.97", group: 11, period: 6, category: "transition-metal" },
  { n: 80, s: "Hg", mass: "200.59", group: 12, period: 6, category: "transition-metal" },
  { n: 81, s: "Tl", mass: "204.38", group: 13, period: 6, category: "post-transition-metal" },
  { n: 82, s: "Pb", mass: "207.2", group: 14, period: 6, category: "post-transition-metal" },
  { n: 83, s: "Bi", mass: "208.98", group: 15, period: 6, category: "post-transition-metal" },
  { n: 84, s: "Po", mass: "[209]", group: 16, period: 6, category: "post-transition-metal" },
  { n: 85, s: "At", mass: "[210]", group: 17, period: 6, category: "halogen" },
  { n: 86, s: "Rn", mass: "[222]", group: 18, period: 6, category: "noble-gas" },
  { n: 87, s: "Fr", mass: "[223]", group: 1, period: 7, category: "alkali-metal" },
  { n: 88, s: "Ra", mass: "[226]", group: 2, period: 7, category: "alkaline-earth-metal" },
  { n: 89, s: "Ac", mass: "[227]", group: 3, period: 9, category: "actinide" },
  { n: 90, s: "Th", mass: "232.04", group: 4, period: 9, category: "actinide" },
  { n: 91, s: "Pa", mass: "231.04", group: 5, period: 9, category: "actinide" },
  { n: 92, s: "U", mass: "238.03", group: 6, period: 9, category: "actinide" },
  { n: 93, s: "Np", mass: "[237]", group: 7, period: 9, category: "actinide" },
  { n: 94, s: "Pu", mass: "[244]", group: 8, period: 9, category: "actinide" },
  { n: 95, s: "Am", mass: "[243]", group: 9, period: 9, category: "actinide" },
  { n: 96, s: "Cm", mass: "[247]", group: 10, period: 9, category: "actinide" },
  { n: 97, s: "Bk", mass: "[247]", group: 11, period: 9, category: "actinide" },
  { n: 98, s: "Cf", mass: "[251]", group: 12, period: 9, category: "actinide" },
  { n: 99, s: "Es", mass: "[252]", group: 13, period: 9, category: "actinide" },
  { n: 100, s: "Fm", mass: "[257]", group: 14, period: 9, category: "actinide" },
  { n: 101, s: "Md", mass: "[258]", group: 15, period: 9, category: "actinide" },
  { n: 102, s: "No", mass: "[259]", group: 16, period: 9, category: "actinide" },
  { n: 103, s: "Lr", mass: "[266]", group: 17, period: 9, category: "actinide" },
  { n: 104, s: "Rf", mass: "[267]", group: 4, period: 7, category: "transition-metal" },
  { n: 105, s: "Db", mass: "[268]", group: 5, period: 7, category: "transition-metal" },
  { n: 106, s: "Sg", mass: "[269]", group: 6, period: 7, category: "transition-metal" },
  { n: 107, s: "Bh", mass: "[270]", group: 7, period: 7, category: "transition-metal" },
  { n: 108, s: "Hs", mass: "[277]", group: 8, period: 7, category: "transition-metal" },
  { n: 109, s: "Mt", mass: "[278]", group: 9, period: 7, category: "unknown" },
  { n: 110, s: "Ds", mass: "[281]", group: 10, period: 7, category: "unknown" },
  { n: 111, s: "Rg", mass: "[282]", group: 11, period: 7, category: "unknown" },
  { n: 112, s: "Cn", mass: "[285]", group: 12, period: 7, category: "transition-metal" },
  { n: 113, s: "Nh", mass: "[286]", group: 13, period: 7, category: "unknown" },
  { n: 114, s: "Fl", mass: "[289]", group: 14, period: 7, category: "post-transition-metal" },
  { n: 115, s: "Mc", mass: "[290]", group: 15, period: 7, category: "unknown" },
  { n: 116, s: "Lv", mass: "[293]", group: 16, period: 7, category: "unknown" },
  { n: 117, s: "Ts", mass: "[294]", group: 17, period: 7, category: "halogen" },
  { n: 118, s: "Og", mass: "[294]", group: 18, period: 7, category: "noble-gas" },
];

function renderPeriodicTable(container, { t }) {
  container.innerHTML = `
    <section class="periodic-page" aria-label="${t("pages.periodicTable.pageLabel")}">
      <header class="periodic-page-header">
        <p class="eyebrow">${t("pages.periodicTable.eyebrow")}</p>
        <h1>${t("pages.periodicTable.heading")}</h1>
        <p>${t("pages.periodicTable.description")}</p>
      </header>

      <div class="periodic-workspace">
        <section class="periodic-table-panel" aria-label="${t("pages.periodicTable.tableLabel")}">
          <div class="periodic-table-scroll">
            <div class="periodic-table" id="periodicTableGrid"></div>
          </div>
        </section>

        <aside class="periodic-sidebar">
          <section class="periodic-detail-card" aria-live="polite" aria-label="${t("pages.periodicTable.detailsLabel")}">
            <div class="periodic-detail-heading">
              <h2 id="periodicDetailName">${t("pages.periodicTable.elements.H")}</h2>
              <p id="periodicDetailCategory">${t("pages.periodicTable.categories.nonmetal")}</p>
            </div>
            <div id="periodicDetailSymbol" class="periodic-detail-symbol category-nonmetal">H</div>
            <dl class="periodic-facts">
              <dt>${t("pages.periodicTable.atomicNumber")}</dt><dd id="periodicDetailNumber">1</dd>
              <dt>${t("pages.periodicTable.symbol")}</dt><dd id="periodicDetailSymbolText">H</dd>
              <dt>${t("pages.periodicTable.atomicMass")}</dt><dd id="periodicDetailMass">1.008</dd>
              <dt>${t("pages.periodicTable.group")}</dt><dd id="periodicDetailGroup">1</dd>
              <dt>${t("pages.periodicTable.period")}</dt><dd id="periodicDetailPeriod">1</dd>
            </dl>
          </section>

          <section class="periodic-legend-card" aria-label="${t("pages.periodicTable.legendLabel")}">
            <h2>${t("pages.periodicTable.legendLabel")}</h2>
            <div class="periodic-legend-grid" id="periodicLegend"></div>
          </section>
        </aside>
      </div>
    </section>
  `;

  const table = container.querySelector("#periodicTableGrid");
  const legend = container.querySelector("#periodicLegend");
  let selectedButton = null;

  function getElementName(element) {
    return t(`pages.periodicTable.elements.${element.s}`);
  }

  function getCategoryName(category) {
    return t(`pages.periodicTable.categories.${category}`);
  }

  function getDisplayPeriod(element) {
    if (element.period < 8) return String(element.period);
    return element.category === "lanthanide" ? "6" : "7";
  }

  function getDisplayGroup(element) {
    return element.period < 8 ? String(element.group) : t("pages.periodicTable.separateSeries");
  }

  function showDetails(element, button) {
    const symbolBox = container.querySelector("#periodicDetailSymbol");
    const elementName = getElementName(element);

    container.querySelector("#periodicDetailName").textContent = elementName;
    container.querySelector("#periodicDetailCategory").textContent =
      getCategoryName(element.category);
    container.querySelector("#periodicDetailNumber").textContent = String(element.n);
    container.querySelector("#periodicDetailSymbolText").textContent = element.s;
    container.querySelector("#periodicDetailMass").textContent = element.mass;
    container.querySelector("#periodicDetailGroup").textContent = getDisplayGroup(element);
    container.querySelector("#periodicDetailPeriod").textContent = getDisplayPeriod(element);

    symbolBox.textContent = element.s;
    symbolBox.className = `periodic-detail-symbol category-${element.category}`;

    if (selectedButton) {
      selectedButton.classList.remove("is-selected");
      selectedButton.setAttribute("aria-pressed", "false");
    }

    if (button) {
      selectedButton = button;
      selectedButton.classList.add("is-selected");
      selectedButton.setAttribute("aria-pressed", "true");
    }
  }

  function renderElement(element) {
    const elementName = getElementName(element);
    const button = document.createElement("button");
    button.type = "button";
    button.className = `periodic-element category-${element.category}`;
    button.style.gridColumn = element.group;
    button.style.gridRow = element.period;
    button.setAttribute(
      "aria-label",
      `${elementName}, ${element.s}, ${t("pages.periodicTable.atomicNumber").toLowerCase()} ${element.n}`,
    );
    button.setAttribute("aria-pressed", "false");
    button.innerHTML = `
      <span class="periodic-number">${element.n}</span>
      <span class="periodic-symbol">${element.s}</span>
      <span class="periodic-name">${elementName}</span>
      <span class="periodic-mass">${element.mass}</span>
    `;
    button.addEventListener("click", () => showDetails(element, button));
    return button;
  }

  function addSeriesPlaceholder(label, group, period, span) {
    const item = document.createElement("div");
    item.className = "periodic-series-label";
    item.style.gridColumn = `${group} / span ${span}`;
    item.style.gridRow = period;
    item.textContent = label;
    table.append(item);
  }

  addSeriesPlaceholder(t("pages.periodicTable.lanthanideRange"), 3, 6, 1);
  addSeriesPlaceholder(t("pages.periodicTable.actinideRange"), 3, 7, 1);

  periodicElements.forEach((element) => {
    const button = renderElement(element);
    table.append(button);

    if (element.n === 1) {
      showDetails(element, button);
    }
  });

  periodicCategoryKeys.forEach((key) => {
    const item = document.createElement("div");
    item.className = "periodic-legend-item";

    const swatch = document.createElement("span");
    swatch.className = `periodic-swatch category-${key}`;
    swatch.setAttribute("aria-hidden", "true");

    const label = document.createElement("span");
    label.textContent = getCategoryName(key);

    item.append(swatch, label);
    legend.append(item);
  });
}

window.gagunPageModules = window.gagunPageModules || [];
window.gagunPageModules.push({
  id: "periodic-table",
  sectionId: "chemistry",
  navKey: "pages.periodicTable.navLabel",
  titleKey: "pages.periodicTable.title",
  theme: {
    background: "#edf7f7",
    backgroundSoft: "#fbfdff",
    mathColor: "rgba(13, 72, 105, 0.14)",
    mathOpacity: "0.72",
  },
  render: renderPeriodicTable,
});
