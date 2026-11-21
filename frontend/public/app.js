const LS_PREFIX = "gym-events-";
const DEFAULT_IMAGE = "https://images.unsplash.com/photo-1505619730259-b1288d154955";

let events = [];
let selectedCountries = new Set(loadSavedCountries());
let eventTypeFilter = "all";
let hidePast = loadSavedHidePast();

function loadSavedHidePast() {
  try {
    const saved = localStorage.getItem(`${LS_PREFIX}hidePast`);
    return saved === null ? true : saved === "true";
  } catch {
    return true;
  }
}

function todayStr() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

const disciplineLabels = {
  fv: "Floor & Vault",
  tra: "Trampoline",
  acro: "Acro",
  tum: "Tumble",
};

function loadSavedCountries() {
  try {
    const saved = localStorage.getItem(`${LS_PREFIX}selectedCountries`);
    return saved ? JSON.parse(saved) : [];
  } catch {
    return [];
  }
}

function saveCountries() {
  localStorage.setItem(`${LS_PREFIX}selectedCountries`, JSON.stringify([...selectedCountries]));
}

function formatDate(dateString) {
  return new Date(dateString).toLocaleDateString("en-GB", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function entryState(event) {
  if (!event.entriesClose) return undefined;
  const now = new Date();
  const close = new Date(event.entriesClose);
  const open = event.entriesOpen ? new Date(event.entriesOpen) : null;
  if (open && now < open) return undefined;
  if (now >= close) return "closed";
  return (close.getTime() - now.getTime()) / 86400000 <= 14 ? "closing-soon" : "open";
}

const entryBadges = {
  open: ["badge-open", "Entries open"],
  "closing-soon": ["badge-closing", "Entries closing soon"],
  closed: ["badge-closed", "Entries closed"],
};

function filteredEvents() {
  return events
    .filter((e) => !hidePast || e.date >= todayStr())
    .filter((e) => selectedCountries.size === 0 || selectedCountries.has(e.country))
    .filter((e) => eventTypeFilter === "all" || e.eventType === eventTypeFilter);
}

function render() {
  const container = document.getElementById("events");
  if (filteredEvents().length === 0 && events.length > 0) {
    const empty = document.createElement("p");
    empty.className = "event-meta";
    empty.textContent = "No events match the selected filters.";
    container.replaceChildren(empty);
  } else {
    container.replaceChildren(...filteredEvents().map(eventCard));
  }
  renderCountryFilters();
}

function eventCard(event) {
  const state = entryState(event);
  const card = document.createElement("article");
  card.className = "event";
  card.innerHTML = `
    <img class="event-image" src="${event.imageUrl || DEFAULT_IMAGE}" alt="" loading="lazy" decoding="async" />
    <div class="event-body">
      <h2 class="event-title">${escapeHtml(event.name)}${
        state ? `<span class="badge ${entryBadges[state][0]}">${entryBadges[state][1]}</span>` : ""
      }</h2>
      <p class="event-meta">
        ${escapeHtml(event.country)} &bull; <time datetime="${event.date}">${formatDate(event.date)}</time>
      </p>
      ${(event.disciplines || []).map((d) => `<span class="discipline">${escapeHtml(disciplineLabels[d] ?? d.toUpperCase())}</span>`).join("")}
      <div class="event-details">${marked.parse(event.details || "")}</div>
    </div>
    ${
      event.entriesOpen || event.entriesClose
        ? `<div class="event-entries">
            ${event.entriesOpen ? `Entries open: <time datetime="${event.entriesOpen}">${formatDate(event.entriesOpen)}</time>` : ""}
            ${event.entriesOpen && event.entriesClose ? " &middot; " : ""}
            ${event.entriesClose ? `Entries close: <time datetime="${event.entriesClose}">${formatDate(event.entriesClose)}</time>` : ""}
          </div>`
        : ""
    }`;
  return card;
}

function escapeHtml(s) {
  const div = document.createElement("div");
  div.textContent = String(s);
  return div.innerHTML;
}

function renderCountryFilters() {
  const container = document.getElementById("country-filters");
  const countries = [...new Set([...events.map((e) => e.country), ...selectedCountries])].sort();
  container.replaceChildren(
    ...countries.map((country) => {
      const id = `country-${country.replace(/\W+/g, "-")}`;
      const label = document.createElement("label");
      label.className = "pill";
      label.innerHTML = `<input type="checkbox" id="${id}" ${selectedCountries.has(country) ? "checked" : ""} /> ${escapeHtml(country)}`;
      label.querySelector("input").addEventListener("change", (e) => {
        if (e.target.checked) selectedCountries.add(country);
        else selectedCountries.delete(country);
        saveCountries();
        render();
      });
      return label;
    })
  );
}

const filterToggle = document.getElementById("filter-toggle");
const filtersPanel = document.getElementById("filters");

filterToggle.addEventListener("click", () => {
  filtersPanel.hidden = !filtersPanel.hidden;
  filterToggle.setAttribute("aria-expanded", String(!filtersPanel.hidden));
});

const hidePastInput = document.getElementById("hide-past");
hidePastInput.checked = hidePast;
hidePastInput.addEventListener("change", (e) => {
  hidePast = e.target.checked;
  localStorage.setItem(`${LS_PREFIX}hidePast`, String(hidePast));
  render();
});

for (const radio of document.querySelectorAll('input[name="eventType"]')) {
  radio.addEventListener("change", (e) => {
    eventTypeFilter = e.target.value;
    render();
  });
}

fetch("/data/events.json")
  .then((r) => r.json())
  .then((data) => {
    events = data.events.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
    render();
  });
