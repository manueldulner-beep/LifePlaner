
"use strict";

// ========================================
// LIFEPLANER – DATEN UND EINSTELLUNGEN
// ========================================

const STORAGE_KEY = "lifeplaner_v1";
const TRAINING_START = "2026-11-03";
const TRAINING_CYCLE = [
  "Oberkörper",
  "Unterkörper",
  "Pause",
  "Oberkörper",
  "Unterkörper",
  "Pause"
];

const DEFAULT_DATA = {
  theme: "chopper",
  referenceWeek: "2026-11-02",
  referenceHomeoffice: "tuesday",
  events: [],
  tasks: {},
  dayNotes: {},
  notes: [],
  workOverrides: {},
  trainingShifts: [],
  weights: {},
  workNotes: "",
  vacation: {
    baseDate: "2026-11-01",
    baseDays: 19,
    annualDays: 30,
    excludeHolidays: []
  },
  reminders: [],
  reminderDone: {}
};

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function loadData() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return clone(DEFAULT_DATA);

    const parsed = JSON.parse(saved);

    return {
      ...clone(DEFAULT_DATA),
      ...parsed
    };
  } catch (error) {
    console.error("Speicherfehler:", error);
    return clone(DEFAULT_DATA);
  }
}

let data = loadData();

function ensureWorkData() {
  if (typeof data.workNotes !== "string") {
    data.workNotes = "";
  }

  if (!data.vacation || typeof data.vacation !== "object") {
    data.vacation = clone(DEFAULT_DATA.vacation);
  }

  data.vacation = {
    ...clone(DEFAULT_DATA.vacation),
    ...data.vacation
  };

  if (!Array.isArray(data.reminders)) {
    data.reminders = [];
  }

  if (
    !data.reminderDone ||
    typeof data.reminderDone !== "object"
  ) {
    data.reminderDone = {};
  }
}

ensureWorkData();

if (
  !data.weights ||
  typeof data.weights !== "object" ||
  Array.isArray(data.weights)
) {
  data.weights = {};
}

let page = "home";
let selectedDate = todayKey();
let displayedMonth = startOfMonth(new Date());
let editorSave = null;

const $ = id => document.getElementById(id);

function save() {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(data)
    );
  } catch (error) {
    alert(
      "Speichern fehlgeschlagen. Bitte Speicherplatz prüfen."
    );
    console.error(error);
  }
}

function uid() {
  return crypto.randomUUID
    ? crypto.randomUUID()
    : Date.now().toString(36) +
      Math.random().toString(36).slice(2);
}

// ========================================
// DATUMSFUNKTIONEN
// ========================================

function dateKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");

  return `${y}-${m}-${d}`;
}

function parseDate(key) {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function todayKey() {
  return dateKey(new Date());
}

function addDays(key, days) {
  const date = parseDate(key);
  date.setDate(date.getDate() + days);
  return dateKey(date);
}

function daysBetween(a, b) {
  const start = parseDate(a);
  const end = parseDate(b);

  return Math.round((end - start) / 86400000);
}

function startOfMonth(date) {
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    1
  );
}

function formatDate(key, options = {}) {
  return parseDate(key).toLocaleDateString("de-DE", {
    day: "numeric",
    month: "long",
    year: "numeric",
    ...options
  });
}

function escapeHTML(value) {
  return String(value ?? "").replace(
    /[&<>"']/g,
    char => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    }[char])
  );
}

// ========================================
// TRAININGSLOGIK
// ========================================

// Eine Verschiebung hält den nächsten offenen
// Trainingsschritt für einen Tag an.
// Die Reihenfolge der Einheiten bleibt erhalten.

function trainingAt(
  key,
  shifts = data.trainingShifts
) {
  if (key < TRAINING_START) {
    return "Nicht gestartet";
  }

  const elapsed = daysBetween(
    TRAINING_START,
    key
  );

  const pauses = shifts.filter(
    date =>
      date >= TRAINING_START &&
      date <= key
  ).length;

  if (shifts.includes(key)) {
    return "Verschoben";
  }

  const index =
    ((elapsed - pauses) % 6 + 6) % 6;

  return TRAINING_CYCLE[index];
}

function shiftTraining(key) {
  if (key < todayKey()) {
    alert(
      "Vergangene Trainingstage können nicht verschoben werden."
    );
    return;
  }

  if (key < TRAINING_START) {
    alert(
      "Der Trainingsplan beginnt am 3. November 2026."
    );
    return;
  }

  if (data.trainingShifts.includes(key)) {
    data.trainingShifts =
      data.trainingShifts.filter(
        d => d !== key
      );

    save();
    render();
    return;
  }

  const status = trainingAt(key);

  if (status === "Pause") {
    alert(
      "Dieser Tag ist bereits ein Pausentag."
    );
    return;
  }

  data.trainingShifts.push(key);
  data.trainingShifts.sort();

  save();
  render();
}

function trainingIcon(status) {
  if (status === "Oberkörper") return "💪";
  if (status === "Unterkörper") return "🏋️";
  if (status === "Pause") return "🌿";
  if (status === "Verschoben") return "↪️";

  return "✨";
}

// ========================================
// ARBEIT UND HOMEOFFICE
// ========================================

function mondayOf(key) {
  const date = parseDate(key);
  const day = (date.getDay() + 6) % 7;

  date.setDate(date.getDate() - day);

  return dateKey(date);
}

function workAt(key) {
  // Manuelle Änderungen haben immer Vorrang.
  if (
    Object.prototype.hasOwnProperty.call(
      data.workOverrides,
      key
    )
  ) {
    return data.workOverrides[key];
  }

  const weekday = parseDate(key).getDay();

  // Samstag und Sonntag frei
  if (weekday === 0 || weekday === 6) {
    return "Frei";
  }

  // Wechselnde Arbeitswochen berechnen
  const weeks = Math.round(
    daysBetween(
      mondayOf(data.referenceWeek),
      mondayOf(key)
    ) / 7
  );

  const even =
    ((weeks % 2) + 2) % 2 === 0;

  // Referenzwoche bestimmt den Präsenztag
  const presenceTuesday =
    data.referenceHomeoffice === "wednesday"
      ? even
      : !even;

  // Dienstag
  if (weekday === 2) {
    return presenceTuesday
      ? "Büro"
      : "Homeoffice";
  }

  // Mittwoch
  if (weekday === 3) {
    return presenceTuesday
      ? "Homeoffice"
      : "Büro";
  }

  // Montag, Donnerstag, Freitag
  return "Homeoffice";
}

 // ========================================
 // AUFGABEN
 // ========================================

function tasksFor(key) {
  return data.tasks[key] || [];
}

function taskProgress(key) {
  const tasks = tasksFor(key);
  const completed = tasks.filter(task => task.done).length;

  return {
    total: tasks.length,
    completed,
    percent: tasks.length
      ? Math.round(completed / tasks.length * 100)
      : 0
  };
}

function addTask(key) {
  openEditor("Aufgabe hinzufügen", [
    { name: "title", label: "Aufgabe", required: true }
  ], values => {
    if (!data.tasks[key]) data.tasks[key] = [];

    data.tasks[key].push({
      id: uid(),
      title: values.title,
      done: false
    });

    save();
    render();
  });
}

function editTask(key, id) {
  const task = tasksFor(key).find(t => t.id === id);
  if (!task) return;

  openEditor("Aufgabe bearbeiten", [
    {
      name: "title",
      label: "Aufgabe",
      value: task.title,
      required: true
    }
  ], values => {
    task.title = values.title;
    save();
    render();
  });
}

function toggleTask(key, id) {
  const task = tasksFor(key).find(t => t.id === id);
  if (!task) return;

  task.done = !task.done;
  save();
  render();
}

function deleteTask(key, id) {
  if (!confirm("Diese Aufgabe löschen?")) return;

  data.tasks[key] = tasksFor(key).filter(t => t.id !== id);
  save();
  render();
}

function renderTasks(key) {
  const tasks = tasksFor(key);
  const progress = taskProgress(key);

  return `
    <div class="row">
      <strong>${progress.completed} / ${progress.total} erledigt</strong>
      <button data-action="add-task" data-date="${key}">
        + Aufgabe
      </button>
    </div>

    <div class="progress">
      <div style="width:${progress.percent}%"></div>
    </div>

    <div class="stack">
      ${tasks.map(task => `
        <div class="item ${task.done ? "done" : ""}">
          <div class="row">
            <label>
              <input type="checkbox"
                data-action="toggle-task"
                data-date="${key}"
                data-id="${task.id}"
                ${task.done ? "checked" : ""}>
              <span class="item-title">
                ${escapeHTML(task.title)}
              </span>
            </label>

            <div>
              <button class="secondary"
                data-action="edit-task"
                data-date="${key}"
                data-id="${task.id}">✎</button>

              <button class="danger"
                data-action="delete-task"
                data-date="${key}"
                data-id="${task.id}">×</button>
            </div>
          </div>
        </div>
      `).join("")}

      ${tasks.length ? "" : '<p class="muted">Noch keine Aufgaben ♡</p>'}
    </div>
  `;
}

// ========================================
// PRIVATE TERMINE
// ========================================

function eventsFor(key) {
  return data.events
    .filter(event => event.date === key)
    .sort((a, b) => (a.time || "").localeCompare(b.time || ""));
}

function addEvent(key) {
  eventEditor(null, key);
}

function eventEditor(id = null, defaultDate = selectedDate) {
  const event = data.events.find(e => e.id === id);

  openEditor(event ? "Termin bearbeiten" : "Termin hinzufügen", [
    {
      name: "title",
      label: "Titel",
      value: event?.title || "",
      required: true
    },
    {
      name: "date",
      label: "Datum",
      type: "date",
      value: event?.date || defaultDate,
      required: true
    },
    {
      name: "time",
      label: "Uhrzeit (optional)",
      type: "time",
      value: event?.time || ""
    }
  ], values => {
    if (event) {
      Object.assign(event, values);
    } else {
      data.events.push({ id: uid(), ...values });
    }

    selectedDate = values.date;
    displayedMonth = startOfMonth(parseDate(selectedDate));

    save();
    render();
  });
}

function deleteEvent(id) {
  if (!confirm("Termin wirklich löschen?")) return;

  data.events = data.events.filter(e => e.id !== id);
  save();
  render();
}

function renderEvents(key) {
  const events = eventsFor(key);

  return `
    <div class="row">
      <strong>Private Termine</strong>
      <button data-action="add-event" data-date="${key}">
        + Termin
      </button>
    </div>

    <div class="stack" style="margin-top:12px">
      ${events.map(event => `
        <div class="item">
          <div class="row">
            <div>
              <strong>${escapeHTML(event.title)}</strong>
              <div class="mini">
                ${event.time ? escapeHTML(event.time) + " Uhr" : "Ganztägig"}
              </div>
            </div>

            <div>
              <button class="secondary"
                data-action="edit-event"
                data-id="${event.id}">✎</button>

              <button class="danger"
                data-action="delete-event"
                data-id="${event.id}">×</button>
            </div>
          </div>
        </div>
      `).join("")}

      ${events.length ? "" : '<p class="muted">Keine Termine eingetragen.</p>'}
    </div>
  `;
}

// ========================================
// ALLGEMEINE NOTIZEN
// ========================================

function editNote(id = null) {
  const note = data.notes.find(n => n.id === id);

  openEditor(note ? "Notiz bearbeiten" : "Neue Notiz", [
    {
      name: "title",
      label: "Titel",
      value: note?.title || "",
      required: true
    },
    {
      name: "body",
      label: "Inhalt",
      type: "textarea",
      value: note?.body || ""
    }
  ], values => {
    if (note) {
      Object.assign(note, values);
    } else {
      data.notes.unshift({
        id: uid(),
        ...values
      });
    }

    save();
    render();
  });
}

function deleteNote(id) {
  if (!confirm("Notiz löschen?")) return;

  data.notes = data.notes.filter(n => n.id !== id);
  save();
  render();
}

// ========================================
// EDITOR-DIALOG
// ========================================

function openEditor(title, fields, onSave) {
  $("editor-title").textContent = title;
  editorSave = onSave;

  $("editor-fields").innerHTML = fields.map(field => {
    const value = escapeHTML(field.value || "");
    const required = field.required ? "required" : "";

    let control;

    if (field.type === "textarea") {
      control = `<textarea name="${field.name}" ${required}>${value}</textarea>`;
    } else if (field.type === "select") {
      control = `
        <select name="${field.name}">
          ${field.options.map(option => `
            <option value="${escapeHTML(option)}"
              ${option === field.value ? "selected" : ""}>
              ${escapeHTML(option)}
            </option>
          `).join("")}
        </select>`;
    } else {
      control = `
        <input
          type="${field.type || "text"}"
          name="${field.name}"
          value="${value}"
          ${required}
        >`;
    }

    return `
      <div class="field">
        <label>${escapeHTML(field.label)}</label>
        ${control}
      </div>`;
  }).join("");

  $("editor").showModal();
}

$("editor-form").addEventListener("submit", event => {
  event.preventDefault();

  const values = Object.fromEntries(
    new FormData(event.currentTarget).entries()
  );

  if (editorSave) editorSave(values);

  $("editor").close();
  editorSave = null;
});

$("cancel-editor").addEventListener("click", () => {
  $("editor").close();
});

// ========================================
// NAVIGATION UND DESIGN
// ========================================

const pages = [
  ["home", "🏠", "Home"],
  ["calendar", "📅", "Kalender"],
  ["training", "💪", "Training"],
  ["work", "💼", "Arbeit"],
  ["weight", "⚖️", "Gewicht"],
  ["notes", "📝", "Notizen"],
  ["settings", "⚙️", "Einstellungen"]
];

try {
  const gespeicherteReihenfolge = JSON.parse(
    localStorage.getItem("lifeplaner-homebutton-reihenfolge") || "[]"
  );

  if (Array.isArray(gespeicherteReihenfolge)) {
    pages.sort((a, b) => {
      const positionA = gespeicherteReihenfolge.indexOf(a[0]);
      const positionB = gespeicherteReihenfolge.indexOf(b[0]);

      return (
        (positionA === -1 ? Infinity : positionA) -
        (positionB === -1 ? Infinity : positionB)
      );
    });
  }
} catch (fehler) {
  console.warn("Button-Reihenfolge konnte nicht geladen werden.", fehler);
}

/* ========================================
   SCHRITT 276 – SCHWEBENDES HANDY-MENÜ
   ======================================== */

/* 🍓 Chopper-Menü aus der Sidebar lösen */
document.addEventListener("DOMContentLoaded", () => {
  const menu = document.getElementById("mobile-menu");

  if (menu && menu.parentElement !== document.body) {
    document.body.appendChild(menu);
  }
});

function closeMobileMenu() {
  const panel = document.getElementById("mobile-menu-panel");
  const toggle = document.getElementById("mobile-menu-toggle");
const backpackPanel = document.getElementById("chopper-backpack-panel");
if (backpackPanel) {
  backpackPanel.hidden = true;
}
  if (!panel || !toggle) return;

  panel.hidden = true;
  toggle.setAttribute("aria-expanded", "false");
  toggle.setAttribute("aria-label", "Menü öffnen");
const chopper = toggle.querySelector(".mobile-menu-chopper");

if (chopper) {
  chopper.src = "chopper-shaker-zu.png";
}  
}

document.addEventListener("click", function (event) {
  const toggle = event.target.closest("#mobile-menu-toggle");
  const panel = document.getElementById("mobile-menu-panel");

  if (!panel) return;

  // Menübutton antippen
  if (toggle) {
    const opening = panel.hidden;
    
  // 👁️ CRIMSON – Mini-Itachi erweckt sein Mangekyō
// 👁️ CRIMSON – ITACHIS MANGEKYŌ ERWACHT
const itachi = toggle.querySelector(".mobile-menu-itachi-image");

if (itachi && data.theme === "crimson") {

  if (opening) {

    // 🖤 Phase 1 – Augen geschlossen
    itachi.src = "mini-itachi.png";

    // 🩸 Phase 2 – Augen öffnen sich
    setTimeout(() => {
      if (toggle.getAttribute("aria-expanded") === "true") {
        itachi.src = "mini-itachi-halb.png";
      }
    }, 40);

    // 👁️ Phase 3 – MANGEKYŌ SHARINGAN!
    setTimeout(() => {
      if (toggle.getAttribute("aria-expanded") === "true") {
        itachi.src = "mini-itachi-mangekyo.png";
      }
    }, 100);

  } else {

    // 🖤 Zurück zum normalen Itachi
    itachi.src = "mini-itachi.png";

  }
}
const chopper = toggle.querySelector(".mobile-menu-chopper");

if (chopper) {
  if (opening) {
    chopper.src = "chopper-shaker-zu.png";

    setTimeout(() => {
      if (toggle.getAttribute("aria-expanded") === "true") {
        chopper.src = "chopper-shaker-offen.png";
      }
    }, 200);
  } else {
    chopper.src = "chopper-shaker-zu.png";
  }
}


   if (!opening) closeMobileMenu();
panel.hidden = !opening;
toggle.setAttribute("aria-expanded", String(opening));
toggle.setAttribute(
  "aria-label",
  opening ? "Menü schließen" : "Menü öffnen"
);

// Beim zweiten Tippen auf Chopper zur Startseite
if (!opening) {
  changePage("home");
}

return;
  }
/* 🎒 Choppers Rucksack auf- und zuklappen */
const backpackButton = event.target.closest("#chopper-backpack");

if (backpackButton) {
  const backpackPanel = document.getElementById("chopper-backpack-panel");

  if (backpackPanel) {
    backpackPanel.hidden = !backpackPanel.hidden;
  }

  return;
}
  // Eine Seite auswählen
  const pageButton = event.target.closest("[data-mobile-page]");

  if (pageButton && !pageButton.disabled) {
    const next = pageButton.dataset.mobilePage;

    closeMobileMenu();
    changePage(next);
    return;
  }

  // Außerhalb des Menüs tippen
  if (!event.target.closest("#mobile-menu")) {
    closeMobileMenu();
  }
});

// Mit Escape schließen
document.addEventListener("keydown", function (event) {
  if (event.key === "Escape") {
    closeMobileMenu();
  }
});

function changePage(next) {
  // Kein Effekt, wenn wir schon auf dieser Seite sind
  if (page === next) {
    window.scrollTo(0, 0);
    return;
  }

  page = next;
  render();

  // Bei jedem echten Seitenwechsel ganz nach oben
  window.scrollTo(0, 0);

  // 👁️ Genjutsu nur im Crimson-Theme
  if (data.theme === "crimson") {
    const main = document.querySelector(".main");

    if (main) {
      main.classList.remove("crimson-page-enter");

      // Animation zuverlässig neu starten
      void main.offsetWidth;

      main.classList.add("crimson-page-enter");
    }
  }
}

function setTheme(theme) {
  if (!["chopper", "crimson", "neo2050"].includes(theme)) return;

  data.theme = theme;
  save();
  render();
}


function renderNavigation() {
  // Gespeicherte Reihenfolge laden
  try {
    const reihenfolge = JSON.parse(
      localStorage.getItem(
        "lifeplaner-homebutton-reihenfolge"
      ) || "[]"
    );

    if (Array.isArray(reihenfolge)) {
      pages.sort((a, b) => {
        const aIndex = reihenfolge.indexOf(a[0]);
        const bIndex = reihenfolge.indexOf(b[0]);

        const aPosition = aIndex === -1
          ? Infinity
          : aIndex;

        const bPosition = bIndex === -1
          ? Infinity
          : bIndex;

        return aPosition - bPosition;
      });
    }
  } catch (fehler) {
    console.warn(
      "Button-Reihenfolge konnte nicht geladen werden.",
      fehler
    );
  }

  $("navigation").innerHTML = pages.map(([id, icon, title]) => `
    <button data-action="page"
      data-page="${id}"
      class="${page === id ? "active" : ""}">
      ${icon} ${title}
    </button>
  `).join("");
}


function renderHeader() {
  const crimson = data.theme === "crimson";

  document.body.dataset.theme = data.theme;
// 👁️ NUR CRIMSON – Akatsuki-Menübeschriftungen
const crimsonMenu = document.body.dataset.theme === "crimson";

const crimsonLabels = [
  ['[data-mobile-page="calendar"]', '📅', 'Kalender'],
  ['[data-mobile-page="einkaufsliste"]', '🛒', 'Einkaufsliste'],
  ['#mobile-menu-panel > button:disabled', '💰', 'Finanzen'],
  ['#chopper-backpack', '👁️', 'Mehr anzeigen']
];

crimsonLabels.forEach(([selector, emoji, label]) => {
  const button = document.querySelector(selector);
  if (!button) return;

  if (crimsonMenu) {
    if (!button.dataset.originalHtml) {
      button.dataset.originalHtml = button.innerHTML;
    }
    button.innerHTML = `${emoji} <span>${label}</span>`;
  } else if (button.dataset.originalHtml) {
    button.innerHTML = button.dataset.originalHtml;
  }
});
  const edition = document.getElementById("edition");
  const mascot = document.getElementById("mascot");
  const todayLabel = document.getElementById("today-label");
  const greeting = document.getElementById("greeting");

  if (edition) {
    edition.textContent = crimson
      ? "🖤 Crimson Edition"
      : "💗 Chopper Edition";
  }

  if (mascot) {
    mascot.textContent = "";
  }

  if (todayLabel) {
    todayLabel.textContent = formatDate(todayKey(), {
      weekday: "long"
    });
  }

  if (greeting) {
    const hour = new Date().getHours();

    greeting.textContent =
      hour < 11 ? "Guten Morgen ♡" :
      hour < 18 ? "Schönen Tag ♡" :
      "Guten Abend ♡";
  }
}

// ========================================
// KALENDER
// ========================================

function renderCalendar(compact = false) {
  const year = displayedMonth.getFullYear();
  const month = displayedMonth.getMonth();

  const first = new Date(year, month, 1);
  const offset = (first.getDay() + 6) % 7;
  const start = new Date(year, month, 1 - offset);

  const weekdays = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];

  let html = `
    <div class="calendar-head">
      <button class="secondary" data-action="prev-month">‹</button>
      <h2>${first.toLocaleDateString("de-DE", {
        month: "long",
        year: "numeric"
      })}</h2>
      <button class="secondary" data-action="next-month">›</button>
    </div>

    <div class="calendar">
      ${weekdays.map(day =>
        `<div class="weekday">${day}</div>`
      ).join("")}
  `;

  for (let i = 0; i < 42; i++) {
    const date = new Date(start);
    date.setDate(start.getDate() + i);

    const key = dateKey(date);
    const training = trainingAt(key);
    const work = workAt(key);
    const events = eventsFor(key);

    const outside = date.getMonth() !== month;
    const selected = key === selectedDate;
    const today = key === todayKey();

    html += `
      <button class="day
        ${outside ? "outside" : ""}
        ${selected ? "selected" : ""}
        ${today ? "today" : ""}
        ${events.length ? "has-event" : ""}"
        data-action="select-date"
        data-date="${key}">

        <div class="day-number">${date.getDate()}</div>
        
<div class="chopper-calendar-dots">
  ${events.length ? `
    <span class="calendar-dot event-dot" title="Termin"></span>
  ` : ""}
</div>
        ${compact ? "" : `
          <span class="tag">
            ${trainingIcon(training)} ${escapeHTML(training)}
          </span>

          <span class="tag">${escapeHTML(work)}</span>

          ${events.slice(0, 2).map(event => `
            <span class="tag">
              📌 ${escapeHTML(event.title)}
            </span>
          `).join("")}
        `}
      </button>
    `;
  }

  return html + "</div>";
}

function changeMonth(direction) {
  displayedMonth = new Date(
    displayedMonth.getFullYear(),
    displayedMonth.getMonth() + direction,
    1
  );

  render();
}

function selectDate(key) {
  const kommtVonAndererSeite = page !== "calendar";

  selectedDate = key;
  displayedMonth = startOfMonth(parseDate(key));
  page = "calendar";

  render();

  // Nur beim echten Seitenwechsel nach oben springen
  if (kommtVonAndererSeite) {
    window.scrollTo({
      top: 0,
      left: 0,
      behavior: "instant"
    });
  }
}

// ========================================
// TAGESDETAILS
// ========================================

/* SCHRITT 209 – Ungespeicherte Tagesnotiz schützen */

window.addEventListener("beforeunload", function (event) {
  const note = document.getElementById("day-note");

  if (!note) return;

  const savedNote = data.dayNotes[note.dataset.date] || "";

  if (note.value !== savedNote) {
    event.preventDefault();
    event.returnValue = "";
  }
});

function renderDayDetails(key) {
  const training = trainingAt(key);
  const work = workAt(key);
  const shifted = data.trainingShifts.includes(key);
  

    return `
    <div class="grid deluxe-day-details">
<article class="card">
  <h2>📌 Termine</h2>
  ${renderEvents(key)}
</article>
      <article class="card">
        <h2>🌸 ${formatDate(key, {
          weekday: "long"
        })}</h2>

        <div class="big-status">
          ${trainingIcon(training)} ${escapeHTML(training)}
        </div>

        <p>💼 ${escapeHTML(work)}</p>

        <div class="actions">
          <button
            data-action="shift-training"
            data-date="${key}"
            ${key < todayKey() ||
              key < TRAINING_START ||
              (!shifted && training === "Pause")
                ? "disabled"
                : ""}>
            ${shifted
              ? "Verschiebung rückgängig"
              : "Training verschieben"}
          </button>

          <button class="secondary"
            data-action="edit-work"
            data-date="${key}">
            Arbeit ändern
          </button>

          ${Object.prototype.hasOwnProperty.call(
            data.workOverrides,
            key
          )
            ? `<button class="secondary"
                data-action="reset-work"
                data-date="${key}">
                Standard wiederherstellen
              </button>`
            : ""}
        </div>
      </article>

      <article class="card">
        <h2>✅ Tagesaufgaben</h2>
        ${renderTasks(key)}
      </article>

      <article class="card">
        <h2>📝 Tagesnotiz</h2>

       
<textarea
  id="day-note"
  data-date="${key}"
  placeholder="Deine Gedanken für diesen Tag..."
  
oninput="const f = document.getElementById('day-note-feedback'); if (f) { f.textContent = '● Ungespeicherte Änderungen'; f.hidden = false; f.classList.add('unsaved'); }"

>${escapeHTML(data.dayNotes[key]||"")}</textarea>


        <button
          data-action="save-day-note"
          data-date="${key}">
          Notiz speichern
        </button>
        <p id="day-note-feedback" class="note-feedback" role="status" hidden></p>
      </article>

    </div>
  `;
}

// ========================================
// HOME
// ========================================

/* CHOPPER – COZY SPRÜCHE */


/* ========================================
   SCHRITT 231 – CHOPPERS MOTIVATIONSZAUBER
   ======================================== */

const chopperSprueche = {
  morgen: [
    "Guten Morgen, Sonnenschein! ☀️🍓",
    "Ein neuer Tag voller kleiner Wunder! 🌷",
    "Du musst heute nicht alles schaffen. ♡",
    "Ich glaub an dich! Auf geht's! 🧸",
    "Erst mal tief durchatmen und lächeln! 💗",
    "Heute darfst du in deinem Tempo wachsen! 🌱",
    "Du bist stärker, als du denkst! 🍓"
  ],

  mittag: [
    "Hey, hast du schon eine Pause gemacht? 🥛",
    "Du machst das richtig toll! 💗",
    "Auch kleine Fortschritte zählen! 🌸",
    "Vergiss nicht, etwas zu trinken! 🍓",
    "Du darfst stolz auf dich sein! ♡",
    "Ein Schritt nach dem anderen, okay? 🧸",
    "Ich feuere dich an! DU SCHAFFST DAS! 🎀"
  ],

  abend: [
    "Du hast heute genug geleistet. 🌙",
    "Zeit, es dir gemütlich zu machen! 🧸",
    "Ich bin stolz auf dich! Wirklich! 💗",
    "Auch ein schwieriger Tag zählt. ♡",
    "Lass die Sorgen für heute los. ☁️",
    "Morgen wartet ein neuer Anfang! 🍓",
    "Du verdienst einen ruhigen Abend! 🌷"
  ],

  nacht: [
    "Pssst ... Zeit zum Ausruhen! 🌙",
    "Die Sterne passen auf dich auf! ✨",
    "Du darfst jetzt alles für heute loslassen. ♡",
    "Schlaf gut, du kleiner Held! 🧸",
    "Morgen ist auch noch ein Tag! 🍓",
    "Ich wünsche dir die süßesten Träume! 💗"
  ],

  motivation: [
    "Ich glaub an dich! IMMER! 🍓",
    "Du bist so viel weiter, als du denkst! 💗",
    "Kleine Schritte sind große Siege! 🌸",
    "Du musst nicht perfekt sein, um toll zu sein! ♡",
    "Du darfst Fehler machen und trotzdem wachsen! 🌱",
    "Dein Tempo ist genau richtig! 🧸",
    "Jeder neue Versuch macht dich mutiger! 🎀",
    "Du bist nicht deine To-do-Liste! 💗",
    "Heute reicht auch ein kleiner Erfolg! 🍓",
    "Du kannst mehr, als du dir zutraust! ✨",
    "Auch Pausen gehören zum Fortschritt! ☁️",
    "Ich bin dein größter Fan! 🧸",
    "Du darfst neu anfangen. Jederzeit! 🌷",
    "Du bist wertvoll, auch wenn du nichts erledigst! ♡",
    "Hey! Schau mal, wie weit du schon gekommen bist! 🍓",
    "Eine Sache nach der anderen. Du packst das! 💗"
  ]
};

let letzterChopperSpruch = "";

function chopperSpruch() {
  const stunde = new Date().getHours();

  let tageszeit;

  if (stunde >= 5 && stunde < 11) {
    tageszeit = "morgen";
  } else if (stunde >= 11 && stunde < 18) {
    tageszeit = "mittag";
  } else if (stunde >= 18 && stunde < 23) {
    tageszeit = "abend";
  } else {
    tageszeit = "nacht";
  }

  // Mal ein Tageszeit-Spruch, mal pure Motivation!
  const kategorie =
    Math.random() < 0.5 ? tageszeit : "motivation";

  let auswahl = chopperSprueche[kategorie];

  // Verhindert, dass direkt derselbe Spruch kommt
  const andereSprueche = auswahl.filter(
    spruch => spruch !== letzterChopperSpruch
  );

  if (andereSprueche.length > 0) {
    auswahl = andereSprueche;
  }

  const index = Math.floor(
    Math.random() * auswahl.length
  );

  letzterChopperSpruch = auswahl[index];

  return letzterChopperSpruch;
}


/* ========================================
   SCHRITT 235 – CHOPPERS TRAININGSERKENNUNG
   ======================================== */

function chopperTrainingHeute() {
  const heute = todayKey();
  const status = trainingAt(heute);

  if (status === "Oberkörper") {
    return {
      typ: "training",
      name: "Oberkörper",
      spruch: "OBERKÖRPER-TAG! Let's gooo! 💪🍓"
    };
  }

  if (status === "Unterkörper") {
    return {
      typ: "training",
      name: "Unterkörper",
      spruch: "LEG DAY! Du packst das! 🏋️💗"
    };
  }

  if (status === "Pause") {
    return {
      typ: "cardio",
      name: "Cardio-Restday",
      spruch: "Heute machen wir gemütlich Cardio! 🏃🍓"
    };
  }

  return {
    typ: "cozy",
    name: "Cozy-Tag",
    spruch: "Wir machen heute alles in unserem Tempo! 🧸♡"
  };
  /* CHOPPERS AUTOMATISCHER BILDWECHSEL */

function chopperBildHeute() {
  const stunde = new Date().getHours();

  // Morgens: Kaffee-Chopper
  if (stunde >= 5 && stunde < 11) {
    return "chopper-morgen.png";
  }

  // Mittags: Gym oder Cardio
  if (stunde >= 11 && stunde < 18) {
    const training = chopperTrainingHeute();

    if (training.typ === "training") {
      return "chopper-gym.png";
    }

    if (training.typ === "cardio") {
      return "chopper-cardio.png";
    }

    return "chopper.png";
  }

  // Abends: Kuschel-Chopper
  if (stunde >= 18 && stunde < 22) {
    return "chopper.png";
  }

  // Ab 22 Uhr: Schlaf-Chopper
  return "chopper-nacht.png";
}
}

/* ========================================
   SCHRITT 246 – CHOPPERS BILDWECHSEL
   ======================================== */

function chopperBildHeute() {
  const stunde = new Date().getHours();

  // Morgens: Kaffee
  if (stunde >= 5 && stunde < 11) {
    return "chopper-morgen.png";
  }

  // Tagsüber: Trainingsplan
  if (stunde >= 11 && stunde < 18) {
    const status = trainingAt(todayKey());

    if (
      status === "Oberkörper" ||
      status === "Unterkörper"
    ) {
      return "chopper-gym.png";
    }

    if (status === "Pause") {
      return "chopper-cardio.png";
    }

    return "chopper.png";
  }

  // Abends: Kuscheln
  if (stunde >= 18 && stunde < 22) {
    return "chopper.png";
  }

  // Nachts: Schlafen
  return "chopper-nacht.png";
}

function renderHome() {
  const today = todayKey();
  const training = trainingAt(today);
  const work = workAt(today);
  const workTomorrow = workAt(addDays(today, 1));

  const upcoming = data.events
    .filter(event => event.date >= today)
    .sort((a, b) =>
      (a.date + (a.time || "")).localeCompare(
        b.date + (b.time || "")
      )
    )
    .slice(0, 5);

  
return `
  <div class="chopper-cozy-welcome">
    <div class="chopper-cozy-welcome-heart">♡</div>

    <img
      src="${chopperBildHeute()}"
      alt="Chopper begleitet dich durch den Tag"
      class="chopper-cozy-mascot"
      onerror="this.onerror=null;this.src='chopper.png';"
    >

    <div class="chopper-snooze">

      <span>Z</span>
      <span>z</span>
      <span>z</span>
      <span>♡</span>
      
    </div>

    <h2>🧸 Willkommen in deiner Kuschelecke ♡</h2>

    <p>
      Mach es dir gemütlich.
      Du musst heute nicht perfekt sein. 🌷
    </p>

    <div class="chopper-speech">
      <span class="chopper-speech-title">
        💗 Chopper sagt:
      </span>

      <span class="chopper-speech-text">
        ${chopperSpruch()}
      </span>
    </div>
  </div>

  <div class="grid neo-command-center">


      ${renderWeightDashboard()}

      <article class="card">
        <h2>💪 Heutiges Training</h2>

        <div class="big-status">
          ${trainingIcon(training)} ${escapeHTML(training)}
        </div>
        

        <p class="muted">
          Dein persönlicher 6-Tage-Rhythmus
        </p>

        <button data-action="page" data-page="training">
          Trainingsplan ansehen
        </button>
      </article>

      <article class="card work-today-card">
        <h2>💼 Dein Arbeitstag</h2>
        <p class="work-tomorrow">
  🌷 Morgen: ${escapeHTML(workTomorrow)}
</p>


        <div class="big-status">
          ${escapeHTML(work)}
        </div>

        <p class="muted">
          Automatisch berechneter Arbeitsstatus
        </p>

        <button data-action="page" data-page="work">
          Arbeitsplanung
        </button>
      </article>

      <article class="card">
        <h2>✅ Aufgaben heute</h2>
        ${renderTasks(today)}
      </article>

      <article class="card">
        <h2>📌 Nächste Termine</h2>

        <div class="stack">
          ${upcoming.map(event => `
            <div class="item">
              <strong>${escapeHTML(event.title)}</strong>

              <div class="mini">
                ${formatDate(event.date)}
                ${event.time
                  ? " · " + escapeHTML(event.time)
                  : ""}
              </div>
            </div>
          `).join("")}

          ${upcoming.length
            ? ""
            : '<p class="muted">Noch keine Termine.</p>'}
        </div>
      </article>

      <article class="card wide">
        <h2>📅 Dein Kalender</h2>
        ${renderCalendar(true)}
      </article>

    </div>
  `;
}

// ========================================
// TRAININGSSEITE
// ========================================

function renderTraining() {
  let rows = "";

  const start = todayKey() < TRAINING_START
    ? TRAINING_START
    : todayKey();

  for (let i = 0; i < 21; i++) {
    const key = addDays(start, i);
    const status = trainingAt(key);
    const shifted = data.trainingShifts.includes(key);

    rows += `
      <div class="item">
        <div class="row">
          <div>
            <strong>${formatDate(key, { weekday: "short" })}</strong>
            <div class="big-status">
              ${trainingIcon(status)} ${escapeHTML(status)}
            </div>
          </div>

          <button
            class="${shifted ? "secondary" : ""}"
            data-action="shift-training"
            data-date="${key}"
            ${!shifted && status === "Pause" ? "disabled" : ""}>
            ${shifted ? "Rückgängig" : "Verschieben"}
          </button>
        </div>
      </div>
    `;
  }

  return `
    <article class="card">
      <h2>💪 Dein Trainingsrhythmus</h2>

      <p>
        Start: 3. November 2026 mit Oberkörper.
        Die Reihenfolge lautet Oberkörper, Unterkörper,
        Pause, Oberkörper, Unterkörper, Pause.
      </p>

      <p class="muted">
        Eine Verschiebung fügt einen zusätzlichen Pausentag
        ein und schiebt die folgenden Einheiten nach hinten.
      </p>

      <div class="stack">${rows}</div>
    </article>
  `;
}

// ========================================
// ARBEITSSEITE
// ========================================

// ========================================
// ARBEITSZENTRALE – URLAUB, NOTIZEN, REMINDER
// ========================================

function isWorkday(key) {
  const day = parseDate(key).getDay();

  return day !== 0 &&
    day !== 6 &&
    !(data.vacation.excludeHolidays || []).includes(key);
}

function countWorkStatus(start, end, status) {
  let total = 0;

  for (const [key, value] of Object.entries(data.workOverrides)) {
    if (
      key >= start &&
      key <= end &&
      value === status &&
      isWorkday(key)
    ) {
      total++;
    }
  }

  return total;
}

function vacationStats(at = todayKey()) {
  const v = data.vacation;
  const base = v.baseDate;
  const year = Number(at.slice(0, 4));
  const baseYear = Number(base.slice(0, 4));
  const annual = Math.max(0, Number(v.annualDays) || 0);

  const yearsAdded = Math.max(0, year - baseYear);

  const used = at >= base
    ? countWorkStatus(base, at, "Urlaub")
    : 0;

  return {
    remaining:
      (Number(v.baseDays) || 0) +
      yearsAdded * annual -
      used,
    used,
    annual
  };
}

function sicknessThisYear() {
  const year = todayKey().slice(0, 4);

  return countWorkStatus(
    year + "-01-01",
    year + "-12-31",
    "Krank"
  );
}

function lastDayOfMonth(key) {
  const d = parseDate(key);

  return dateKey(
    new Date(
      d.getFullYear(),
      d.getMonth() + 1,
      0
    )
  );
}

function reminderInstances(reminder, today = todayKey()) {
  const result = [];
  const start = reminder.start || today;
  const repeat = reminder.repeat;
  const day = parseDate(today).getDay();
  const weekday = Number(reminder.weekday ?? 1);
  const last = lastDayOfMonth(today);

  const add = (key, label) => {
    if (key >= start && key <= today) {
      result.push({ key, label });
    }
  };

  if (repeat === "once") {
    add(start, formatDate(start));
  } else if (repeat === "daily") {
    add(today, "Täglich");
  } else if (repeat === "weekdays") {
    if (day > 0 && day < 6) {
      add(today, "Werktags");
    }
  } else if (repeat === "weekly") {
    if (day === weekday) {
      add(today, "Wöchentlich");
    }
  } else if (repeat === "biweekly") {
    if (
      day === weekday &&
      daysBetween(
        mondayOf(start),
        mondayOf(today)
      ) % 14 === 0
    ) {
      add(today, "Alle 2 Wochen");
    }
  } else if (repeat === "monthly") {
    if (
      parseDate(today).getDate() ===
      Math.min(
        Number(reminder.monthDay || 1),
        parseDate(last).getDate()
      )
    ) {
      add(today, "Monatlich");
    }
  } else if (repeat === "yearly") {
    if (today.slice(5) === start.slice(5)) {
      add(today, "Jährlich");
    }
  } else if (repeat === "monthend") {
    const days = daysBetween(today, last);

    if (days <= Number(reminder.daysBefore ?? 2)) {
      add(
        last,
        "Monatsende: " + formatDate(last)
      );
    }
  } else if (repeat === "friday") {
    // Sichtbar von Montag bis Freitag.
    if (day >= 1 && day <= 5) {
      add(
        addDays(mondayOf(today), 4),
        "Bis Freitag: Arbeitszeitenbuchung"
      );
    }
  }

  return result;
}

function defaultReminders() {
  return [
    {
      id: "system-friday",
      title: "Arbeitszeitenbuchung für diese Woche abschließen",
      repeat: "friday",
      start: "2026-11-01",
      system: true
    },
    {
      id: "system-month",
      title: "Arbeitszeitenbuchung für den Monatsabschluss abschließen",
      repeat: "monthend",
      daysBefore: 3,
      start: "2026-11-01",
      system: true
    }
  ];
}

function renderWorkReminders() {
  const today = todayKey();
  const all = [
    ...defaultReminders(),
    ...data.reminders
  ];

  const rows = [];

  for (const reminder of all) {
    for (const instance of reminderInstances(reminder, today)) {
      const doneKey =
        reminder.id + "|" + instance.key;

      const done = Boolean(
        data.reminderDone[doneKey]
      );

      rows.push(`
        <div class="lp-reminder ${done ? "lp-done" : ""}">
          <div>
            <strong>${escapeHTML(reminder.title)}</strong>

            <small>
              ${escapeHTML(instance.label)}
              · ${done ? "Erledigt" : "Offen"}
            </small>
          </div>

          <div class="lp-reminder-buttons">
            <button
              class="${done ? "secondary" : ""}"
              data-action="reminder-toggle"
              data-id="${escapeHTML(reminder.id)}"
              data-occurrence="${instance.key}">
              ${done ? "↩ Zurück" : "✓ Erledigt"}
            </button>

            ${reminder.system ? "" : `
              <button
                class="danger"
                data-action="reminder-delete"
                data-id="${escapeHTML(reminder.id)}">
                ×
              </button>
            `}
          </div>
        </div>
      `);
    }
  }

  return rows.length
    ? rows.join("")
    : '<p class="muted">Heute keine fälligen Erinnerungen.</p>';
}

function renderWork() {
  let rows = "";

  for (let i = 0; i < 21; i++) {
    const key = addDays(todayKey(), i);

    rows += `
      <div class="item row">
        <div>
          <strong>
            ${formatDate(key, { weekday: "short" })}
          </strong>
          <div>${escapeHTML(workAt(key))}</div>
        </div>

        <button
          class="secondary"
          data-action="edit-work"
          data-date="${key}">
          Ändern
        </button>
      </div>
    `;
  }

  const stats = vacationStats();

  return `
    <div class="grid lp-work-grid">

      <article class="card wide">
        <h2>💼 Meine Arbeitsübersicht</h2>

        <div class="lp-stat-grid">
          <div class="lp-stat">
            <small>🌴 Resturlaub</small>
            <strong>${stats.remaining}</strong>
            <small>Tage verfügbar</small>
          </div>

          <div class="lp-stat">
            <small>
              🤒 Krankheitstage ${todayKey().slice(0, 4)}
            </small>
            <strong>${sicknessThisYear()}</strong>
            <small>Erfasste Arbeitstage</small>
          </div>
        </div>

        <p class="muted">
          Urlaub und Krankheit werden über
          „Arbeit ändern“ im Kalender oder hier erfasst.
          Gesetzliche Feiertage kannst du in den
          Einstellungen als arbeitsfreie Tage hinterlegen.
        </p>
      </article>

      <article class="card wide">
        <h2>🔔 Erinnerungen</h2>

        <div class="lp-reminders">
          ${renderWorkReminders()}
        </div>

        <button data-action="reminder-add">
          + Eigene Erinnerung
        </button>

        <p class="muted">
          Erinnerungen erscheinen beim Öffnen des
          LifePlaners am Fälligkeitstag.
          Es werden noch keine iPhone-Push-Nachrichten
          verschickt.
        </p>
      </article>

      <article class="card wide">
        <h2>📝 Arbeitsnotizen</h2>

        <textarea
          id="work-notes"
          rows="5"
          placeholder="Wichtige Punkte, Arbeitsaufgaben, Dinge zum Merken …">${escapeHTML(data.workNotes)}</textarea>

        <button data-action="work-notes-save">
          Notizen speichern
        </button>
      </article>

      <article class="card">
        <h2>🏠 Homeoffice-Rhythmus</h2>

        <div class="field">
          <label>Referenzwoche (Montag)</label>

          <input
            type="date"
            id="reference-week"
            value="${data.referenceWeek}">
        </div>

        <div class="field">
          <label>Homeoffice in der Referenzwoche</label>

          <select id="reference-homeoffice">
            <option
              value="tuesday"
              ${data.referenceHomeoffice === "tuesday"
                ? "selected"
                : ""}>
              Dienstag
            </option>

            <option
              value="wednesday"
              ${data.referenceHomeoffice === "wednesday"
                ? "selected"
                : ""}>
              Mittwoch
            </option>
          </select>
        </div>

        <button data-action="save-work-settings">
          Rhythmus speichern
        </button>
      </article>

      <article class="card">
        <h2>📆 Nächste 21 Tage</h2>

        <div class="stack">
          ${rows}
        </div>
      </article>

    </div>
  `;
}

function editWork(key) {
  openEditor(
    "Arbeitsstatus ändern – " + formatDate(key),
    [
      {
        name: "status",
        label: "Arbeitsstatus",
        type: "select",
        value: workAt(key),
        options: [
          "Büro",
          "Homeoffice",
          "Urlaub",
          "Frei",
          "Krank"
        ]
      }
    ],
    values => {
      data.workOverrides[key] = values.status;

      save();
      render();
    }
  );
}

function resetWork(key) {
  delete data.workOverrides[key];

  save();
  render();
}

function addReminder() {
  openEditor("Neue Erinnerung", [
    {
      name: "title",
      label: "Woran möchtest du erinnert werden?",
      required: true
    },
    {
      name: "start",
      label: "Startdatum",
      type: "date",
      value: todayKey(),
      required: true
    },
    {
      name: "repeat",
      label: "Wiederholung",
      type: "select",
      value: "Wöchentlich",
      options: [
        "Einmal",
        "Täglich",
        "Werktags",
        "Wöchentlich",
        "Alle 2 Wochen",
        "Monatlich",
        "Jährlich",
        "Monatsende"
      ]
    },
    {
      name: "weekday",
      label: "Wochentag (für wöchentlich)",
      type: "select",
      value: "Montag",
      options: [
        "Montag",
        "Dienstag",
        "Mittwoch",
        "Donnerstag",
        "Freitag",
        "Samstag",
        "Sonntag"
      ]
    },
    {
      name: "monthDay",
      label: "Monatstag (1–31)",
      type: "number",
      value: "1"
    },
    {
      name: "daysBefore",
      label: "Tage vor Monatsende (0–28)",
      type: "number",
      value: "3"
    }
  ], values => {
    const repeatNames = {
      "Einmal": "once",
      "Täglich": "daily",
      "Werktags": "weekdays",
      "Wöchentlich": "weekly",
      "Alle 2 Wochen": "biweekly",
      "Monatlich": "monthly",
      "Jährlich": "yearly",
      "Monatsende": "monthend"
    };

    const weekdays = [
      "Sonntag",
      "Montag",
      "Dienstag",
      "Mittwoch",
      "Donnerstag",
      "Freitag",
      "Samstag"
    ];

    if (
      !values.title.trim() ||
      !/^\d{4}-\d{2}-\d{2}$/.test(values.start) ||
      dateKey(parseDate(values.start)) !== values.start
    ) {
      alert(
        "Bitte Titel und gültiges Startdatum eingeben."
      );
      return;
    }

    data.reminders.push({
      id: uid(),
      title: values.title.trim(),
      start: values.start,
      repeat: repeatNames[values.repeat],
      weekday: weekdays.indexOf(values.weekday),
      monthDay: Math.max(
        1,
        Math.min(31, Number(values.monthDay) || 1)
      ),
      daysBefore: Math.max(
        0,
        Math.min(28, Number(values.daysBefore) || 0)
      )
    });

    save();
    render();
  });
}

// ========================================
// NOTIZENSEITE
// ========================================

function renderNotes() {
  return `
    <article class="card">
      <div class="row">
        <h2>📝 Meine Notizen</h2>
        <button data-action="add-note">+ Neue Notiz</button>
      </div>

      <div class="stack">
        ${data.notes.map(note => `
          <div class="item">
            <h3>${escapeHTML(note.title)}</h3>

            <p style="white-space:pre-wrap">${escapeHTML(note.body)}</p>

            <div class="actions">
              <button class="secondary"
                data-action="edit-note"
                data-id="${note.id}">Bearbeiten</button>

              <button class="danger"
                data-action="delete-note"
                data-id="${note.id}">Löschen</button>
            </div>
          </div>
        `).join("")}

        ${data.notes.length ? "" :
          '<p class="muted">Noch keine Notizen vorhanden.</p>'}
      </div>
    </article>
  `;
}

// ========================================
// EINSTELLUNGEN
// ========================================

function renderSettings() {
  return `
    <div class="grid">
      <article class="card wide">
        <h2>🎨 Design auswählen</h2>

        <div class="theme-options">
          <button
            class="theme-choice chopper
              ${data.theme === "chopper" ? "selected" : ""}"
            data-action="theme"
            data-theme="chopper">
            💗🌸<br>Chopper Edition
          </button>

          <button
            class="theme-choice crimson
              ${data.theme === "crimson" ? "selected" : ""}"
            data-action="theme"
            data-theme="crimson">
            🖤🐦‍⬛<br>Crimson Edition
          </button>
          <button
  class="theme-choice neo2050
    ${data.theme === "neo2050" ? "selected" : ""}"
  data-action="theme"
  data-theme="neo2050">
  🩵🚀<br>NEO 2050
</button>
        </div>

        <p class="muted">
          Beim Designwechsel bleiben alle Daten erhalten.
        </p>
      </article>

      <article class="card wide">
        <h2>🏠 Startseite personalisieren</h2>

        <p class="muted">
          Bestimme selbst, in welcher Reihenfolge
          deine Homebuttons angezeigt werden.
        </p>

        
<div id="homebutton-sortierung">
  
${pages.map(([id, icon, title], index) => `
  <div class="field">
    <span>${icon} ${escapeHTML(title)}</span>

    <div class="actions">
      <button
        class="secondary"
        data-action="homebutton-up"
        data-button-id="${id}"
        ${index === 0 ? "disabled" : ""}>
        ⬆️
      </button>

      <button
        class="secondary"
        data-action="homebutton-down"
        data-button-id="${id}"
        ${index === pages.length - 1 ? "disabled" : ""}>
        ⬇️
      </button>
    </div>
  </div>
`).join("")}

</div>

      </article>

      <article class="card wide">
        <h2>🌴 Urlaubskonto einstellen</h2>

        <p class="muted">
          Hier kannst du deinen Resturlaub und deinen
          jährlichen Urlaubsanspruch einstellen.
          Eingetragene Urlaubstage werden automatisch
          vom Urlaubskonto abgezogen.
        </p>

        <div class="field">
          <label>Stichtag</label>

          <input
            id="vacation-base-date"
            type="date"
            value="${escapeHTML(data.vacation.baseDate)}">
        </div>

        <div class="field">
          <label>
            Resturlaub am Stichtag
          </label>

          <input
            id="vacation-base-days"
            type="number"
            min="0"
            step="0.5"
            value="${data.vacation.baseDays}">
        </div>

        <div class="field">
          <label>
            Neue Urlaubstage jedes Jahr am 1. Januar
          </label>

          <input
            id="vacation-annual-days"
            type="number"
            min="0"
            step="0.5"
            value="${data.vacation.annualDays}">
        </div>

        <div class="field">
          <label>
            Zusätzliche arbeitsfreie Tage / Feiertage
            (JJJJ-MM-TT, eine Zeile pro Tag)
          </label>

          <textarea
            id="vacation-holidays"
            rows="3"
            placeholder="2026-12-25">${escapeHTML(
              (data.vacation.excludeHolidays || []).join("\n")
            )}</textarea>
        </div>

        <button data-action="vacation-save">
          Urlaubskonto speichern
        </button>

        <p class="muted">
          Nicht genutzter Urlaub wird in dieser Version
          ins nächste Jahr übernommen. Bitte gleiche
          das mit den Regeln deines Arbeitgebers ab.
        </p>
      </article>

      <article class="card">
        <h2>💾 Datensicherung</h2>

        <p>
          Exportiere deine Daten als JSON-Datei.
        </p>

        <div class="actions">
          <button data-action="export">
            Backup exportieren
          </button>

          <button
            class="secondary"
            data-action="import">
            Backup importieren
          </button>
        </div>
      </article>

      <article class="card">
        <h2>ℹ️ LifePlaner</h2>

        <p>Version 1.0</p>

        <p class="muted">
          Alle Daten werden lokal in diesem Browser
          gespeichert. Für die Nutzung auf einem
          anderen Gerät benötigst du einen
          Backup-Export und anschließenden Import.
        </p>
      </article>
    </div>
  `;
}

// ========================================
// BACKUP
// ========================================

function exportBackup() {
  const blob = new Blob(
    [JSON.stringify(data, null, 2)],
    { type: "application/json" }
  );

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = `LifePlaner-Backup-${todayKey()}.json`;
  link.click();

  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function validateBackup(value) {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value)
  ) {
    throw new Error("Ungültiges Backup.");
  }

 if (!["chopper", "crimson", "neo2050"].includes(value.theme)) {
    throw new Error("Ungültiges Design.");
  }

  if (
    !Array.isArray(value.events) ||
    !Array.isArray(value.notes) ||
    !Array.isArray(value.trainingShifts)
  ) {
    throw new Error("Unvollständige Datenlisten.");
  }

  if (
    !value.tasks ||
    typeof value.tasks !== "object" ||
    Array.isArray(value.tasks) ||
    !value.dayNotes ||
    typeof value.dayNotes !== "object" ||
    Array.isArray(value.dayNotes) ||
    !value.workOverrides ||
    typeof value.workOverrides !== "object" ||
    Array.isArray(value.workOverrides)
  ) {
    throw new Error("Ungültige Tagesdaten.");
  }

  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(value.referenceWeek) ||
    !["tuesday", "wednesday"].includes(
      value.referenceHomeoffice
    )
  ) {
    throw new Error("Ungültiger Arbeitsrhythmus.");
  }

  const validDate = key => {
    if (
      typeof key !== "string" ||
      !/^\d{4}-\d{2}-\d{2}$/.test(key)
    ) {
      return false;
    }

    const date = parseDate(key);

    return (
      !Number.isNaN(date.getTime()) &&
      dateKey(date) === key
    );
  };

  if (!validDate(value.referenceWeek)) {
    throw new Error("Ungültiges Referenzdatum.");
  }

  for (const event of value.events) {
    if (
      !event ||
      typeof event.id !== "string" ||
      typeof event.title !== "string" ||
      !validDate(event.date) ||
      typeof event.time !== "string" ||
      (
        event.time &&
        !/^([01]\d|2[0-3]):[0-5]\d$/.test(event.time)
      )
    ) {
      throw new Error("Ungültiger Termin.");
    }
  }

  for (const note of value.notes) {
    if (
      !note ||
      typeof note.id !== "string" ||
      typeof note.title !== "string" ||
      typeof note.body !== "string"
    ) {
      throw new Error("Ungültige Notiz.");
    }
  }

  for (const [key, tasks] of Object.entries(value.tasks)) {
    if (
      !validDate(key) ||
      !Array.isArray(tasks) ||
      tasks.some(task =>
        !task ||
        typeof task.id !== "string" ||
        typeof task.title !== "string" ||
        typeof task.done !== "boolean"
      )
    ) {
      throw new Error("Ungültige Aufgaben.");
    }
  }

  for (const [key, note] of Object.entries(value.dayNotes)) {
    if (
      !validDate(key) ||
      typeof note !== "string"
    ) {
      throw new Error("Ungültige Tagesnotiz.");
    }
  }

  for (
    const [key, status] of
    Object.entries(value.workOverrides)
  ) {
    if (
      !validDate(key) ||
      ![
        "Büro",
        "Homeoffice",
        "Urlaub",
        "Frei",
        "Krank"
      ].includes(status)
    ) {
      throw new Error("Ungültiger Arbeitsstatus.");
    }
  }

  if (
    value.trainingShifts.some(
      key => !validDate(key) || key < TRAINING_START
    ) ||
    new Set(value.trainingShifts).size !==
      value.trainingShifts.length
  ) {
    throw new Error(
      "Ungültige Trainingsverschiebungen."
    );
  }

  // Die Prüfung der Gewichtsdaten
  // wird in Teil 7 fortgesetzt.

if (value.weights !== undefined) {
  if (
    !value.weights ||
    typeof value.weights !== "object" ||
    Array.isArray(value.weights)
  ) {
    throw new Error("Ungültige Gewichtsdaten.");
  }

  for (const [date, weight] of Object.entries(value.weights)) {
    const validDate =
      /^\d{4}-\d{2}-\d{2}$/.test(date) &&
      dateKey(parseDate(date)) === date;

    if (
      !validDate ||
      typeof weight !== "number" ||
      !Number.isFinite(weight) ||
      weight < 20 ||
      weight > 400
    ) {
      throw new Error("Ungültiger Gewichtseintrag.");
    }
  }
}

  return true;
}

// ========================================
// BACKUP IMPORTIEREN
// ========================================

$("import-file").addEventListener("change", async event => {
  const file = event.target.files[0];
  if (!file) return;

  try {
    if (file.size > 5 * 1024 * 1024) {
      throw new Error("Die Datei ist zu groß.");
    }

    const imported = JSON.parse(await file.text());

    validateBackup(imported);

    if (!confirm(
      "Alle aktuellen Daten werden überschrieben. Fortfahren?"
    )) {
      return;
    }

    data = {
      ...clone(DEFAULT_DATA),
      ...clone(imported)
    };

    if (
      !data.weights ||
      typeof data.weights !== "object" ||
      Array.isArray(data.weights)
    ) {
      data.weights = {};
    }

    ensureWorkData();
    save();
    render();

    alert("Backup erfolgreich importiert!");

  } catch (error) {
    console.error("Backup-Import fehlgeschlagen:", error);

    alert(
      "Import fehlgeschlagen: " + error.message
    );

  } finally {
    event.target.value = "";
  }
});

// ========================================
// ZENTRALE BUTTON-STEUERUNG
// ========================================

document.addEventListener("click", event => {
  const button = event.target.closest("[data-action]");
  if (!button || button.disabled) return;

  const action = button.dataset.action;
  const key = button.dataset.date;
  const id = button.dataset.id;

  switch (action) {
    case "page":
      changePage(button.dataset.page);
      break;

    case "theme":
      setTheme(button.dataset.theme);
      break;

    case "homebutton-up":
    case "homebutton-down": {
      const buttonId = button.dataset.buttonId;
      const index = pages.findIndex(
        eintrag => eintrag[0] === buttonId
      );

      const richtung =
        action === "homebutton-up" ? -1 : 1;

      const neuerIndex = index + richtung;

      if (
        index >= 0 &&
        neuerIndex >= 0 &&
        neuerIndex < pages.length
      ) {
        [pages[index], pages[neuerIndex]] =
          [pages[neuerIndex], pages[index]];

        // Reihenfolge der Homebuttons speichern
        localStorage.setItem(
          "lifeplaner-homebutton-reihenfolge",
          JSON.stringify(pages.map(eintrag => eintrag[0]))
        );

        render();
      }

      break;
    }

    case "prev-month":
      changeMonth(-1);
      break;

    case "next-month":
      changeMonth(1);
      break;

    case "select-date":
      selectDate(key);
      break;

    case "open-weight":
      openWeightSheet(
        button.dataset.date || todayKey()
      );
      break;

    case "delete-weight":
      deleteWeight(button.dataset.date);
      break;

    case "add-task":
      addTask(key);
      break;

    case "edit-task":
      editTask(key, id);
      break;

    case "delete-task":
      deleteTask(key, id);
      break;

    case "add-event":
      addEvent(key);
      break;

    case "edit-event":
      eventEditor(id);
      break;

    case "delete-event":
      deleteEvent(id);
      break;

    case "shift-training":
      shiftTraining(key);
      break;

    case "edit-work":
      editWork(key);
      break;

    case "reset-work":
      resetWork(key);
      break;

    case "add-note":
      editNote();
      break;

    case "edit-note":
      editNote(id);
      break;

    case "delete-note":
      deleteNote(id);
      break;

    // Arbeitsnotizen speichern
    case "work-notes-save":
      data.workNotes = $("work-notes").value;
      save();
      alert("Arbeitsnotizen gespeichert!");
      break;

    // Eigene Erinnerung hinzufügen
    case "reminder-add":
      addReminder();
      break;

    // Eigene Erinnerung löschen
    case "reminder-delete":
      if (confirm("Erinnerung löschen?")) {
        data.reminders = data.reminders.filter(
          reminder => reminder.id !== id
        );

        save();
        render();
      }
      break;

    // Erinnerung als erledigt markieren
    case "reminder-toggle": {
      const doneKey =
        id + "|" + button.dataset.occurrence;

      if (data.reminderDone[doneKey]) {
        delete data.reminderDone[doneKey];
      } else {
        data.reminderDone[doneKey] = true;
      }

      save();
      render();
      break;
    }

    // Urlaubskonto speichern
    case "vacation-save": {
      const baseDate =
        $("vacation-base-date").value;

      const baseDays =
        Number($("vacation-base-days").value);

      const annualDays =
        Number($("vacation-annual-days").value);

      const holidays = $("vacation-holidays")
        .value
        .split(/[\s,;]+/)
        .map(value => value.trim())
        .filter(Boolean);

      const valid = value =>
        /^\d{4}-\d{2}-\d{2}$/.test(value) &&
        dateKey(parseDate(value)) === value;

      if (
        !valid(baseDate) ||
        !Number.isFinite(baseDays) ||
        baseDays < 0 ||
        !Number.isFinite(annualDays) ||
        annualDays < 0 ||
        holidays.some(value => !valid(value))
      ) {
        alert(
          "Bitte gültige Werte und Datumsangaben eingeben."
        );
        break;
      }

      data.vacation = {
        baseDate,
        baseDays,
        annualDays,
        excludeHolidays: [...new Set(holidays)]
      };

      save();
      render();
      alert("Urlaubskonto gespeichert!");
      break;
    }

    // Tagesnotiz speichern
    
case "save-day-note": {
  data.dayNotes[key] = $("day-note").value;
  save();

  const feedback = document.getElementById(
    "day-note-feedback"
  );

  
if (feedback) {
  feedback.textContent = "✓ Notiz gespeichert!";
  feedback.hidden = false;
  feedback.classList.remove("unsaved");
}


  break;
}


    // Homeoffice-Rhythmus speichern
    case "save-work-settings": {
      const reference =
        $("reference-week").value;

      if (
        !/^\d{4}-\d{2}-\d{2}$/.test(reference) ||
        dateKey(parseDate(reference)) !== reference
      ) {
        alert(
          "Bitte ein gültiges Referenzdatum eingeben."
        );
        break;
      }

      data.referenceWeek = mondayOf(reference);
      data.referenceHomeoffice =
        $("reference-homeoffice").value;

      save();
      render();
      break;
    }

    // Datensicherung
    case "export":
      exportBackup();
      break;

    case "import":
      $("import-file").click();
      break;
  }
});

// ========================================
// ÄNDERUNGEN AN EINGABEFELDERN
// ========================================

document.addEventListener("change", event => {
  const element = event.target;

  if (element.dataset.action === "toggle-task") {
    toggleTask(
      element.dataset.date,
      element.dataset.id
    );
  }
});

// ========================================
// GEWICHTSTRACKER
// ========================================

function getWeightEntries() {
  return Object.entries(data.weights || {})
    .filter(([date, weight]) =>
      /^\d{4}-\d{2}-\d{2}$/.test(date) &&
      typeof weight === "number" &&
      Number.isFinite(weight)
    )
    .sort((a, b) => a[0].localeCompare(b[0]));
}

function formatWeight(value) {
  if (value === null || value === undefined) {
    return "—";
  }

  return value.toLocaleString("de-DE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

function averageWeight(entries) {
  if (!entries.length) return null;

  const total = entries.reduce(
    (sum, [, weight]) => sum + weight,
    0
  );

  return total / entries.length;
}

function weightAverageBetween(start, end) {
  const entries = getWeightEntries().filter(
    ([date]) => date >= start && date <= end
  );

  return averageWeight(entries);
}

function weightMonthStart(date) {
  return date.slice(0, 7) + "-01";
}

function weightMonthEnd(date) {
  const first = parseDate(weightMonthStart(date));

  return dateKey(
    new Date(
      first.getFullYear(),
      first.getMonth() + 1,
      0
    )
  );
}

function getWeightStats() {
  const today = todayKey();

  const thisMonday = mondayOf(today);
  const lastMonday = addDays(thisMonday, -7);

  const currentWeek = weightAverageBetween(
    thisMonday,
    addDays(thisMonday, 6)
  );

  const previousWeek = weightAverageBetween(
    lastMonday,
    addDays(thisMonday, -1)
  );

  const thisMonth = weightMonthStart(today);

  const previousMonth = dateKey(
    new Date(
      parseDate(thisMonth).getFullYear(),
      parseDate(thisMonth).getMonth() - 1,
      1
    )
  );

  const currentMonth = weightAverageBetween(
    thisMonth,
    weightMonthEnd(thisMonth)
  );

  const previousMonthAverage = weightAverageBetween(
    previousMonth,
    weightMonthEnd(previousMonth)
  );

  const entries = getWeightEntries();

  const lastEntry = entries.length
    ? entries[entries.length - 1]
    : null;

  return {
    lastEntry,
    currentWeek,
    previousWeek,
    currentMonth,
    previousMonth: previousMonthAverage
  };
}

function renderWeightChange(current, previous) {
  if (current === null || previous === null) {
    return `<span class="muted">
      Noch kein Vergleich möglich
    </span>`;
  }

  const difference = current - previous;
  const percent = previous
    ? (difference / previous) * 100
    : 0;

  const sign = difference > 0 ? "+" : "";

  const colorClass =
    difference > 0 ? "weight-up" :
    difference < 0 ? "weight-down" : "";

  return `
    <span class="${colorClass}">
      ${sign}${formatWeight(difference)} kg
      (${sign}${percent.toLocaleString("de-DE", {
        minimumFractionDigits: 1,
        maximumFractionDigits: 1
      })} %)
    </span>
  `;
}

// ========================================
// GEWICHTSÜBERSICHT AUF DER STARTSEITE
// ========================================

function renderWeightDashboard() {
  const stats = getWeightStats();

  return `
    <article class="card wide weight-overview">

      <div class="row">
        <h2>⚖️ Mein Gewicht</h2>

        <button data-action="open-weight">
          + Gewicht eintragen
        </button>
      </div>

      <div class="weight-kpis">

        <div class="weight-kpi">
          <span>Aktuelles Gewicht</span>
          <strong>
            ${stats.lastEntry
              ? formatWeight(stats.lastEntry[1]) + " kg"
              : "—"}
          </strong>
          <small>
            ${stats.lastEntry
              ? formatDate(stats.lastEntry[0])
              : "Noch kein Eintrag"}
          </small>
        </div>

        <div class="weight-kpi">
          <span>Wochendurchschnitt</span>
          <strong>
            ${stats.currentWeek !== null
              ? formatWeight(stats.currentWeek) + " kg"
              : "—"}
          </strong>
          <small>
            ${renderWeightChange(
              stats.currentWeek,
              stats.previousWeek
            )}
          </small>
        </div>

        <div class="weight-kpi">
          <span>Monatsdurchschnitt</span>
          <strong>
            ${stats.currentMonth !== null
              ? formatWeight(stats.currentMonth) + " kg"
              : "—"}
          </strong>
          <small>
            ${renderWeightChange(
              stats.currentMonth,
              stats.previousMonth
            )}
          </small>
        </div>

      </div>

      <button
        class="secondary"
        data-action="page"
        data-page="weight">
        Gewichtsverlauf ansehen
      </button>

    </article>
  `;
}

// ========================================
// GEWICHTSVERLAUF
// ========================================

function weightHistoryGroupKey(date) {
  return date.slice(0, 7) + "-01";
}

function weightHistoryGroupTitle(key) {
  return parseDate(key).toLocaleDateString("de-DE", {
    month: "long",
    year: "numeric"
  });
}

function weightHistoryDifference(current, previous) {
  if (previous === null) {
    return `
      <span class="weight-diff weight-diff-neutral">
        Erster Eintrag
      </span>
    `;
  }

  const difference = Math.round(
    (current - previous) * 100
  ) / 100;

  const cssClass =
    difference > 0
      ? "weight-diff-up"
      : difference < 0
        ? "weight-diff-down"
        : "weight-diff-neutral";

  const sign =
    difference > 0
      ? "+"
      : difference < 0
        ? "−"
        : "±";

  return `
    <span class="weight-diff ${cssClass}">
      ${sign}${formatWeight(Math.abs(difference))} kg
    </span>
  `;
}
let weightHistoryView = "days";
// 🌸 Gewichtstagebuch: Monatswerte berechnen
function getWeightHistoryMonths() {
  const groups = new Map();

  getWeightEntries().forEach(([date, weight]) => {
    const month = date.slice(0, 7);

    if (!groups.has(month)) {
      groups.set(month, []);
    }

    groups.get(month).push({ date, weight });
  });

  return [...groups.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([month, items]) => ({
      month,
      items,
      average: items.reduce(
        (sum, item) => sum + item.weight,
        0
      ) / items.length
    }));
}
// 🌸 Gewichtstagebuch: Wochenwerte berechnen
function getWeightHistoryWeeks() {
  const groups = new Map();

  getWeightEntries().forEach(([date, weight]) => {
    const week = mondayOf(date);

    if (!groups.has(week)) {
      groups.set(week, []);
    }

    groups.get(week).push({ date, weight });
  });

  return [...groups.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([week, items]) => ({
      week,
      items,
      average: items.reduce(
        (sum, item) => sum + item.weight,
        0
      ) / items.length
    }));
}// 🌸 Gewichtstagebuch: Wochenansicht
function renderWeightHistoryWeeks() {
  const weeks = getWeightHistoryWeeks();

  if (!weeks.length) {
    return '<p class="muted">Noch keine Gewichtseinträge vorhanden.</p>';
  }

  // Alle vorherigen Messungen für den Tagesvergleich
  const entries = getWeightEntries();
  const previousWeights = new Map();

  entries.forEach(([date], index) => {
    previousWeights.set(
      date,
      index > 0 ? entries[index - 1][1] : null
    );
  });

  return `
    <div class="weight-history-groups">

      ${[...weeks].reverse().map((group, index, reversedWeeks) => {
        const previous = weeks.findLast(
  item => item.week < group.week
);
const kiloChange = previous
  ? group.average - previous.average
  : null;
        const percent = previous
          ? ((group.average - previous.average) /
              previous.average) * 100
          : null;

        return `
        <details class="weight-history-group" open>
          <summary class="weight-history-summary-compact">

  <div class="weight-compact-heading">
    <strong>📅 Woche ab ${escapeHTML(formatDate(group.week))}</strong>
    <small>${group.items.length} ${group.items.length === 1 ? "Messung" : "Messungen"}</small>
  </div>

  <div class="weight-compact-stats">
    <strong>${formatWeight(group.average)} kg</strong>
    <small>Ø Woche</small>

    <span class="weight-compact-percent ${kiloChange === null ? "weight-neutral" : kiloChange > 0 ? "weight-gain" : kiloChange < 0 ? "weight-loss" : "weight-neutral"}">
  ${kiloChange === null
    ? "–"
    : `${kiloChange > 0 ? "+" : ""}${formatWeight(kiloChange)} kg`}

  ${percent === null
    ? ""
    : `(${percent > 0 ? "+" : ""}${percent.toFixed(1).replace(".", ",")} %)`}
</span>

</summary>

            <div class="weight-history-items">

              ${[...group.items].reverse().map(({ date, weight }) => `
                <div class="weight-history-item">

                  <div class="weight-history-date">
                    <strong>
                      ${escapeHTML(formatDate(date, {
                        weekday: "short"
                      }))}
                    </strong>
                    <small>${formatWeight(weight)} kg</small>
                  </div>

                  <div class="weight-history-actions">
                    

                    <button class="secondary"
                      data-action="open-weight"
                      data-date="${date}">✎</button>

                    <button class="danger"
                      data-action="delete-weight"
                      data-date="${date}">×</button>
                  </div>

                </div>
              `).join("")}

            </div>
          </details>
        `;
      }).join("")}

    </div>
  `;
}// 🌸 Gewichtstagebuch: Monatsansicht
function renderWeightHistoryMonths() {
  const months = getWeightHistoryMonths();

  if (!months.length) {
    return '<p class="muted">Noch keine Gewichtseinträge vorhanden.</p>';
  }

  return `
    <div class="weight-history-groups">

      ${[...months].reverse().map((group) => {
        const previous = [...months]
          .reverse()
          .find(item => item.month < group.month);
const kiloChange = previous
  ? group.average - previous.average
  : null;
        const percent = previous && previous.average !== 0
          ? ((group.average - previous.average) /
              previous.average) * 100
          : null;

        return `
          <details class="weight-history-group">

            <summary class="weight-history-summary-compact">

  <div class="weight-compact-heading">
    <strong>
      🗓️ ${escapeHTML(
        new Date(group.month + "-01T12:00:00")
          .toLocaleDateString("de-DE", {
            month: "long",
            year: "numeric"
          })
      )}
    </strong>

    <small>
      ${group.items.length}
      ${group.items.length === 1 ? "Messung" : "Messungen"}
    </small>
  </div>

  <div class="weight-compact-stats">
    <strong>${formatWeight(group.average)} kg</strong>
    <small>Ø Monat</small>

    <span class="weight-compact-percent ${kiloChange === null ? "weight-neutral" : kiloChange > 0 ? "weight-gain" : kiloChange < 0 ? "weight-loss" : "weight-neutral"}">
      ${kiloChange === null
        ? "–"
        : `${kiloChange > 0 ? "+" : ""}${formatWeight(kiloChange)} kg`}

      ${percent === null
        ? ""
        : `(${percent > 0 ? "+" : ""}${percent.toFixed(1).replace(".", ",")} %)`}
    </span>
  </div>

</summary>

            <div class="weight-history-items">

              ${[...group.items].reverse().map(({ date, weight }) => `
                <div class="weight-history-item">

                  <div class="weight-history-date">
                    <strong>
                      ${escapeHTML(formatDate(date, {
                        weekday: "short"
                      }))}
                    </strong>

                    <small>
                      ${formatWeight(weight)} kg
                    </small>
                  </div>

                  <div class="weight-history-actions">

                    <button
                      class="secondary"
                      data-action="open-weight"
                      data-date="${date}">
                      ✎
                    </button>

                    <button
                      class="danger"
                      data-action="delete-weight"
                      data-date="${date}">
                      ×
                    </button>

                  </div>

                </div>
              `).join("")}

            </div>

          </details>
        `;
      }).join("")}

    </div>
  `;
}
// 🌸 Gewichtstagebuch: ausgewählte Ansicht anzeigen
function renderWeightHistory() {
  if (weightHistoryView === "weeks") {
    return renderWeightHistoryWeeks();
  }

  if (weightHistoryView === "months") {
  return renderWeightHistoryMonths();
}

  return renderWeightHistoryDays();
}
function renderWeightHistoryDays() {
  const entries = getWeightEntries();

  if (!entries.length) {
    return `
      <p class="muted">
        Noch keine Gewichtseinträge vorhanden.
      </p>
    `;
  }

  const groups = new Map();

  // Vorherige Messungen auch über Monatsgrenzen
  // hinweg berücksichtigen.
  const previousWeights = new Map();

  entries.forEach(([date, weight], index) => {
    previousWeights.set(
      date,
      index > 0 ? entries[index - 1][1] : null
    );
  });

  // Neueste Messungen zuerst anzeigen.
  [...entries].reverse().forEach(([date, weight]) => {
    const key = weightHistoryGroupKey(date);

    if (!groups.has(key)) {
      groups.set(key, []);
    }

    groups.get(key).push({ date, weight });
  });

  return `
    <div class="weight-history-groups">

      ${[...groups.entries()].map(([key, items], index) => `
        <details
          class="weight-history-group"
          ${index === 0 ? "open" : ""}>

          <summary>
            <span>
              ${escapeHTML(weightHistoryGroupTitle(key))}
            </span>

            <small>
              ${items.length}
              ${items.length === 1
                ? "Messung"
                : "Messungen"}
            </small>
          </summary>

          <div class="weight-history-items">

            ${items.map(({ date, weight }) => `
              <div class="weight-history-item">

                <div class="weight-history-date">
                  <strong>
                    ${escapeHTML(formatDate(date, {
                      weekday: "short"
                    }))}
                  </strong>

                  <small>
                    ${formatWeight(weight)} kg
                  </small>
                </div>

                <div class="weight-history-actions">

                  ${weightHistoryDifference(
                    weight,
                    previousWeights.get(date)
                  )}

                  <button
                    class="secondary"
                    data-action="open-weight"
                    data-date="${date}">
                    ✎
                  </button>

                  <button
                    class="danger"
                    data-action="delete-weight"
                    data-date="${date}">
                    ×
                  </button>

                </div>

              </div>
            `).join("")}

          </div>

        </details>
      `).join("")}

    </div>
  `;
}

// ========================================
// GEWICHTSSEITE
// ========================================

function renderWeightPage() {
  return `
    <div class="grid">

      ${renderWeightDashboard()}

      <article class="card wide">

        <details class="weight-collapsible">
          <summary>
            <span>📈 Gewichtsverlauf</span>
            <span class="weight-summary-hint">
              Anzeigen / Ausblenden
            </span>
          </summary>

          <div class="weight-collapsible-content">
            <p class="muted">
              Deine letzten 60 Gewichtseinträge
            </p>

            ${renderWeightChart()}
          </div>
        </details>

      </article>
          

      <article class="card wide">

  <details class="weight-collapsible">
    <summary>
      <span>📋 Gewichtstagebuch</span>
      <span class="weight-summary-hint">
        Anzeigen / Ausblenden
      </span>
    </summary>

    <div class="weight-collapsible-content">

      <div class="row">
        <span class="muted">Deine Gewichtseinträge</span>
<div class="weight-history-tabs">
  <button
    class="weight-history-tab"
    data-weight-view="days">
    Tage
  </button>

  <button
    class="weight-history-tab"
    data-weight-view="weeks">
    Wochen
  </button>

  <button
    class="weight-history-tab"
    data-weight-view="months">
    Monate
  </button>
</div>
        <button data-action="open-weight">
          + Nachtragen
        </button>
      </div>

            <div id="weight-history-results">
        ${renderWeightHistory()}
      </div>

    </div>
  </details>

</article>

    </div>
  `;
}
// ========================================
// GEWICHTSEINGABE
// ========================================

function openWeightSheet(date = todayKey()) {
  const dialog = $("weight-sheet");

  if (!dialog) {
    alert("Das Gewicht-Bottom-Sheet fehlt in index.html.");
    return;
  }

  const entries = getWeightEntries();

  const latestWeight = entries.length
    ? entries[entries.length - 1][1]
    : "";

  $("weight-date").value = date;

  $("weight-value").value =
    data.weights[date] ?? latestWeight;

  if (!dialog.open) {
    dialog.showModal();
  }

  $("weight-value").focus();
}

// ========================================
// GEWICHTSEINTRAG LÖSCHEN
// ========================================

function deleteWeight(date) {
  if (!Object.prototype.hasOwnProperty.call(
    data.weights,
    date
  )) {
    return;
  }

  if (!confirm(
    `Gewichtseintrag vom ${formatDate(date)} löschen?`
  )) {
    return;
  }

  delete data.weights[date];

  save();
  render();
}

// ========================================
// GEWICHTSEINGABE STEUERN
// ========================================

function initWeightSheet() {
  const dialog = $("weight-sheet");
  const form = $("weight-form");
  const closeButton = $("close-weight-sheet");

  if (!dialog || !form || !closeButton) {
    console.error(
      "Gewicht-Bottom-Sheet: HTML-Elemente fehlen."
    );
    return;
  }

  closeButton.addEventListener("click", () => {
    dialog.close();
  });

  form.addEventListener("submit", event => {
    event.preventDefault();

    const date = $("weight-date").value;
    const weight = Number($("weight-value").value);

    const validDate =
      /^\d{4}-\d{2}-\d{2}$/.test(date) &&
      dateKey(parseDate(date)) === date;

    if (!validDate || date > todayKey()) {
      alert("Bitte ein gültiges Datum bis heute wählen.");
      return;
    }

    if (
      !Number.isFinite(weight) ||
      weight < 20 ||
      weight > 400
    ) {
      alert(
        "Bitte ein gültiges Gewicht zwischen " +
        "20 und 400 kg eingeben."
      );
      return;
    }

    data.weights[date] = Math.round(weight * 100) / 100;

    save();

    dialog.close();

    render();
  });
}

// ========================================
// GEWICHTSDIAGRAMM
// ========================================

function renderWeightChart() {
  const entries = getWeightEntries().slice(-60);

  if (!entries.length) {
    return `
      <p class="muted">
        Noch keine Gewichtsdaten vorhanden.
        Trage dein erstes Gewicht ein.
      </p>
    `;
  }

  const width = 760;
 const height = 190;

  const left = 54;
  const right = 18;
  const top = 20;
  const bottom = 44;

  const values = entries.map(([, weight]) => weight);

  const minimum = Math.min(...values);
  const maximum = Math.max(...values);

  const padding = Math.max(
    (maximum - minimum) * 0.15,
    0.3
  );

  const low = minimum - padding;
  const high = maximum + padding;

  function xPosition(index) {
    if (entries.length === 1) {
      return left + (width - left - right) / 2;
    }

    return left +
      index * (width - left - right) /
      (entries.length - 1);
  }

  function yPosition(weight) {
    return top +
      (high - weight) / (high - low) *
      (height - top - bottom);
  }

  const points = entries.map(([, weight], index) => {
    return (
      xPosition(index).toFixed(1) + "," +
      yPosition(weight).toFixed(1)
    );
  }).join(" ");

  const gridLines = [0, 1, 2, 3, 4].map(index => {
    const value = low + (high - low) * index / 4;
    const y = yPosition(value);

    return `
      <line
        x1="${left}"
        y1="${y}"
        x2="${width - right}"
        y2="${y}"
        stroke="currentColor"
        opacity=".13"
      />

      <text
        x="${left - 8}"
        y="${y + 4}"
        text-anchor="end"
        fill="currentColor"
        font-size="12">
        ${formatWeight(value)}
      </text>
    `;
  }).join("");

  const dots = entries.map(([date, weight], index) => {
    return `
      <circle
        cx="${xPosition(index)}"
        cy="${yPosition(weight)}"
        r="4"
        fill="var(--accent)">
        <title>
          ${escapeHTML(formatDate(date))}:
          ${formatWeight(weight)} kg
        </title>
      </circle>
    `;
  }).join("");

  return `
    <div class="weight-chart-wrap">

      <svg
        class="weight-chart"
        viewBox="0 0 ${width} ${height}"
        role="img"
        aria-label="Gewichtsverlauf">

        ${gridLines}

        <polyline
          points="${points}"
          fill="none"
          stroke="var(--accent)"
          stroke-width="3"
          stroke-linecap="round"
          stroke-linejoin="round"
        />

        ${dots}

        <text
          x="${left}"
          y="${height - 12}"
          fill="currentColor"
          font-size="12">
          ${escapeHTML(formatDate(entries[0][0]))}
        </text>

        <text
          x="${width - right}"
          y="${height - 12}"
          text-anchor="end"
          fill="currentColor"
          font-size="12">
          ${escapeHTML(formatDate(
            entries[entries.length - 1][0]
          ))}
        </text>

      </svg>

    </div>
  `;
}

// ========================================
// GEWICHTSAUSWERTUNG
// ========================================

let weightAnalysisPeriod = "week";
let weightAnalysisCount = 8;

function weightAnalysisGroups() {
  const entries = getWeightEntries();
  const groups = new Map();

  for (const [date, weight] of entries) {
    const key = weightAnalysisPeriod === "month"
      ? weightMonthStart(date)
      : mondayOf(date);

    if (!groups.has(key)) {
      groups.set(key, []);
    }

    groups.get(key).push(weight);
  }

  return [...groups.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .slice(-weightAnalysisCount)
    .map(([key, values]) => ({
      key,
      average: values.reduce(
        (sum, value) => sum + value,
        0
      ) / values.length,
      count: values.length
    }));
}

function renderWeightAnalysisResults() {
  const groups = weightAnalysisGroups();

  if (!groups.length) {
    return `
      <p class="muted">
        Noch keine Gewichtsdaten für die Auswertung vorhanden.
      </p>
    `;
  }

  const rows = groups.map((group, index) => {
    const previous = index > 0
      ? groups[index - 1].average
      : null;

    const title = weightAnalysisPeriod === "month"
      ? weightHistoryGroupTitle(group.key)
      : "Woche ab " + formatDate(group.key);

    return `
      <div class="item">
        <div class="row">
          <div>
            <strong>${escapeHTML(title)}</strong>
            <div class="mini">
              ${group.count}
              ${group.count === 1 ? "Messung" : "Messungen"}
            </div>
          </div>

          <div>
            <strong>
              ${formatWeight(group.average)} kg
            </strong>

            <div class="mini">
              ${renderWeightChange(
                group.average,
                previous
              )}
            </div>
          </div>
        </div>
      </div>
    `;
  }).reverse().join("");

  return `
    <div class="stack">
      ${rows}
    </div>
  `;
}

// ========================================
// GEWICHTSAUSWERTUNG: AUSWAHL ÄNDERN
// ========================================

document.addEventListener("change", event => {
  const element = event.target;

  if (element.dataset.weightAnalysis === "period") {
    weightAnalysisPeriod =
      element.value === "month" ? "month" : "week";

    const results = $("weight-analysis-results");

    if (results) {
      results.innerHTML = renderWeightAnalysisResults();
    }
  }

  if (element.dataset.weightAnalysis === "count") {
    const count = Number(element.value);

    if ([4, 8, 16].includes(count)) {
      weightAnalysisCount = count;
    }

    const results = $("weight-analysis-results");

    if (results) {
      results.innerHTML = renderWeightAnalysisResults();
    }
  }
});

// ========================================
// LIFEPLANER RENDERN
// ========================================

function render() {
  renderHeader();
  renderNavigation();

  const content = $("content");

  if (!content) {
    console.error(
      "LifePlaner: Element #content fehlt in index.html."
    );
    return;
  }

  switch (page) {
    case "home":
      content.innerHTML = renderHome();
      break;

    case "calendar":
      content.innerHTML = `
        <div class="stack">
          <article class="card">
            ${renderCalendar(true)}
          </article>

          ${renderDayDetails(selectedDate)}
        </div>
      `;
      break;

    case "training":
      content.innerHTML = renderTraining();
      break;

    case "work":
      content.innerHTML = renderWork();
      break;
case "vacation":
  content.innerHTML = `
    <section class="card">
      <h2>🌴 Mein Urlaubsplaner</h2>
      <p>Willkommen in deinem eigenen Urlaubsplaner! 💗</p>
      <p>Hier planen wir bald deine Reisen,
         Urlaubstage und schönsten Auszeiten. 🏖️</p>
    </section>
  `;
  break;
    case "weight":
      content.innerHTML = renderWeightPage();
      break;

    case "notes":
      content.innerHTML = renderNotes();
      break;

    case "settings":
      content.innerHTML = renderSettings();
      break;

    default:
      page = "home";
      content.innerHTML = renderHome();
  }
}

// ========================================
// LIFEPLANER STARTEN
// ========================================

function initLifePlaner() {
  ensureWorkData();
  initWeightSheet();
  render();
}

initLifePlaner();
// 🌸 Gewichtstagebuch: Ansicht wechseln
document.addEventListener("click", event => {
  const button = event.target.closest("[data-weight-view]");

  if (!button) return;

  weightHistoryView = button.dataset.weightView;
  const historyResults = document.getElementById("weight-history-results");

if (historyResults) {
  historyResults.innerHTML = renderWeightHistory();
}

  document.querySelectorAll("[data-weight-view]").forEach(tab => {
    const active = tab.dataset.weightView === weightHistoryView;

    tab.classList.toggle("active", active);
    tab.setAttribute("aria-pressed", String(active));
  });
});