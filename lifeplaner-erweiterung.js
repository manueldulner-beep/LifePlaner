
/* ==========================================
   LIFEPLANER ERWEITERUNG
   TEIL 1 – GEBURTSTAGE UND FEIERTAGE
   ========================================== */

"use strict";

(function () {

  const LP_BUNDESLAENDER = [
    "Baden-Württemberg",
    "Bayern",
    "Berlin",
    "Brandenburg",
    "Bremen",
    "Hamburg",
    "Hessen",
    "Mecklenburg-Vorpommern",
    "Niedersachsen",
    "Nordrhein-Westfalen",
    "Rheinland-Pfalz",
    "Saarland",
    "Sachsen",
    "Sachsen-Anhalt",
    "Schleswig-Holstein",
    "Thüringen"
  ];

  // Neue Datenbereiche vorbereiten.
  // Bestehende LifePlaner-Daten bleiben erhalten.

  if (!Array.isArray(data.birthdays)) {
    data.birthdays = [];
  }

  if (!Array.isArray(data.vacationPlans)) {
    data.vacationPlans = [];
  }

  if (!LP_BUNDESLAENDER.includes(data.holidayState)) {
    data.holidayState = "Bayern";
  }

  function lpSafe(value) {
    return String(value ?? "").replace(
      /[&<>"']/g,
      character => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
      })[character]
    );
  }

  function lpDateKey(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
  }

  function lpParseDate(value) {
    const [year, month, day] = value.split("-").map(Number);
    return new Date(year, month - 1, day);
  }

  function lpAddDays(value, amount) {
    const date = lpParseDate(value);
    date.setDate(date.getDate() + amount);
    return lpDateKey(date);
  }

  function lpFormatDate(value) {
    return lpParseDate(value).toLocaleDateString("de-DE", {
      day: "2-digit",
      month: "short",
      year: "numeric"
    });
  }

  function lpIsWorkday(value) {
    const day = lpParseDate(value).getDay();
    return day >= 1 && day <= 5;
  }

  // Berechnung des Ostersonntags.
  // Daraus werden bewegliche Feiertage abgeleitet.

  function lpEaster(year) {
    const a = year % 19;
    const b = Math.floor(year / 100);
    const c = year % 100;
    const d = Math.floor(b / 4);
    const e = b % 4;
    const f = Math.floor((b + 8) / 25);
    const g = Math.floor((b - f + 1) / 3);
    const h = (19 * a + b - d - g + 15) % 30;
    const i = Math.floor(c / 4);
    const k = c % 4;
    const l = (32 + 2 * e + 2 * i - h - k + 7) % 7;
    const m = Math.floor((a + 11 * h + 22 * l) / 451);

    const month = Math.floor((h + l - 7 * m + 114) / 31);
    const day = ((h + l - 7 * m + 114) % 31) + 1;

    return lpDateKey(new Date(year, month - 1, day));
  }

  function lpHolidays(year, state = data.holidayState) {
    const holidays = {};

    function add(date, name) {
      holidays[date] = name;
    }

    function fixed(month, day, name) {
      const mm = String(month).padStart(2, "0");
      const dd = String(day).padStart(2, "0");

      add(`${year}-${mm}-${dd}`, name);
    }

    const easter = lpEaster(year);

    // Bundesweite Feiertage

    fixed(1, 1, "Neujahr");
    fixed(5, 1, "Tag der Arbeit");
    fixed(10, 3, "Tag der Deutschen Einheit");
    fixed(12, 25, "1. Weihnachtstag");
    fixed(12, 26, "2. Weihnachtstag");

    add(lpAddDays(easter, -2), "Karfreitag");
    add(lpAddDays(easter, 1), "Ostermontag");
    add(lpAddDays(easter, 39), "Christi Himmelfahrt");
    add(lpAddDays(easter, 50), "Pfingstmontag");

    // Feiertage einzelner Bundesländer

    if ([
      "Baden-Württemberg",
      "Bayern",
      "Sachsen-Anhalt"
    ].includes(state)) {
      fixed(1, 6, "Heilige Drei Könige");
    }

    if ([
      "Baden-Württemberg",
      "Bayern",
      "Hessen",
      "Nordrhein-Westfalen",
      "Rheinland-Pfalz",
      "Saarland"
    ].includes(state)) {
      add(lpAddDays(easter, 60), "Fronleichnam");
    }

    if ([
      "Baden-Württemberg",
      "Bayern",
      "Nordrhein-Westfalen",
      "Rheinland-Pfalz",
      "Saarland"
    ].includes(state)) {
      fixed(11, 1, "Allerheiligen");
    }

    if ([
      "Brandenburg",
      "Bremen",
      "Hamburg",
      "Mecklenburg-Vorpommern",
      "Niedersachsen",
      "Sachsen",
      "Sachsen-Anhalt",
      "Schleswig-Holstein",
      "Thüringen"
    ].includes(state)) {
      fixed(10, 31, "Reformationstag");
    }

    if (["Berlin", "Mecklenburg-Vorpommern"].includes(state)) {
      fixed(3, 8, "Internationaler Frauentag");
    }

    if (state === "Thüringen") {
      fixed(9, 20, "Weltkindertag");
    }

    if (state === "Saarland") {
      fixed(8, 15, "Mariä Himmelfahrt");
    }

    if (state === "Brandenburg") {
      add(easter, "Ostersonntag");
      add(lpAddDays(easter, 49), "Pfingstsonntag");
    }

    if (state === "Sachsen") {
      const date = new Date(year, 10, 23);
      date.setDate(date.getDate() - ((date.getDay() + 4) % 7));

      add(lpDateKey(date), "Buß- und Bettag");
    }

    return holidays;
  }

  function lpHolidayOn(date) {
    return lpHolidays(
      Number(date.slice(0, 4))
    )[date] || null;
  }

  function lpWorkdaysBetween(start, end) {
    let count = 0;

    for (
      let day = start;
      day <= end;
      day = lpAddDays(day, 1)
    ) {
      if (lpIsWorkday(day) && !lpHolidayOn(day)) {
        count++;
      }
    }

    return count;
  }

  function lpCalendarDays(start, end) {
    const a = lpParseDate(start);
    const b = lpParseDate(end);

    return Math.round(
      (b.getTime() - a.getTime()) / 86400000
    ) + 1;
  }

  function lpBirthdaysOn(date) {
    return data.birthdays.filter(
      birthday => birthday.date.slice(5) === date.slice(5)
    );
  }

  function lpVacationOn(date) {
    return data.vacationPlans.some(
      vacation =>
        vacation.start <= date &&
        vacation.end >= date
    );
  }

  // Weitere Teile folgen hier.

  /* ==========================================
     TEIL 2 – GEBURTSTAGSBEREICH
     ========================================== */

  // Neuen Menüpunkt für Geburtstage hinzufügen.

  const lpBirthdayMenuIndex = pages.findIndex(
    item => item[0] === "notes"
  );

  if (!pages.some(item => item[0] === "birthdays")) {
    pages.splice(
      lpBirthdayMenuIndex >= 0
        ? lpBirthdayMenuIndex
        : pages.length,
      0,
      ["birthdays", "🎂", "Geburtstage"]
    );
  }

  // Geburtstagsseite aufbauen.

  function lpRenderBirthdays() {
    
    // Alter beim nächsten Geburtstag berechnen.

    const lpToday = new Date();
    const lpCurrentYear = lpToday.getFullYear();
    const lpTodayMonthDay = lpDateKey(lpToday).slice(5);

    function lpBirthdayInfo(birthday) {

      const monthDay = birthday.date.slice(5);
      const birthYear = Number(birthday.date.slice(0, 4));

      const nextYear = monthDay < lpTodayMonthDay
        ? lpCurrentYear + 1
        : lpCurrentYear;

      const nextAge = nextYear - birthYear;

      const displayDate = lpParseDate(birthday.date)
        .toLocaleDateString("de-DE", {
          day: "numeric",
          month: "long"
        });

      return `
        <div class="mini">
          ${displayDate} · jedes Jahr ♡
        </div>
        <div class="mini">
          🎉 Wird ${nextAge} Jahre alt (${nextYear})
        </div>
      `;
    }

    const birthdays = [...data.birthdays].sort((a, b) => {
      return a.date.slice(5).localeCompare(b.date.slice(5));
    });

    const birthdayList = birthdays.length
      ? birthdays.map(birthday => {

          const name = lpSafe(birthday.name);

          return `
            <div class="item row">

              <div>
                <strong>🎂 ${name}</strong>
                ${lpBirthdayInfo(birthday)}
              </div>

              <button
                type="button"
                class="secondary"
                data-lp-action="delete-birthday"
                data-lp-id="${lpSafe(birthday.id)}">
                Löschen
              </button>

            </div>
          `;
        }).join("")
      : `
          <p class="muted">
            Noch keine Geburtstage eingetragen.
          </p>
        `;

    return `
      <div class="grid">

        <article class="card wide">

          <h2>🎂 Geburtstage</h2>

          <p class="muted">
            Trage die Geburtstage deiner Familie,
            Freunde und Lieblingsmenschen ein.
            Sie wiederholen sich jedes Jahr automatisch.
          </p>

          <form id="lp-birthday-form" class="lp-birthday-form">

            <div class="field">
              <label for="lp-birthday-name">
                Name
              </label>

              <input
                id="lp-birthday-name"
                name="name"
                type="text"
                maxlength="100"
                placeholder="z. B. Lisa"
                required>
            </div>

            <div class="field">
              <label for="lp-birthday-date">
                Geburtsdatum
              </label>

              <input
                id="lp-birthday-date"
                name="date"
                type="date"
                required>
            </div>

            <button type="submit">
              ♡ Geburtstag speichern
            </button>

          </form>

        </article>

        <article class="card wide">

          <h2>🎉 Meine Geburtstagsliste</h2>

          <div class="stack">
            ${birthdayList}
          </div>

        </article>

      </div>
    `;
  }

  // Geburtstage speichern und löschen.
  // Die Ereignisse werden zentral abgefangen,
  // damit sie auch nach einem Seitenwechsel funktionieren.

  document.addEventListener("submit", function (event) {

    if (event.target.id !== "lp-birthday-form") {
      return;
    }

    event.preventDefault();

    const form = new FormData(event.target);

    const name = String(
      form.get("name") || ""
    ).trim();

    const birthdayDate = String(
      form.get("date") || ""
    );

    if (!name || !birthdayDate) {
      alert("Bitte Name und Geburtsdatum eintragen.");
      return;
    }

    data.birthdays.push({
      id: "birthday-" +
          Date.now() + "-" +
          Math.random().toString(36).slice(2, 8),
      name: name,
      date: birthdayDate
    });

    save();
    render();

  });

  document.addEventListener("click", function (event) {

    const button = event.target.closest(
      '[data-lp-action="delete-birthday"]'
    );

    if (!button) {
      return;
    }

    const birthday = data.birthdays.find(
      item => item.id === button.dataset.lpId
    );

    if (!birthday) {
      return;
    }

    if (!confirm(
      `Geburtstag von ${birthday.name} wirklich löschen?`
    )) {
      return;
    }

    data.birthdays = data.birthdays.filter(
      item => item.id !== birthday.id
    );

    save();
    render();

  });

  // Weitere Teile folgen hier.

  /* ==========================================
     TEIL 3 – KALENDER-MARKIERUNGEN
     ========================================== */

  // Markierungen für Termine, Geburtstage,
  // Feiertage und geplante Urlaubstage.

  function lpCalendarMarkers(date) {

    const birthdayCount = lpBirthdaysOn(date).length;
    const holidayName = lpHolidayOn(date);
    const vacation = lpVacationOn(date);

    let html = "";

    // Termine erhalten einen farbigen Punkt.
    // Die vorhandene Termin-Funktion bleibt erhalten.

    let appointmentCount = 0;

    if (typeof eventsFor === "function") {
      try {
        const appointments = eventsFor(date);

        if (Array.isArray(appointments)) {
          appointmentCount = appointments.length;
        }
      } catch (error) {
        console.warn(
          "Termine konnten nicht gezählt werden:",
          error
        );
      }
    }

    if (appointmentCount > 0) {
      html += `
        <span
          class="lp-calendar-dot"
          title="${appointmentCount} Termin(e)"
          aria-label="${appointmentCount} Termin(e)">
        </span>
      `;
    }

    if (birthdayCount > 0) {
      const names = lpBirthdaysOn(date)
        .map(person => person.name)
        .join(", ");

      html += `
        <span
          class="lp-calendar-icon"
          title="Geburtstag: ${lpSafe(names)}"
          aria-label="Geburtstag">
          🎂
        </span>
      `;
    }

    if (holidayName) {
      html += `
        <span
          class="lp-calendar-icon"
          title="${lpSafe(holidayName)}"
          aria-label="Feiertag">
          🎉
        </span>
      `;
    }

    if (vacation) {
      html += `
        <span
          class="lp-calendar-icon"
          title="Geplanter Urlaub"
          aria-label="Geplanter Urlaub">
          🌴
        </span>
      `;
    }

    if (!html) {
      return "";
    }

    return `
      <span class="lp-calendar-markers">
        ${html}
      </span>
    `;
  }

  // Bestehende Kalenderfunktion erweitern,
  // ohne sie vollständig zu ersetzen.

  const lpOriginalRenderCalendar = renderCalendar;

  renderCalendar = function (...args) {

    const originalHtml = lpOriginalRenderCalendar(...args);

    if (typeof originalHtml !== "string") {
      return originalHtml;
    }

    // Kalender-Tage einzeln bearbeiten.

    return originalHtml.replace(
      /<button\b[^>]*class="[^"]*\bday\b[^"]*"[^>]*>[\s\S]*?<\/button>/g,
      function (dayHtml) {

        // Datum aus dem vorhandenen Kalender auslesen.

        const dateMatch = dayHtml.match(
          /data-date=["'](\d{4}-\d{2}-\d{2})["']/
        );

        if (!dateMatch) {
          return dayHtml;
        }

        const date = dateMatch[1];
        const markers = lpCalendarMarkers(date);

        if (!markers) {
          return dayHtml;
        }

        // Markierungen unter der Tageszahl anzeigen.

        if (dayHtml.includes('class="day-number"')) {
          return dayHtml.replace(
            /(<[^>]+class="day-number"[^>]*>[\s\S]*?<\/[^>]+>)/,
            "$1" + markers
          );
        }

        // Ersatz, falls die Tageszahl anders aufgebaut ist.

        return dayHtml.replace(
          /<\/button>$/,
          markers + "</button>"
        );

      }
    );
  };

  // Zusätzliche Informationen zum ausgewählten Tag.

  function lpDayDetails(date) {

    const birthdays = lpBirthdaysOn(date);
    const holiday = lpHolidayOn(date);
    const vacation = lpVacationOn(date);

    let html = "";

    if (holiday) {
      html += `
        <div class="lp-day-detail">
          <strong>🎉 Feiertag</strong>
          <span>${lpSafe(holiday)}</span>
        </div>
      `;
    }

    birthdays.forEach(person => {
      html += `
        <div class="lp-day-detail">
          <strong>🎂 Geburtstag</strong>
          <span>${lpSafe(person.name)}</span>
        </div>
      `;
    });

    if (vacation) {
      html += `
        <div class="lp-day-detail">
          <strong>🌴 Geplanter Urlaub</strong>
          <span>Du hast für diesen Tag Urlaub geplant.</span>
        </div>
      `;
    }

    return html;
  }

  // Weitere Teile folgen hier.

  /* ==========================================
     TEIL 4 – URLAUBSPLANER
     ========================================== */

  // Neuen Menüpunkt für den Urlaubsplaner anlegen.

  const lpVacationMenuIndex = pages.findIndex(
    item => item[0] === "birthdays"
  );

  if (!pages.some(item => item[0] === "vacation-planner")) {
    pages.splice(
      lpVacationMenuIndex >= 0
        ? lpVacationMenuIndex + 1
        : pages.length,
      0,
      ["vacation-planner", "🌴", "Urlaubsplaner"]
    );
  }

  // Ausgewähltes Jahr für die Urlaubsübersicht.

  let lpVacationYear = new Date().getFullYear();

  // Geplante Urlaubstage eines Jahres berechnen.
  // Mehrjährige Urlaube werden korrekt aufgeteilt.

  /* ==========================================
     URLAUBSKONTO FÜR ZUKÜNFTIGE JAHRE
     ========================================== */

  // Urlaubstage, die bereits unter "Arbeit"
  // als genommen eingetragen wurden.

  function lpTakenVacationDaysUntil(endDate) {

    const baseDate = data.vacation.baseDate;
    let total = 0;

    for (const [date, status] of Object.entries(
      data.workOverrides
    )) {

      if (
        status === "Urlaub" &&
        date >= baseDate &&
        date <= endDate &&
        lpIsWorkday(date) &&
        !lpHolidayOn(date) &&
        !(data.vacation.excludeHolidays || []).includes(date)
      ) {
        total++;
      }
    }

    return total;
  }

  // Urlaubskonto zum Ende eines ausgewählten Jahres.
  // Resturlaub wird ins nächste Jahr übernommen.

  function lpVacationBalanceForYear(year) {

    const baseYear = Number(
      data.vacation.baseDate.slice(0, 4)
    );

    const baseDays = Number(
      data.vacation.baseDays
    ) || 0;

    const annualDays = Number(
      data.vacation.annualDays
    ) || 0;

    const newYears = Math.max(
      0,
      year - baseYear
    );

    const available =
      baseDays + newYears * annualDays;

    const taken = lpTakenVacationDaysUntil(
      year + "-12-31"
    );

    return {
      available: available,
      taken: taken,
      remaining: available - taken
    };
  }

  function lpPlannedVacationDays(year) {

    let total = 0;

    const yearStart = `${year}-01-01`;
    const yearEnd = `${year}-12-31`;

    data.vacationPlans.forEach(vacation => {

      const start = vacation.start > yearStart
        ? vacation.start
        : yearStart;

      const end = vacation.end < yearEnd
        ? vacation.end
        : yearEnd;

      if (start <= end) {
        total += lpWorkdaysBetween(start, end);
      }

    });

    return total;
  }

  // Urlaubsliste erstellen.

  /* ==========================================
     NOCH VERPLANBARE URLAUBSTAGE
     ========================================== */

  function lpVacationPlanningStats(year) {

    // Urlaubskonto einschließlich übertragener
    // Resttage und neuer Jahresurlaubstage.

    const balance = lpVacationBalanceForYear(year);

    // Alle im ausgewählten Jahr geplanten Tage.
    const planned = lpPlannedVacationDays(year);

    // Bereits als Urlaub genommene Tage werden
    // nicht noch einmal als Planung abgezogen.

    let alreadyTakenAndPlanned = 0;

    const yearStart = year + "-01-01";
    const yearEnd = year + "-12-31";

    for (const [date, status] of Object.entries(
      data.workOverrides
    )) {

      if (
        status === "Urlaub" &&
        date >= yearStart &&
        date <= yearEnd &&
        lpIsWorkday(date) &&
        !lpHolidayOn(date) &&
        data.vacationPlans.some(plan =>
          plan.start <= date && plan.end >= date
        )
      ) {
        alreadyTakenAndPlanned++;
      }
    }

    const stillToPlan =
      balance.remaining -
      planned +
      alreadyTakenAndPlanned;

    return {
      available: balance.available,
      taken: balance.taken,
      planned: planned,
      remaining: stillToPlan
    };
  }

  function lpVacationList() {

    const vacations = [...data.vacationPlans]
      .filter(vacation => {

        const yearStart = `${lpVacationYear}-01-01`;
        const yearEnd = `${lpVacationYear}-12-31`;

        return (
          vacation.start <= yearEnd &&
          vacation.end >= yearStart
        );

      })
      .sort((a, b) => a.start.localeCompare(b.start));

    if (!vacations.length) {
      return `
        <p class="muted">
          Für dieses Jahr hast du noch keinen Urlaub geplant.
        </p>
      `;
    }

    return vacations.map(vacation => {

      const days = lpWorkdaysBetween(
        vacation.start,
        vacation.end
      );

      const calendarDays = lpCalendarDays(
        vacation.start,
        vacation.end
      );

      return `
        <div class="item lp-vacation-item">

          <div>
            <strong>
              🌴 ${lpSafe(vacation.name || "Mein Urlaub")}
            </strong>

            <p class="mini">
              ${lpFormatDate(vacation.start)}
              bis
              ${lpFormatDate(vacation.end)}
            </p>

            <p>
              <strong>${days} Urlaubstage</strong>
              für ${calendarDays} Kalendertage
            </p>
          </div>

          <button
            type="button"
            class="secondary"
            data-lp-action="delete-vacation"
            data-lp-id="${lpSafe(vacation.id)}">
            Entfernen
          </button>

        </div>
      `;

    }).join("");
  }

  // Hauptansicht des Urlaubsplaners.

  function lpRenderVacationPlanner() {

    const planned = lpPlannedVacationDays(
      lpVacationYear
    );

    const yearOptions = [
      new Date().getFullYear(),
      new Date().getFullYear() + 1,
      new Date().getFullYear() + 2
    ].map(year => `
      <option
        value="${year}"
        ${year === lpVacationYear ? "selected" : ""}>
        ${year}
      </option>
    `).join("");

    const stateOptions = LP_BUNDESLAENDER.map(state => `
      <option
        value="${lpSafe(state)}"
        ${state === data.holidayState ? "selected" : ""}>
        ${lpSafe(state)}
      </option>
    `).join("");

    return `
      <div class="grid lp-vacation-grid">

        <article class="card wide">

          <h2>🌴 Mein Urlaubsplaner</h2>

          <p class="muted">
            Plane deinen Urlaub clever und nutze
            Wochenenden und Feiertage optimal aus.
          </p>

          <div class="lp-vacation-settings">

            <div class="field">
              <label for="lp-vacation-state">
                🗺️ Bundesland
              </label>

              <select id="lp-vacation-state">
                ${stateOptions}
              </select>
            </div>

            <div class="field">
              <label for="lp-vacation-year">
                📅 Jahr
              </label>

              <select id="lp-vacation-year">
                ${yearOptions}
              </select>
            </div>

          </div>

          <div class="lp-vacation-stats">

            <div class="lp-vacation-stat">
              <span>Geplante Urlaubstage</span>
              <strong>${planned}</strong>
              <small>Arbeitstage im Jahr ${lpVacationYear}</small>
            </div>

            <div class="lp-vacation-stat">
              <span>Bundesland</span>
              <strong class="lp-state-name">
                ${lpSafe(data.holidayState)}
              </strong>
              <small>Feiertage werden berücksichtigt</small>
            </div>

          </div>

          <p class="muted">
            Hinweis: Deine Urlaubsplanung ist zunächst
            getrennt vom Urlaubskonto unter „Arbeit“.
            So werden keine Tage doppelt abgezogen.
          </p>

          ${
            data.holidayState === "Bayern"
              ? `
                <p class="mini">
                  Bayern: Mariä Himmelfahrt gilt nur in
                  bestimmten Gemeinden. Das Augsburger
                  Friedensfest gilt nur in Augsburg.
                  Diese regionalen Sonderfälle werden
                  vorerst nicht automatisch abgezogen.
                </p>
              `
              : ""
          }

        </article>

        <article class="card wide">

          <h2>✈️ Neuen Urlaub planen</h2>

          <form id="lp-vacation-form">

            <div class="lp-vacation-settings">

              <div class="field">
                <label for="lp-vacation-start">
                  Von
                </label>

                <input
                  type="date"
                  id="lp-vacation-start"
                  name="start"
                  required>
              </div>

              <div class="field">
                <label for="lp-vacation-end">
                  Bis
                </label>

                <input
                  type="date"
                  id="lp-vacation-end"
                  name="end"
                  required>
              </div>

            </div>

            <div class="field">
              <label for="lp-vacation-name">
                Name oder Reiseziel
              </label>

              <input
                type="text"
                id="lp-vacation-name"
                name="name"
                maxlength="100"
                placeholder="z. B. Sommerurlaub in Japan">
            </div>

            <button type="submit">
              ♡ Urlaub einplanen
            </button>

          </form>

        </article>

        <article class="card wide">

          <h2>📋 Meine Urlaubsplanung</h2>

          <div class="stack">
            ${lpVacationList()}
          </div>

        </article>

      </div>
    `;
  }

  // Formular für neue Urlaubsplanung.

  document.addEventListener("submit", function (event) {

    if (event.target.id !== "lp-vacation-form") {
      return;
    }

    event.preventDefault();

    const form = new FormData(event.target);

    const start = String(form.get("start") || "");
    const end = String(form.get("end") || "");
    const name = String(form.get("name") || "").trim();

    if (!start || !end) {
      alert("Bitte Start- und Enddatum auswählen.");
      return;
    }

    if (end < start) {
      alert("Das Enddatum muss nach dem Startdatum liegen.");
      return;
    }

    // Verhindert doppelt geplante Urlaubszeiträume.

    const overlap = data.vacationPlans.some(vacation =>
      start <= vacation.end &&
      end >= vacation.start
    );

    if (overlap) {
      alert(
        "Dieser Zeitraum überschneidet sich mit einem " +
        "bereits geplanten Urlaub."
      );
      return;
    }

    data.vacationPlans.push({
      id: "vacation-" +
          Date.now() + "-" +
          Math.random().toString(36).slice(2, 8),
      start: start,
      end: end,
      name: name
    });

    save();
    render();

  });

  // Geplanten Urlaub entfernen.

  document.addEventListener("click", function (event) {

    const button = event.target.closest(
      '[data-lp-action="delete-vacation"]'
    );

    if (!button) {
      return;
    }

    const vacation = data.vacationPlans.find(
      item => item.id === button.dataset.lpId
    );

    if (!vacation) {
      return;
    }

    if (!confirm(
      "Diesen geplanten Urlaub wirklich entfernen?"
    )) {
      return;
    }

    data.vacationPlans = data.vacationPlans.filter(
      item => item.id !== vacation.id
    );

    save();
    render();

  });

  // Bundesland oder Jahr wechseln.

  document.addEventListener("change", function (event) {

    if (event.target.id === "lp-vacation-state") {

      data.holidayState = event.target.value;

      save();
      render();

    }

    if (event.target.id === "lp-vacation-year") {

      lpVacationYear = Number(event.target.value);

      render();

    }

  });

  // Weitere Teile folgen hier.

  /* ==========================================
     TEIL 5 – BRÜCKENTAG-FINDER
     ========================================== */

  // Prüfen, ob ein Tag ohnehin frei ist:
  // Wochenende oder gesetzlicher Feiertag.

  function lpIsFreeDay(date) {
    return !lpIsWorkday(date) || Boolean(lpHolidayOn(date));
  }

  // Berechnet, wie viele freie Kalendertage
  // man durch den Einsatz von Urlaub erhält.

  function lpFindBridgeDays(year) {

    const yearStart = `${year}-01-01`;
    const yearEnd = `${year}-12-31`;

    const suggestions = [];
    const unique = new Set();

    // Jeden Tag des Jahres als möglichen Start prüfen.

    for (
      let start = yearStart;
      start <= yearEnd;
      start = lpAddDays(start, 1)
    ) {

      // Nur an tatsächlichen Arbeitstagen starten.

      if (lpIsFreeDay(start)) {
        continue;
      }

      // Verschiedene Urlaubslängen ausprobieren.

      for (let length = 1; length <= 16; length++) {

        const end = lpAddDays(start, length - 1);

        if (end > yearEnd) {
          break;
        }

        const vacationDays = lpWorkdaysBetween(
          start,
          end
        );

        // Höchstens 10 Urlaubstage einsetzen.

        if (vacationDays < 1 || vacationDays > 10) {
          continue;
        }

        // Angrenzende Wochenenden und Feiertage
        // vor dem Urlaub dazurechnen.

        let freeStart = start;

        while (
          freeStart > yearStart &&
          lpIsFreeDay(lpAddDays(freeStart, -1))
        ) {
          freeStart = lpAddDays(freeStart, -1);
        }

        // Angrenzende freie Tage nach dem Urlaub.

        let freeEnd = end;

        while (
          freeEnd < yearEnd &&
          lpIsFreeDay(lpAddDays(freeEnd, 1))
        ) {
          freeEnd = lpAddDays(freeEnd, 1);
        }

        const totalFreeDays = lpCalendarDays(
          freeStart,
          freeEnd
        );

        const gainedDays = totalFreeDays - vacationDays;

        // Nur interessante Kombinationen anzeigen.

        if (totalFreeDays < 5 || gainedDays < 2) {
          continue;
        }

        const key = `${freeStart}|${freeEnd}`;

        if (unique.has(key)) {
          continue;
        }

        unique.add(key);

        suggestions.push({
          start: freeStart,
          end: freeEnd,
          vacationDays: vacationDays,
          freeDays: totalFreeDays,
          gainedDays: gainedDays,
          efficiency: totalFreeDays / vacationDays
        });

      }

    }

    // Beste Kombinationen zuerst:
    // möglichst viele freie Tage pro Urlaubstag.

    suggestions.sort((a, b) => {
      return (
        b.efficiency - a.efficiency ||
        b.gainedDays - a.gainedDays ||
        a.start.localeCompare(b.start)
      );
    });

    return suggestions.slice(0, 12);
  }

  // Vorschläge als schöne Übersicht darstellen.

  function lpRenderBridgeDays() {

    const suggestions = lpFindBridgeDays(
      lpVacationYear
    );

    if (!suggestions.length) {
      return `
        <p class="muted">
          Für dieses Jahr wurden keine passenden
          Brückentage gefunden.
        </p>
      `;
    }

    return `
      <div class="lp-bridge-list">

        ${suggestions.map(suggestion => `

          <div class="lp-bridge-card">

            <div class="lp-bridge-main">

              <strong>
                ✨ ${suggestion.freeDays} Tage frei
              </strong>

              <span class="lp-bridge-highlight">
                mit nur
                ${suggestion.vacationDays}
                Urlaubstagen
              </span>

              <p class="mini">
                ${lpFormatDate(suggestion.start)}
                bis
                ${lpFormatDate(suggestion.end)}
              </p>

              <p class="muted">
                ${suggestion.gainedDays} freie Tage
                ohne Urlaubseinsatz
              </p>

            </div>

            <button
              type="button"
              data-lp-action="plan-bridge"
              data-lp-start="${suggestion.start}"
              data-lp-end="${suggestion.end}">
              🌴 Einplanen
            </button>

          </div>

        `).join("")}

      </div>
    `;
  }

  // Brückentag-Vorschlag übernehmen.

  document.addEventListener("click", function (event) {

    const button = event.target.closest(
      '[data-lp-action="plan-bridge"]'
    );

    if (!button) {
      return;
    }

    const start = button.dataset.lpStart;
    const end = button.dataset.lpEnd;

    const overlap = data.vacationPlans.some(vacation =>
      start <= vacation.end &&
      end >= vacation.start
    );

    if (overlap) {
      alert(
        "Dieser Zeitraum überschneidet sich " +
        "mit einem bereits geplanten Urlaub."
      );
      return;
    }

    const neededDays = lpWorkdaysBetween(start, end);

    if (!confirm(
      `${lpCalendarDays(start, end)} Tage frei ` +
      `mit ${neededDays} Urlaubstagen einplanen?`
    )) {
      return;
    }

    data.vacationPlans.push({
      id: "bridge-" +
          Date.now() + "-" +
          Math.random().toString(36).slice(2, 8),
      start: start,
      end: end,
      name: "Clever geplante Brückentage"
    });

    save();
    render();

  });

  // Brückentag-Finder in die Urlaubsseite einbauen.

  const lpOriginalVacationPlanner = lpRenderVacationPlanner;

  lpRenderVacationPlanner = function () {

    const originalHtml = lpOriginalVacationPlanner();

    const bridgeSection = `
      <article class="card wide">

        <h2>✨ Die besten Brückentage</h2>

        <p class="muted">
          Die Vorschläge berücksichtigen
          dein Bundesland, gesetzliche Feiertage
          und deine freien Wochenenden.
        </p>

        ${lpRenderBridgeDays()}

      </article>
    `;

   
return originalHtml.replace(
  /<\/div>\s*$/,
  bridgeSection + "</div>"
);


  };

  // Weitere Teile folgen hier.

  /* ==========================================
     TEIL 6 – JAHRESÜBERSICHT UND FERIEN
     ========================================== */

  // Gesetzliche Feiertage des ausgewählten Jahres.

  function lpRenderHolidayOverview() {

    const holidays = lpHolidays(
      lpVacationYear,
      data.holidayState
    );

    const entries = Object.entries(holidays)
      .sort((a, b) => a[0].localeCompare(b[0]));

    return `
      <div class="lp-holiday-list">

        ${entries.map(([date, name]) => {

          const weekday = lpParseDate(date)
            .toLocaleDateString("de-DE", {
              weekday: "long"
            });

          const useful = lpIsWorkday(date);

          return `
            <div class="lp-holiday-item">

              <div>
                <strong>
                  🎉 ${lpSafe(name)}
                </strong>

                <div class="mini">
                  ${lpFormatDate(date)} · ${weekday}
                </div>
              </div>

              <span class="lp-holiday-status">
                ${
                  useful
                    ? "Arbeitsfrei"
                    : "Wochenende"
                }
              </span>

            </div>
          `;

        }).join("")}

      </div>
    `;
  }

  // Hinweise zu Schulferien und Reisezeiten.
  // Keine erfundenen Ferientermine oder Flugpreise.

  function lpRenderSchoolHolidayInfo() {

    return `
      <div class="lp-school-holidays">

        <p>
          🏫 <strong>Schulferien in
          ${lpSafe(data.holidayState)}</strong>
        </p>

        <p class="muted">
          Schulferien sind häufig besonders
          gefragte Reisezeiten. Flüge und
          Unterkünfte können dann teurer sein.
          Das ist aber keine aktuelle Preisabfrage.
        </p>

        <p class="muted">
          Die genauen Ferientermine unterscheiden
          sich je nach Bundesland und Jahr.
          Prüfe sie im offiziellen Ferienkalender
          der Kultusministerkonferenz.
        </p>

        <a
          class="lp-external-link"
          href="https://www.kmk.org/service/ferien.html"
          target="_blank"
          rel="noopener noreferrer">
          📅 Offizielle Schulferien ansehen
        </a>

        <div class="lp-travel-tips">

          <div class="lp-travel-tip">
            <strong>☀️ Sommerferien</strong>
            <span>
              Oft hohe Nachfrage nach Flügen,
              Hotels und Ferienwohnungen.
            </span>
          </div>

          <div class="lp-travel-tip">
            <strong>🐣 Osterferien</strong>
            <span>
              Beliebte Reisezeit rund um Ostern.
            </span>
          </div>

          <div class="lp-travel-tip">
            <strong>🎄 Weihnachtsferien</strong>
            <span>
              Rund um Weihnachten und Neujahr
              kann die Nachfrage steigen.
            </span>
          </div>

          <div class="lp-travel-tip">
            <strong>🌿 Außerhalb der Schulferien</strong>
            <span>
              Je nach Reiseziel häufig eine
              gute Gelegenheit zum Sparen.
            </span>
          </div>

        </div>

      </div>
    `;
  }

  // Beide Bereiche in den Urlaubsplaner einfügen.

  const lpVacationPlannerWithBridges =
    lpRenderVacationPlanner;

  lpRenderVacationPlanner = function () {

    const originalHtml =
      lpVacationPlannerWithBridges();

    const extraSections = `
      <article class="card wide">

        <h2>🎉 Feiertage ${lpVacationYear}</h2>

        <p class="muted">
          Gesetzliche Feiertage für
          ${lpSafe(data.holidayState)}.
          Regionale Sonderregelungen
          können zusätzlich gelten.
        </p>

        ${lpRenderHolidayOverview()}

      </article>

      <article class="card wide">

        <h2>🏫 Schulferien & Reiseplanung</h2>

        ${lpRenderSchoolHolidayInfo()}

      </article>
    `;

    return originalHtml.replace(
      /<\/div>\s*$/,
      extraSections + "</div>"
    );

  };

  
  /* ==========================================
     SCHRITT 3 – URLAUBSÜBERSICHT PRO JAHR
     ========================================== */

  function lpRenderYearlyVacationStats() {

console.log("🌴 Urlaubsbudget wird aufgerufen");

    const stats = lpVacationPlanningStats(
      lpVacationYear
    );

    return `
      <article class="card wide">

        <h2>
          🌴 Urlaubsbudget ${lpVacationYear}
        </h2>

        <p class="muted">
          Inklusive übertragener Resturlaubstage
          und neuer Urlaubstage zum 1. Januar.
        </p>

        <div class="lp-vacation-stats">

          <div class="lp-vacation-stat">
            <span>Insgesamt verfügbar</span>
            <strong>${stats.available}</strong>
            <small>Bis Ende ${lpVacationYear}</small>
          </div>

          <div class="lp-vacation-stat">
            <span>Bereits genommen</span>
            <strong>${stats.taken}</strong>
            <small>Seit dem Stichtag</small>
          </div>

          <div class="lp-vacation-stat">
            <span>Geplant für ${lpVacationYear}</span>
            <strong>${stats.planned}</strong>
            <small>Urlaubstage ohne Feiertage</small>
          </div>

          <div class="lp-vacation-stat">
            <span>Noch verplanbar</span>
            <strong>${stats.remaining}</strong>
            <small>Nach Abzug der Planung</small>
          </div>

        </div>

        <p class="muted">
          Bereits als genommen eingetragener Urlaub,
          der auch im Urlaubsplaner steht,
          wird nicht doppelt abgezogen.
        </p>

      </article>
    `;
  }


  // Urlaubsplaner einfügen.s
// Neue Übersicht in den bestehenden


  /* ==========================================
     TEIL 7 – VERBINDUNG MIT DEM LIFEPLANER
     ========================================== */

  // Bestehende Seitenanzeige merken.
  // Alle bisherigen Bereiche bleiben erhalten.

  const lpVacationPlannerBeforeYearlyStats =
    lpRenderVacationPlanner;

  lpRenderVacationPlanner = function () {
    const originalHtml =
      lpVacationPlannerBeforeYearlyStats();

    return originalHtml.replace(
      '<div class="grid lp-vacation-grid">',
      '<div class="grid lp-vacation-grid">' +
        lpRenderYearlyVacationStats()
    );
  };

  const lpOriginalRender = render;

  render = function () {

    // Für die neuen Seiten zuerst die normale
    // Navigation und das Design aktualisieren.

    if (
      page === "birthdays" ||
      page === "vacation-planner"
    ) {

      renderHeader();
      renderNavigation();

      const content = document.getElementById("content");

      if (!content) {
        return;
      }

      if (page === "birthdays") {
        content.innerHTML = lpRenderBirthdays();
      }

      if (page === "vacation-planner") {
        content.innerHTML = lpRenderVacationPlanner();
      }

      return;
    }

    // Alle bisherigen Seiten normal anzeigen.

    lpOriginalRender();

  };

  // Geburtstage, Feiertage und Urlaub auch
  // unter den Tagesdetails im Kalender anzeigen.

  const lpOriginalRenderDayDetails = renderDayDetails;

  renderDayDetails = function (key) {

    const originalHtml = lpOriginalRenderDayDetails(key);
    const extraDetails = lpDayDetails(key);

    if (!extraDetails) {
      return originalHtml;
    }

    const extraCard = `
      <article class="card">

        <h2>💗 Besondere Tage</h2>

        <div class="lp-day-details">
          ${extraDetails}
        </div>

      </article>
    `;

    return originalHtml.replace(
      /<\/div>\s*$/,
      extraCard + "</div>"
    );

  };

  // Nach dem Start die neuen Menüpunkte anzeigen.

  render();

})(); // Ende der LifePlaner-Erweiterung
