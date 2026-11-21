
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
  routines: [],
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

function addRoutine() {
  openEditor("Neue Routine erstellen", [
    {
      name: "title",
      label: "Name der Routine",
      required: true
    }
  ], values => {
    if (!Array.isArray(data.routines)) {
      data.routines = [];
    }

    data.routines.push({
      id: uid(),
      title: values.title,
      active: false,
      tasks: []
    });

    save();
    render();
  });
}

function addTask(key) {
  const crimson = data.theme === "crimson";

  const fields = [
    {
      name: "title",
      label: "Aufgabe",
      required: true
    },
    {
      name: "time",
      label: "Uhrzeit (optional)",
      type: "time"
    }
  ];

  if (crimson) {
    fields.push({
      name: "duration",
      label: "Geschätzte Dauer in Minuten (15–1440)",
      type: "number",
      value: 30,
      required: true
    });
  }

  openEditor("Aufgabe hinzufügen", fields, values => {
    const duration = crimson
      ? Number(values.duration)
      : undefined;

    if (
      crimson &&
      (!Number.isFinite(duration) ||
        duration < 15 ||
        duration > 1440)
    ) {
      alert("Bitte eine Dauer zwischen 15 und 1440 Minuten eingeben.");
      return;
    }

    if (
      crimson &&
      !crimsonConfirmSchedule({
        key,
        time: values.time,
        duration
      })
    ) return;

    if (!data.tasks[key]) data.tasks[key] = [];

    const task = {
      id: uid(),
      title: values.title.trim(),
      time: values.time || "",
      done: false
    };

    if (crimson) task.duration = duration;

      data.tasks[key].push(task);

    save();
    render();

    lifePlanerScheduleTaskPush(key, task).catch(error => {
      console.error("Aufgaben-Push fehlgeschlagen:", error);
    });
  });
}


let taskLongPressTimer = null;

let crimsonTaskLongPressed = false;

document.addEventListener("click", event => {
  if (data.theme !== "crimson") return;

  const card = event.target.closest(
    ".crimson-day-plan .item"
  );

  if (!card) return;

  // Checkbox selbst funktioniert bereits.
  if (event.target.closest(
    'input, button, a, select, textarea'
  )) return;

  // Nach langem Drücken nicht zusätzlich abhaken.
  if (crimsonTaskLongPressed) {
    crimsonTaskLongPressed = false;
    return;
  }

  const checkbox = card.querySelector(
    'input[type="checkbox"][data-action]'
  );

  if (!checkbox) return;

  checkbox.click();
});

document.addEventListener("pointerdown", event => {
  if (data.theme !== "crimson") return;

  const task = event.target.closest("[data-longpress-task]");
  if (!task) return;

  if (event.target.closest("input, button")) return;
  if (event.button !== 0) return;
crimsonTaskLongPressed = false;
  clearTimeout(taskLongPressTimer);

  taskLongPressTimer = setTimeout(() => {
    taskLongPressTimer = null;
crimsonTaskLongPressed = true;
    openTaskLongPressMenu(
      task.dataset.date,
      task.dataset.id
    );
  }, 300);
});

["pointerup", "pointercancel", "pointermove"].forEach(type => {
  document.addEventListener(type, () => {
    clearTimeout(taskLongPressTimer);
    taskLongPressTimer = null;
  });
});




/* ==========================================
   ITACHI – TAGESAUFGABEN WEGWISCHEN
   ========================================== */

let crimsonSwipeBlockClick = false;

document.addEventListener("touchstart", event => {
  if (data.theme !== "crimson") return;

  const card = event.target.closest(
    ".crimson-day-plan .item[data-longpress-task]"
  );

  if (!card || event.touches.length !== 1) return;

  const touch = event.touches[0];

  card._swipeStartX = touch.clientX;
  card._swipeStartY = touch.clientY;
  card._swipeDistance = 0;
  card._swipeActive = true;
  card.style.transition = "none";
}, { passive: true });

document.addEventListener("touchmove", event => {
  if (data.theme !== "crimson") return;

  const card = event.target.closest(
    ".crimson-day-plan .item[data-longpress-task]"
  );

  if (!card || !card._swipeActive) return;
  if (event.touches.length !== 1) return;

  const touch = event.touches[0];

  const dx = touch.clientX - card._swipeStartX;
  const dy = touch.clientY - card._swipeStartY;

  // Vertikales Scrollen weiterhin erlauben
  if (Math.abs(dy) > Math.abs(dx)) return;

  // Nur nach links wischen
  if (dx >= 0) return;

  // Long-Press-Bearbeitung abbrechen
  clearTimeout(taskLongPressTimer);
  taskLongPressTimer = null;

  card._swipeDistance = dx;

  const distance = Math.max(dx, -140);

  card.style.transform =
    `translateX(${distance}px)`;

  card.style.background =
    `rgba(125, 12, 34, ${
      Math.min(Math.abs(distance) / 140, 0.8)
    })`;
}, { passive: true });

document.addEventListener("touchend", event => {
  if (data.theme !== "crimson") return;

  const card = event.target.closest(
    ".crimson-day-plan .item[data-longpress-task]"
  );

  if (!card || !card._swipeActive) return;

  card._swipeActive = false;

  const distance = card._swipeDistance || 0;

  card.style.transition =
    "transform .2s ease, background .2s ease";

  card.style.transform = "";
  card.style.background = "";

  if (distance > -90) return;

  // Verhindert versehentliches Abhaken
  crimsonSwipeBlockClick = true;

  const key = card.dataset.date;
  const id = card.dataset.id;

window.crimsonSwipeDeleting = true;
deleteTask(key, id);
window.crimsonSwipeDeleting = false;

  setTimeout(() => {
    crimsonSwipeBlockClick = false;
  }, 500);
}, { passive: true });

document.addEventListener("touchcancel", event => {
  const card = event.target.closest(
    ".crimson-day-plan .item[data-longpress-task]"
  );

  if (!card) return;

  card._swipeActive = false;
  card.style.transform = "";
  card.style.background = "";
}, { passive: true });

// Klick nach einem Wischen unterdrücken
document.addEventListener("click", event => {
  if (!crimsonSwipeBlockClick) return;

  if (event.target.closest(".crimson-day-plan .item")) {
    event.preventDefault();
    event.stopImmediatePropagation();
  }
}, true);

function openTaskLongPressMenu(key, id) {
  editTask(key, id);
}




/* 🩸 CRIMSON SMART TODO – BEARBEITEN & VERSCHIEBEN */

function editTask(key, id) {
  const task = tasksFor(key).find(t => t.id === id);
  if (!task) return;

  const fields = [
    {
      name: "title",
      label: "Aufgabe",
      value: task.title,
      required: true
    },
    {
      name: "time",
      label: "Uhrzeit (optional)",
      type: "time",
      value: task.time || ""
    }
  ];

  // Nur Crimson bekommt die neue Datumsfunktion.
  if (data.theme === "crimson") {
    fields.splice(1, 0, {
      name: "date",
      label: "Geplant für",
      type: "date",
      value: key,
      required: true
    });
  }

if (data.theme === "crimson") {
  fields.push({
    name: "duration",
    label: "Geschätzte Dauer in Minuten (15–1440)",
    type: "number",
    value: task.duration ?? 30,
    required: true
  });
}

  openEditor("Aufgabe bearbeiten", fields, values => {
    const targetKey =
      data.theme === "crimson"
        ? values.date
        : key;

    if (!targetKey) return;

    // Vorhandene Aufgabe aktualisieren.
    
const duration = data.theme === "crimson"
  ? Number(values.duration)
  : task.duration;

if (data.theme === "crimson") {
  if (
    !Number.isFinite(duration) ||
    duration < 15 ||
    duration > 1440
  ) {
    alert("Bitte eine Dauer zwischen 15 und 1440 Minuten eingeben.");
    return;
  }

  if (!crimsonConfirmSchedule({
    key: targetKey,
    time: values.time,
    duration,
    exclude: {
      id: task.id,
      type: "ToDo"
    }
  })) return;
}

task.title = values.title.trim();
task.time = values.time || "";

if (data.theme === "crimson") {
  task.duration = duration;
}


    // Falls sich das Datum geändert hat:
    if (targetKey !== key) {
      data.tasks[key] = tasksFor(key).filter(
        item => item.id !== id
      );

      if (!data.tasks[targetKey]) {
        data.tasks[targetKey] = [];
      }

      // Dieselbe Aufgabe verschieben, nicht kopieren.
      data.tasks[targetKey].push(task);

      // Kalender zum neuen Datum führen.
      if (page === "calendar") {
        selectedDate = targetKey;
        displayedMonth = startOfMonth(
          parseDate(targetKey)
        );
      }
    }

    save();
    render();    
      // 🩸 Aufgaben-Push beim Bearbeiten synchronisieren
    if (data.theme === "crimson") {
      (async () => {
        if (
  !task.time ||
  task.done ||
  new Date(`${targetKey}T${task.time}:00`).getTime() <= Date.now()
) {
          await lifePlanerDeleteTaskPush(task.id);
        } else {
          await lifePlanerScheduleTaskPush(targetKey, task);
        }
      })().catch(error => {
        console.error(
          "Aufgaben-Push aktualisieren fehlgeschlagen:",
          error
        );
      });
    }
  });
  // 🩸 Verschieben-Button oben rechts im To-do-Editor
  if (data.theme === "crimson") {
    const editor = $("editor");

    editor.querySelector("#crimson-move-task")?.remove();

    const moveButton = document.createElement("button");
    moveButton.id = "crimson-move-task";
    moveButton.type = "button";
    moveButton.className = "secondary";
    moveButton.textContent = "📅 Verschieben";

    moveButton.style.cssText = `
      display:block;
      margin:0 0 12px auto;
      font-size:13px;
    `;

    moveButton.addEventListener("click", () => {
      const dateField = editor.querySelector('input[name="date"]');
      if (!dateField) return;

      const choice = confirm(
        "Auf morgen verschieben?\n\nOK = Morgen\nAbbrechen = Datum selbst auswählen"
      );

      if (choice) {
        dateField.value = addDays(todayKey(), 1);
      } else {
        dateField.focus();
        dateField.showPicker?.();
      }
    });

    $("editor-fields").prepend(moveButton);
  }
  $("editor").dataset.taskDate = key;
  $("editor-delete-task").dataset.id = id;
  $("editor-delete-task").hidden = false;
}



/* ==========================================
   ITACHI CRIMSON – TAGESZIEL
   ========================================== */

function crimsonDayGoalProgress(key) {
  const tasks = allTasksForDay(key);

  const total = tasks.length;
  const completed = tasks.filter(task =>
    task.type === "routine"
      ? routineTaskDone(key, task.routineId, task.id)
      : task.done
  ).length;

  return {
    total,
    completed,
    complete: total > 0 && completed === total
  };
}

function crimsonUpdateGoalUI(key, animate = false) {
  if (data.theme !== "crimson") return;

  const plan = document.querySelector(
    ".crimson-day-plan"
  );

  if (!plan) return;

  const goal = crimsonDayGoalProgress(key);

  plan.classList.toggle(
    "crimson-goal-complete",
    goal.complete
  );

  let message = plan.querySelector(
    ".crimson-goal-message"
  );

  if (!goal.complete) {
    message?.remove();
    plan.classList.remove(
      "crimson-goal-just-finished"
    );
    return;
  }

  if (!message) {
    message = document.createElement("div");
    message.className = "crimson-goal-message";
    message.textContent = "✓ Tagesziel erreicht";
    plan.appendChild(message);
  }

  if (animate) {
    plan.classList.remove(
      "crimson-goal-just-finished"
    );

    void plan.offsetWidth;

    plan.classList.add(
      "crimson-goal-just-finished"
    );

    plan.addEventListener("animationend", event => {
      if (event.target === plan) {
        plan.classList.remove(
          "crimson-goal-just-finished"
        );
      }
    }, { once: true });
  }
}


function toggleTask(key, id) {
  const task = tasksFor(key).find(t => t.id === id);
  if (!task) return;

  const wasComplete =
    data.theme === "crimson" &&
    crimsonDayGoalProgress(key).complete;

  task.done = !task.done;

  save();
  render();
  // 🩸 Push beim Abhaken aktualisieren
  if (task.done) {
    lifePlanerDeleteTaskPush(task.id).catch(error => {
      console.error("Aufgaben-Push löschen fehlgeschlagen:", error);
    });
  } else {
    lifePlanerScheduleTaskPush(key, task).catch(error => {
      console.error("Aufgaben-Push planen fehlgeschlagen:", error);
    });
  }
  if (data.theme === "crimson") {
    const isComplete =
      crimsonDayGoalProgress(key).complete;

    crimsonUpdateGoalUI(
      key,
      !wasComplete && isComplete
    );
  }
}


function deleteTask(key, id) {
  if (!window.crimsonSwipeDeleting &&
      !confirm("Diese Aufgabe löschen?")) return;

  data.tasks[key] = tasksFor(key).filter(t => t.id !== id);

  save();
  render();

  // 🩸 Zugehörige Push-Erinnerung löschen
  lifePlanerDeleteTaskPush(id).catch(error => {
    console.error(
      "Aufgaben-Push löschen fehlgeschlagen:",
      error
    );
  });
}

function addTaskFromRoutineEditor(routineId) {
  addRoutineTask(routineId);
}

function toggleRoutineTask(key, routineId, taskId) {
  if (!data.routineProgress) {
    data.routineProgress = {};
  }

  if (!data.routineProgress[key]) {
    data.routineProgress[key] = {};
  }

  if (!data.routineProgress[key][routineId]) {
    data.routineProgress[key][routineId] = {};
  }

  const progress = data.routineProgress[key][routineId];
const wasComplete =
  data.theme === "crimson" &&
  crimsonDayGoalProgress(key).complete;
  progress[taskId] = !progress[taskId];

 
save();
render();

if (data.theme === "crimson") {
  const isComplete =
    crimsonDayGoalProgress(key).complete;

  crimsonUpdateGoalUI(
    key,
    !wasComplete && isComplete
  );
}

}

function routineTaskDone(key, routineId, taskId) {
  const progress = data.routineProgress || {};

  return progress[key]?.[routineId]?.[taskId] === true;
}

function routineTasksForDay(key) {
  return activeRoutinesForDay(key)
    .flatMap(routine =>
      (routine.tasks || []).map(task => ({
        ...task,
        routineId: routine.id,
        routineTitle: routine.title
      }))
    )
    .sort((a, b) =>
      (a.time || "99:99").localeCompare(b.time || "99:99")
    );
}

function activeRoutinesForDay(key) {
  return (data.routines || []).filter(routine =>
    routine.active === true &&
    routineMatchesDay(routine, key)
  );
}

function routineMatchesDay(routine, key) {
  const schedule = routine.schedule || "daily";

  const day = new Date(`${key}T12:00:00`).getDay();

  if (schedule === "daily") return true;

  if (schedule === "weekdays") {
    return day >= 1 && day <= 5;
  }

  if (schedule === "custom") {
    return Array.isArray(routine.days) &&
      routine.days.includes(day);
  }

  if (schedule === "weekends") {
    return day === 0 || day === 6;
  }

  if (schedule === "training") {
    const training = trainingAt(key);

    return training === "Oberkörper" ||
           training === "Unterkörper";
  }

  if (schedule === "rest") {
    return trainingAt(key) === "Pause";
  }

  return false;
}

function routineDayFields(routine) {
  const days = [
    ["Montag", 1],
    ["Dienstag", 2],
    ["Mittwoch", 3],
    ["Donnerstag", 4],
    ["Freitag", 5],
    ["Samstag", 6],
    ["Sonntag", 0]
  ];

  return days.map(([label, day]) => ({
    type: "checkbox",
    name: `day_${day}`,
    
label: ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"][day],

    value: (routine.days || []).includes(day)
  }));
}

function editRoutine(id) {
  const routine = (data.routines || []).find(
    routine => routine.id === id
  );

  if (!routine) return;

  const routineTasks = [...(routine.tasks || [])].sort(
    (a, b) =>
      (a.time || "99:99").localeCompare(b.time || "99:99")
  );

 


const taskFields = routineTasks.map(task => ({
  type: "button",
  label: `✎ ${task.time || "–"} · ${task.title}`,
  action: "edit-routine-task",
  id: task.id,
  routineId: routine.id
}));



 
  openEditor("Routine bearbeiten", [
    {
      name: "title",
      label: "Name der Routine",
      value: routine.title,
      required: true
    },
    
    {
      name: "schedule",
      label: "Wann soll die Routine stattfinden?",
      type: "select",
      value: routine.schedule || "daily",
      

     
options: [
  "daily",
  "weekdays",
  "weekends",
  "custom",
  "training",
  "rest"
]

    },
  
...routineDayFields(routine),
{
  type: "button",
  label: "🩸 DEINE AUFGABEN",
  action: "routine-section-heading"
},
...taskFields,


  
{
  type: "button",
  name: "addTask",
  label: "+ Aufgabe hinzufügen",
  action: "add-task-from-routine-editor",
  id: routine.id
},
{
  type: "button",
  name: "deleteRoutine",
  label: "🗑️ Gesamte Routine löschen",
  action: "delete-routine",
  id: routine.id
}

], values => {


    routine.title = values.title;

    routine.schedule = values.schedule || "daily";

    routine.days = [0, 1, 2, 3, 4, 5, 6].filter(
      day => values[`day_${day}`] === "1"
    );

   

    save();
    render();
  });

}

function deleteRoutineTask(routineId, taskId) {
  const routine = (data.routines || []).find(
    routine => routine.id === routineId
  );

  if (!routine) return;

  const task = (routine.tasks || []).find(
    task => task.id === taskId
  );

  if (!task) return;

  if (!confirm(`Aufgabe "${task.title}" wirklich löschen?`)) {
    return;
  }

  routine.tasks = routine.tasks.filter(
    task => task.id !== taskId
  );

  save();
  render();
}

function editRoutineTask(routineId, taskId) {
  const routine = (data.routines || []).find(
    routine => routine.id === routineId
  );

  if (!routine) return;

  const task = (routine.tasks || []).find(
    task => task.id === taskId
  );

  if (!task) return;


if (data.theme === "crimson") {
  $("editor").dataset.returnRoutineId = routineId;
}


  openEditor("Routine-Aufgabe bearbeiten", [
    {
      name: "title",
      label: "Aufgabe",
      value: task.title,
      required: true
    },
    {
      name: "time",
      label: "Uhrzeit (optional)",
      type: "time",
      value: task.time || ""
    }
  ], values => {
    task.title = values.title;
    task.time = values.time || "";

    save();
    render();

editRoutine(routineId);


  });
}

function addRoutineTask(routineId) {
  const routine = (data.routines || []).find(
    routine => routine.id === routineId
  );

  if (!routine) return;

  openEditor("Routine-Aufgabe hinzufügen", [
    {
      name: "title",
      label: "Aufgabe",
      required: true
    },
    {
      name: "time",
      label: "Uhrzeit (optional)",
      type: "time"
    }
  ], values => {
    if (!Array.isArray(routine.tasks)) {
      routine.tasks = [];
    }

    routine.tasks.push({
      id: uid(),
      title: values.title,
      time: values.time || ""
    });

 
    save();
    render();

    // 🩸 Direkt die nächste Aufgabe eingeben
   

editRoutine(routineId);

  });
$("editor").dataset.returnRoutineId = routineId;

}


function deleteRoutine(id) {
  const routine = (data.routines || []).find(
    routine => routine.id === id
  );

  if (!routine) return;

  if (!confirm(`Routine "${routine.title}" wirklich löschen?`)) {
    return;
  }

  data.routines = data.routines.filter(
    routine => routine.id !== id
  );

  save();
  render();
}

function toggleRoutine(id) {
  const routine = (data.routines || []).find(
    routine => routine.id === id
  );

  if (!routine) return;

  routine.active = !routine.active;

  save();
  render();
}

function routineScheduleLabel(routine) {
  const schedule = routine.schedule || "daily";

  if (schedule === "daily") return "Täglich";
  if (schedule === "weekdays") return "Mo–Fr";
  if (schedule === "weekends") return "Sa–So";
  if (schedule === "training") return "Trainingstage";
  if (schedule === "rest") return "Pausentage";

  if (schedule === "custom") {
    const names = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];

    const days = [1, 2, 3, 4, 5, 6, 0].filter(
      day => (routine.days || []).includes(day)
    );

    return days.length
      ? days.map(day => names[day]).join(", ")
      : "Keine Tage gewählt";
  }

  return "Unbekannter Zeitplan";
}

function renderRoutines() {
  const routines = Array.isArray(data.routines)
    ? data.routines
    : [];

  if (!routines.length) {
    return '<p class="muted">Noch keine Routinen erstellt.</p>';
  }

 
  return routines.map(routine => `
    

<details class="item crimson-routine-card">
  
<summary>
  <strong>${escapeHTML(routine.title)}</strong>
  <span class="crimson-routine-status ${routine.active ? "is-active" : ""}">
    ${routine.active ? "● Aktiv" : "○ Inaktiv"}
  </span>

    <span class="muted">📅 ${escapeHTML(routineScheduleLabel(routine))} · ${(routine.tasks || []).length} Aufgaben</span>
  </summary>


      <div class="row">
    


        <button
          class="secondary"
          data-action="toggle-routine"
          data-id="${routine.id}">
          ${routine.active ? "✓ Aktiv" : "○ Inaktiv"}
        </button>
        
<button
  class="secondary"
  data-action="edit-routine"
  data-id="${routine.id}">
  ✎ Routine bearbeiten
</button>


      </div>
      <div class="stack">
        ${
[...(routine.tasks || [])]
  .sort((a, b) =>
    (a.time || "99:99").localeCompare(b.time || "99:99")
  )
  .map(task => `

          <div class="item">
            ${task.time
              ? `<span class="task-time">${escapeHTML(task.time)}</span>`
              : ""}
            <span>${escapeHTML(task.title)}</span>



          </div>
        `).join("")}
        </div>
    

    </details>
  `).join("");

}

function allTasksForDay(key) {
  const normalTasks = tasksFor(key).map(task => ({
    ...task,
    type: "normal"
  }));

  const routineTasks = routineTasksForDay(key).map(task => ({
    ...task,
    type: "routine"
  }));

 
if (data.theme !== "crimson") {
  return normalTasks.sort(
    (a, b) =>
      (a.time || "99:99").localeCompare(b.time || "99:99")
  );
}

return [...normalTasks, ...routineTasks].sort(
  (a, b) =>
    (a.time || "99:99").localeCompare(b.time || "99:99")
);

}
function lifePlanerMoveTask(key, id, newDate) {
  if (!newDate || newDate === key) return;

  const tasks = data.tasks[key] || [];
  const index = tasks.findIndex(task => task.id === id);

  if (index === -1) return;

  const [task] = tasks.splice(index, 1);

  if (!data.tasks[newDate]) {
    data.tasks[newDate] = [];
  }

  data.tasks[newDate].push(task);

  save();
  render();
}
function renderTasks(key) {
  
  
const tasks = data.theme === "crimson"
  ? allTasksForDay(key).filter(task => task.type === "normal")
  : [...tasksFor(key)].sort((a, b) =>
      (a.time || "99:99").localeCompare(b.time || "99:99")
    );



const progress = (() => {
  // Normale Aufgaben + Routine-Aufgaben
  const tasks = allTasksForDay(key);

  const total = tasks.length;

  const completed = tasks.filter(task => {
    if (task.type === "routine") {
      return routineTaskDone(
        key,
        task.routineId,
        task.id
      );
    }

    return task.done;
  }).length;

  return {
    total,
    completed,
    percent: total > 0
      ? Math.round((completed / total) * 100)
      : 0
  };
})();


const combinedPreview = data.theme === "crimson"
  ? allTasksForDay(key).map(task => `
      

<div class="item"
  ${task.type === "normal" ? `
    data-longpress-task="true"
    data-date="${key}"
    data-id="${task.id}"
  ` : ""}>
  <input
    type="checkbox"

    data-action="${task.type === "routine" ? "toggle-routine-task" : "toggle-task"}"
    data-date="${key}"
    data-id="${task.id}"
    ${task.type === "routine" ? `data-routine-id="${task.routineId}"` : ""}
    ${task.type === "routine"
      ? (routineTaskDone(key, task.routineId, task.id) ? "checked" : "")
      : (task.done ? "checked" : "")}
  >
  <span class="task-time">

          ⏰ ${escapeHTML(task.time || "–")}
        </span>
        
<span class="${
  task.type === "routine"
    ? (routineTaskDone(key, task.routineId, task.id) ? "routine-task-done" : "")
    : (task.done ? "routine-task-done" : "")
}">
  ${escapeHTML(task.title)}
</span>

        <small class="muted">
          ${task.type === "routine" ? "Routine" : "Tagesaufgabe"}



        </small>
      </div>
    `).join("")
  : "";
const crimsonGoal = data.theme === "crimson"
  ? crimsonDayGoalProgress(key)
  : null;
  
return `
  ${data.theme === "crimson" && combinedPreview ? `
  
<div class="routine-section crimson-day-plan ${
  crimsonGoal?.complete ? "crimson-goal-complete" : ""
}">

      

      <div class="stack">
        ${combinedPreview}${crimsonGoal?.complete
  ? '<div class="crimson-goal-message">✓ Tagesziel erreicht</div>'
  : ""}
      </div>
    </div>
  ` : ""}

 


${data.theme === "crimson" && progress.total === 0 ? `
  <div class="crimson-todo-empty">
    <span class="crimson-todo-empty-icon">☑</span>
    <span>Deine ToDo-Liste ist noch leer</span>
    <small>Füge deine erste Aufgabe hinzu.</small>
  </div>
` : `
  <div class="row crimson-progress-label">
    <strong>${progress.completed}/${progress.total} erledigt</strong>
  </div>

  <div class="progress">
    <div style="width:${progress.percent}%"></div>
  </div>

  ${data.theme === "crimson" ? `
    <div class="uchiha-milestones">
      ${[25, 50, 75, 100].map(level => `
        <span class="${
          progress.percent >= level ? "active" : ""
        }">
          ${progress.percent >= level ? "◉" : "○"}
          ${level}%
        </span>
      `).join("")}
    </div>
  ` : ""}
`}


    
<div class="stack">
  ${data.theme === "crimson" ? "" : tasks.map(task => `

        <div class="item ${task.done ? "done" : ""}">
          <div class="row">
            <label>
              <input type="checkbox"
                data-action="toggle-task"
                data-date="${key}"
                data-id="${task.id}"
                ${task.done ? "checked" : ""}>
             
<span class="item-title">
  ${task.time
    ? `<span class="task-time">⏰ ${escapeHTML(task.time)}</span> `
    : ""}
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

    
     
${data.theme === "crimson"
  ? ""
  : (tasks.length ? "" : '<p class="muted">Noch keine Aufgaben</p>')}

    </div>

    
${false && data.theme === "crimson" && routineTasksForDay(key).length ? `

      <div class="routine-section">
        <h3>⏰ Heutige Routine-Aufgaben</h3>

       
${routineTasksForDay(key).map(task => `
  <div class="item">
    <input
      type="checkbox"
      data-action="toggle-routine-task"
      data-date="${key}"
      data-routine-id="${task.routineId}"
      data-id="${task.id}"
      ${routineTaskDone(key, task.routineId, task.id)
        ? "checked"
        : ""}
    >

    ${task.time
      ? `<span class="task-time">${escapeHTML(task.time)}</span>`
      : ""}

    
<span class="${routineTaskDone(key, task.routineId, task.id) ? "routine-task-done" : ""}">
  ${escapeHTML(task.title)}
</span>


    <small class="muted">
      ${escapeHTML(task.routineTitle)}
    </small>
  </div>
`).join("")}

      </div>
    ` : ""}

    ${data.theme === "crimson" ? `
      <div class="routine-section">
        <h3>🩸 Meine Routinen</h3>
        ${renderRoutines()}
      </div>
    ` : ""}
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

/* 🩸 CRIMSON – TERMIN-EDITOR MIT ENDZEIT */

/* 🩸 CRIMSON – TERMIN-KATEGORIEN */


const CRIMSON_EVENT_CATEGORIES = {
  arbeit: "Arbeit 💼",
  privat: "Privat 💜",
  training: "Gym 🏋️",
  wichtig: "Wichtig 👁️"
};


function crimsonEventCategory(value) {
  return Object.hasOwn(
    CRIMSON_EVENT_CATEGORIES,
    value
  ) ? value : "privat";
}


/* 🩸 CRIMSON – GOOGLE MAPS */

function crimsonOpenGoogleMaps(location) {
  const address = String(location || "").trim();

  if (!address) {
    alert("Bitte zuerst einen Ort oder eine Adresse eingeben.");
    return;
  }

  const url =
    "https://www.google.com/maps/search/?api=1&query=" +
    encodeURIComponent(address);

  window.open(url, "_blank", "noopener,noreferrer");
}

function eventEditor(
  id = null,
  defaultDate = selectedDate,
  defaultTime = ""
) {
  const event = data.events.find(e => e.id === id);
  const crimson = data.theme === "crimson";

  const startTime = event?.time ?? defaultTime;
  const oldDuration = Number(event?.duration) || 60;

  const startMinutes = crimsonTimeToMinutes(startTime);

  const endMinutes = startMinutes === null
    ? null
    : Math.min(1440, startMinutes + oldDuration);

  const endTime = endMinutes === null
    ? ""
    : crimsonMinutesToTime(endMinutes);

  const fields = [
    {
      name: "title",
      label: "Titel",
      value: event?.title || "",
      required: true
    },
    {
      name: "date",
      label: "📅 Datum",
      type: "date",
      value: event?.date || defaultDate,
      required: true
    },
    {
      name: "time",
      label: crimson ? "🕐 Beginn" : "Uhrzeit (optional)",
      type: "time",
      value: startTime
    }
  ];

if (crimson) {
  fields.push({
    name: "location",
    label: "📍 Ort oder Adresse (Google Maps)",
    value: event?.location || ""
  });
}

  if (crimson) {
    fields.push({
      name: "crimsonCategory",
      label: "🎨 Terminkategorie",
      type: "select",
      value: crimsonEventCategory(event?.crimsonCategory),
      options: Object.keys(CRIMSON_EVENT_CATEGORIES)
    });

    fields.push({
      name: "endTime",
      label: "🕒 Ende",
      type: "time",
      value: endTime === "24:00" ? "23:59" : endTime
    });
  }

if (crimson) {
  const editorFields = document.getElementById(
    "editor-fields"
  );

  const locationInput = editorFields?.querySelector(
    'input[name="location"]'
  );

  if (locationInput) {
    const mapsButton = document.createElement("button");

    mapsButton.type = "button";
    mapsButton.className = "secondary";
    mapsButton.textContent = "📍 In Google Maps öffnen";

    mapsButton.style.cssText = `
      width:100%;
      margin-top:8px;
    `;

    mapsButton.addEventListener("click", () => {
      crimsonOpenGoogleMaps(locationInput.value);
    });

    locationInput.parentElement.appendChild(mapsButton);
  }
}

  // 🩸 Folgetermine werden nur beim Erstellen angeboten.
  // Beim Bearbeiten bleibt das bisherige Verhalten erhalten.
  const allowFollowups = crimson && !event;

  let followupContainer = null;

  function readFollowups() {
    if (!followupContainer) return [];

    
return [...followupContainer.querySelectorAll(
  ".crimson-followup-row"
)].map(row => ({
  date: row.querySelector(
    '[data-followup="date"]'
  ).value,

  time: row.querySelector(
    '[data-followup="time"]'
  ).value,

  endTime: row.querySelector(
    '[data-followup="endTime"]'
  ).value,

  location: row.querySelector(
    '[data-followup="location"]'
  ).value.trim()
}));

  }

  function validateTime(date, time, finish, label) {
    if (!date) {
      alert(`${label}: Bitte ein Datum auswählen.`);
      return null;
    }

    if (!time && !finish) {
      return {
        date,
        time: "",
        duration: 60
      };
    }

    const start = crimsonTimeToMinutes(time);
    const end = crimsonTimeToMinutes(finish);

    if (start === null || end === null) {
      alert(`${label}: Bitte Beginn und Ende eingeben.`);
      return null;
    }

    const duration = end - start;

    if (duration < 15) {
      alert(`${label}: Mindestens 15 Minuten erforderlich.`);
      return null;
    }

    if (duration > 1440) {
      alert(`${label}: Der Termin ist zu lang.`);
      return null;
    }

    return {
      date,
      time,
      duration
    };
  }

  openEditor(
    event ? "Termin bearbeiten" : "Termin hinzufügen",
    fields,
    values => {
      let duration = event?.duration;
      let extraEvents = [];

      if (crimson) {
        const main = validateTime(
          values.date,
          values.time,
          values.endTime,
          "Haupttermin"
        );

        if (!main) return false;

        duration = main.duration;

        if (allowFollowups) {
          const rows = readFollowups();

          for (let i = 0; i < rows.length; i++) {
            const row = rows[i];

            const checked = validateTime(
              row.date,
              row.time,
              row.endTime,
              `Folgetermin ${i + 1}`
            );

            if (!checked) return false;

            
extraEvents.push({
  ...checked,
  location: row.location
});

          }

          // Verhindert versehentlich identische Einträge
          // innerhalb dieser neuen Terminserie.
          const appointments = [main, ...extraEvents];
          const seen = new Set();

          for (const appointment of appointments) {
            const signature = [
              appointment.date,
              appointment.time,
              appointment.duration
            ].join("|");

            if (seen.has(signature)) {
              alert(
                "Ein Termin wurde mehrfach mit identischem " +
                "Datum und identischer Uhrzeit eingetragen."
              );
              return false;
            }

            seen.add(signature);
          }

          // Überschneidungen innerhalb der neuen Serie prüfen.
          for (let i = 0; i < appointments.length; i++) {
            const a = appointments[i];
            if (!a.time) continue;

            const aStart = crimsonTimeToMinutes(a.time);
            const aEnd = aStart + a.duration;

            for (let j = i + 1; j < appointments.length; j++) {
              const b = appointments[j];

              if (!b.time || a.date !== b.date) continue;

              const bStart = crimsonTimeToMinutes(b.time);
              const bEnd = bStart + b.duration;

              if (aStart < bEnd && bStart < aEnd) {
                alert(
                  "Zwei deiner neuen Termine überschneiden sich. " +
                  "Bitte die Uhrzeiten anpassen."
                );
                return false;
              }
            }
          }
        }

        // Bestehende Kalenderprüfung auch für Folgetermine.
        const appointmentsToCheck = [
          main,
          ...extraEvents
        ];

        for (const appointment of appointmentsToCheck) {
          if (!crimsonConfirmSchedule({
            key: appointment.date,
            time: appointment.time,
            duration: appointment.duration,
            exclude: event
              ? { id: event.id, type: "Termin" }
              : null
          })) {
            return false;
          }
        }
      }

      const updated = {
        title: values.title.trim(),
        date: values.date,
        time: values.time || ""
      };

   
if (crimson) {
  updated.duration = duration;

  updated.crimsonCategory = crimsonEventCategory(
    values.crimsonCategory
  );

  updated.location = (values.location || "").trim();
updated.reminderMinutes = [
  ...document.querySelectorAll(
    ".crimson-event-reminders input[data-crimson-reminder]:checked"
  )
].map(input => Number(input.dataset.crimsonReminder));

}
      const alteErinnerungen = event
        ? [...(event.reminderMinutes || [])]
        : [];

      if (event) {
        Object.assign(event, updated);
      } else {
        data.events.push({
          id: uid(),
          ...updated
        });

        // 🩸 Alle Folgetermine einzeln speichern.
        for (const extra of extraEvents) {
          data.events.push({
            id: uid(),
            title: updated.title,
            date: extra.date,
            time: extra.time,
            duration: extra.duration,
            

crimsonCategory: updated.crimsonCategory,
location: extra.location,
reminderMinutes: [...updated.reminderMinutes]


          });
        }
      }

      selectedDate = values.date;

      displayedMonth = startOfMonth(
        parseDate(selectedDate)
      );

               save();
      render();

      if (event) {
        (async () => {
          for (const minutes of alteErinnerungen) {
            await lifePlanerDeleteEventPush(event.id, minutes);
          }

          await lifePlanerScheduleEventPush(event);
        })().catch(error => {
          console.error("Termin-Erinnerungen aktualisieren fehlgeschlagen:", error);
        });
      } else {
        const neueTermine = data.events.slice(
          -(extraEvents.length + 1)
        );

        for (const termin of neueTermine) {
          lifePlanerScheduleEventPush(termin).catch(error => {
            console.error("Termin-Push fehlgeschlagen:", error);
          });
        }
      }
    }
  );

/* 🩸 CRIMSON – ERINNERUNGEN IM TERMIN-EDITOR */

if (crimson) {
  const editorFields = document.getElementById("editor-fields");

  const reminderBox = document.createElement("div");
  reminderBox.className = "crimson-event-reminders";

  reminderBox.style.cssText = `
    grid-column:1 / -1;
    padding:14px;
    margin-top:12px;
    border:1px solid rgba(190,45,75,.35);
    border-radius:12px;
    background:rgba(130,20,45,.08);
  `;

  const savedReminders = Array.isArray(event?.reminderMinutes)
    ? event.reminderMinutes
    : [];

  const options = [
    [5, "5 Minuten"],
    [15, "15 Minuten"],
    [30, "30 Minuten"],
    [60, "1 Stunde"],
    [1440, "1 Tag"]
  ];

  reminderBox.innerHTML = `
    <strong>🔔 Erinnerungen</strong>

    <p style="font-size:12px;opacity:.7;margin:6px 0 12px">
      Du kannst mehrere Erinnerungen auswählen.
    </p>

    <div style="display:grid;gap:10px">
      ${options.map(([minutes, label]) => `
        <label style="
          display:flex;
          align-items:center;
          gap:10px;
          font-size:14px;
        ">
          <input
            type="checkbox"
            data-crimson-reminder="${minutes}"
            ${savedReminders.includes(minutes) ? "checked" : ""}
            style="width:18px;height:18px;flex-shrink:0"
          >
          ${label} vorher
        </label>
      `).join("")}
    </div>

   
  `;

  editorFields.appendChild(reminderBox);


}

  // 🩸 Zusätzliche Eingabefelder nur bei neuen Crimson-Terminen.
  if (!allowFollowups) return;

  const editorFields = document.getElementById(
    "editor-fields"
  );

  if (!editorFields) return;

  const section = document.createElement("div");
  section.className = "crimson-followup-section";

  section.style.cssText = `
    grid-column: 1 / -1;
    width: 100%;
    margin-top: 16px;
    padding-top: 14px;
    border-top: 1px solid rgba(180, 45, 65, 0.4);
  `;

  section.innerHTML = `
    <div style="margin-bottom:12px">
      <strong>🩸 Folgetermine</strong>
      <p style="font-size:13px;opacity:.75;margin:6px 0">
        Gleicher Titel und gleiche Kategorie,
        aber eigene Tage und Uhrzeiten.
      </p>
    </div>

    <div class="crimson-followup-list"></div>

    <button
      type="button"
      class="secondary crimson-add-followup"
      style="width:100%;margin-top:10px"
    >
      ＋ Folgetermin hinzufügen
    </button>
  `;

  editorFields.appendChild(section);

  followupContainer = section.querySelector(
    ".crimson-followup-list"
  );

  const addButton = section.querySelector(
    ".crimson-add-followup"
  );

  function addFollowupRow() {
    const mainDate = editorFields.querySelector(
      'input[name="date"]'
    )?.value || defaultDate;

    const mainStart = editorFields.querySelector(
      'input[name="time"]'
    )?.value || "";

    const mainEnd = editorFields.querySelector(
      'input[name="endTime"]'
    )?.value || "";

const mainLocation = editorFields.querySelector(
  'input[name="location"]'
)?.value || "";

    const row = document.createElement("div");
    row.className = "crimson-followup-row";

    row.style.cssText = `
      padding: 14px;
      margin: 10px 0;
      border: 1px solid rgba(180,45,65,.35);
      border-radius: 12px;
      background: rgba(120,15,35,.08);
    `;

    row.innerHTML = `
     
<div style="
  display:grid;
  grid-template-columns:repeat(2,minmax(0,1fr));
  gap:12px;
">
 
<label style="
  grid-column:1 / -1;
  display:flex;
  flex-direction:column;
  gap:4px;
  font-size:13px;
">
  📅 Datum
  <input
    type="date"
    data-followup="date"
    required
    value="${escapeHTML(mainDate)}"
    style="
      width: 70%;
      height:30px;
      min-height:20px;
      padding:4px 5px;
      box-sizing:border-box;
    "
  >
</label>

<label style="
  grid-column:1 / -1;
  display:flex;
  flex-direction:column;
  gap:5px;
  font-size:13px;
">
  📍 Ort oder Adresse
  <input
    type="text"
    data-followup="location"
    value="${escapeHTML(mainLocation)}"
    placeholder="Straße, Hausnummer, Stadt ..."
    style="
      width:100%;
      box-sizing:border-box;
    "
  >
</label>


  <label style="min-width:0;">
    🕐 Beginn
    <input
      type="time"
      data-followup="time"
      value="${escapeHTML(mainStart)}"
      style="width:100%;box-sizing:border-box;"
    >
  </label>

  <label style="min-width:0;">
    🕒 Ende
    <input
      type="time"
      data-followup="endTime"
      value="${escapeHTML(mainEnd)}"
      style="width:100%;box-sizing:border-box;"
    >
  </label>
</div>

    `;

    followupContainer.appendChild(row);

    const startInput = row.querySelector(
      '[data-followup="time"]'
    );

    const endInput = row.querySelector(
      '[data-followup="endTime"]'
    );

    // Dauer beim Ändern der Startzeit beibehalten.
    startInput.addEventListener("change", () => {
      const start = crimsonTimeToMinutes(startInput.value);
      const end = crimsonTimeToMinutes(endInput.value);

      if (start === null) return;

      const duration = (
        start !== null &&
        end !== null &&
        end > start
      ) ? end - start : 60;

      // Nur automatisch setzen, wenn noch kein Ende da ist.
      if (!endInput.value) {
        const newEnd = Math.min(1439, start + duration);

        if (newEnd > start) {
          endInput.value = crimsonMinutesToTime(newEnd);
        }
      }
    });

    row.querySelector(
      ".crimson-remove-followup"
    ).addEventListener("click", () => {
      row.remove();
      updateFollowupLabels();
    });

    updateFollowupLabels();
  }

  function updateFollowupLabels() {
    followupContainer.querySelectorAll(
      ".crimson-followup-row"
    ).forEach((row, index) => {
      row.querySelector(
        ".crimson-followup-label"
      ).textContent = `📅 Folgetermin ${index + 1}`;
    });
  }

  addButton.addEventListener("click", addFollowupRow);
}


/* 🩸 CRIMSON – LIVE-STARTZEIT, ENDZEIT & DAUER */

/* ==========================================
   🩸 CRIMSON SMART REMINDERS
   Benachrichtigungen bei geöffneter App
   ========================================== */

const CRIMSON_REMINDER_STORAGE =
  "lifeplaner_crimson_reminders_sent_v1";

let crimsonReminderChecking = false;

function crimsonGetSentReminders() {
  try {
    return JSON.parse(
      localStorage.getItem(CRIMSON_REMINDER_STORAGE) || "{}"
    );
  } catch (error) {
    return {};
  }
}

function crimsonSaveSentReminders(sent) {
  try {
    localStorage.setItem(
      CRIMSON_REMINDER_STORAGE,
      JSON.stringify(sent)
    );
  } catch (error) {
    console.error("Erinnerungsstatus konnte nicht gespeichert werden", error);
  }
}

function crimsonEventDateTime(event) {
  if (!event.date || !event.time) return null;

  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(event.date);
  const time = /^(\d{2}):(\d{2})$/.exec(event.time);

  if (!match || !time) return null;

  const year = Number(match[1]);
  const month = Number(match[2]) - 1;
  const day = Number(match[3]);
  const hours = Number(time[1]);
  const minutes = Number(time[2]);

  if (hours > 23 || minutes > 59) return null;

  const date = new Date(
    year, month, day, hours, minutes, 0, 0
  );

  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month ||
    date.getDate() !== day
  ) {
    return null;
  }

  return date;
}

async function crimsonShowEventNotification(event, minutes) {
  if (!("Notification" in window)) return;
  if (Notification.permission !== "granted") return;
  if (!("serviceWorker" in navigator)) return;

  const registration = await navigator.serviceWorker.ready;

  const description = minutes >= 1440
    ? "Morgen"
    : minutes >= 60
      ? `In ${minutes / 60} Stunde(n)`
      : `In ${minutes} Minuten`;

  const body = [
    description + ": " + event.title,
    event.time ? "🕐 " + event.time + " Uhr" : "",
    event.location ? "📍 " + event.location : ""
  ].filter(Boolean).join("\n");

  await registration.showNotification(
    "🩸 LifePlaner – Terminerinnerung",
    {
      body,
      icon: "./icon-192.png",
      badge: "./icon-192.png",
      tag: "crimson-" + event.id + "-" + minutes,
      data: {
        url: "./index.html"
      }
    }
  );
}

async function crimsonCheckEventReminders() {
  if (crimsonReminderChecking) return;
  if (data.theme !== "crimson") return;
  if (!("Notification" in window)) return;
  if (Notification.permission !== "granted") return;

  crimsonReminderChecking = true;

  try {
    const now = Date.now();
    const sent = crimsonGetSentReminders();

    for (const event of data.events) {
      const start = crimsonEventDateTime(event);

      if (!start) continue;

      const reminders = Array.isArray(event.reminderMinutes)
        ? event.reminderMinutes
        : [];

      for (const minutes of reminders) {
        const offset = Number(minutes);

        if (!Number.isFinite(offset) || offset <= 0) {
          continue;
        }

        const reminderTime =
          start.getTime() - offset * 60 * 1000;

        const reminderKey = [
          event.id,
          start.getTime(),
          offset
        ].join("|");

        if (sent[reminderKey]) continue;

        // Nur aktuelle Erinnerungen anzeigen.
        // Nach langer Abwesenheit keine alten Meldungen nachholen.
        if (
          now >= reminderTime &&
          now - reminderTime < 2 * 60 * 1000
        ) {
          try {
            await crimsonShowEventNotification(event, offset);

            sent[reminderKey] = now;
            crimsonSaveSentReminders(sent);
          } catch (error) {
            console.error("Crimson Erinnerung fehlgeschlagen:", error);
          }
        }
      }
    }

    // Alte Einträge nach 60 Tagen aufräumen.
    for (const key of Object.keys(sent)) {
      if (now - sent[key] > 60 * 86400000) {
        delete sent[key];
      }
    }

    crimsonSaveSentReminders(sent);
  } finally {
    crimsonReminderChecking = false;
  }
}

// Regelmäßig prüfen, solange LifePlaner läuft.
setInterval(crimsonCheckEventReminders, 30000);

// Auch beim Zurückkehren in die App prüfen.
document.addEventListener("visibilitychange", () => {
  if (!document.hidden) {
    crimsonCheckEventReminders();
  }
});

window.addEventListener("focus", crimsonCheckEventReminders);

window.addEventListener("load", crimsonCheckEventReminders);

function crimsonSetupEventTimeFields() {
  if (data.theme !== "crimson") return;

  const fields = document.getElementById("editor-fields");
  if (!fields) return;

  const startInput = fields.querySelector('input[name="time"]');
  const endInput = fields.querySelector('input[name="endTime"]');

  // Nur Crimson-Termine, keine Aufgaben.
  if (!startInput || !endInput) return;

  const preview = document.createElement("div");
  preview.className = "crimson-duration-preview";
  preview.setAttribute("aria-live", "polite");

  fields.appendChild(preview);

  const toMinutes = value => {
    if (!/^\d{2}:\d{2}$/.test(value || "")) return null;

    const [hours, minutes] = value.split(":").map(Number);

    if (hours > 23 || minutes > 59) return null;

    return hours * 60 + minutes;
  };

  const toTime = minutes => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;

    return String(hours).padStart(2, "0") +
      ":" +
      String(mins).padStart(2, "0");
  };

 
  const updatePreview = () => {
    const start = toMinutes(startInput.value);
    const end = toMinutes(endInput.value);

    const form = document.getElementById("editor-form");
    const saveButton = form?.querySelector(
      'button[type="submit"], input[type="submit"], button:not([type])'
    );

    let error = "";
    let message = "";

    if (start === null && end === null) {
      message = "⏱️ Ganztägiger Termin";
    } else if (start === null || end === null) {
      error = "Bitte Beginn und Ende eingeben.";
    } else {
      const duration = end - start;

      if (duration <= 0) {
        error = "Die Endzeit muss nach der Startzeit liegen.";
      } else if (duration < 15) {
        error = "Der Termin muss mindestens 15 Minuten dauern.";
      } else {
        const hours = Math.floor(duration / 60);
        const minutes = duration % 60;
        const parts = [];

        if (hours) parts.push(`${hours} Std.`);
        if (minutes) parts.push(`${minutes} Min.`);

        message = "⏱️ Dauer: " + parts.join(" ");
      }
    }

    preview.textContent = error
      ? `⚠️ ${error}`
      : message;

    preview.classList.toggle(
      "crimson-duration-error",
      Boolean(error)
    );

    if (saveButton) {
      saveButton.disabled = Boolean(error);
    }

    // Browser-Validierung für die beiden Zeitfelder
    startInput.setCustomValidity(error || "");
    endInput.setCustomValidity(error || "");
  };


  let previousStart = toMinutes(startInput.value);

  const shiftEnd = () => {
    const newStart = toMinutes(startInput.value);
    const oldEnd = toMinutes(endInput.value);

    if (newStart === null) {
      previousStart = null;
      updatePreview();
      return;
    }

    if (previousStart !== null && oldEnd !== null) {
      const duration = oldEnd - previousStart;

      if (duration >= 15) {
        const newEnd = newStart + duration;

        if (newEnd <= 1439) {
          endInput.value = toTime(newEnd);
        } else {
          // Ende kann nicht über Mitternacht liegen.
          endInput.value = "23:59";
        }
      }
    } else if (oldEnd === null) {
      // Neue Termine erhalten zunächst 60 Minuten.
      endInput.value = toTime(
        Math.min(1439, newStart + 60)
      );
    }

    previousStart = newStart;
    updatePreview();
  };

  startInput.addEventListener("input", shiftEnd);
  startInput.addEventListener("change", shiftEnd);

  endInput.addEventListener("input", updatePreview);
  endInput.addEventListener("change", updatePreview);

  updatePreview();
}

function deleteEvent(id) {
  if (!confirm("Termin wirklich löschen?")) return;

  const termin = data.events.find(e => e.id === id);

  if (termin) {
    for (const minutes of termin.reminderMinutes || []) {
      lifePlanerDeleteEventPush(termin.id, minutes).catch(error => {
        console.error("Termin-Push löschen fehlgeschlagen:", error);
      });
    }
  }

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

/* 🩸 Crimson – Routine-Aufgaben durch Wischen löschen */

function enableRoutineTaskSwipe() {
  if (document.body.dataset.theme !== "crimson") return;

  const editor = document.getElementById("editor");
  if (!editor) return;

  editor.querySelectorAll(
    'button[data-action="edit-routine-task"]'
  ).forEach(button => {
    if (button.dataset.swipeReady) return;
    button.dataset.swipeReady = "1";

    
let startX = 0;
let startY = 0;
let swiping = false;


    button.addEventListener("touchstart", event => {
button.style.transition = "none";
button.style.transform = "";
button.style.background = "";

      startX = event.touches[0].clientX;
      startY = event.touches[0].clientY;
    }, { passive: true });

button.addEventListener("touchmove", event => {
  if (!event.touches.length) return;

  const deltaX = event.touches[0].clientX - startX;
  const deltaY = event.touches[0].clientY - startY;

  if (Math.abs(deltaY) > Math.abs(deltaX)) return;
  if (deltaX >= 0) return;

  swiping = true;

  
const distance = Math.max(deltaX, -160);


  button.style.transform = `translateX(${distance}px)`;
  button.style.background =
    `rgba(160, 35, 65, ${Math.min(Math.abs(distance) / 120, 0.9)})`;
}, { passive: true });

    button.addEventListener("touchend", event => {
      const deltaX = event.changedTouches[0].clientX - startX;
      const deltaY = event.changedTouches[0].clientY - startY;

if (swiping) {
  button.style.transition =
    "transform 0.2s ease, background 0.2s ease";

  button.style.transform = "";
  button.style.background = "";

  swiping = false;
}

      if (deltaX > -90 || Math.abs(deltaY) > 50) return;

      const routineId = button.dataset.routineId;
      const taskId = button.dataset.id;

      const routine = (data.routines || [])
        .find(r => r.id === routineId);

      if (!routine) return;

      const task = (routine.tasks || [])
        .find(t => t.id === taskId);

      if (!task) return;

     

      routine.tasks = routine.tasks.filter(t => t.id !== taskId);

      
save();
render();

editor.close();
editorSave = null;

editRoutine(routineId);

    }, { passive: true });
  });
}

function openEditor(title, fields, onSave) {
  

$("editor-title").textContent = title;
$("editor-title").hidden = data.theme === "crimson";


delete $("editor").dataset.returnRoutineId;

  $("editor-delete-task").hidden = true;
  editorSave = onSave;

 
  $("editor-fields").innerHTML = fields.map(field => {

    const value = escapeHTML(field.value || "");
    const required = field.required ? "required" : "";

    
    
    let control;

   
if (field.type === "checkbox") {
  control = `
    <label class="crimson-day-tile">
      <input
        type="checkbox"
        name="${escapeHTML(field.name)}"
        value="1"
        ${field.value ? "checked" : ""}
      >
      <span>${escapeHTML(field.label)}</span>
    </label>`;
} else if (field.type === "button") {

      control = `
        <button
          type="button"
          class="secondary"
          data-action="${escapeHTML(field.action || "")}"
          
data-id="${escapeHTML(field.id || "")}"
data-routine-id="${escapeHTML(field.routineId || "")}">

          ${escapeHTML(field.label || "Button")}
        </button>`;
    } else if (field.type === "textarea") {

      control = `<textarea name="${field.name}" ${required}>${value}</textarea>`;
    } else if (field.type === "select") {
      control = `
        <select name="${field.name}">
          ${field.options.map(option => `
            <option value="${escapeHTML(option)}"
              ${option === field.value ? "selected" : ""}>
              

${escapeHTML(
  field.name === "crimsonCategory"
    ? (CRIMSON_EVENT_CATEGORIES[option] || option)
    : ({
        daily: "🔁 Täglich",
        weekdays: "💼 Montag – Freitag",
        weekends: "🌿 Samstag & Sonntag",
        custom: "📅 Eigene Wochentage",
        training: "💪 Nur Trainingstage",
        rest: "😴 Nur Pausentage"
      }[option] || option)
)}


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
       

${field.type === "button" || field.type === "checkbox"
  ? ""
  : `<label>${escapeHTML(field.label)}</label>`}


        ${control}
      </div>`;
  }).join("");

  // 🩸 Wochentage nur bei Custom anzeigen
  const scheduleSelect = $("editor-fields")
    .querySelector('select[name="schedule"]');

  if (scheduleSelect) {
    const updateDays = () => {
      $("editor-fields")
        .querySelectorAll('input[name^="day_"]')
        .forEach(input => {
         
input.closest(".field").style.display =
  scheduleSelect.value === "custom" ? "" : "none";

        });
    };

    scheduleSelect.addEventListener("change", updateDays);
    updateDays();
  }



const dialog = $("editor");

if (data.theme === "crimson") {
  dialog.setAttribute("tabindex", "-1");
  dialog.focus({ preventScroll: true });
}

dialog.showModal();

if (data.theme === "crimson") {
  dialog.focus({ preventScroll: true });
}

enableRoutineTaskSwipe();

crimsonSetupEventTimeFields();
}



/* 🩸 Editor – bei ungültigen Eingaben offen bleiben */

$("editor-form").addEventListener("submit", event => {
  event.preventDefault();

  const values = Object.fromEntries(
    new FormData(event.currentTarget).entries()
  );

  const saveCallback = editorSave;

  // Callback darf mit false das Schließen verhindern.
  if (saveCallback) {
    const result = saveCallback(values);

    if (result === false) return;
  }

  $("editor").close();
  editorSave = null;
});




$("cancel-editor").addEventListener("click", () => {
  const dialog = $("editor");
  const routineId = dialog.dataset.returnRoutineId;

  dialog.close();
  editorSave = null;

  delete dialog.dataset.returnRoutineId;

  if (data.theme === "crimson" && routineId) {
    editRoutine(routineId);
  }
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
      <button
        type="button"
        class="day
          ${outside ? "outside" : ""}
          ${selected ? "selected" : ""}
          ${today ? "today" : ""}
          ${data.theme !== "crimson" && events.length ? "has-event" : ""}"
        data-action="select-date"
        data-date="${key}">

        <div class="day-number">${date.getDate()}</div>
        
<div class="chopper-calendar-dots">

  ${events.length
    ? '<span class="calendar-dot event-dot" title="Termin"></span>'
    : ""
  }
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

/* ==========================================
   🩸 CRIMSON – SMART CALENDAR V1
   Monat / Woche / Tag
   ========================================== */

let crimsonCalendarView = "month";

/* 🩸 CRIMSON – KALENDER TODO-LISTE */

function renderCrimsonCalendarTodos(key) {
  const tasks = tasksFor(key);
  const completed = tasks.filter(task => task.done).length;

  return `
    <section class="crimson-calendar-todos">

      <div class="crimson-calendar-todos-head">
        <h3>📜 ToDo-Liste</h3>

        ${tasks.length ? `
          <span>${completed}/${tasks.length} erledigt</span>
        ` : ""}
      </div>

      ${tasks.length ? `
        <div class="crimson-calendar-todo-progress">
          <div style="width:${
            Math.round(completed / tasks.length * 100)
          }%"></div>
        </div>

        <div class="crimson-calendar-todo-items">
          ${tasks.map(task => `
           <div class="crimson-calendar-todo-item">
              <input
                type="checkbox"
                data-action="toggle-task"
                data-date="${key}"
                data-id="${task.id}"
                ${task.done ? "checked" : ""}
              >

              <span class="${task.done ? "is-done" : ""}">
                ${escapeHTML(task.title)}
              </span>

              
${task.time ? `
  <small>${escapeHTML(task.time)}</small>
` : ""}

<button
  type="button"
  class="crimson-calendar-edit-todo"
  data-action="edit-task"
  data-date="${key}"
  data-id="${task.id}"
  aria-label="Aufgabe bearbeiten">
  ✎
</button>

            </div>
          `).join("")}
        </div>
      ` : `
        <div class="crimson-calendar-todo-empty">
          Deine ToDo-Liste ist noch leer
        </div>
      `}

      <button
        type="button"
        class="crimson-calendar-add-todo"
        data-action="add-task"
        data-date="${key}">
        + ToDo hinzufügen
      </button>

    </section>
  `;
}

/* ==========================================
   🩸 CRIMSON SMART CALENDAR V3
   Tages-Zeitachse für Termine & ToDos
   ========================================== */

/* ==========================================
   🩸 CRIMSON SMART CALENDAR V4
   Präzise Tages-Zeitachse
   ========================================== */

/* ==========================================
   🩸 CRIMSON SMART CALENDAR V5
   Zeitberechnung & Konflikterkennung
   ========================================== */

function crimsonTimeToMinutes(time) {
  if (!/^\d{2}:\d{2}$/.test(time || "")) return null;

  const [hours, minutes] = time.split(":").map(Number);

  if (
    hours < 0 || hours > 23 ||
    minutes < 0 || minutes > 59
  ) return null;

  return hours * 60 + minutes;
}

function crimsonDuration(value, fallback = 30) {
  const number = Number(value);

  return Number.isFinite(number) &&
    number >= 15 &&
    number <= 1440
      ? number
      : fallback;
}

function crimsonTimeConflict(key, time, duration, exclude = null) {
  const start = crimsonTimeToMinutes(time);

  if (start === null) return [];

  const end = start + duration;

  const entries = [
    ...eventsFor(key).map(event => ({
      ...event,
      type: "Termin",
      duration: crimsonDuration(event.duration, 60)
      
    })),

    ...tasksFor(key).map(task => ({
      ...task,
      type: "ToDo",
      duration: crimsonDuration(task.duration, 30)
    }))
  ];

  return entries.filter(entry => {
    if (
      exclude &&
      entry.id === exclude.id &&
      entry.type === exclude.type
    ) return false;

    const otherStart = crimsonTimeToMinutes(entry.time);

    if (otherStart === null) return false;

    const otherEnd = otherStart + entry.duration;

    return start < otherEnd && end > otherStart;
  });
}

function crimsonConfirmSchedule({
  key,
  time,
  duration,
  exclude = null
}) {
  if (!time) return true;

  const start = crimsonTimeToMinutes(time);

  if (start === null) {
    alert("Bitte eine gültige Uhrzeit eingeben.");
    return false;
  }

  if (start + duration > 1440) {
    alert(
      "Der Eintrag würde über Mitternacht hinausgehen. " +
      "Das unterstützen wir in dieser Version noch nicht."
    );
    return false;
  }

  const conflicts = crimsonTimeConflict(
    key,
    time,
    duration,
    exclude
  );

  if (!conflicts.length) return true;

  const names = conflicts
    .slice(0, 4)
    .map(entry => `• ${entry.type}: ${entry.title}`)
    .join("\n");

  return confirm(
    "⚠️ ZEITKONFLIKT ERKANNT!\n\n" +
    names +
    "\n\nTrotzdem speichern?"
  );
}

/* ==========================================
   🩸 CRIMSON SMART CALENDAR V6
   Freie Zeitfenster & ToDo-Vorschläge
   ========================================== */

function crimsonMinutesToTime(minutes) {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;

  return String(hours).padStart(2, "0") + ":" +
    String(mins).padStart(2, "0");
}

function crimsonBusyIntervals(key, excludeTaskId = null) {

  const events = eventsFor(key)
    .filter(event => {
      const time = String(event.time ?? "").trim();

      // Termine ohne Uhrzeit blockieren keine Stunden.
      return time !== "" && time !== "00:00";
    })
    .map(event => ({
      id: event.id,
      type: "event",
      time: event.time,
      duration: crimsonDuration(event.duration, 60)
    }));

  const tasks = tasksFor(key)
    .filter(task => {
      const time = String(task.time ?? "").trim();

      // Ungeplante Aufgaben blockieren keine Zeit.
      return (
        task.id !== excludeTaskId &&
        time !== "" &&
        time !== "00:00"
      );
    })
    .map(task => ({
      id: task.id,
      type: "task",
      time: task.time,
      duration: crimsonDuration(task.duration, 30)
    }));

  return [...events, ...tasks]
    .map(item => {
      const start = crimsonTimeToMinutes(item.time);

      if (start === null) return null;

      return {
        start,
        end: Math.min(
          1440,
          start + item.duration
        )
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.start - b.start);
}


function crimsonFreeSlots(
  key,
  duration,
  excludeTaskId = null
) {


  const START_HOUR = 8;
  const END_HOUR = 22;
  const STEP = 15;

  const startOfDay = START_HOUR * 60;
  const endOfDay = END_HOUR * 60;

  const busy = crimsonBusyIntervals(key, excludeTaskId);

  const slots = [];

  // An vergangenen Tagen keine neuen Vorschläge machen.
  if (key < todayKey()) return slots;

  let earliest = startOfDay;

  // Heute keine Vorschläge in der Vergangenheit.
  if (key === todayKey()) {
    const now = new Date();

    earliest = Math.max(
      earliest,
      now.getHours() * 60 + now.getMinutes()
    );
  }

  earliest = Math.ceil(earliest / STEP) * STEP;

  for (
    let start = earliest;
    start + duration <= endOfDay;
    start += STEP
  ) {
    const end = start + duration;

    const hasConflict = busy.some(interval =>
      start < interval.end && end > interval.start
    );

    if (!hasConflict) {
      slots.push({
        start,
        end,
        time: crimsonMinutesToTime(start),
        endTime: crimsonMinutesToTime(end)
      });
    }
  }

  return slots;
}

function renderCrimsonSmartSuggestions(key) {
 
const unscheduledTasks = tasksFor(key).filter(task => {
  const time = String(task.time ?? "").trim();

  return !task.done && (
    time === "" ||
    time === "00:00"
  );
});


  if (!unscheduledTasks.length) {
    return `
      <section class="crimson-smart-suggestions">
        <h3>🧠 Smart Scheduling</h3>
        <p class="crimson-smart-hint">
          Alle offenen ToDos haben bereits eine Uhrzeit
          oder es gibt noch keine offenen Aufgaben ohne Uhrzeit.
        </p>
      </section>
    `;
  }

  return `
    <section class="crimson-smart-suggestions">
      <div class="crimson-smart-suggestions-head">
        <h3>🧠 Smart Scheduling</h3>
        <span>Freie Zeiten finden</span>
      </div>

      <p class="crimson-smart-hint">
        Diese Aufgaben haben noch keine Uhrzeit.
        Crimson schlägt dir freie Zeitfenster vor.
      </p>

      ${unscheduledTasks.map(task => {
        const duration = crimsonDuration(
          task.duration,
          30
        );

        const suggestions = crimsonFreeSlots(
          key,
          duration,
          task.id
        ).slice(0, 3);

        return `
          <div class="crimson-smart-task-card">

            <div class="crimson-smart-task-heading">
              <strong>📜 ${escapeHTML(task.title)}</strong>
              <small>${duration} Min.</small>
            </div>

            ${suggestions.length ? `
              <div class="crimson-smart-slot-list">

                ${suggestions.map(slot => `
                  <button
                    type="button"
                    class="crimson-smart-slot"
                    data-crimson-schedule-task="${task.id}"
                    data-date="${key}"
                    data-time="${slot.time}">

                    <span>✦</span>

                    <span>
                      ${slot.time} – ${slot.endTime}
                    </span>

                    <span>Einplanen +</span>
                  </button>
                `).join("")}

              </div>
            ` : `
              <p class="crimson-smart-no-slot">
                Kein passendes freies Zeitfenster gefunden.
              </p>
            `}

          </div>
        `;
      }).join("")}
    </section>
  `;
}

function renderCrimsonNowLine(key) {
  if (key !== todayKey()) return "";

  const now = new Date();
  const minutes = now.getHours() * 60 + now.getMinutes();
  const top = minutes * 1.2;
  const time = String(now.getHours()).padStart(2, "0") +
    ":" + String(now.getMinutes()).padStart(2, "0");

  return `
    <div
      id="crimson-now-line"
      style="
        position:absolute;
        top:${top}px;
        left:0;
        right:0;
        height:2px;
        background:#ff304f;
        z-index:20;
        pointer-events:none;
        box-shadow:0 0 8px rgba(255,48,79,.55);
      ">

      <span style="
        position:absolute;
        left:0;
        top:-11px;
        width:52px;
        padding:3px 2px;
        border-radius:6px;
        background:#ff304f;
        color:white;
        font-size:11px;
        font-weight:800;
        text-align:center;
      ">${time}</span>

      <span style="
        position:absolute;
        left:53px;
        top:-4px;
        width:9px;
        height:9px;
        border-radius:50%;
        background:#ff304f;
      "></span>

    </div>
  `;
}

/* 🩸 CRIMSON – TIMELINE DRAG & DROP */

let crimsonDrag = null;
let crimsonSuppressClick = false;

function crimsonDragTime(minutes) {
  const rounded = Math.max(
    0,
    Math.min(1425, Math.round(minutes / 15) * 15)
  );

  return (
    String(Math.floor(rounded / 60)).padStart(2, "0") +
    ":" +
    String(rounded % 60).padStart(2, "0")
  );
}

// Verhindert, dass nach einem Ziehen der Editor aufgeht.
document.addEventListener("click", event => {
  if (!crimsonSuppressClick) return;

  crimsonSuppressClick = false;
  event.preventDefault();
  event.stopImmediatePropagation();
}, true);

document.addEventListener("pointerdown", event => {
  if (data.theme !== "crimson") return;
  if (page !== "calendar") return;
  if (crimsonCalendarView !== "day") return;
  if (event.button !== 0) return;

  const block = event.target.closest(".crimson-time-block");
  if (!block) return;

  const canvas = block.closest(".crimson-timeline-canvas");
  const scrollBox = block.closest(".crimson-timeline-scroll");

  if (!canvas || !scrollBox) return;


crimsonDrag = {
  block,
  canvas,
  scrollBox,
  pointerId: event.pointerId,
  startY: event.clientY,
  lastY: event.clientY,
  startScrollTop: scrollBox.scrollTop,
  startTop: parseFloat(block.style.top) || 0,
  moved: false,
  id: block.dataset.id,
  type: block.classList.contains("event") ? "event" : "task",
    date: selectedDate,
  mode: event.target.closest(".crimson-resize-handle")
    ? "resize"
    : "move",
  startHeight: block.offsetHeight
};


 
 block.setPointerCapture?.(event.pointerId);
});

function crimsonUpdateDragPosition(drag) {

  if (drag.mode === "resize") {
    const deltaY =
      drag.lastY - drag.startY +
      drag.scrollBox.scrollTop -
      drag.startScrollTop;

    if (!drag.moved && Math.abs(deltaY) < 8) return;

    drag.moved = true;

    const maxHeight = Math.max(
      18,
      drag.canvas.clientHeight - drag.startTop
    );

    const height = Math.max(
      18,
      Math.min(maxHeight, drag.startHeight + deltaY)
    );

    const duration = Math.max(
      15,
      Math.floor(height / 1.2 / 15) * 15
    );

    drag.block.style.height = `${duration * 1.2}px`;
    drag.block.style.zIndex = "50";
    drag.block.style.boxShadow =
      "0 8px 24px rgba(255,48,79,.45)";

    const label = drag.block.querySelector("strong");

    if (label) {
      const startMinutes = drag.startTop / 1.2;
      const endMinutes = Math.min(
        1440,
        startMinutes + duration
      );

      const endTime =
        String(Math.floor(endMinutes / 60)).padStart(2, "0") +
        ":" +
        String(endMinutes % 60).padStart(2, "0");

      label.textContent = `🩸 ${crimsonDragTime(startMinutes)} – ${endTime}`;
    }

    return;
  }

  const deltaY = drag.lastY - drag.startY;
  const deltaScroll =
    drag.scrollBox.scrollTop - drag.startScrollTop;

  if (!drag.moved &&
      Math.abs(deltaY + deltaScroll) < 8) return;

  drag.moved = true;

  const maxTop = Math.max(
    0,
    drag.canvas.clientHeight - drag.block.offsetHeight
  );

  const top = Math.max(
    0,
    Math.min(
      maxTop,
      drag.startTop + deltaY + deltaScroll
    )
  );

  drag.block.style.top = `${top}px`;
  drag.block.style.zIndex = "50";
  drag.block.style.opacity = "0.85";
  drag.block.style.boxShadow =
    "0 8px 24px rgba(255,48,79,.45)";

  const time = crimsonDragTime(top / 1.2);
  const label = drag.block.querySelector("strong");

  if (label) {
    label.textContent = `🩸 ${time}`;
  }
}


document.addEventListener("pointermove", event => {
  const drag = crimsonDrag;

  if (!drag || event.pointerId !== drag.pointerId) return;

  drag.lastY = event.clientY;

  crimsonUpdateDragPosition(drag);

  // Auto-Scroll erst starten, wenn wirklich gezogen wird.
  if (drag.moved) {
    crimsonStartAutoScroll();
  }
});


/* 🩸 CRIMSON – AUTO-SCROLL BEIM ZIEHEN */

let crimsonAutoScrollFrame = null;

function crimsonAutoScrollTick() {
  crimsonAutoScrollFrame = null;

  const drag = crimsonDrag;

  if (!drag || !drag.moved) return;

  const rect = drag.scrollBox.getBoundingClientRect();
  const edge = 70;
  const maxSpeed = 14;

  let speed = 0;

  if (drag.lastY < rect.top + edge) {
    const distance = Math.max(
      0,
      drag.lastY - rect.top
    );

    speed = -maxSpeed * (1 - distance / edge);
  } else if (drag.lastY > rect.bottom - edge) {
    const distance = Math.max(
      0,
      rect.bottom - drag.lastY
    );

    speed = maxSpeed * (1 - distance / edge);
  }

  if (speed !== 0) {
    const before = drag.scrollBox.scrollTop;

    drag.scrollBox.scrollTop += speed;

    if (drag.scrollBox.scrollTop !== before) {
      crimsonUpdateDragPosition(drag);
    }
  }

  crimsonAutoScrollFrame =
    requestAnimationFrame(crimsonAutoScrollTick);
}

function crimsonStartAutoScroll() {
  if (crimsonAutoScrollFrame !== null) return;

  crimsonAutoScrollFrame =
    requestAnimationFrame(crimsonAutoScrollTick);
}

function crimsonStopAutoScroll() {
  if (crimsonAutoScrollFrame !== null) {
    cancelAnimationFrame(crimsonAutoScrollFrame);
    crimsonAutoScrollFrame = null;
  }
}


document.addEventListener("pointerup", event => {
  const drag = crimsonDrag;

  if (!drag || event.pointerId !== drag.pointerId) return;

  crimsonDrag = null;
crimsonStopAutoScroll();

if (!drag.moved) return;

  crimsonSuppressClick = true;

  // Falls der Browser keinen Klick mehr auslöst,
  // die Sperre automatisch zurücksetzen.
  setTimeout(() => {
    crimsonSuppressClick = false;
  }, 350);

  if (drag.mode === "resize") {
    const item = drag.type === "event"
      ? data.events.find(e => e.id === drag.id)
      : tasksFor(drag.date).find(t => t.id === drag.id);

    const oldScroll = drag.scrollBox.scrollTop;

    if (!item || !item.time) {
      render();
      return;
    }

    const newDuration = Math.max(
      15,
      Math.round(
        parseFloat(drag.block.style.height) / 1.2 / 15
      ) * 15
    );

    const startMinutes = crimsonTimeToMinutes(item.time);

    if (
      startMinutes === null ||
      startMinutes + newDuration > 1440
    ) {
      alert("Die neue Dauer würde über Mitternacht hinausgehen.");
      render();
      return;
    }

    if (Number(item.duration) !== newDuration) {
      const allowed = crimsonConfirmSchedule({
        key: drag.date,
        time: item.time,
        duration: newDuration,
        exclude: {
          id: item.id,
          type: drag.type === "event" ? "Termin" : "ToDo"
        }
      });

      if (!allowed) {
        render();
        return;
      }

      item.duration = newDuration;
      save();
    }

    render();

    const newScrollBox = document.querySelector(
      ".crimson-timeline-scroll"
    );

    if (newScrollBox) {
      newScrollBox.scrollTop = oldScroll;
    }

    return;
  }

  const newTime = crimsonDragTime(
    parseFloat(drag.block.style.top) / 1.2
  );

  const item = drag.type === "event"
    ? data.events.find(e => e.id === drag.id)
    : tasksFor(drag.date).find(t => t.id === drag.id);

  if (!item) {
    render();
    return;
  }

  const duration = Number(item.duration) ||
    (drag.type === "event" ? 60 : 30);

  // Nicht über das Tagesende hinaus verschieben.
  const [hours, minutes] = newTime.split(":").map(Number);

  if (hours * 60 + minutes + duration > 1440) {
    alert("Der Eintrag würde über Mitternacht hinausgehen.");
    render();
    return;
  }

  if (item.time === newTime) {
    render();
    return;
  }

  // Vorhandene Konfliktprüfung weiterverwenden.
  const allowed = crimsonConfirmSchedule({
    key: drag.date,
    time: newTime,
    duration,
    exclude: {
      id: item.id,
      type: drag.type === "event" ? "Termin" : "Aufgabe"
    }
  });

  if (!allowed) {
    render();
    return;
  }

  const oldScroll = drag.scrollBox.scrollTop;

  item.time = newTime;

  save();
  render();

  const newScrollBox = document.querySelector(
    ".crimson-timeline-scroll"
  );

  if (newScrollBox) {
    newScrollBox.scrollTop = oldScroll;
  }
});

document.addEventListener("pointercancel", event => {
  if (!crimsonDrag) return;
  if (event.pointerId !== crimsonDrag.pointerId) return;

  crimsonDrag = null;
crimsonStopAutoScroll();
render();
});

function renderCrimsonDayTimeline(key) {
  const PX_PER_MINUTE = 1.2;
  const DAY_MINUTES = 24 * 60;

  const toMinutes = time => {
    if (!/^\d{2}:\d{2}$/.test(time || "")) return null;

    const [hours, minutes] = time.split(":").map(Number);

    if (
      hours < 0 || hours > 23 ||
      minutes < 0 || minutes > 59
    ) return null;

    return hours * 60 + minutes;
  };

  const entries = [
    ...eventsFor(key).map(event => ({
      crimsonCategory: crimsonEventCategory(event.crimsonCategory),
      id: event.id,
      type: "event",
      title: event.title,
      time: event.time || "",
      duration: Number(event.duration) || 60,
      done: false
    })),

    ...tasksFor(key).map(task => ({
      id: task.id,
      type: "task",
      title: task.title,
      time: task.time || "",
      duration: Number(task.duration) || 30,
      done: !!task.done
    }))
  ];

  const scheduled = entries
    .map(entry => ({
      ...entry,
      start: toMinutes(entry.time)
    }))
    .filter(entry => entry.start !== null)
    .map(entry => ({
      ...entry,
      duration: Math.max(
        15,
        Math.min(720, entry.duration)
      )
    }))
    .sort((a, b) => a.start - b.start);

  const unscheduled = entries.filter(
    entry => toMinutes(entry.time) === null
  );

  const hours = Array.from({ length: 24 }, (_, i) => i);

  // Überlappende Einträge werden nebeneinander platziert.
  const positioned = [];

  for (const entry of scheduled) {
    const end = Math.min(
      DAY_MINUTES,
      entry.start + entry.duration
    );

    const overlapping = positioned.filter(other =>
      entry.start < other.end &&
      end > other.start
    );

    const usedColumns = new Set(
      overlapping.map(other => other.column)
    );

    let column = 0;

    while (usedColumns.has(column)) column++;

    positioned.push({
      ...entry,
      end,
      column
    });
  }

  // Überlappungsgruppen für die Spaltenbreite.
  const groups = [];
  let currentGroup = [];
  let groupEnd = -1;

  for (const entry of positioned) {
    if (currentGroup.length && entry.start >= groupEnd) {
      groups.push(currentGroup);
      currentGroup = [];
      groupEnd = -1;
    }

    currentGroup.push(entry);
    groupEnd = Math.max(groupEnd, entry.end);
  }

  if (currentGroup.length) groups.push(currentGroup);

  for (const group of groups) {
    const columns = Math.max(
      ...group.map(entry => entry.column)
    ) + 1;

    group.forEach(entry => {
      entry.columns = columns;
    });
  }

  const timelineHeight = DAY_MINUTES * PX_PER_MINUTE;

  return `
    <section class="crimson-day-timeline crimson-timeline-v4">

      ${unscheduled.length ? `
        <div class="crimson-timeline-allday">
          <span>Ohne Uhrzeit</span>

          <div>
            ${unscheduled.map(entry => `
              <button
                type="button"
                class="crimson-timeline-entry ${entry.type}"
                data-action="${
                  entry.type === "event"
                    ? "edit-event"
                    : "edit-task"
                }"
                data-id="${entry.id}"
                ${entry.type === "task"
                  ? `data-date="${key}"`
                  : ""}>

                ${entry.type === "task" ? "📜" : "📅"}
                ${escapeHTML(entry.title)}
              </button>
            `).join("")}
          </div>
        </div>
      ` : ""}

      <div class="crimson-timeline-scroll">

        <div
          class="crimson-timeline-canvas"
          style="height:${timelineHeight}px">

          ${hours.map(hour => `
            <div
              class="crimson-timeline-grid-hour"
              style="top:${hour * 60 * PX_PER_MINUTE}px">

              <span>
                ${String(hour).padStart(2, "0")}:00
              </span>
            </div>
          `).join("")}
${renderCrimsonNowLine(key)}
          ${positioned.map(entry => {
            const top = entry.start * PX_PER_MINUTE;
            const height = Math.max(
              24,
              (entry.end - entry.start) * PX_PER_MINUTE
            );

            const width = 100 / entry.columns;
            const left = entry.column * width;

            return `
              <button
                type="button"
                
class="crimson-time-block ${entry.type} ${
  entry.done ? "done" : ""
} ${
  entry.type === "event"
    ? "crimson-category-" +
      crimsonEventCategory(entry.crimsonCategory)
    : ""
}"

                  entry.done ? "done" : ""
                }"
                title="Zum Bearbeiten anklicken"
                style="
                  top:${top}px;
                  height:${height}px;
                  left:calc(
                    57px + (100% - 57px) * ${left / 100}
                  );
                  width:calc(
                    (100% - 57px) * ${width / 100} - 4px
                  );
                "
                data-action="${
                  entry.type === "event"
                    ? "edit-event"
                    : "edit-task"
                }"
                data-id="${entry.id}"
                ${entry.type === "task"
                  ? `data-date="${key}"`
                  : ""}>

                
<strong>
  ${escapeHTML(entry.time)}
  –
  ${String(Math.floor(entry.end / 60)).padStart(2, "0")}:${String(entry.end % 60).padStart(2, "0")}
</strong>

<span>
  ${entry.type === "task" ? "📜" : "📅"}
  ${escapeHTML(entry.title)}
</span>
<span
  class="crimson-resize-handle"
  title="Ziehen, um die Dauer zu ändern"
  aria-hidden="true"
></span>

              </button>
            `;
          }).join("")}

        </div>
      </div>
    </section>
  `;
}

setInterval(() => {
  const line = document.getElementById("crimson-now-line");

  if (!line || data.theme !== "crimson") return;

  const now = new Date();
  const minutes = now.getHours() * 60 + now.getMinutes();

  if (selectedDate !== todayKey()) {
    line.remove();
    return;
  }

  line.style.top = `${minutes * 1.2}px`;

  const label = line.querySelector("span");

  if (label) {
    label.textContent =
      String(now.getHours()).padStart(2, "0") +
      ":" +
      String(now.getMinutes()).padStart(2, "0");
  }
}, 30000);

function renderCrimsonCalendarDetails(key) {
  const work = workAt(key);
  const training = trainingAt(key);

  return `
    <div class="grid deluxe-day-details">

  

      <article class="card">
        <div class="row crimson-tasks-header">
          <h2>📜 ToDo-Liste</h2>

          <button
            type="button"
            data-action="add-task"
            data-date="${key}">
            + Aufgabe
          </button>
        </div>

        ${renderTasks(key)}
      </article>

      <article class="card">
        <h2>📝 Tagesnotiz</h2>

        <textarea
          id="day-note"
          data-date="${key}"
          placeholder="Deine Gedanken für diesen Tag..."
          oninput="const f = document.getElementById('day-note-feedback'); if (f) { f.textContent = '● Ungespeicherte Änderungen'; f.hidden = false; f.classList.add('unsaved'); }"
        >${escapeHTML(data.dayNotes[key] || "")}</textarea>

        <button
          data-action="save-day-note"
          data-date="${key}">
          Notiz speichern
        </button>

        <p
          id="day-note-feedback"
          class="note-feedback"
          role="status"
          hidden></p>
            </article>

      <!-- 🩸 CRIMSON – TAGESÜBERSICHT -->
      <article class="card" style="
        grid-column: 1 / -1;
        padding: 12px;
      ">
        <h2 style="
          font-size: 13px;
          margin-bottom: 10px;
        ">🩸 Tagesübersicht</h2>

        <div style="
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 8px;
        ">

          <div style="
            background: rgba(120, 20, 40, 0.15);
            border: 1px solid #652032;
            border-radius: 10px;
            padding: 10px;
            text-align: center;
          ">
            <div style="font-size: 11px; opacity: 0.7;">
              💼 Arbeit
            </div>
            <strong style="font-size: 12px;">
              ${escapeHTML(work)}
            </strong>
          </div>

          <div style="
            background: rgba(120, 20, 40, 0.15);
            border: 1px solid #652032;
            border-radius: 10px;
            padding: 10px;
            text-align: center;
          ">
            <div style="font-size: 11px; opacity: 0.7;">
              💪 Training
            </div>
            <strong style="font-size: 12px;">
              ${trainingIcon(training)}
              ${escapeHTML(training)}
            </strong>
          </div>

        </div>
      </article>

    </div>
  `;
}


function renderCrimsonSmartCalendar() {
  const key = selectedDate;
  const selected = parseDate(key);

  const views = [
    ["month", "Monat"],
    ["week", "Woche"],
    ["day", "Tag"]
  ];


const tabs = `
  <div class="crimson-calendar-tabs">
    ${views.map(([value, label]) => `
      <button
        type="button"
        data-crimson-calendar-view="${value}"
        class="${crimsonCalendarView === value ? "active" : ""}"
        aria-pressed="${crimsonCalendarView === value}">
        ${label}
      </button>
    `).join("")}
  </div>
`;


  let calendarContent = "";

  if (crimsonCalendarView === "month") {
    calendarContent = renderCalendar(true);
  }

if (crimsonCalendarView === "week") {
  // 121 Tage als durchgehende horizontale Leiste
  const days = Array.from({ length: 121 }, (_, i) => {
    const date = parseDate(key);
    date.setDate(date.getDate() + i - 60);

    const dayKey = dateKey(date);

    return {
      key: dayKey,
      date,
      events: eventsFor(dayKey)
    };
  });

  calendarContent = `
    <div class="crimson-calendar-week"
         data-crimson-week-scroll>
      ${days.map(day => `
        <button
          type="button"
          class="crimson-calendar-week-day ${
            day.key === key ? "active" : ""
          }"
          data-action="select-date"
          data-date="${day.key}">
          <small>${day.date.toLocaleDateString("de-DE", {
            weekday: "short"
          })}</small>
          <strong>${day.date.getDate()}</strong>
                    ${crimsonBirthdaysFor(day.key).length
            ? '<span title="Geburtstag">🎂</span>'
            : `<span class="crimson-calendar-event-dot ${
                day.events.length ? "visible" : ""
              }"></span>`
          }
        </button>
      `).join("")}
    </div>
  `;
}

if (crimsonCalendarView === "day") {
  calendarContent = `
    <div class="crimson-calendar-day-heading">
      <strong>${escapeHTML(formatDate(key, {
        weekday: "long",
        day: "numeric",
        month: "long"
      }))}</strong>
    </div>

    ${renderCrimsonDayTimeline(key)}
  `;
}



  const events = eventsFor(key);

  const eventList = events.length
    ? events.map(event => `
        <button
          type="button"
          class="crimson-smart-event"
data-crimson-gesture-event="true"
data-id="${event.id}">
          
<span
  class="crimson-smart-event-time"
  style="
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex: 0 0 66px;
    min-width: 66px;
    min-height: 36px;
    padding: 6px 5px;
    box-sizing: border-box;
    background: #491f30;
    border: 1px solid #ff5369;
    border-radius: 10px;
    color: #ff9aaa;
    font-size: 13px;
    font-weight: 800;
    box-shadow: 0 0 10px rgba(255,45,65,0.25);
  "
>
  ${event.time ? escapeHTML(event.time) : "Ganztägig"}
</span>

          
<span class="crimson-smart-event-title">
  ${
    /training|fitness|sport|gym/i.test(event.title)
      ? "💪 "
      : /arzt|doktor|zahnarzt|termin/i.test(event.title)
      ? "📅 "
      : /anime|film|kino|abend/i.test(event.title)
      ? "🌙 "
      : "📌 "
  }
  ${escapeHTML(event.title)}
</span>

          <span>›</span>
        </button>
      `).join("")
    : `
        <div class="crimson-calendar-empty">
          Keine Termine für diesen Tag
        </div>
      `;

  return `
    <section class="crimson-smart-calendar">
      <div class="crimson-calendar-topbar">
        <strong>📅 Kalender</strong>
        <button
          type="button"
          class="crimson-calendar-today"
          data-crimson-calendar-today>
          Heute
        </button>        
        <button
          type="button"
          class="crimson-birthday-add"
          data-crimson-birthday-add
          title="Geburtstag hinzufügen">
          🎂
        </button>
      </div>

      ${tabs}

      
    
     
<div class="crimson-calendar-main">
  ${calendarContent}
</div>

${crimsonCalendarView === "day" ? "" : `
  <div class="crimson-calendar-events-scroll">
    <div class="crimson-focus-events-title">
      Termine am ${escapeHTML(formatDate(key, {
        day: "numeric",
        month: "long"
      }))}
    </div>

       <div class="crimson-focus-events-list">
      ${renderCrimsonBirthdaysForDay(key)}
      ${events.length || !crimsonBirthdaysFor(key).length
        ? eventList
        : ""}
    </div>
  </div>
`}


      <div class="crimson-calendar-details">
        ${renderCrimsonCalendarDetails(key)}
      </div>

    </section>
  `;
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

  if (kommtVonAndererSeite) {
    window.scrollTo(0, 0);
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

  if (data.theme === "crimson") {
    return renderCrimsonHome();
  }

/* ========================================
   ITACHI – EIGENES KOMPAKTES CRIMSON HOME
   ======================================== */

function renderCrimsonHome() {
  const today = todayKey();
  const work = workAt(today);
  const workTomorrow = workAt(addDays(today, 1));

const tomorrow = addDays(today, 1);

const tomorrowEvents = data.events
  .filter(event => event.date === tomorrow)
  .sort((a, b) =>
    (a.time || "").localeCompare(b.time || "")
  );

  const upcoming = data.events
    .filter(event => event.date === today)
    .sort((a, b) =>
      (a.date + (a.time || "")).localeCompare(
        b.date + (b.time || "")
      )
    )
    .slice(0, 5);

  return `
    <div class="grid neo-command-center itachi-home">

      <!-- GEWICHT -->
      ${renderWeightDashboard()}

      <!-- HEUTE -->
      <article class="card itachi-home-today">
        <h2>📌 Heute</h2>

        <div class="itachi-home-today-content">

          <section class="itachi-home-events">
            <h3>📅 Termine</h3>

            <div class="stack">
              ${upcoming.map(event => `
                <div class="item">
                  <strong>
                    ${escapeHTML(event.title)}
                  </strong>

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
                : '<p class="muted">Keine Termine.</p>'}
            </div>
          </section>

<h3>🔮 Morgen</h3>
<div class="stack">
  ${tomorrowEvents.map(event => '<div class="item"><strong>' + escapeHTML(event.title) + '</strong><div class="mini">' + (event.time ? escapeHTML(event.time) + ' Uhr' : 'Ganztägig') + '</div></div>').join("")}
  ${tomorrowEvents.length ? "" : '<p class="muted">Morgen keine Termine.</p>'}
</div>

<button
  data-action="add-event"
  data-date="${today}">
  + Termin
</button>

        </div>
      </article>

  
<!-- AUFGABEN – ITACHI HEADER -->
<article class="card itachi-home-tasks">

  <div class="crimson-tasks-header">
    <h2>📜 ToDo-Liste</h2>

    <div class="crimson-tasks-actions">
      <button
        type="button"
        data-action="add-task"
        data-date="${today}">
        + Aufgabe
      </button>

      <button
        type="button"
        data-action="add-routine">
        + Routine
      </button>
    </div>
  </div>

  ${renderTasks(today)}

</article>

      <!-- ARBEIT -->
      
<!-- TRAINING -->
<article class="card itachi-home-work">
  <h2>💪 Training</h2>

  <div class="big-status">
    ${trainingIcon(trainingAt(today))}
    ${escapeHTML(trainingAt(today))}
  </div>

  <button
    data-action="page"
    data-page="training">
    Trainingsplan
  </button>
</article>


      <!-- ARBEITSTAG -->
      <article class="card itachi-home-workday">
        <h2>⏱️ Arbeitstag</h2>

        <div class="big-status">
          ${escapeHTML(work)}
        </div>

        <p class="muted">
          Morgen: ${escapeHTML(workTomorrow)}
        </p>

        <button
          data-action="page"
          data-page="work">
          Arbeitsplanung
        </button>
      </article>

    </div>
  `;
}


  const today = todayKey();
  const training = trainingAt(today);
  const work = workAt(today);
  const workTomorrow = workAt(addDays(today, 1));

 
const tomorrow = addDays(today, 1);

const tomorrowEvents = data.events
  .filter(event => event.date === tomorrow)
  .sort((a, b) =>
    (a.time || "").localeCompare(b.time || "")
  );



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
        
<div class="crimson-tasks-header">
  <h2>Aufgaben</h2>

  <div class="crimson-tasks-actions">
    <button data-action="add-task"
            data-date="${key}">
      + Aufgabe
    </button>

    <button data-action="add-routine">
      + Routine
    </button>
  </div>
</div>

        ${renderTasks(today)}
      </article>

      
<article class="card">
  <h2>Aufgaben</h2>
  ${renderTasks(today)}
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
      <article class="card wide">
        <h2>🔔 Benachrichtigungen</h2>

        <p class="muted">
          Aktiviere Erinnerungen für deine Aufgaben
          und Termine auf deinem iPhone.
        </p>

        <button
          type="button"
          onclick="lifePlanerActivatePush().catch(e => alert('Push fehlgeschlagen: ' + e.message))">
          🔔 Push aktivieren
        </button>
                <button
          type="button"
          class="secondary"
          onclick="lifePlanerCheckOldTaskPush().catch(e => alert(e.message))">
          🔍 Alte Erinnerungen prüfen
        </button>
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

    
    case "add-routine":
      addRoutine();
      break;

    
    case "toggle-routine":
      toggleRoutine(id);
      break;

case "toggle-routine-task":
  toggleRoutineTask(key, button.dataset.routineId, id);
  break;

    case "add-routine-task":
      addRoutineTask(id);
      break;

case "edit-routine-task":
  $("editor").close();
  editorSave = null;
  editRoutineTask(button.dataset.routineId, id);
  break;


case "edit-routine":
  editRoutine(id);
  break;

case "delete-routine":
  $("editor").close();
  editorSave = null;
  deleteRoutine(id);
  break;

case "add-task-from-routine-editor":
  $("editor").close();
  addTaskFromRoutineEditor(id);
  break;
case "delete-routine-task":
  if (confirm("Diese Routine-Aufgabe wirklich löschen?")) {
    $("editor").close();

    const routine = (data.routines || []).find(
      routine => routine.id === button.dataset.routineId
    );

    if (routine) {
      routine.tasks = (routine.tasks || []).filter(
        task => task.id !== id
      );

      save();
      render();
    }
  }
  break;

    case "edit-task":
      editTask(key, id);
      break;



case "delete-task-from-editor": {
  const key = document.querySelector("#editor")?.dataset.taskDate;
  const taskId = id;

  if (!key || !taskId) break;

  data.tasks[key] = tasksFor(key).filter(t => t.id !== taskId);

  $("editor").close();
  editorSave = null;

  save();
  render();
  break;
}


    case "delete-task":
      
// Aufgabe ohne Bestätigungsfenster löschen
const task = tasksFor(key).find(t => t.id === id);

if (task) {
  card.classList.add("crimson-swipe-vanish");

  setTimeout(() => {
    data.tasks[key] = tasksFor(key).filter(
      t => t.id !== id
    );

    save();
    render();
  }, 550);
}

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

  // Andere Themes bleiben unverändert
  if (data.theme !== "crimson") {
    return renderWeightDashboardClassic(stats);
  }

  // Letzte 7 Kalendertage inklusive heute
  const startDate = addDays(todayKey(), -6);
  const recentEntries = getWeightEntries().filter(
    ([date]) => date >= startDate && date <= todayKey()
  );

  const average7 = recentEntries.length
    ? recentEntries.reduce((sum, [, weight]) => sum + weight, 0) /
      recentEntries.length
    : null;

  // Vorherige 7 Tage zum Vergleichen
  const previousStart = addDays(todayKey(), -13);
  const previousEnd = addDays(todayKey(), -7);

  const previousEntries = getWeightEntries().filter(
    ([date]) => date >= previousStart && date <= previousEnd
  );

  const previousAverage = previousEntries.length
    ? previousEntries.reduce((sum, [, weight]) => sum + weight, 0) /
      previousEntries.length
    : null;

  const weightDiff =
    average7 !== null && previousAverage !== null
      ? average7 - previousAverage
      : null;

  const weightPercent =
    weightDiff !== null && previousAverage !== 0
      ? (weightDiff / previousAverage) * 100
      : null;

  return `
    <article class="card wide weight-overview crimson-weight-home">

      <div class="crimson-weight-header">
        <h2>⚖️ Gewicht</h2>

        <button data-action="open-weight">
          + Gewicht eintragen
        </button>
      </div>

      <div class="crimson-weight-grid">

        <div class="crimson-weight-stat">
          <span>AKTUELL</span>
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

        <div class="crimson-weight-stat">
          <span>Ø 7 TAGE</span>
          <strong>
            ${average7 !== null
              ? formatWeight(average7) + " kg"
              : "—"}
          </strong>
          <small>
            ${recentEntries.length}
            ${recentEntries.length === 1 ? "Messung" : "Messungen"}
          </small>
<div class="crimson-weight-change ${
  weightDiff === null
    ? "neutral"
    : weightDiff > 0
      ? "up"
      : weightDiff < 0
        ? "down"
        : "neutral"
}">
  ${weightDiff === null
    ? "Kein Vergleich"
    : `
      ${weightDiff > 0 ? "+" : weightDiff < 0 ? "−" : "±"}${formatWeight(Math.abs(weightDiff))} kg
      (${weightPercent > 0 ? "+" : weightPercent < 0 ? "−" : "±"}${Math.abs(weightPercent).toFixed(1).replace(".", ",")} %)
    `}
</div>

        </div>

      </div>

      <button
        class="secondary crimson-weight-history"
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

/* 🩸 ITACHI – GEWICHT WIE UHRZEIT AUSWÄHLEN */

function initCrimsonWeightPicker() {
  if (data.theme !== "crimson") return;

  const kgWheel = document.getElementById("crimson-kg-wheel");
  const decimalWheel = document.getElementById("crimson-decimal-wheel");
  const input = document.getElementById("weight-value");
  const display = document.getElementById("crimson-weight-display");

  if (!kgWheel || !decimalWheel || !input || !display) return;

  const startWeight = Number(input.value) || 72.4;
  const startTenths = Math.round(startWeight * 10);

  const ROW = 38;
  const kgMin = 20;
  const kgMax = 400;

  let kg = Math.max(
    kgMin,
    Math.min(kgMax, Math.floor(startTenths / 10))
  );

  let decimal = ((startTenths % 10) + 10) % 10;

  // Sehr viele Wiederholungen für endloses Drehen
  const REPEATS = 101;
  const MIDDLE = Math.floor(REPEATS / 2);

  function updateDisplay() {
    display.textContent = kg + "," + decimal;
    input.value = (kg + decimal / 10).toFixed(1);
  }

  function fillWheel(element, values) {
    const fragment = document.createDocumentFragment();

    element.replaceChildren();

    const top = document.createElement("div");
    top.style.height = ROW * 2 + "px";
    fragment.appendChild(top);

    values.forEach(value => {
      const item = document.createElement("div");
      item.className = "crimson-picker-item";
      item.textContent = value;
      fragment.appendChild(item);
    });

    const bottom = document.createElement("div");
    bottom.style.height = ROW * 2 + "px";
    fragment.appendChild(bottom);

    element.appendChild(fragment);
  }

  // Kilogramm: 20 bis 400
  const kgValues = Array.from(
    { length: kgMax - kgMin + 1 },
    (_, i) => i + kgMin
  );

  // Kommastellen: 0–9 immer wieder
  const decimalValues = Array.from(
    { length: REPEATS * 10 },
    (_, i) => i % 10
  );

  fillWheel(kgWheel, kgValues);
  fillWheel(decimalWheel, decimalValues);

  kgWheel.scrollTop = (kg - kgMin) * ROW;

  const middleStart = MIDDLE * 10;
  decimalWheel.scrollTop = (middleStart + decimal) * ROW;

  function connectWheel(element, onValue, isDecimal) {
    let frame = null;

    function readValue() {
      const index = Math.round(element.scrollTop / ROW);

      if (isDecimal) {
        onValue(((index % 10) + 10) % 10);
      } else {
        onValue(Math.max(kgMin, Math.min(kgMax, kgMin + index)));
      }

      updateDisplay();
    }

    element.onscroll = () => {
      if (frame !== null) return;

      frame = requestAnimationFrame(() => {
        frame = null;
        readValue();
      });
    };

    element.addEventListener("scrollend", () => {
      if (!isDecimal) return;

      const index = Math.round(element.scrollTop / ROW);

      // Zur Mitte zurückspringen, ohne sichtbaren Zahlenwechsel
      if (index < 100 || index > decimalValues.length - 100) {
        element.scrollTop =
          (middleStart + ((index % 10) + 10) % 10) * ROW;
      }
    }, { passive: true });

    element.onclick = event => {
      const item = event.target.closest(".crimson-picker-item");
      if (!item || !element.contains(item)) return;

      const items = element.querySelectorAll(".crimson-picker-item");
      const index = Array.prototype.indexOf.call(items, item);

      element.scrollTo({
        top: index * ROW,
        behavior: "smooth"
      });
    };
  }

  connectWheel(kgWheel, value => {
    kg = value;
  }, false);

  connectWheel(decimalWheel, value => {
    decimal = value;
  }, true);

  updateDisplay();
}


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

if (data.theme === "crimson") {
  initCrimsonWeightPicker();
} else {
  $("weight-value").focus();
}

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
  if (data.theme === "crimson") {
    content.innerHTML = renderCrimsonSmartCalendar();
  } else {
    content.innerHTML = `
      <div class="stack">
        <article class="card">
          ${renderCalendar(true)}
        </article>

        ${renderDayDetails(selectedDate)}
      </div>
    `;
  }
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
/* ==========================================
   ITACHI CRIMSON – CHECK ANIMATION
   ========================================== */

document.addEventListener("change", event => {
  if (data.theme !== "crimson") return;

  const checkbox = event.target.closest(
    '.crimson-day-plan input[type="checkbox"][data-action]'
  );

  if (!checkbox || !checkbox.checked) return;

  const taskId = checkbox.dataset.id;
  const taskDate = checkbox.dataset.date;
  const routineId = checkbox.dataset.routineId || "";

  // Erst nach dem bestehenden Rendern animieren.
  requestAnimationFrame(() => {
    const cards = document.querySelectorAll(
      ".crimson-day-plan .item"
    );

    const card = Array.from(cards).find(item => {
      const input = item.querySelector(
        'input[type="checkbox"][data-action]'
      );

      return input &&
        input.dataset.id === taskId &&
        input.dataset.date === taskDate &&
        (input.dataset.routineId || "") === routineId &&
        input.checked;
    });

    if (!card) return;

    card.classList.add("crimson-just-checked");

    card.addEventListener("animationend", () => {
      card.classList.remove("crimson-just-checked");
    }, { once: true });
  });
}, true);

/* 🩸 CRIMSON – AUTOMATISCH ZUR AKTUELLEN UHRZEIT */
function crimsonScrollToCurrentTime() {
  if (data.theme !== "crimson") return;
  if (page !== "calendar") return;
  if (crimsonCalendarView !== "day") return;
  if (selectedDate !== todayKey()) return;

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      // Zuerst die Timeline im Fokusfenster suchen
      const focus = document.querySelector(
        "#crimson-focus-overlay.is-open"
      );

      const scope = focus || document;

      const timeline = scope.querySelector(
        ".crimson-timeline-scroll"
      );

      const canvas = scope.querySelector(
        ".crimson-timeline-canvas"
      );

      if (!timeline || !canvas) return;

      // Falls die Timeline selbst nicht scrollt,
      // den sichtbaren Kalenderbereich verwenden.
      const main = scope.querySelector(
        ".crimson-calendar-main"
      );

      const scrollBox =
        timeline.scrollHeight > timeline.clientHeight + 2
          ? timeline
          : main;

      if (!scrollBox) return;

      const now = new Date();
      const minutes =
        now.getHours() * 60 + now.getMinutes();

      const pixelsPerMinute =
        canvas.offsetHeight / 1440;

      // Aktuelle Uhrzeit, mit 45 Minuten Platz oben
      const targetY =
        (minutes - 45) * pixelsPerMinute;

      // Position des Kalenders im Scrollbereich
      const scrollRect =
        scrollBox.getBoundingClientRect();

      const canvasRect =
        canvas.getBoundingClientRect();

      const target =
        scrollBox.scrollTop +
        canvasRect.top -
        scrollRect.top +
        targetY;

      const maxScroll = Math.max(
        0,
        scrollBox.scrollHeight -
        scrollBox.clientHeight
      );

      scrollBox.scrollTop = Math.max(
        0,
        Math.min(target, maxScroll)
      );
    });
  });
}

/* 🩸 CRIMSON – TERMIN PER TIMELINE-KLICK */

document.addEventListener("click", event => {
  if (data.theme !== "crimson") return;
  if (page !== "calendar") return;
  const jumpButton = event.target.closest(
    '[data-action="crimson-jump-today"]'
  );

  if (jumpButton) {
    crimsonJumpToToday();
    return;
  }

  if (crimsonCalendarView !== "day") return;

  const canvas = event.target.closest(
    ".crimson-timeline-canvas"
  );

  if (!canvas) return;

  // Bestehende Termine und Aufgaben
  // weiterhin normal bearbeiten.
  if (event.target.closest(".crimson-time-block")) {
    return;
  }

  // Nur freie Flächen der Timeline verwenden.
  const rect = canvas.getBoundingClientRect();
  const y = event.clientY - rect.top;

  // 1 Minute entspricht 1,2 Pixeln.
  const minutes = Math.max(
    0,
    Math.min(1439, y / 1.2)
  );

  // Auf das nächste 15-Minuten-Raster runden.
  const rounded = Math.min(
    1425,
    Math.round(minutes / 15) * 15
  );

  const hours = Math.floor(rounded / 60);
  const mins = rounded % 60;

  const time =
    String(hours).padStart(2, "0") +
    ":" +
    String(mins).padStart(2, "0");

  eventEditor(null, selectedDate, time);
});

/* 🩸 CRIMSON – KALENDER-STEUERUNG */

document.addEventListener("click", event => {
  if (data.theme !== "crimson") return;
  if (page !== "calendar") return;

  const viewButton = event.target.closest(
    "[data-crimson-calendar-view]"
  );

  

if (viewButton) {
  crimsonCalendarView =
    viewButton.dataset.crimsonCalendarView;

  render();

  if (crimsonCalendarView === "day") {
    crimsonScrollToCurrentTime();
  }

/* 🩸 CRIMSON – ZURÜCK ZU HEUTE */

function crimsonJumpToToday() {
  if (data.theme !== "crimson") return;

  selectedDate = todayKey();
  displayedMonth = startOfMonth(
    parseDate(selectedDate)
  );

  crimsonCalendarView = "day";

  render();
  crimsonScrollToCurrentTime();
}

  return;
}



const todayButton = event.target.closest(
  '[data-crimson-calendar-today], [data-action="crimson-jump-today"]'
);

if (todayButton) {
  selectedDate = todayKey();

  displayedMonth = startOfMonth(
    parseDate(selectedDate)
  );

  // 🩸 Immer zur Tagesansicht wechseln
  crimsonCalendarView = "day";

  render();

  // 🩸 Zur aktuellen Uhrzeit springen
  crimsonScrollToCurrentTime();

  return;
}

 
});

/* ==========================================
   🩸 CRIMSON V6 – TODO EINPLANEN
   ========================================== */

document.addEventListener("click", event => {
  const button = event.target.closest(
    "[data-crimson-schedule-task]"
  );

  if (!button) return;

  if (data.theme !== "crimson") return;

  const key = button.dataset.date;
  const taskId = button.dataset.crimsonScheduleTask;
  const time = button.dataset.time;

  const task = tasksFor(key).find(item =>
    item.id === taskId
  );

if (
  !task ||
  task.done ||
  (
    String(task.time ?? "").trim() !== "" &&
    String(task.time ?? "").trim() !== "00:00"
  )
) {
    alert(
      "Diese Aufgabe wurde inzwischen geändert. " +
      "Bitte aktualisiere die Ansicht."
    );
    render();
    return;
  }

  const duration = crimsonDuration(task.duration, 30);

  // Vor dem Speichern erneut auf Konflikte prüfen.
  const available = crimsonFreeSlots(
    key,
    duration,
    task.id
  ).some(slot => slot.time === time);

  if (!available) {
    alert(
      "Dieses Zeitfenster ist nicht mehr verfügbar. " +
      "Bitte wähle einen neuen Vorschlag."
    );

    render();
    return;
  }

  // Bestehende Aufgabe aktualisieren.
  // KEINE neue Aufgabe anlegen.
  task.time = time;

  save();
  render();
});

/* ==========================================
   🩸 CRIMSON – SMOOTH CALENDAR V2
   Monat: Wischen
   Woche: frei seitlich scrollen
   Tag: Wischen + aktuelle Uhrzeit
   ========================================== */

(() => {
  let startX = 0;
  let startY = 0;
  let swipeStarted = false;
  let blockClickUntil = 0;
  let animating = false;

  // Design nur für Crimson
  const style = document.createElement("style");

  style.textContent = `
    body[data-theme="crimson"]
    .crimson-calendar-week[data-crimson-week-scroll] {
      display: flex !important;
      flex-wrap: nowrap !important;
      overflow-x: auto !important;
      overflow-y: hidden !important;
      gap: 6px !important;
      padding: 8px 10px 12px !important;
      scroll-snap-type: x proximity;
      -webkit-overflow-scrolling: touch;
      overscroll-behavior-x: contain;
      touch-action: pan-x pan-y;
      scrollbar-width: none;
    }

    body[data-theme="crimson"]
    .crimson-calendar-week[data-crimson-week-scroll]
   ::-webkit-scrollbar {
      display: none;
    }

    body[data-theme="crimson"]
    .crimson-calendar-week[data-crimson-week-scroll]
    .crimson-calendar-week-day {
      flex: 0 0 58px !important;
      width: 58px !important;
      min-width: 58px !important;
      scroll-snap-align: center;
      transition:
        background .2s ease,
        border-color .2s ease,
        transform .2s ease;
    }

    body[data-theme="crimson"]
    .crimson-calendar-week[data-crimson-week-scroll]
    .crimson-calendar-week-day:active {
      transform: scale(.96);
    }

    @media (prefers-reduced-motion: reduce) {
      body[data-theme="crimson"]
      .crimson-calendar-week-day {
        transition: none !important;
      }
    }
  `;

  document.head.appendChild(style);

  function calendarArea(target) {
    if (data.theme !== "crimson") return null;
    if (page !== "calendar") return null;

    return target.closest(
      ".crimson-smart-calendar .crimson-calendar-main"
    );
  }

  // Wochenleiste beim Anzeigen auf den
  // ausgewählten Tag zentrieren
  const initializedWeeks = new WeakSet();

  function centerWeek() {
    const strip = document.querySelector(
      "[data-crimson-week-scroll]"
    );

    if (!strip || initializedWeeks.has(strip)) return;

    initializedWeeks.add(strip);

    const active = strip.querySelector(
      ".crimson-calendar-week-day.active"
    );

    if (!active) return;

    requestAnimationFrame(() => {
      const target =
        active.offsetLeft -
        strip.offsetLeft -
        (strip.clientWidth - active.offsetWidth) / 2;

      strip.scrollLeft = Math.max(0, target);
    });
  }

  const observer = new MutationObserver(() => {
    if (data.theme !== "crimson") return;
    if (page !== "calendar") return;

    centerWeek();
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true
  });

  centerWeek();

  function animateCalendar(direction) {
    const main = document.querySelector(
      ".crimson-smart-calendar .crimson-calendar-main"
    );

    if (!main) return;

    if (window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches) return;

    if (!main.animate) return;

    main.animate(
      [
        {
          opacity: 0.55,
          transform: `translateX(${direction * 15}px)`
        },
        {
          opacity: 1,
          transform: "translateX(0)"
        }
      ],
      {
        duration: 260,
        easing: "cubic-bezier(.22,1,.36,1)"
      }
    );
  }

  document.addEventListener("touchstart", event => {
    swipeStarted = false;

    if (event.touches.length !== 1) return;
    if (!calendarArea(event.target)) return;

    // Woche hat eigenes natives Seitwärtsscrollen
    if (crimsonCalendarView === "week") return;

    // Termine und Timeline-Blöcke behalten
    // ihre bisherigen Gesten
    if (event.target.closest(
      ".crimson-time-block, " +
      ".crimson-smart-event, " +
      "input, textarea, select, dialog"
    )) return;

    const touch = event.touches[0];

    startX = touch.clientX;
    startY = touch.clientY;
    swipeStarted = true;
  }, { passive: true });

  document.addEventListener("touchend", event => {
    if (!swipeStarted) return;

    swipeStarted = false;

    if (animating) return;
    if (event.changedTouches.length !== 1) return;
    if (!calendarArea(event.target)) return;

    const touch = event.changedTouches[0];

    const dx = touch.clientX - startX;
    const dy = touch.clientY - startY;

    // Horizontale Bewegung muss eindeutig sein
    if (Math.abs(dx) < 55) return;
    if (Math.abs(dx) < Math.abs(dy) * 1.4) return;

    const direction = dx < 0 ? 1 : -1;

    blockClickUntil = Date.now() + 450;
    animating = true;

    if (crimsonCalendarView === "month") {
      displayedMonth = new Date(
        displayedMonth.getFullYear(),
        displayedMonth.getMonth() + direction,
        1
      );
    }

    if (crimsonCalendarView === "day") {
      selectedDate = addDays(selectedDate, direction);

      displayedMonth = startOfMonth(
        parseDate(selectedDate)
      );
    }

    render();

    // Weiche Bewegung nach dem Wechsel
    animateCalendar(direction);

    // Bei Rückkehr zu heute:
    // direkt wieder zur aktuellen Uhrzeit
    if (
      crimsonCalendarView === "day" &&
      selectedDate === todayKey()
    ) {
      crimsonScrollToCurrentTime();
    }

    setTimeout(() => {
      animating = false;
    }, 280);

  }, { passive: true });

  document.addEventListener("touchcancel", () => {
    swipeStarted = false;
  }, { passive: true });

  // Verhindert unbeabsichtigte Klicks
  // unmittelbar nach einer Wischbewegung
  document.addEventListener("click", event => {
    if (Date.now() >= blockClickUntil) return;

    if (calendarArea(event.target)) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  }, true);
})();

/* ==========================================
   🩸 CRIMSON – KALENDER FOKUSMODUS
   Schwebender Button / Fenster / Ansichten
   Nur Crimson
   ========================================== */

(() => {
  let focusOpen = false;
  let previousPage = "home";

  const css = document.createElement("style");

  css.textContent = `
    /* Schwebender Kalenderknopf */
    #crimson-focus-fab {
      position: fixed;
      right: 18px;
      bottom: 158px;
      z-index: 950;
      width: 49px;
      height: 49px;
      display: none;
      align-items: center;
      justify-content: center;
      padding: 0;
      border: 1px solid #70404b;
      border-radius: 50%;
      background: #21171d;
      color: #e9a1b0;
      font-size: 23px;
      box-shadow: 0 5px 18px rgba(0,0,0,.3);
      cursor: pointer;
      -webkit-tap-highlight-color: transparent;
    }

    body[data-theme="crimson"]
    #crimson-focus-fab.is-visible {
      display: flex;
    }

    /* Button neben Heute */
    body[data-theme="crimson"]
    .crimson-focus-header-button {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 39px;
      min-width: 39px;
      height: 36px;
      padding: 0;
      margin-left: 7px;
      border: 1px solid #70404b;
      border-radius: 9px;
      background: #21171d;
      color: #e9a1b0;
      font-size: 19px;
      box-shadow: none;
    }

    /* Hintergrund */
    #crimson-focus-overlay {
      position: fixed;
      inset: 0;
      z-index: 99990;
      display: none;
      align-items: center;
      justify-content: center;
      padding: 12px;
      padding-top: max(12px, env(safe-area-inset-top));
      padding-bottom: max(12px, env(safe-area-inset-bottom));
      background: rgba(0,0,0,.78);
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
    }

    #crimson-focus-overlay.is-open {
      display: flex;
      animation: crimsonFocusFade .22s ease both;
    }

    /* Kalenderfenster */
    #crimson-focus-window {
      width: min(100%, 540px);
      height: min(91dvh, 900px);
      min-height: 0;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      border: 1px solid #59303d;
      border-radius: 19px;
      background: #101014;
      box-shadow: 0 22px 65px rgba(0,0,0,.55);
      animation: crimsonFocusEnter .3s
        cubic-bezier(.22,1,.36,1) both;
    }

    /* Eigene obere Leiste */
    #crimson-focus-toolbar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      flex-shrink: 0;
      padding: 12px 14px;
      border-bottom: 1px solid #30252c;
    }

    #crimson-focus-toolbar strong {
      color: #f0dce2;
      font-size: 15px;
      font-weight: 650;
    }

    #crimson-focus-toolbar button {
      width: 36px;
      height: 36px;
      min-width: 36px;
      padding: 0;
      border: 1px solid #50303a;
      border-radius: 10px;
      background: #251a21;
      color: #e9a1b0;
      font-size: 20px;
      box-shadow: none;
    }

    #crimson-focus-toolbar .crimson-focus-actions {
      display: flex;
      align-items: center;
      gap: 7px;
    }

    /* Nur Kalender, keine anderen Bereiche */
    #crimson-focus-content {
      flex: 1;
      min-height: 0;
      overflow: hidden;
      display: flex;
      flex-direction: column;
    }

    #crimson-focus-content
    .crimson-smart-calendar {
      display: flex;
      flex-direction: column;
      flex: 1;
      min-height: 0;
      height: 100%;
      gap: 8px;
      padding: 12px;
      overflow: hidden;
      background: transparent;
    }

    #crimson-focus-content
    .crimson-calendar-topbar,
    #crimson-focus-content
    .crimson-calendar-tabs {
      flex-shrink: 0;
    }

    #crimson-focus-content
    .crimson-calendar-main {
      flex: 1;
      min-height: 0;
      overflow: auto;
      overscroll-behavior: contain;
      -webkit-overflow-scrolling: touch;
    }

    /* Tages-Timeline darf intern scrollen */
    #crimson-focus-content
    .crimson-timeline-scroll {
      max-height: 100%;
      overscroll-behavior: contain;
      -webkit-overflow-scrolling: touch;
    }

    /* Andere Kalender-Zusatzbereiche ausblenden */
    #crimson-focus-content
    .crimson-calendar-details {
      display: none !important;
    }

    /* Keine zweite Fokus-Schaltfläche im Fenster */
    #crimson-focus-content
    .crimson-focus-header-button {
      display: none !important;
    }

    body.crimson-focus-locked {
      overflow: hidden !important;
    }

    @keyframes crimsonFocusFade {
      from { opacity: 0; }
      to { opacity: 1; }
    }

    @keyframes crimsonFocusEnter {
      from {
        opacity: 0;
        transform: translateY(14px) scale(.975);
      }
      to {
        opacity: 1;
        transform: translateY(0) scale(1);
      }
    }

    @media (prefers-reduced-motion: reduce) {
      #crimson-focus-overlay,
      #crimson-focus-window {
        animation: none !important;
      }
    }
  `;

css.textContent += `
  /* 🩸 GRÖSSERES KALENDERFENSTER */
  #crimson-focus-overlay {
    padding: 6px !important;
    padding-top: max(6px, env(safe-area-inset-top)) !important;
    padding-bottom: max(6px, env(safe-area-inset-bottom)) !important;
  }

  #crimson-focus-window {
    width: min(100%, 620px) !important;
    height: 94dvh !important;
    max-height: 94dvh !important;
    border-radius: 18px !important;
  }

  /* Heute und Kalenderbutton näher */
  body[data-theme="crimson"]
  .crimson-calendar-topbar {
    display: flex !important;
    justify-content: flex-start !important;
    align-items: center !important;
    gap: 5px !important;
  }

  body[data-theme="crimson"]
  .crimson-calendar-topbar > strong {
    margin-right: auto !important;
  }

  body[data-theme="crimson"]
  .crimson-focus-header-button {
    margin-left: 0 !important;
    width: 36px !important;
    min-width: 36px !important;
    height: 36px !important;
  }

  /* Plus-Button mittig unten im Kalenderfenster */
  #crimson-focus-toolbar
  [data-crimson-focus-add] {
    display: none !important;
  }

  #crimson-focus-window {
    position: relative !important;
  }

  #crimson-focus-bottom {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 9px 0 13px;
    border-top: 1px solid #30252c;
    background: #101014;
  }

  #crimson-focus-bottom
  [data-crimson-focus-add] {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 53px;
    height: 53px;
    min-width: 53px;
    padding: 0;
    border-radius: 50%;
    border: 1px solid #985368;
    background: #542637;
    color: #ffe5eb;
    font-size: 31px;
    font-weight: 300;
    box-shadow: 0 4px 16px rgba(0,0,0,.25);
  }

  #crimson-focus-bottom
  [data-crimson-focus-add]:active {
    transform: scale(.94);
  }
`;

/* 🩸 KALENDER BLEIBT SICHTBAR –
   NUR DIE TERMINE SCROLLEN */

css.textContent += `
  /* Monat und Woche behalten ihren Platz */
  #crimson-focus-content
  .crimson-smart-calendar:has(
    .crimson-calendar-events-scroll
  )
  .crimson-calendar-main {
    flex: 0 0 auto !important;
    min-height: 0 !important;
    overflow: visible !important;
  }

  /* Terminliste: ungefähr 3 Einträge sichtbar */
  #crimson-focus-content
  .crimson-calendar-events-scroll {
    display: flex;
    flex-direction: column;
    gap: 7px;
    flex: 0 1 auto;
    min-height: 0;
    max-height: 180px;
    overflow-y: auto;
    overflow-x: hidden;
    overscroll-behavior: contain;
    -webkit-overflow-scrolling: touch;
    scrollbar-width: thin;
    scrollbar-color: #633342 transparent;
    padding: 2px 4px 5px 0;
  }

  /* Termine dürfen nicht zusammengedrückt werden */
  #crimson-focus-content
  .crimson-calendar-events-scroll
  .crimson-smart-event {
    flex-shrink: 0 !important;
  }

  /* Wochenleiste weiterhin seitlich wischbar */
  #crimson-focus-content
  .crimson-calendar-week {
    overflow-x: auto !important;
    overflow-y: hidden !important;
  }
`;

/* 🩸 FIX: Kalender sichtbar,
   Termine scrollbar,
   Plus außerhalb */

css.textContent += `
  /* Fenster und Plus untereinander */
  #crimson-focus-overlay {
    flex-direction: column !important;
    gap: 12px !important;
  }

  /* Platz für den äußeren Plus-Button */
  #crimson-focus-window {
    flex: 0 1 auto !important;
    height: 85dvh !important;
    max-height: 85dvh !important;
    min-height: 0 !important;
  }

  /* Kalender oben, Termine darunter */
  #crimson-focus-content
  .crimson-smart-calendar {
    display: flex !important;
    flex-direction: column !important;
    min-height: 0 !important;
    overflow: hidden !important;
  }

  /* Kalender wird nicht von Terminen verdrängt */
  #crimson-focus-content
  .crimson-calendar-main {
    flex: 0 0 auto !important;
    height: auto !important;
    min-height: 0 !important;
    overflow: visible !important;
  }

  /* Termine bekommen ihren eigenen Platz */
  #crimson-focus-content
  .crimson-calendar-events-scroll {
    display: flex !important;
    flex-direction: column !important;
    flex: 0 1 auto !important;
    gap: 7px !important;
    min-height: 0 !important;
    max-height: 190px !important;
    overflow-y: auto !important;
    overflow-x: hidden !important;
    overscroll-behavior: contain;
    -webkit-overflow-scrolling: touch;
    padding: 3px 2px 8px !important;
  }

  /* Termine bleiben sichtbar und lesbar */
  #crimson-focus-content
  .crimson-calendar-events-scroll
  .crimson-smart-event,
  #crimson-focus-content
  .crimson-calendar-events-scroll
  .crimson-calendar-empty {
    display: flex !important;
    flex-shrink: 0 !important;
    width: 100%;
    box-sizing: border-box;
  }

  /* Plus-Bereich außerhalb des Fensters */
  #crimson-focus-bottom {
    flex: 0 0 auto !important;
    display: flex !important;
    justify-content: center !important;
    align-items: center !important;
    width: 100%;
    padding: 0 !important;
    border: none !important;
    background: transparent !important;
  }

  /* Runder Plus-Button */
  #crimson-focus-bottom
  [data-crimson-focus-add] {
    display: flex !important;
    width: 58px !important;
    height: 58px !important;
    min-width: 58px !important;
    border-radius: 50% !important;
    background: #542637 !important;
    border: 1px solid #a65b72 !important;
    color: #ffe5eb !important;
    font-size: 32px !important;
    box-shadow: 0 6px 24px rgba(0,0,0,.45);
  }

  /* Tagesansicht behält ihre Timeline */
  #crimson-focus-content
  .crimson-smart-calendar:not(
    :has(.crimson-calendar-events-scroll)
  )
  .crimson-calendar-main {
    flex: 1 1 auto !important;
    overflow: auto !important;
  }
`;
/* 🩸 CRIMSON – FOKUSKALENDER KOMPAKT */

css.textContent += `

  /* NUR FOKUSFENSTER */
  #crimson-focus-content .crimson-smart-calendar {
    display: flex !important;
    flex-direction: column !important;
    height: 100% !important;
    min-height: 0 !important;
    gap: 4px !important;
    padding: 6px !important;
    overflow: hidden !important;
  }

  /* Kopfbereich */
  #crimson-focus-content .crimson-calendar-topbar,
  #crimson-focus-content .crimson-calendar-tabs {
    flex: 0 0 auto !important;
    margin: 0 !important;
  }

  /* Kalender bekommt keine zusätzliche Höhe */
  #crimson-focus-content
  .crimson-smart-calendar:has(.calendar)
  .crimson-calendar-main {
    flex: 0 0 auto !important;
    height: auto !important;
    min-height: 0 !important;
    overflow: visible !important;
  }

  /* Monatsüberschrift */
  #crimson-focus-content .calendar-head {
    margin: 0 0 3px !important;
    padding: 0 !important;
  }

  /* WICHTIG: Auch die Kalenderzeilen verkleinern */
  #crimson-focus-content .calendar {
    display: grid !important;
    grid-template-rows: 16px repeat(6, 28px) !important;
grid-auto-rows: 28px !important;
    gap: 2px !important;
    height: auto !important;
    min-height: 0 !important;
    align-content: start !important;
  }

  #crimson-focus-content .calendar .weekday {
    height: 16px !important;
    min-height: 0 !important;
    padding: 1px 0 !important;
    font-size: 10px !important;
    line-height: 14px !important;
  }

  /* Tageskästchen */
  #crimson-focus-content .calendar .day {
  display: flex !important;
  flex-direction: column !important;
  align-items: center !important;
  justify-content: flex-start !important;

  width: 100% !important;
  height: 28px !important;
  min-height: 0 !important;
  max-height: 28px !important;

  margin: 0 !important;
  padding: 2px 1px !important;
  box-sizing: border-box !important;

  border-radius: 6px !important;
  line-height: 1 !important;
  overflow: hidden !important;
}
  /* Tageszahlen */
  #crimson-focus-content .calendar .day-number {
    display: block !important;
    width: 100% !important;
    height: 13px !important;
    min-height: 13px !important;
    line-height: 13px !important;
    font-size: 11px !important;
    text-align: center !important;
    margin: 0 !important;
    padding: 0 !important;
    flex-shrink: 0 !important;
  }

#crimson-focus-content .calendar .chopper-calendar-dots {
  position: relative !important;
  top: -8px !important;

  display: flex !important;
  align-items: center !important;
  justify-content: center !important;

  gap: 2px !important;
  height: 9px !important;
  min-height: 0 !important;
  max-height: 9px !important;

  margin: 0 !important;
  padding: 0 !important;
  overflow: visible !important;
}

  #crimson-focus-content .crimson-calendar-birthday-icon {
  position: static !important;
  top: auto !important;

  font-size: 8px !important;
  line-height: 9px !important;
  width: 9px !important;
  height: 9px !important;

  margin: 0 !important;
  padding: 0 !important;
}

 #crimson-focus-content .calendar .event-dot {
  position: static !important;
  top: auto !important;

  display: block !important;
  width: 3px !important;
  height: 3px !important;
  min-width: 3px !important;
  min-height: 3px !important;
  max-width: 3px !important;
  max-height: 3px !important;

  margin: 0 !important;
  padding: 0 !important;
  flex-shrink: 0 !important;
}

  /* Terminbereich erhält den freien Platz */
  #crimson-focus-content
  .crimson-calendar-events-scroll {
    display: flex !important;
    flex-direction: column !important;
    flex: 1 1 0 !important;
    height: auto !important;
    min-height: 0 !important;
    max-height: none !important;
    overflow: hidden !important;
    gap: 3px !important;
    padding: 4px 0 0 !important;
    border-top: 1px solid #50303b;
  }

  /* Überschrift */
  #crimson-focus-content .crimson-focus-events-title {
    flex: 0 0 auto !important;
    margin: 0 0 3px !important;
    font-size: 12px !important;
    line-height: 16px !important;
  }

  /* Terminliste scrollt selbst */
  #crimson-focus-content .crimson-focus-events-list {
    display: flex !important;
    flex-direction: column !important;
    flex: 1 1 0 !important;
    height: auto !important;
    min-height: 0 !important;
    max-height: none !important;
    gap: 4px !important;
    overflow-y: auto !important;
    overflow-x: hidden !important;
    -webkit-overflow-scrolling: touch;
    padding: 1px 2px 5px !important;
  }

  /* Terminkarten nicht zusammendrücken */
  #crimson-focus-content
  .crimson-focus-events-list .crimson-smart-event {
    display: flex !important;
    flex: 0 0 auto !important;
    min-height: 38px !important;
    padding: 4px 7px !important;
    box-sizing: border-box !important;
    width: 100% !important;
  }

  /* Tagesansicht bleibt scrollbar */
  #crimson-focus-content
  .crimson-smart-calendar:not(:has(.crimson-calendar-events-scroll))
  .crimson-calendar-main {
    flex: 1 1 auto !important;
    min-height: 0 !important;
    overflow: auto !important;
  }

`;
document.head.appendChild(css);
  /* Schwebenden Button einmal erstellen */

  const fab = document.createElement("button");
  fab.id = "crimson-focus-fab";
  fab.type = "button";
  fab.innerHTML = `
  <svg width="23" height="23" viewBox="0 0 24 24"
       fill="none" stroke="currentColor"
       stroke-width="1.8" stroke-linecap="round"
       stroke-linejoin="round">
    <rect x="3" y="5" width="18" height="16" rx="2"/>
    <path d="M7 3v4M17 3v4M3 10h18"/>
    <path d="M8 14h2M14 14h2M8 18h2"/>
  </svg>
`;
  fab.setAttribute(
    "aria-label",
    "Kalender-Fokusmodus öffnen"
  );

  document.body.appendChild(fab);

  /* Fenster einmal erstellen */

  const overlay = document.createElement("div");
  overlay.id = "crimson-focus-overlay";

  overlay.innerHTML = `
    <div
      id="crimson-focus-window"
      role="dialog"
      aria-modal="true"
      aria-label="Kalender-Fokusmodus"
    >
      <div id="crimson-focus-toolbar">
        <strong>🩸 Mein Kalender</strong>

        <div class="crimson-focus-actions">
          <button
            type="button"
            data-crimson-focus-add
            aria-label="Termin hinzufügen"
          >＋</button>

          <button
            type="button"
            data-crimson-focus-close
            aria-label="Schließen"
          >×</button>
        </div>
      </div>

      <div id="crimson-focus-content"></div>
    </div>
  `;

  document.body.appendChild(overlay);

/* 🩸 Plus-Button unten mittig platzieren */
const focusWindow = overlay.querySelector(
  "#crimson-focus-window"
);

const bottomBar = document.createElement("div");
bottomBar.id = "crimson-focus-bottom";

const addButton = overlay.querySelector(
  "[data-crimson-focus-add]"
);

if (addButton) {
  bottomBar.appendChild(addButton);
}

overlay.appendChild(bottomBar);

  const content = overlay.querySelector(
    "#crimson-focus-content"
  );

  function updateButton() {
    const crimson = data.theme === "crimson";
    const onCalendar = page === "calendar";

    fab.classList.toggle(
      "is-visible",
      crimson && !onCalendar && !focusOpen
    );

    // Alten Button entfernen, falls vorhanden
    document.querySelectorAll(
      "#content .crimson-focus-header-button"
    ).forEach(button => button.remove());

    if (!crimson || !onCalendar || focusOpen) {
      return;
    }

    const today = document.querySelector(
      "#content .crimson-calendar-today"
    );

    if (!today) return;

    const button = document.createElement("button");

    button.type = "button";
    button.className =
      "crimson-focus-header-button";

    button.innerHTML = fab.innerHTML;
    button.setAttribute(
      "aria-label",
      "Kalender-Fokusmodus öffnen"
    );

    today.insertAdjacentElement(
      "afterend",
      button
    );
  }

  function refreshFocus() {
    if (!focusOpen) return;
    if (data.theme !== "crimson") {
      closeFocus();
      return;
    }

    // Derselbe Kalender, dieselben Termine
    content.innerHTML = renderCrimsonSmartCalendar();
if (
  crimsonCalendarView === "day" &&
  selectedDate === todayKey()
) {
  crimsonScrollToCurrentTime();
}
    // Wochenleiste auf den gewählten Tag setzen
    const strip = content.querySelector(
      "[data-crimson-week-scroll]"
    );

    const active = strip?.querySelector(
      ".crimson-calendar-week-day.active"
    );

    if (strip && active) {
      requestAnimationFrame(() => {
        strip.scrollLeft =
          active.offsetLeft -
          strip.offsetLeft -
          (strip.clientWidth - active.offsetWidth) / 2;
      });
    }

    if (
      crimsonCalendarView === "day" &&
      selectedDate === todayKey()
    ) {
      requestAnimationFrame(() => {
        crimsonScrollToCurrentTime();
      });
    }
  }

  function openFocus() {
    if (data.theme !== "crimson") return;
    if (focusOpen) return;

    previousPage = page;

    // Kalenderfunktionen erwarten page === calendar
    page = "calendar";
    focusOpen = true;

    document.body.classList.add(
      "crimson-focus-locked"
    );

    overlay.classList.add("is-open");

    render();
    refreshFocus();
    updateButton();
  }

  function closeFocus() {
    if (!focusOpen) return;

    focusOpen = false;

    overlay.classList.remove("is-open");
    document.body.classList.remove(
      "crimson-focus-locked"
    );

    content.innerHTML = "";

    // Zur ursprünglichen Seite zurückkehren
    page = previousPage;

    render();
    updateButton();
  }

  /* Öffnen und Schließen */

  document.addEventListener("click", event => {
    const openButton = event.target.closest(
      "#crimson-focus-fab, " +
      ".crimson-focus-header-button"
    );

    if (openButton) {
      event.preventDefault();
      openFocus();
      return;
    }

    if (event.target.closest(
      "[data-crimson-focus-close]"
    )) {
      event.preventDefault();
      closeFocus();
      return;
    }

    if (event.target.closest(
      "[data-crimson-focus-add]"
    )) {
      event.preventDefault();
      eventEditor(null, selectedDate);
    }
  }, true);

  // Klick auf den dunklen Hintergrund schließt
  overlay.addEventListener("click", event => {
    if (event.target === overlay) {
      closeFocus();
    }
  });

  // Nach jedem normalen Rendern das
  // Kalenderfenster synchron halten
  const originalRender = render;

  render = function(...args) {
    const result = originalRender.apply(this, args);

    updateButton();

    if (focusOpen) {
      refreshFocus();
    }

    return result;
  };

  updateButton();
})();
/* 🩸 CRIMSON – GEBURTSTAGE */

function crimsonBirthdaysFor(key) {
  if (data.theme !== "crimson") return [];

  const birthdays = Array.isArray(data.birthdays)
    ? data.birthdays
    : [];

  const monthDay = key.slice(5);

  return birthdays.filter(birthday =>
    birthday.date?.slice(5) === monthDay
  );
}

function renderCrimsonBirthdaysForDay(key) {
  const birthdays = crimsonBirthdaysFor(key);

  return birthdays.map(birthday => {
    const birthYear = Number(birthday.date.slice(0, 4));
    const currentYear = Number(key.slice(0, 4));

    const age = currentYear - birthYear;

    return `
      <button
        type="button"
        class="crimson-smart-event crimson-birthday-event"
        data-crimson-birthday-id="${escapeHTML(birthday.id)}"
        style="
          display:flex;
          align-items:center;
          gap:10px;
          width:100%;
          min-height:43px;
          padding:7px 10px;
          border:1px solid #b46a91;
          border-radius:10px;
          background:#391b31;
          color:#ffe0ee;
          text-align:left;
          flex-shrink:0;
        ">
        <span style="font-size:22px">🎂</span>
        <span style="flex:1">
          <strong>${escapeHTML(birthday.name)}</strong>
          <small style="display:block;opacity:.75">
            Wird ${age} Jahre alt
          </small>
        </span>
        <span>✎</span>
      </button>
    `;
  }).join("");
}

document.addEventListener("click", event => {
  if (data.theme !== "crimson") return;

  const addButton = event.target.closest(
    "[data-crimson-birthday-add]"
  );

  if (addButton) {
    const name = prompt(
      "🎂 Für wen möchtest du einen Geburtstag eintragen?"
    );

    if (name === null || !name.trim()) return;

    const date = prompt(
      "Geburtsdatum eingeben (JJJJ-MM-TT):",
      selectedDate
    );

    if (date === null) return;

    const validFormat = /^\d{4}-\d{2}-\d{2}$/.test(date);

    const parsed = validFormat
      ? parseDate(date)
      : null;

    if (
      !parsed ||
      Number.isNaN(parsed.getTime()) ||
      dateKey(parsed) !== date ||
      parsed > new Date()
    ) {
      alert("Bitte ein gültiges Geburtsdatum eingeben.");
      return;
    }

    if (!Array.isArray(data.birthdays)) {
      data.birthdays = [];
    }

    data.birthdays.push({
      id: uid(),
      name: name.trim(),
      date
    });

    save();
    render();
    return;
  }

  const birthdayButton = event.target.closest(
    "[data-crimson-birthday-id]"
  );

  if (!birthdayButton) return;

  const birthday = (data.birthdays || []).find(
    item => item.id === birthdayButton.dataset.crimsonBirthdayId
  );

  if (!birthday) return;

  const newName = prompt(
    "🎂 Namen bearbeiten (leer = Geburtstag löschen):",
    birthday.name
  );

  if (newName === null) return;

  if (!newName.trim()) {
    if (!confirm(
      `Geburtstag von ${birthday.name} wirklich löschen?`
    )) return;

    data.birthdays = data.birthdays.filter(
      item => item.id !== birthday.id
    );
  } else {
    const newDate = prompt(
      "Geburtsdatum bearbeiten (JJJJ-MM-TT):",
      birthday.date
    );

    if (newDate === null) return;

    const validFormat = /^\d{4}-\d{2}-\d{2}$/.test(newDate);
    const parsed = validFormat ? parseDate(newDate) : null;

    if (
      !parsed ||
      Number.isNaN(parsed.getTime()) ||
      dateKey(parsed) !== newDate ||
      parsed > new Date()
    ) {
      alert("Ungültiges Geburtsdatum.");
      return;
    }

    birthday.name = newName.trim();
    birthday.date = newDate;
  }

  save();
  render();
});