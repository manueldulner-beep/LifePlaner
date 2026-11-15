
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
  weights: {}
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
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (error) {
    alert("Speichern fehlgeschlagen. Bitte Speicherplatz prüfen.");
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
  return new Date(date.getFullYear(), date.getMonth(), 1);
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
  return String(value ?? "").replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[char]));
}

// ========================================
// TRAININGSLOGIK
// ========================================

// Eine Verschiebung hält den nächsten offenen
// Trainingsschritt für einen Tag an.
// Die Reihenfolge der Einheiten bleibt erhalten.

function trainingAt(key, shifts = data.trainingShifts) {
  if (key < TRAINING_START) return "Nicht gestartet";

  const elapsed = daysBetween(TRAINING_START, key);

  const pauses = shifts.filter(
    date => date >= TRAINING_START && date <= key
  ).length;

  if (shifts.includes(key)) return "Verschoben";

  const index = ((elapsed - pauses) % 6 + 6) % 6;
  return TRAINING_CYCLE[index];
}

function shiftTraining(key) {
  if (key < todayKey()) {
    alert("Vergangene Trainingstage können nicht verschoben werden.");
    return;
  }

  if (key < TRAINING_START) {
    alert("Der Trainingsplan beginnt am 3. November 2026.");
    return;
  }

  if (data.trainingShifts.includes(key)) {
    data.trainingShifts = data.trainingShifts.filter(d => d !== key);
    save();
    render();
    return;
  }

  const status = trainingAt(key);

  if (status === "Pause") {
    alert("Dieser Tag ist bereits ein Pausentag.");
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
  if (Object.prototype.hasOwnProperty.call(data.workOverrides, key)) {
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

  const even = ((weeks % 2) + 2) % 2 === 0;

  // Referenzwoche bestimmt den Präsenztag
  const presenceTuesday =
    data.referenceHomeoffice === "wednesday"
      ? even
      : !even;

  // Dienstag
  if (weekday === 2) {
    return presenceTuesday ? "Büro" : "Homeoffice";
  }

  // Mittwoch
  if (weekday === 3) {
    return presenceTuesday ? "Homeoffice" : "Büro";
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

function changePage(next) {
  page = next;
  render();
  window.scrollTo(0, 0);
}

function setTheme(theme) {
  if (!["chopper", "crimson"].includes(theme)) return;

  data.theme = theme;
  save();
  render();
}

function renderNavigation() {
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
      ${weekdays.map(day => `<div class="weekday">${day}</div>`).join("")}
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

        ${compact ? "" : `
          <span class="tag">
            ${trainingIcon(training)} ${escapeHTML(training)}
          </span>

          <span class="tag">${escapeHTML(work)}</span>

          ${events.slice(0, 2).map(event => `
            <span class="tag">📌 ${escapeHTML(event.title)}</span>
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
  selectedDate = key;
  displayedMonth = startOfMonth(parseDate(key));
  page = "calendar";
  render();
}

// ========================================
// TAGESDETAILS
// ========================================

function renderDayDetails(key) {
  const training = trainingAt(key);
  const work = workAt(key);
  const shifted = data.trainingShifts.includes(key);

  return `
    <div class="grid">

      <article class="card">
        <h2>🌸 ${formatDate(key, { weekday: "long" })}</h2>

        <div class="big-status">
          ${trainingIcon(training)} ${escapeHTML(training)}
        </div>

        <p>💼 ${escapeHTML(work)}</p>

        <div class="actions">
          <button
            data-action="shift-training"
            data-date="${key}"
            ${key < todayKey() || key < TRAINING_START ||
              (!shifted && training === "Pause") ? "disabled" : ""}>
            ${shifted ? "Verschiebung rückgängig" : "Training verschieben"}
          </button>

          <button class="secondary"
            data-action="edit-work"
            data-date="${key}">
            Arbeit ändern
          </button>

          ${Object.prototype.hasOwnProperty.call(data.workOverrides, key)
            ? `<button class="secondary"
                data-action="reset-work"
                data-date="${key}">Standard wiederherstellen</button>`
            : ""}
        </div>
      </article>

      <article class="card">
        <h2>📌 Termine</h2>
        ${renderEvents(key)}
      </article>

      <article class="card">
        <h2>✅ Tagesaufgaben</h2>
        ${renderTasks(key)}
      </article>

      <article class="card">
        <h2>📝 Tagesnotiz</h2>
        <textarea id="day-note"
          data-date="${key}"
          placeholder="Deine Gedanken für diesen Tag...">${escapeHTML(
            data.dayNotes[key] || ""
          )}</textarea>

        <button data-action="save-day-note"
          data-date="${key}">
          Notiz speichern
        </button>
      </article>

    </div>
  `;
}

// ========================================
// HOME
// ========================================

function renderHome() {
  const today = todayKey();
  const training = trainingAt(today);
  const work = workAt(today);

  const upcoming = data.events
    .filter(event => event.date >= today)
    .sort((a, b) =>
      (a.date + (a.time || "")).localeCompare(
        b.date + (b.time || "")
      )
    )
    .slice(0, 5);

  return `
    <div class="grid">
    ${renderWeightDashboard()}

      <article class="card">
        <h2>💪 Heutiges Training</h2>
        <div class="big-status">
          ${trainingIcon(training)} ${escapeHTML(training)}
        </div>
        <p class="muted">Dein persönlicher 6-Tage-Rhythmus</p>
        <button data-action="page" data-page="training">
          Trainingsplan ansehen
        </button>
      </article>

      <article class="card">
        <h2>💼 Dein Arbeitstag</h2>
        <div class="big-status">${escapeHTML(work)}</div>
        <p class="muted">Automatisch berechneter Arbeitsstatus</p>
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
                ${event.time ? " · " + escapeHTML(event.time) : ""}
              </div>
            </div>
          `).join("")}

          ${upcoming.length ? "" : '<p class="muted">Noch keine Termine.</p>'}
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

function renderWork() {
  let rows = "";

  for (let i = 0; i < 21; i++) {
    const key = addDays(todayKey(), i);

    rows += `
      <div class="item row">
        <div>
          <strong>${formatDate(key, { weekday: "short" })}</strong>
          <div>${escapeHTML(workAt(key))}</div>
        </div>

        <button class="secondary"
          data-action="edit-work"
          data-date="${key}">
          Ändern
        </button>
      </div>
    `;
  }

  return `
    <div class="grid">
      <article class="card">
        <h2>💼 Homeoffice-Rhythmus</h2>

        <div class="field">
          <label>Referenzwoche (Montag)</label>
          <input type="date" id="reference-week"
            value="${data.referenceWeek}">
        </div>

        <div class="field">
          <label>Homeoffice in der Referenzwoche</label>
          <select id="reference-homeoffice">
            <option value="tuesday"
              ${data.referenceHomeoffice === "tuesday" ? "selected" : ""}>
              Dienstag
            </option>
            <option value="wednesday"
              ${data.referenceHomeoffice === "wednesday" ? "selected" : ""}>
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
        <div class="stack">${rows}</div>
      </article>
    </div>
  `;
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
        </div>

        <p class="muted">
          Beim Designwechsel bleiben alle Daten erhalten.
        </p>
      </article>

      <article class="card">
        <h2>💾 Datensicherung</h2>
        <p>Exportiere deine Daten als JSON-Datei.</p>

        <div class="actions">
          <button data-action="export">Backup exportieren</button>
          <button class="secondary" data-action="import">
            Backup importieren
          </button>
        </div>
      </article>

      <article class="card">
        <h2>ℹ️ LifePlaner</h2>
        <p>Version 1.0</p>
        <p class="muted">
          Alle Daten werden lokal in diesem Browser gespeichert.
          Für die Nutzung auf einem anderen Gerät benötigst du
          einen Backup-Export und anschließenden Import.
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
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Ungültiges Backup.");
  }

  if (!["chopper", "crimson"].includes(value.theme)) {
    throw new Error("Ungültiges Design.");
  }

  if (!Array.isArray(value.events) ||
      !Array.isArray(value.notes) ||
      !Array.isArray(value.trainingShifts)) {
    throw new Error("Unvollständige Datenlisten.");
  }

  if (!value.tasks || typeof value.tasks !== "object" ||
      Array.isArray(value.tasks) ||
      !value.dayNotes || typeof value.dayNotes !== "object" ||
      Array.isArray(value.dayNotes) ||
      !value.workOverrides ||
      typeof value.workOverrides !== "object" ||
      Array.isArray(value.workOverrides)) {
    throw new Error("Ungültige Tagesdaten.");
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(value.referenceWeek) ||
      !["tuesday", "wednesday"].includes(value.referenceHomeoffice)) {
    throw new Error("Ungültiger Arbeitsrhythmus.");
  }

  const validDate = key => {
    if (typeof key !== "string" ||
        !/^\d{4}-\d{2}-\d{2}$/.test(key)) return false;

    const date = parseDate(key);
    return !Number.isNaN(date.getTime()) && dateKey(date) === key;
  };

  if (!validDate(value.referenceWeek)) {
    throw new Error("Ungültiges Referenzdatum.");
  }

  for (const event of value.events) {
    if (!event || typeof event.id !== "string" ||
        typeof event.title !== "string" ||
        !validDate(event.date) ||
        typeof event.time !== "string" ||
        (event.time && !/^([01]\d|2[0-3]):[0-5]\d$/.test(event.time))) {
      throw new Error("Ungültiger Termin.");
    }
  }

  for (const note of value.notes) {
    if (!note || typeof note.id !== "string" ||
        typeof note.title !== "string" ||
        typeof note.body !== "string") {
      throw new Error("Ungültige Notiz.");
    }
  }

  for (const [key, tasks] of Object.entries(value.tasks)) {
    if (!validDate(key) || !Array.isArray(tasks) ||
        tasks.some(task =>
          !task || typeof task.id !== "string" ||
          typeof task.title !== "string" ||
          typeof task.done !== "boolean")) {
      throw new Error("Ungültige Aufgaben.");
    }
  }

  for (const [key, note] of Object.entries(value.dayNotes)) {
    if (!validDate(key) || typeof note !== "string") {
      throw new Error("Ungültige Tagesnotiz.");
    }
  }

  for (const [key, status] of Object.entries(value.workOverrides)) {
    if (!validDate(key) ||
        !["Büro", "Homeoffice", "Urlaub", "Frei", "Krank"].includes(status)) {
      throw new Error("Ungültiger Arbeitsstatus.");
    }
  }

  if (value.trainingShifts.some(key =>
      !validDate(key) || key < TRAINING_START) ||
      new Set(value.trainingShifts).size !== value.trainingShifts.length) {
    throw new Error("Ungültige Trainingsverschiebungen.");
  }
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
    case "page": changePage(button.dataset.page); break;
    case "theme": setTheme(button.dataset.theme); break;
    case "prev-month": changeMonth(-1); break;
    case "next-month": changeMonth(1); break;
    case "select-date": selectDate(key); break;

    case "open-weight":
  openWeightSheet(button.dataset.date || todayKey());
  break;

    case "delete-weight":
  deleteWeight(button.dataset.date);
  break;

    case "add-task": addTask(key); break;
    case "edit-task": editTask(key, id); break;
    case "delete-task": deleteTask(key, id); break;

    case "add-event": addEvent(key); break;
    case "edit-event": eventEditor(id); break;
    case "delete-event": deleteEvent(id); break;

    case "shift-training": shiftTraining(key); break;
    case "edit-work": editWork(key); break;
    case "reset-work": resetWork(key); break;

    case "add-note": editNote(); break;
    case "edit-note": editNote(id); break;
    case "delete-note": deleteNote(id); break;

    case "save-day-note":
      data.dayNotes[key] = $("day-note").value;
      save();
      alert("Tagesnotiz gespeichert!");
      break;

    case "save-work-settings": {
      const reference = $("reference-week").value;

      if (!/^\d{4}-\d{2}-\d{2}$/.test(reference) ||
          dateKey(parseDate(reference)) !== reference) {
        alert("Bitte ein gültiges Referenzdatum eingeben.");
        break;
      }

      data.referenceWeek = mondayOf(reference);
      data.referenceHomeoffice =
        $("reference-homeoffice").value;

      save();
      render();
      break;
    }

    case "export": exportBackup(); break;
    case "import": $("import-file").click(); break;
  }
});

document.addEventListener("change", event => {
  const element = event.target;

  if (element.dataset.action === "toggle-task") {
    toggleTask(element.dataset.date, element.dataset.id);
  }
});


/* =========================================
   LIFEPLANER – GEWICHTSTRACKER
   ========================================= */

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

/* GEWICHTSÜBERSICHT AUF DEM DASHBOARD */

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
          <span>Letztes Gewicht</span>

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
            ${stats.currentWeek === null
              ? "—"
              : formatWeight(stats.currentWeek) + " kg"}
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
            ${stats.currentMonth === null
              ? "—"
              : formatWeight(stats.currentMonth) + " kg"}
          </strong>

          <small>
            ${renderWeightChange(
              stats.currentMonth,
              stats.previousMonth
            )}
          </small>
        </div>

      </div>

      <div class="actions">
        <button
          class="secondary"
          data-action="page"
          data-page="weight">
          Gewichtsverlauf ansehen
        </button>
      </div>

    </article>
  `;
}

/* GEWICHTSVERLAUF ALS SVG-DIAGRAMM */

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
  const height = 260;

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

/* EIGENE GEWICHTSSEITE */

/* EIGENE GEWICHTSSEITE */

/* =========================================
   GEWICHT – AUSWERTUNG UND VERGLEICHE
   ========================================= */

let weightAnalysisPeriod = "week";
let weightAnalysisCount = 8;

function weightPeriodStart(key, period) {
  if (period === "week") {
    return mondayOf(key);
  }

  return key.slice(0, 7) + "-01";
}

function shiftWeightPeriod(key, period, amount) {
  const date = parseDate(key);

  if (period === "week") {
    return addDays(key, amount * 7);
  }

  return dateKey(
    new Date(
      date.getFullYear(),
      date.getMonth() + amount,
      1
    )
  );
}

function weightPeriodEnd(start, period) {
  if (period === "week") {
    return addDays(start, 6);
  }

  return addDays(
    shiftWeightPeriod(start, "month", 1),
    -1
  );
}

function weightPeriodLabel(start, period) {
  if (period === "month") {
    return parseDate(start).toLocaleDateString(
      "de-DE",
      {
        month: "long",
        year: "numeric"
      }
    );
  }

  const end = weightPeriodEnd(start, period);

  const calendarWeek = Math.ceil(
    (
      daysBetween(
        mondayOf(dateKey(
          new Date(parseDate(start).getFullYear(), 0, 4)
        )),
        start
      ) + 1
    ) / 7
  );

  // Für die Anzeige ist der Datumsbereich
  // entscheidend, auch am Jahreswechsel.
  return (
    formatDate(start, {
      year: "numeric",
      month: "short"
    }) +
    " – " +
    formatDate(end, {
      year: "numeric",
      month: "short"
    })
  );
}

function getWeightPeriodData(start, period) {
  const end = weightPeriodEnd(start, period);

  const values = getWeightEntries()
    .filter(([date]) => date >= start && date <= end)
    .map(([, weight]) => weight);

  const average = values.length
    ? values.reduce((sum, weight) => sum + weight, 0)
      / values.length
    : null;

  return {
    start,
    end,
    average,
    count: values.length
  };
}

function weightDifferenceBadge(current, previous) {
  if (current === null || previous === null) {
    return `
      <span class="weight-diff weight-diff-neutral">
        Kein Vergleich
      </span>
    `;
  }

  const difference = current - previous;

  const rounded = Math.round(difference * 100) / 100;

  const cssClass =
    rounded > 0
      ? "weight-diff-up"
      : rounded < 0
        ? "weight-diff-down"
        : "weight-diff-neutral";

  const symbol =
    rounded > 0 ? "+" : rounded < 0 ? "−" : "±";

  return `
    <span class="weight-diff ${cssClass}">
      ${symbol}${formatWeight(Math.abs(rounded))} kg
    </span>
  `;
}

function renderWeightAnalysisResults() {
  const period = weightAnalysisPeriod;
  const count = weightAnalysisCount;

  const currentStart = weightPeriodStart(
    todayKey(),
    period
  );

  const rows = [];

  for (let index = 0; index < count; index++) {
    const start = shiftWeightPeriod(
      currentStart,
      period,
      -index
    );

    const previousStart = shiftWeightPeriod(
      start,
      period,
      -1
    );

    const current = getWeightPeriodData(
      start,
      period
    );

    const previous = getWeightPeriodData(
      previousStart,
      period
    );

    rows.push(`
      <div class="weight-analysis-row">

        <div class="weight-analysis-label">
          <strong>
            ${escapeHTML(
              weightPeriodLabel(start, period)
            )}
          </strong>

          <small>
            ${current.count}
            ${current.count === 1
              ? "Messung"
              : "Messungen"}
          </small>
        </div>

        <div class="weight-analysis-values">
          <strong>
            ${current.average === null
              ? "—"
              : formatWeight(current.average) + " kg"}
          </strong>

          ${weightDifferenceBadge(
            current.average,
            previous.average
          )}
        </div>

      </div>
    `);
  }

  return `
    <div class="weight-analysis-list">
      ${rows.join("")}
    </div>

    <p class="muted weight-analysis-hint">
      Die Differenz vergleicht jeden Durchschnitt
      mit dem direkt vorherigen
      ${period === "week" ? "Wochen-" : "Monats-"}
      durchschnitt. Fehlende Messungen werden
      nicht mit 0 kg berechnet.
    </p>
  `;
}

/* =========================================
   GEWICHTSTAGEBUCH – MONATE UND WOCHEN
   ========================================= */



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

function renderWeightHistory() {
  const entries = getWeightEntries();

  if (!entries.length) {
    return `
      <p class="muted">
        Noch keine Gewichtseinträge vorhanden.
      </p>
    `;
  }

  const groups = new Map();

  // Die vorherige Messung wird unabhängig von
  // Monats- oder Wochengrenzen berücksichtigt.
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

function renderWeightPage() {
  const entries = getWeightEntries().reverse();

  const history = entries.length
    ? entries.map(([date, weight]) => `
        <div class="item row">

          <div>
            <strong>
              ${escapeHTML(formatDate(date, {
                weekday: "short"
              }))}
            </strong>

            <div class="mini">
              ${formatWeight(weight)} kg
            </div>
          </div>

          <div class="row">
            <button
              class="secondary"
              data-action="open-weight"
              data-date="${date}">
              Bearbeiten
            </button>

            <button
              class="danger"
              data-action="delete-weight"
              data-date="${date}">
              Löschen
            </button>
          </div>

        </div>
      `).join("")
    : `
      <p class="muted">
        Noch keine Gewichtseinträge vorhanden.
      </p>
    `;

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
            <span>📊 Gewichtsauswertung</span>
            <span class="weight-summary-hint">
              Anzeigen / Ausblenden
            </span>
          </summary>

          <div class="weight-collapsible-content">

            <p class="muted">
              Vergleiche deine Durchschnittswerte
              über mehrere Wochen oder Monate.
            </p>

            <div class="weight-analysis-controls">

              <div class="field">
                <label for="weight-analysis-period">
                  Zeitraum
                </label>

                <select
                  id="weight-analysis-period"
                  data-weight-analysis="period">

                  <option value="week"
                    ${weightAnalysisPeriod === "week"
                      ? "selected" : ""}>
                    Wochen
                  </option>

                  <option value="month"
                    ${weightAnalysisPeriod === "month"
                      ? "selected" : ""}>
                    Monate
                  </option>

                </select>
              </div>

              <div class="field">
                <label for="weight-analysis-count">
                  Anzahl
                </label>

                <select
                  id="weight-analysis-count"
                  data-weight-analysis="count">

                  <option value="4"
                    ${weightAnalysisCount === 4
                      ? "selected" : ""}>
                    Letzte 4
                  </option>

                  <option value="8"
                    ${weightAnalysisCount === 8
                      ? "selected" : ""}>
                    Letzte 8
                  </option>

                  <option value="16"
                    ${weightAnalysisCount === 16
                      ? "selected" : ""}>
                    Letzte 16
                  </option>

                </select>
              </div>

            </div>

            <div id="weight-analysis-results">
              ${renderWeightAnalysisResults()}
            </div>

          </div>
        </details>

      </article>

    
<article class="card wide">

  <div class="row">
    <h2>📋 Gewichtstagebuch</h2>

    <button data-action="open-weight">
      + Nachtragen
    </button>
  </div>

  <div id="weight-history-results">
    ${renderWeightHistory()}
  </div>

</article>


    </div>
  `;
}

/* BOTTOM SHEET ÖFFNEN */

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

/* GEWICHT LÖSCHEN */

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

/* BOTTOM SHEET STEUERUNG */

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
// APP RENDERN
// ========================================

function render() {
  renderNavigation();
  renderHeader();

  let html = "";

  switch (page) {
    case "home":
      html = renderHome();
      break;

    case "calendar":
      html = `
        <article class="card" style="margin-bottom:20px">
          ${renderCalendar()}
        </article>
        ${renderDayDetails(selectedDate)}
      `;
      break;

    case "training":
      html = renderTraining();
      break;

    case "work":
      html = renderWork();
      break;
    case "weight":
      html = renderWeightPage();
      break;

    case "notes":
      html = renderNotes();
      break;

    case "settings":
      html = renderSettings();
      break;

    default:
      html = renderHome();
  }

  $("content").innerHTML = html;
}

// ========================================
// START
// ========================================


/* =========================================
   HISTORISCHE GEWICHTSDATEN IMPORTIEREN
   Juli bis Oktober 2026
   ========================================= */

const historischeGewichte = {
  // JULI 2026
  "2026-07-01": 95.5,
  "2026-07-03": 95.7,
  "2026-07-04": 95.4,
  "2026-07-05": 95.8,
  "2026-07-08": 95.4,
  "2026-07-09": 95.6,
  "2026-07-10": 95.9,
  "2026-07-11": 95.8,
  "2026-07-12": 95.9,
  "2026-07-13": 96.1,
  "2026-07-14": 95.6,
  "2026-07-15": 95.2,
  "2026-07-16": 94.5,
  "2026-07-19": 95.4,
  "2026-07-20": 95.7,
  "2026-07-21": 95.5,
  "2026-07-22": 95.1,
  "2026-07-23": 95.0,
  "2026-07-24": 95.0,

  // AUGUST 2026
  "2026-08-02": 95.1,
  "2026-08-03": 96.1,
  "2026-08-04": 96.2,
  "2026-08-05": 95.7,
  "2026-08-07": 95.7,
  "2026-08-09": 96.0,
  "2026-08-11": 96.7,
  "2026-08-12": 96.7,
  "2026-08-13": 96.5,
  "2026-08-14": 96.3,
  "2026-08-15": 97.0,
  "2026-08-16": 96.5,
  "2026-08-18": 97.0,
  "2026-08-19": 96.3,
  "2026-08-20": 96.6,
  "2026-08-23": 97.8,
  "2026-08-25": 97.8,
  "2026-08-26": 97.0,
  "2026-08-27": 96.8,
  "2026-08-28": 97.2,
  "2026-08-29": 96.7,
  "2026-08-30": 97.3,
  "2026-08-31": 98.3,

  // SEPTEMBER 2026
  "2026-09-01": 97.8,
  "2026-09-02": 97.6,
  "2026-09-05": 97.9,
  "2026-09-06": 98.3,
  "2026-09-07": 97.6,
  "2026-09-09": 97.3,
  "2026-09-10": 97.7,
  "2026-09-11": 97.3,
  "2026-09-12": 97.2,
  "2026-09-13": 97.3,
  "2026-09-15": 98.0,
  "2026-09-16": 97.5,
  "2026-09-17": 97.4,
  "2026-09-21": 97.4,
  "2026-09-25": 97.6,
  "2026-09-26": 97.5,
  "2026-09-27": 97.6,
  "2026-09-30": 97.7,

  // OKTOBER 2026
  "2026-10-02": 97.4,
  "2026-10-10": 97.2,
  "2026-10-12": 97.9,
  "2026-10-19": 97.2,
  "2026-10-20": 97.6,
  "2026-10-21": 97.9,
  "2026-10-22": 98.0,
  "2026-10-24": 98.3,
  "2026-10-25": 97.8,
  "2026-10-26": 98.2,
  "2026-10-27": 98.2,
  "2026-10-28": 97.9,
  "2026-10-29": 98.3
};

// Nur einmal importieren.
// Bereits vorhandene Gewichtseinträge
// werden NICHT überschrieben.

if (
  !localStorage.getItem(
    "lifeplaner_gewicht_import_2026"
  )
) {
  if (!data.weights) {
    data.weights = {};
  }

  let anzahlImportiert = 0;

  for (const [datum, gewicht] of Object.entries(
    historischeGewichte
  )) {
    if (
      !Object.prototype.hasOwnProperty.call(
        data.weights,
        datum
      )
    ) {
      data.weights[datum] = gewicht;
      anzahlImportiert++;
    }
  }

  save();

  localStorage.setItem(
    "lifeplaner_gewicht_import_2026",
    "done"
  );

  console.log(
    anzahlImportiert +
    " historische Gewichtseinträge importiert."
  );
}

render();
initWeightSheet();

/* =========================================
   GEWICHTSAUSWERTUNG – AUSWAHL
   ========================================= */

document.addEventListener("change", event => {
  const element = event.target;

  if (!element.matches("[data-weight-analysis]")) {
    return;
  }

  if (element.dataset.weightAnalysis === "period") {
    weightAnalysisPeriod = element.value;
  }

  if (element.dataset.weightAnalysis === "count") {
    weightAnalysisCount = Number(element.value);
  }

  const results = document.getElementById(
    "weight-analysis-results"
  );

  if (results) {
    results.innerHTML = renderWeightAnalysisResults();
  }
});

