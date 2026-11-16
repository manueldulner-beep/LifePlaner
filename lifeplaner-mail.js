
(() => {
  "use strict";

  const KEY = "lifeplaner_mail_v1";

  // Terminvorschläge bleiben getrennt vom Kalender,
  // bis du sie ausdrücklich bestätigst.
  let proposals = [];

  try {
    const stored = JSON.parse(localStorage.getItem(KEY) || "[]");
    if (Array.isArray(stored)) proposals = stored;
  } catch (error) {
    console.warn("Mail-Vorschläge konnten nicht geladen werden.", error);
  }

  const css = document.createElement("style");
  css.textContent = `
    #lp-mail-button {
      position: fixed;
      right: 15px;
      bottom: 90px;
      z-index: 9000;
      padding: 12px 16px;
      border-radius: 30px;
      border: 1px solid #bd3659;
      background: #230d18;
      color: #fff;
      box-shadow: 0 5px 20px #0008;
      font-weight: bold;
      cursor: pointer;
    }

    #lp-mail-overlay {
      position: fixed;
      inset: 0;
      z-index: 10000;
      background: #000c;
      display: none;
      align-items: center;
      justify-content: center;
      padding: 15px;
    }

    #lp-mail-panel {
      width: 100%;
      max-width: 520px;
      max-height: 88vh;
      overflow-y: auto;
      padding: 20px;
      border-radius: 18px;
      background: #190e17;
      border: 1px solid #a92e51;
      color: white;
      box-sizing: border-box;
    }

    #lp-mail-panel h2 {
      margin-top: 0;
      color: #ff688d;
    }

    .lp-mail-row {
      padding: 14px;
      margin: 12px 0;
      background: #ffffff0d;
      border: 1px solid #ffffff25;
      border-radius: 12px;
    }

    .lp-mail-actions {
      display: flex;
      gap: 7px;
      flex-wrap: wrap;
      margin-top: 12px;
    }

    #lp-mail-panel button {
      padding: 9px 11px;
      border-radius: 9px;
      cursor: pointer;
    }

    #lp-mail-panel input,
    #lp-mail-panel select {
      width: 100%;
      box-sizing: border-box;
      padding: 10px;
      margin: 5px 0 12px;
      border-radius: 8px;
      border: 1px solid #666;
      background: #281c28;
      color: white;
    }

    #lp-mail-panel label {
      display: block;
      font-size: 13px;
    }

    .lp-mail-muted {
      opacity: .7;
      font-size: 13px;
    }
  `;
  document.head.appendChild(css);

  const button = document.createElement("button");
  button.id = "lp-mail-button";
  button.type = "button";
  button.textContent = "📧";
button.title = "Mail-Termine";
button.setAttribute("aria-label", "Mail-Termine öffnen");

  const overlay = document.createElement("div");
  overlay.id = "lp-mail-overlay";

  const panel = document.createElement("div");
  panel.id = "lp-mail-panel";

  overlay.appendChild(panel);
  document.body.append(button, overlay);

  function isCrimson() {
    return typeof data !== "undefined" &&
      data.theme === "crimson";
  }

  function updateVisibility() {
  const visible =
    isCrimson() &&
    typeof page !== "undefined" &&
    page === "calendar";

  button.hidden = !visible;
  button.style.display = visible ? "block" : "none";

  if (!visible) {
    overlay.style.display = "none";
  }
}

  function saveProposals() {
    localStorage.setItem(KEY, JSON.stringify(proposals));
  }

  function escapeText(value) {
    return String(value ?? "").replace(/[&<>"']/g, char => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    }[char]));
  }

  function categoryFor(source) {
    return source === "outlook" ? "arbeit" : "privat";
  }

  function sourceLabel(source) {
    return {
      gmail: "📧 Gmail",
      gmx: "📧 GMX",
      outlook: "💼 Outlook / Exchange"
    }[source] || "📧 E-Mail";
  }

  function closePanel() {
    overlay.style.display = "none";
  }

  function openPanel() {
    if (!isCrimson()) return;
    overlay.style.display = "flex";
    renderList();
  }

  function renderList() {
    panel.innerHTML = `
      <h2>🩸 Mail-Assistent</h2>
      <p class="lp-mail-muted">
        Terminvorschläge prüfen, bevor sie im Kalender landen.
      </p>

      <button type="button" id="lp-mail-new">
        ➕ Testvorschlag erstellen
      </button>

      <div id="lp-mail-list"></div>

      <button type="button" id="lp-mail-close">
        Schließen
      </button>
    `;

    panel.querySelector("#lp-mail-new")
      .addEventListener("click", () => editProposal());

    panel.querySelector("#lp-mail-close")
      .addEventListener("click", closePanel);

    const list = panel.querySelector("#lp-mail-list");

    if (!proposals.length) {
      list.innerHTML = `
        <p class="lp-mail-muted">
          Noch keine Terminvorschläge vorhanden.
        </p>
      `;
      return;
    }

    proposals.forEach(proposal => {
      const row = document.createElement("div");
      row.className = "lp-mail-row";

      const duration = Number(proposal.duration) || 60;

      row.innerHTML = `
        <strong>${escapeText(proposal.title)}</strong>
        <p>
          ${escapeText(sourceLabel(proposal.source))}<br>
          📅 ${escapeText(proposal.date)}<br>
          🕐 ${escapeText(proposal.time)}
          · ${duration} Minuten<br>
          📍 ${escapeText(proposal.location || "Kein Ort")}<br>
          🏷️ ${proposal.source === "outlook" ? "Arbeit" : "Privat"}
        </p>
        <div class="lp-mail-actions">
          <button type="button" data-action="accept">
            ✅ Bestätigen
          </button>
          <button type="button" data-action="edit">
            ✏️ Bearbeiten
          </button>
          <button type="button" data-action="reject">
            ❌ Ablehnen
          </button>
        </div>
      `;

      row.querySelector('[data-action="accept"]')
        .addEventListener("click", () => acceptProposal(proposal.id));

      row.querySelector('[data-action="edit"]')
        .addEventListener("click", () => editProposal(proposal.id));

      row.querySelector('[data-action="reject"]')
        .addEventListener("click", () => {
          if (!confirm("Terminvorschlag ablehnen?")) return;

          proposals = proposals.filter(p => p.id !== proposal.id);
          saveProposals();
          renderList();
        });

      list.appendChild(row);
    });
  }

  function editProposal(id = null) {
    const existing = proposals.find(p => p.id === id);

    const today = new Date();
    const localDate = [
      today.getFullYear(),
      String(today.getMonth() + 1).padStart(2, "0"),
      String(today.getDate()).padStart(2, "0")
    ].join("-");

    panel.innerHTML = `
      <h2>${existing ? "✏️ Vorschlag bearbeiten" : "📧 Neuer Testvorschlag"}</h2>

      <form id="lp-mail-form">
        <label>E-Mail-Konto</label>
        <select name="source">
          <option value="gmail">Gmail – Privat</option>
          <option value="gmx">GMX – Privat</option>
          <option value="outlook">Outlook / Exchange – Arbeit</option>
        </select>

        <label>Termintitel</label>
        <input name="title" required maxlength="150">

        <label>Datum</label>
        <input name="date" type="date" required>

        <label>Beginn</label>
        <input name="time" type="time" required>

        <label>Ende</label>
        <input name="endTime" type="time" required>

        <label>Ort / Adresse / Besprechungslink</label>
        <input name="location" maxlength="500">

        <div class="lp-mail-actions">
          <button type="submit">💾 Vorschlag speichern</button>
          <button type="button" id="lp-mail-back">Zurück</button>
        </div>
      </form>
    `;

    const form = panel.querySelector("#lp-mail-form");

    form.elements.source.value = existing?.source || "gmail";
    form.elements.title.value = existing?.title || "";
    form.elements.date.value = existing?.date || localDate;
    form.elements.time.value = existing?.time || "10:00";
    form.elements.location.value = existing?.location || "";

    const start = form.elements.time.value;
    const minutes = Number(start.slice(0, 2)) * 60 +
      Number(start.slice(3, 5)) +
      (Number(existing?.duration) || 60);

    form.elements.endTime.value =
      String(Math.floor(minutes / 60) % 24).padStart(2, "0") +
      ":" +
      String(minutes % 60).padStart(2, "0");

    panel.querySelector("#lp-mail-back")
      .addEventListener("click", renderList);

    form.addEventListener("submit", event => {
      event.preventDefault();

      const values = form.elements;

      const startMinutes =
        Number(values.time.value.slice(0, 2)) * 60 +
        Number(values.time.value.slice(3, 5));

      const endMinutes =
        Number(values.endTime.value.slice(0, 2)) * 60 +
        Number(values.endTime.value.slice(3, 5));

      const duration = endMinutes - startMinutes;

      if (duration < 15) {
        alert("Das Ende muss mindestens 15 Minuten nach dem Beginn liegen.");
        return;
      }

      const proposal = {
        id: existing?.id || (
          crypto.randomUUID
            ? crypto.randomUUID()
            : String(Date.now()) + Math.random()
        ),
        source: values.source.value,
        title: values.title.value.trim(),
        date: values.date.value,
        time: values.time.value,
        duration,
        location: values.location.value.trim()
      };

      if (existing) {
        Object.assign(existing, proposal);
      } else {
        proposals.push(proposal);
      }

      saveProposals();
      renderList();
    });
  }

  function acceptProposal(id) {
    const proposal = proposals.find(p => p.id === id);
    if (!proposal) return;

    if (
      typeof data === "undefined" ||
      !Array.isArray(data.events) ||
      typeof save !== "function" ||
      typeof render !== "function"
    ) {
      alert("LifePlaner-Kalender ist noch nicht bereit.");
      return;
    }

    // Bestehende Crimson-Konfliktprüfung verwenden.
    if (typeof crimsonConfirmSchedule === "function") {
      const allowed = crimsonConfirmSchedule({
        key: proposal.date,
        time: proposal.time,
        duration: proposal.duration
      });

      if (!allowed) return;
    }

    const alreadyExists = data.events.some(event =>
      event.title === proposal.title &&
      event.date === proposal.date &&
      event.time === proposal.time
    );

    if (alreadyExists && !confirm(
      "Ein ähnlicher Termin existiert bereits. Trotzdem hinzufügen?"
    )) return;

    data.events.push({
      id: typeof uid === "function"
        ? uid()
        : String(Date.now()) + Math.random(),
      title: proposal.title,
      date: proposal.date,
      time: proposal.time,
      duration: proposal.duration,
      location: proposal.location,
      crimsonCategory: categoryFor(proposal.source),
      reminderMinutes: [],
      mailSource: proposal.source
    });

    proposals = proposals.filter(p => p.id !== id);

    save();
    saveProposals();

    if (
      typeof parseDate === "function" &&
      typeof startOfMonth === "function"
    ) {
      selectedDate = proposal.date;
      displayedMonth = startOfMonth(parseDate(proposal.date));
    }

    closePanel();
    render();

    alert("✅ Termin wurde in deinen Crimson-Kalender übernommen!");
  }

  button.addEventListener("click", openPanel);

  overlay.addEventListener("click", event => {
    if (event.target === overlay) closePanel();
  });

  // Themewechsel erkennen, ohne app-neu.js zu verändern.
  updateVisibility();

  setInterval(updateVisibility, 800);

  console.log("🩸 LifePlaner Mail-Assistent geladen");
})();
