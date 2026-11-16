
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
    
    /* 🩸 CRIMSON – SCHWEBENDE KALENDER-BUTTONS */

   
/* 🩸 CRIMSON – BEIDE BUTTONS IDENTISCH */

#lp-mail-button,
#lp-crimson-add-button {
  position: fixed !important;
  right: 16px !important;

  width: 56px !important;
  height: 56px !important;
  min-width: 56px !important;
  min-height: 56px !important;
  max-width: 56px !important;
  max-height: 56px !important;

  box-sizing: border-box !important;
  padding: 0 !important;
  margin: 0 !important;

  display: flex;
  align-items: center;
  justify-content: center;

  border-radius: 50% !important;
border: 1px solid rgba(255, 45, 65, 0.85) !important;

  background: linear-gradient(
  145deg,
  rgba(48, 38, 48, 0.5),
  rgba(25, 21, 30, 0.5)
) !important;

  color: white !important;

  box-shadow:
  0 6px 18px rgba(0, 0, 0, 0.4),
  inset 0 1px 1px rgba(255, 255, 255, 0.15),
  0 0 9px rgba(255, 35, 55, 0.3) !important;

  z-index: 9000 !important;
  cursor: pointer;

  -webkit-appearance: none;
  appearance: none;
  -webkit-tap-highlight-color: transparent;

  transition:
    transform 180ms ease,
    box-shadow 180ms ease,
    background 180ms ease;
}

/* 📧 Oben */
#lp-mail-button {
  bottom: calc(65px + env(safe-area-inset-bottom)) !important;
  font-size: 24px !important;
}

/* ➕ Unten */
#lp-crimson-add-button {
  bottom: calc(0px + env(safe-area-inset-bottom)) !important;
  font-size: 32px !important;
  font-weight: 400 !important;
}

/* ✨ Identische Eindrückanimation */
#lp-mail-button:active,
#lp-crimson-add-button:active,
#lp-mail-button.lp-pressed,
#lp-crimson-add-button.lp-pressed {
  transform: scale(0.88) !important;

  background: linear-gradient(
    145deg,
    #43182b,
    #250e19
  ) !important;

  box-shadow:
    0 2px 6px rgba(0, 0, 0, 0.3),
    inset 0 3px 9px rgba(0, 0, 0, 0.45) !important;
}


/* 🩸 CRIMSON – SCHÖNE FLOATING BUTTONS */

#lp-mail-button,
#lp-crimson-add-button {
  box-sizing: border-box;
  width: 58px;
  height: 58px;
  padding: 0;

  display: flex;
  align-items: center;
  justify-content: center;

  border-radius: 50%;
  border: 1px solid rgba(255, 126, 163, 0.55);

  background: linear-gradient(
    145deg,
    #62243e,
    #351522
  );

  color: #fff;
  box-shadow:
    0 6px 18px rgba(0, 0, 0, 0.4),
    inset 0 1px 1px rgba(255, 255, 255, 0.15);

  cursor: pointer;
  -webkit-tap-highlight-color: transparent;

  transition:
    transform 180ms ease,
    box-shadow 180ms ease,
    background 180ms ease;
}

/* 📧 Mail */
#lp-mail-button {
  right: 16px;
  bottom: calc(98px + env(safe-area-inset-bottom));
  font-size: 24px;
}

/* ➕ Neuer Termin */
#lp-crimson-add-button {
  right: 16px;
  bottom: calc(24px + env(safe-area-inset-bottom));

  font-size: 32px;
  font-weight: 400;
}

/* ✨ Weich eindrücken */
#lp-mail-button:active,
#lp-crimson-add-button:active,
#lp-mail-button.lp-pressed,
#lp-crimson-add-button.lp-pressed {
  transform: scale(0.88);

  background: linear-gradient(
    145deg,
    #43182b,
    #250e19
  );

  box-shadow:
    0 2px 6px rgba(0, 0, 0, 0.3),
    inset 0 3px 9px rgba(0, 0, 0, 0.45);
}

    #lp-crimson-add-button:active {
      transform: scale(0.94);
    }
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

  // 🩸 CRIMSON – TERMIN HINZUFÜGEN
  const addButton = document.createElement("button");

  addButton.id = "lp-crimson-add-button";
  addButton.type = "button";
  addButton.textContent = "+";
  addButton.title = "Neuen Termin erstellen";
  addButton.setAttribute(
    "aria-label",
    "Neuen Termin erstellen"
  );

  addButton.addEventListener("click", () => {
    if (
      typeof data === "undefined" ||
      data.theme !== "crimson" ||
      typeof page === "undefined" ||
      page !== "calendar"
    ) return;

    if (typeof addEvent === "function") {
      addEvent(selectedDate);
    } else {
      alert("Der Termin-Editor ist nicht verfügbar.");
    }
  });

  const overlay = document.createElement("div");
  overlay.id = "lp-mail-overlay";

  const panel = document.createElement("div");
  panel.id = "lp-mail-panel";

  overlay.appendChild(panel);
  document.body.append(button, addButton, overlay);

  function isCrimson() {
    return typeof data !== "undefined" &&
      data.theme === "crimson";
  }

  
  function updateVisibility() {
    const visible =
      typeof data !== "undefined" &&
      data.theme === "crimson" &&
      typeof page !== "undefined" &&
      page === "calendar";

    button.hidden = !visible;
    button.style.display = visible ? "flex" : "none";

    addButton.hidden = !visible;
    addButton.style.display = visible ? "flex" : "none";

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
  ➕ Vorschlag manuell erstellen
</button>

<button type="button" id="lp-mail-import">
  📩 E-Mail-Text einfügen
</button>

      <div id="lp-mail-list"></div>

      <button type="button" id="lp-mail-close">
        Schließen
      </button>
    `;

    panel.querySelector("#lp-mail-new")
      .addEventListener("click", () => editProposal());
panel.querySelector("#lp-mail-import")
  .addEventListener("click", openMailImport);
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

  // ============================================
  // 🩸 LIFEPLANER – KOSTENLOSER E-MAIL-IMPORT
  // ============================================

  function openMailImport() {
    panel.innerHTML = `
      <h2>📩 E-Mail erkennen</h2>

      <p class="lp-mail-muted">
        Kopiere den Text einer Termin-E-Mail hier hinein.
        Die Erkennung läuft direkt auf deinem Gerät.
      </p>

      <label for="lp-import-source">E-Mail-Konto</label>
      <select id="lp-import-source">
        <option value="gmail">📧 Gmail – Privat</option>
        <option value="gmx">📧 GMX – Privat</option>
        <option value="outlook">💼 Outlook – Arbeit</option>
      </select>

      <label for="lp-import-text">E-Mail-Text</label>
      <textarea
        id="lp-import-text"
        rows="10"
        placeholder="Beispiel:

Betreff: Zahnarzttermin

Ihr Termin ist am 20.11.2026
von 14:00 bis 15:00 Uhr.
Ort: Musterstraße 5, München"
        style="
          width:100%;
          box-sizing:border-box;
          padding:12px;
          margin:8px 0;
          border-radius:10px;
          background:#281c28;
          color:white;
          border:1px solid #666;
          resize:vertical;
        "
      ></textarea>

      <div class="lp-mail-actions">
        <button type="button" id="lp-import-detect">
          🔍 Termin erkennen
        </button>

        <button type="button" id="lp-import-back">
          Zurück
        </button>
      </div>

      <p id="lp-import-status" class="lp-mail-muted"></p>
    `;

    panel.querySelector("#lp-import-back")
      .addEventListener("click", renderList);

    panel.querySelector("#lp-import-detect")
      .addEventListener("click", () => {
        const text = panel.querySelector(
          "#lp-import-text"
        ).value.trim();

        const source = panel.querySelector(
          "#lp-import-source"
        ).value;

        const status = panel.querySelector(
          "#lp-import-status"
        );

        if (!text) {
          status.textContent =
            "⚠️ Bitte zuerst einen E-Mail-Text einfügen.";
          return;
        }

        const result = detectMailAppointment(text);

        if (!result.date || !result.time) {
          status.textContent =
            "⚠️ Datum oder Beginn nicht eindeutig erkannt. " +
            "Bitte einen Vorschlag manuell erstellen.";
          return;
        }

        // Vorschlag nur speichern, nicht direkt
        // in den Kalender übernehmen.
        const proposal = {
          id: crypto.randomUUID
            ? crypto.randomUUID()
            : String(Date.now()) + Math.random(),

          source,
          title: result.title,
          date: result.date,
          time: result.time,
          duration: result.duration,
          location: result.location
        };

        proposals.push(proposal);
        saveProposals();

        // Sofort den vorhandenen Editor öffnen.
        // Hier kannst du alles kontrollieren.
        editProposal(proposal.id);
      });
  }

  function detectMailAppointment(text) {
    const lines = text
      .split(/\r?\n/)
      .map(line => line.trim())
      .filter(Boolean);

    // ------------------------------------------
    // 1. TITEL
    // ------------------------------------------

    let title = "Termin aus E-Mail";

    const subject = lines.find(line =>
      /^(betreff|subject)\s*:/i.test(line)
    );

    if (subject) {
      title = subject.replace(
        /^(betreff|subject)\s*:/i,
        ""
      ).trim() || title;
    } else {
      const heading = lines.find(line =>
        /termin|besprechung|meeting|einladung|buchung/i
          .test(line) &&
        line.length <= 100
      );

      if (heading) {
        title = heading.slice(0, 100);
      }
    }

    // ------------------------------------------
    // 2. DATUM
    // Unterstützt:
    // 20.11.2026
    // 20. November 2026
    // 2026-11-20
    // ------------------------------------------

    let date = "";

    const numericDate = text.match(
      /\b(\d{1,2})\.(\d{1,2})\.(\d{4})\b/
    );

    const isoDate = text.match(
      /\b(\d{4})-(\d{2})-(\d{2})\b/
    );

    const months = {
      januar: 1,
      februar: 2,
      märz: 3,
      maerz: 3,
      april: 4,
      mai: 5,
      juni: 6,
      juli: 7,
      august: 8,
      september: 9,
      oktober: 10,
      november: 11,
      dezember: 12
    };

    const writtenDate = text.match(
      /\b(\d{1,2})\.\s*(Januar|Februar|März|Maerz|April|Mai|Juni|Juli|August|September|Oktober|November|Dezember)\s+(\d{4})\b/i
    );

    let year, month, day;

    if (numericDate) {
      day = Number(numericDate[1]);
      month = Number(numericDate[2]);
      year = Number(numericDate[3]);
    } else if (writtenDate) {
      day = Number(writtenDate[1]);
      month = months[writtenDate[2].toLowerCase()];
      year = Number(writtenDate[3]);
    } else if (isoDate) {
      year = Number(isoDate[1]);
      month = Number(isoDate[2]);
      day = Number(isoDate[3]);
    }

    if (year && month && day) {
      const candidate = new Date(
        year, month - 1, day
      );

      if (
        candidate.getFullYear() === year &&
        candidate.getMonth() === month - 1 &&
        candidate.getDate() === day
      ) {
        date = [
          year,
          String(month).padStart(2, "0"),
          String(day).padStart(2, "0")
        ].join("-");
      }
    }

    // ------------------------------------------
    // 3. UHRZEIT
    // Erkennt beispielsweise:
    // 14:00 bis 15:00 Uhr
    // 14:00 - 15:00
    // um 14:00 Uhr
    // ------------------------------------------

    let time = "";
    let duration = 60;

    const timePattern =
      /\b([01]?\d|2[0-3])[:.]([0-5]\d)\s*(?:Uhr)?\b/gi;

    const matches = [
      ...text.matchAll(timePattern)
    ];

    function toMinutes(match) {
      return Number(match[1]) * 60 +
        Number(match[2]);
    }

    if (matches.length) {
      const start = toMinutes(matches[0]);

      time =
        String(Math.floor(start / 60)).padStart(2, "0") +
        ":" +
        String(start % 60).padStart(2, "0");

      if (matches.length > 1) {
        const end = toMinutes(matches[1]);
        const difference = end - start;

        if (difference >= 15 && difference <= 1440) {
          duration = difference;
        }
      }
    }

    // ------------------------------------------
    // 4. ORT
    // ------------------------------------------

    let location = "";

    const locationLine = lines.find(line =>
      /^(ort|adresse|location|treffpunkt)\s*:/i
        .test(line)
    );

    if (locationLine) {
      location = locationLine.replace(
        /^(ort|adresse|location|treffpunkt)\s*:/i,
        ""
      ).trim().slice(0, 500);
    }

    return {
      title,
      date,
      time,
      duration,
      location
    };
  }

  // ==========================================
  // 🩸 CRIMSON – TERMIN-GESTEN
  // Tippen: Tagesansicht
  // Halten: Bearbeiten
  // Rechts wischen: Löschen
  // ==========================================

  let crimsonGesture = null;
  let crimsonGestureTimer = null;
  let crimsonBlockClickUntil = 0;

  function crimsonGestureCard(target) {
    if (
      typeof data === "undefined" ||
      data.theme !== "crimson" ||
      typeof page === "undefined" ||
      page !== "calendar"
    ) return null;

    return target instanceof Element
      ? target.closest("[data-crimson-gesture-event]")
      : null;
  }

  function crimsonClearGestureTimer() {
    clearTimeout(crimsonGestureTimer);
    crimsonGestureTimer = null;
  }

  function crimsonOpenEventDay(id) {
    const appointment = data.events.find(
      event => String(event.id) === String(id)
    );

    if (!appointment) return;

    selectedDate = appointment.date;
    displayedMonth = startOfMonth(
      parseDate(appointment.date)
    );

    crimsonCalendarView = "day";
    render();

    // Zum Termin in der Tages-Zeitachse springen.
    requestAnimationFrame(() => {
      const timeline = document.querySelector(
        ".crimson-timeline-scroll"
      );

      const blocks = [
        ...document.querySelectorAll(
          '.crimson-time-block.event, ' +
          '.crimson-timeline-entry.event'
        )
      ];

      const block = blocks.find(
        element => String(element.dataset.id) === String(id)
      );

      if (timeline && block &&
          block.classList.contains("crimson-time-block")) {
        timeline.scrollTop = Math.max(
          0, block.offsetTop - 90
        );
      } else if (block) {
        block.scrollIntoView({
          behavior: "smooth",
          block: "center"
        });
      }
    });
  }

  document.addEventListener("pointerdown", event => {
    const card = crimsonGestureCard(event.target);
    if (!card || event.button !== 0) return;

    crimsonClearGestureTimer();

    crimsonGesture = {
      id: card.dataset.id,
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      lastX: event.clientX,
      lastY: event.clientY,
      card,
      moved: false,
      handled: false
    };

    crimsonGestureTimer = setTimeout(() => {
      const gesture = crimsonGesture;
      if (!gesture || gesture.moved) return;

      gesture.handled = true;
      crimsonBlockClickUntil = Date.now() + 900;

      if (navigator.vibrate) navigator.vibrate(25);

      eventEditor(gesture.id);
    }, 550);
  });

  document.addEventListener("pointermove", event => {
    const gesture = crimsonGesture;

    if (!gesture ||
        gesture.pointerId !== event.pointerId) return;

    gesture.lastX = event.clientX;
    gesture.lastY = event.clientY;

    const dx = event.clientX - gesture.x;
    const dy = event.clientY - gesture.y;

    if (Math.abs(dx) > 12 || Math.abs(dy) > 12) {
      gesture.moved = true;
      crimsonClearGestureTimer();
    }

  
if (dx < -20 && Math.abs(dx) > Math.abs(dy) * 1.5) {
  gesture.card.style.transform =
    `translateX(${Math.max(dx, -85)}px)`;
}

  });

  document.addEventListener("pointerup", event => {
    const gesture = crimsonGesture;

    if (!gesture ||
        gesture.pointerId !== event.pointerId) return;

    crimsonClearGestureTimer();
    crimsonGesture = null;

    gesture.card.style.transform = "";

    if (gesture.handled) return;

    const dx = event.clientX - gesture.x;
    const dy = event.clientY - gesture.y;

    
    if (dx < -85 && Math.abs(dx) > Math.abs(dy) * 1.5) {
      crimsonBlockClickUntil = Date.now() + 900;

      data.events = data.events.filter(
        appointment =>
          String(appointment.id) !== String(gesture.id)
      );

      save();
      render();
      return;
    }


    if (gesture.moved) {
      crimsonBlockClickUntil = Date.now() + 900;
    }
  });

  document.addEventListener("pointercancel", () => {
    crimsonClearGestureTimer();

    if (crimsonGesture) {
      crimsonGesture.card.style.transform = "";
    }

    crimsonGesture = null;
  });

  // Im Capture-Modus, damit nicht der
  // normale Termin-Editor ausgelöst wird.
  document.addEventListener("click", event => {
    const card = crimsonGestureCard(event.target);
    if (!card) return;

    event.preventDefault();
    event.stopImmediatePropagation();

    if (Date.now() < crimsonBlockClickUntil) return;

    crimsonOpenEventDay(card.dataset.id);
  }, true);

  // iPhone: vertikales Scrollen bleibt möglich.
  const crimsonGestureStyle = document.createElement("style");
  crimsonGestureStyle.textContent = `
    [data-crimson-gesture-event] {
      touch-action: pan-y;
      user-select: none;
      -webkit-user-select: none;
      -webkit-touch-callout: none;
      transition: transform 0.15s ease;
    }
  `;
  document.head.appendChild(crimsonGestureStyle);

// 🩸 Weiches Eindrücken für beide Buttons
[button, addButton].forEach(btn => {
  let releaseTimer;

  btn.addEventListener("pointerdown", () => {
    clearTimeout(releaseTimer);
    btn.classList.add("lp-pressed");
  });

  const release = () => {
    clearTimeout(releaseTimer);

    releaseTimer = setTimeout(() => {
      btn.classList.remove("lp-pressed");
    }, 120);
  };

  btn.addEventListener("pointerup", release);
  btn.addEventListener("pointercancel", release);
  btn.addEventListener("pointerleave", release);
});

  button.addEventListener("click", openPanel);

  overlay.addEventListener("click", event => {
    if (event.target === overlay) closePanel();
  });

  // Themewechsel erkennen, ohne app-neu.js zu verändern.
  updateVisibility();

  setInterval(updateVisibility, 800);

  console.log("🩸 LifePlaner Mail-Assistent geladen");
})();
