
/* ========================================
   LIFEPLANER – EINKAUF & HAUSHALT
   ======================================== */

(function () {
  "use strict";
 

  const STORAGE_KEY = "lifeplaner_haushalt_v1";

  // Gemeinsame Haushaltsdaten
  const startDaten = {
    version: 1,

    einkaufsliste: [],

    einkaeufe: [],

    kategorien: [
      "Lebensmittel",
      "Drogerie & Hygiene",
      "Haushalt & Reinigung",
      "Getränke",
      "Sonstiges"
    ],

    budgets: {
      lebensmittel: 0,
      drogerie: 0,
      haushalt: 0
    }
  };

  // Vorhandene Daten laden oder neu anlegen
  function ladeHaushalt() {
    try {
      const gespeichert = localStorage.getItem(STORAGE_KEY);

      if (gespeichert) {
        return JSON.parse(gespeichert);
      }
    } catch (fehler) {
      console.error("Haushaltsdaten konnten nicht geladen werden:", fehler);
    }

    return structuredClone(startDaten);
  }

  let haushalt = ladeHaushalt();

  // Einkaufshistorie auch bei älteren gespeicherten Daten vorbereiten
  if (!Array.isArray(haushalt.einkaeufe)) {
    haushalt.einkaeufe = [];
  }

  // Prüfen, ob ein Produkt als gekauft markiert wurde
  function lpGekaufteProdukte() {
    return haushalt.einkaufsliste.filter(
      produkt => produkt.erledigt === true
    );
  }

  // Haushaltsdaten speichern
  function speichereHaushalt() {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(haushalt)
    );
  }

  // Für spätere Erweiterungen bereitstellen
  
document.addEventListener("change", event => {
  if (event.target.id !== "einkauf-jahresauswahl") {
    return;
  }

  sessionStorage.setItem(
    "lp_einkauf_jahr",
    event.target.value
  );

  render();
});
window.lifeplanerHaushalt = {
    daten: haushalt,
    speichern: speichereHaushalt
  };

  // Einkaufslisten-Button im Menü hinzufügen
  if (typeof pages !== "undefined" && Array.isArray(pages)) {
    if (!pages.some(eintrag => eintrag[0] === "einkaufsliste")) {
      pages.push([
        "einkaufsliste",
        "🛒",
        "Einkaufsliste"
      ]);
    }
  }
  // Menü nach dem Hinzufügen aktualisieren
  if (typeof render === "function") {
    render();
  }

  // Einkaufslisten-Seite anzeigen
  
  // Ausgaben für alle 12 Monate eines Jahres ermitteln
  
  // 🛒 Fortschritt der aktuellen Einkaufsliste berechnen
  function lpEinkaufsfortschritt() {
    const gesamt = haushalt.einkaufsliste.length;

    const erledigt = haushalt.einkaufsliste.filter(
      produkt => produkt.erledigt
    ).length;

    const offen = gesamt - erledigt;

    const prozent = gesamt > 0
      ? Math.round((erledigt / gesamt) * 100)
      : 0;

    return {
      gesamt,
      erledigt,
      offen,
      prozent
    };
  }
function lpJahresausgaben(jahr) {
    const monate = [];

    for (let monat = 0; monat < 12; monat++) {
      monate.push({
        monat: new Date(jahr, monat, 1).toLocaleDateString(
          "de-DE",
          { month: "short" }
        ),
        betrag: lpAusgabenFuerMonat(jahr, monat)
      });
    }

    return monate;
  }

  // Ausgaben für einen beliebigen Monat berechnen
  function lpAusgabenFuerMonat(jahr, monat) {
    return haushalt.einkaeufe
      .filter(einkauf => {
        const datum = new Date(einkauf.datum);

        return (
          !Number.isNaN(datum.getTime()) &&
          datum.getFullYear() === jahr &&
          datum.getMonth() === monat
        );
      })
      .reduce((summe, einkauf) => {
        const betrag = einkauf.gesamtbetrag;

        return summe + (
          typeof betrag === "number" &&
          Number.isFinite(betrag)
            ? betrag
            : 0
        );
      }, 0);
  }

  // Ausgaben des letzten Monats berechnen
  function lpVormonatsausgaben() {
    const vormonat = new Date();

    vormonat.setDate(1);
    vormonat.setMonth(vormonat.getMonth() - 1);

    return lpAusgabenFuerMonat(
      vormonat.getFullYear(),
      vormonat.getMonth()
    );
  }

  // Gesamtausgaben des aktuellen Monats berechnen
  function lpMonatsausgaben() {
    const heute = new Date();
    const monat = heute.getMonth();
    const jahr = heute.getFullYear();

    return haushalt.einkaeufe
      .filter(einkauf => {
        const datum = new Date(einkauf.datum);

        return (
          !Number.isNaN(datum.getTime()) &&
          datum.getMonth() === monat &&
          datum.getFullYear() === jahr
        );
      })
      .reduce((summe, einkauf) => {
        const betrag = einkauf.gesamtbetrag;

        // Ältere Einkäufe ohne Preis nicht mitrechnen
        return summe + (
          typeof betrag === "number" &&
          Number.isFinite(betrag)
            ? betrag
            : 0
        );
      }, 0);
  }

  // Häufig vorkommende Produkte ermitteln
  function lpHaeufigeProdukte() {
    const zaehler = {};

    haushalt.einkaufsliste.forEach(produkt => {
      const name = produkt.name.trim();
      const schluessel = name.toLocaleLowerCase("de");

      if (!schluessel) return;

      if (!zaehler[schluessel]) {
        zaehler[schluessel] = {
          name: name,
          anzahl: 0
        };
      }

      zaehler[schluessel].anzahl++;
    });

    return Object.values(zaehler)
      .sort((a, b) => b.anzahl - a.anzahl)
      .slice(0, 6);
  }

  // Passendes Symbol für ein Produkt auswählen
  function lpProduktSymbol(name) {
    const text = name.toLowerCase().trim();

    const symbole = [
      // 💪 Gym & Protein
      [["magerquark", "skyr", "joghurt", "quark", "hüttenkäse"], "🥣"],
      [["frischkäse", "mozzarella", "feta", "harzer"], "🧀"],
      [["chicken", "pute", "hähnchen", "hühnchen"], "🍗"],
      [["rinderhack", "hackfleisch", "rind"], "🥩"],
      [["thunfisch", "lachs", "garnelen"], "🐟"],
      [["sojahack", "tofu", "tempeh"], "🌱"],
      [["proteinpulver", "protein pudding", "proteinriegel"], "💪"],

      // 🍚 Kohlenhydrate
      [["haferflocken", "dinkelflocken", "müsli"], "🥣"],
      [["reis", "quinoa", "couscous", "bulgur"], "🍚"],
      [["süßkartoffel"], "🍠"],
      [["wrap", "reiswaffel", "maiswaffel"], "🌯"],

      // 🥦 Gemüse
      [["brokkoli", "blumenkohl", "tk gemüse"], "🥦"],
      [["spinat", "rucola", "feldsalat"], "🥬"],
      [["paprika"], "🫑"],
      [["zwiebel", "knoblauch"], "🧅"],
      [["champignon", "pilze"], "🍄"],
      [["avocado"], "🥑"],
      [["zucchini"], "🥒"],
      [["kimchi", "sauerkraut", "rotkohl", "weißkohl"], "🥬"],
      [["linse", "kichererbse", "kidneybohne", "edamame"], "🫘"],

      // 🍓 Obst
      [["himbeere", "erdbeere", "beerenmix"], "🍓"],
      [["blaubeere", "heidelbeere"], "🫐"],
      [["mango"], "🥭"],
      [["kiwi"], "🥝"],
      [["orange"], "🍊"],
      [["zitrone"], "🍋"],
      [["ananas"], "🍍"],
      [["traube"], "🍇"],
      [["birne"], "🍐"],

      // 🥜 Fette & Snacks
      [["mandel", "walnuss", "cashew", "pistazie", "nussmus"], "🥜"],
      [["erdnussbutter"], "🥜"],
      [["chia", "leinsamen", "kürbiskerne", "sonnenblumenkerne"], "🌻"],
      [["olivenöl"], "🫒"],
      [["hummus"], "🫘"],

      // 🥛 Getränke & Sonstiges
      [["hafermilch", "sojamilch", "kokosmilch"], "🥛"],
      [["sojasauce", "sriracha", "senf"], "🧂"],
      [["zimt", "ingwer"], "🫚"],

      [["milch"], "🥛"],
      [["brot", "brötchen", "toast"], "🍞"],
      [["ei", "eier"], "🥚"],
      [["käse"], "🧀"],
      [["butter"], "🧈"],
      [["apfel", "äpfel"], "🍎"],
      [["banane"], "🍌"],
      [["erdbeere"], "🍓"],
      [["tomate"], "🍅"],
      [["kartoffel"], "🥔"],
      [["karotte", "möhre"], "🥕"],
      [["salat"], "🥬"],
      [["gurke"], "🥒"],
      [["pizza"], "🍕"],
      [["nudel", "spaghetti", "pasta"], "🍝"],
      [["reis"], "🍚"],
      [["fleisch", "steak"], "🥩"],
      [["hähnchen", "hühnchen"], "🍗"],
      [["fisch", "lachs"], "🐟"],
      [["wasser"], "💧"],
      [["saft"], "🧃"],
      [["kaffee"], "☕"],
      [["tee"], "🍵"],
      [["schokolade", "schoki"], "🍫"],
      [["keks"], "🍪"],
      [["chips"], "🥔"],
      [["zahnpasta", "zahnbürste"], "🪥"],
      [["shampoo", "duschgel", "seife"], "🧴"],
      [["toilettenpapier", "klopapier"], "🧻"],
      [["waschmittel", "spülmittel", "reiniger"], "🧼"]
    ];

    for (const [begriffe, symbol] of symbole) {
      if (begriffe.some(begriff => text.includes(begriff))) {
        return symbol;
      }
    }

    return "🛍️";
  }

  // Vorschläge für die intelligente Produktsuche
  const lpProduktVorschlaege = [
    "Milch", "Milchreis", "Butter", "Käse", "Joghurt",
    "Quark", "Sahne", "Eier", "Brot", "Brötchen",
    "Toast", "Mehl", "Zucker", "Reis", "Nudeln",
    "Spaghetti", "Kartoffeln", "Tomaten", "Gurken",
    "Karotten", "Salat", "Paprika", "Zwiebeln",
    "Knoblauch", "Äpfel", "Bananen", "Erdbeeren",
    "Trauben", "Orangen", "Zitronen", "Wasser",
    "Apfelsaft", "Orangensaft", "Kaffee", "Tee",
    "Pizza", "Hähnchen", "Hackfleisch", "Lachs",
    "Schokolade", "Kekse", "Chips", "Müsli",
    "Haferflocken", "Honig", "Marmelade",
    "Toilettenpapier", "Zahnpasta", "Shampoo",
    "Duschgel", "Waschmittel", "Spülmittel",
    "Magerquark",
    "Chicken",
    "Hähnchenbrust",
    "TK Himbeeren",
    "TK Blaubeeren",
    "TK Gemüse",
    "Bananen",
    "Frischkäse",
    "Kartoffeln",
    "Sojahack",
    "Sauerkraut",
    "Kimchi",
    "Haferflocken",
    "Toastbrot",
    "Skyr",
    "Protein Pudding",
    "Hüttenkäse",
    "Brokkoli",
    "Erdnussbutter",

    // 💪 Protein & Muskelaufbau
    "Putenbrust",
    "Rinderhack",
    "Thunfisch",
    "Garnelen",
    "Räucherlachs",
    "Tofu",
    "Räuchertofu",
    "Tempeh",
    "Linsen",
    "Kichererbsen",
    "Kidneybohnen",
    "Edamame",
    "Mozzarella",
    "Feta",
    "Harzer Käse",
    "Griechischer Joghurt",
    "Naturjoghurt",
    "Proteinpulver",
    "Proteinriegel",

    // 🍚 Kohlenhydrate & Meal Prep
    "Basmatireis",
    "Vollkornreis",
    "Vollkornnudeln",
    "Couscous",
    "Bulgur",
    "Quinoa",
    "Süßkartoffeln",
    "Vollkornbrot",
    "Reiswaffeln",
    "Maiswaffeln",
    "Wraps",
    "Vollkornwraps",
    "Dinkelflocken",

    // 🥦 Gemüse
    "Zucchini",
    "Spinat",
    "TK Spinat",
    "Blumenkohl",
    "TK Brokkoli",
    "Grüne Bohnen",
    "Champignons",
    "Avocado",
    "Rote Bete",
    "Rotkohl",
    "Weißkohl",
    "Frühlingszwiebeln",
    "Rucola",
    "Feldsalat",

    // 🫐 Obst & Beeren
    "TK Erdbeeren",
    "TK Beerenmix",
    "Heidelbeeren",
    "Himbeeren",
    "Kiwi",
    "Mango",
    "TK Mango",
    "Ananas",
    "Birnen",
    "Granatapfel",

    // 🥜 Gesunde Fette & Snacks
    "Mandeln",
    "Walnüsse",
    "Cashewkerne",
    "Pistazien",
    "Chiasamen",
    "Leinsamen",
    "Kürbiskerne",
    "Sonnenblumenkerne",
    "Olivenöl",
    "Nussmus",
    "Hummus",

    // 🥗 Sonstiges
    "Passierte Tomaten",
    "Tomatenmark",
    "Hafermilch",
    "Sojamilch",
    "Kokosmilch",
    "Senf",
    "Sojasauce",
    "Sriracha",
    "Zimt",
    "Ingwer",
    "Zitronensaft"

  ];

  const lpEinkaufOriginalRender = render;

  // Produkt zur Einkaufsliste hinzufügen
  function lpProduktHinzufuegen() {
    const produktFeld = document.getElementById("einkauf-produkt");
    const mengenFeld = document.getElementById("einkauf-menge");
    const kategorieFeld = document.getElementById("einkauf-kategorie");

    if (!produktFeld || !mengenFeld) return;

    const produkt = produktFeld.value.trim();
    const menge = mengenFeld.value.trim();
    const kategorie = kategorieFeld.value;

    if (!produkt) {
      
      return;
    }

    
haushalt.einkaufsliste.push({
  id: (typeof crypto.randomUUID === "function"
  ? (Date.now().toString(36) + Math.random().toString(36).slice(2))
  : Date.now().toString(36) + Math.random().toString(36).slice(2)),
  name: produkt,
  menge: menge || "1 Stück",
  kategorie: kategorie,
  erledigt: false
});


    speichereHaushalt();
    render();
  }
// 📱 iPhone: Produkt direkt beim Berühren hinzufügen
document.addEventListener("touchstart", function (event) {
  const button = event.target.closest(
    '[data-action="einkauf-hinzufuegen"]'
  );

  if (!button) return;

  event.preventDefault();
  event.stopImmediatePropagation();

  lpProduktHinzufuegen();
}, { capture: true, passive: false });
  // Klick auf den Hinzufügen-Button erkennen
document.addEventListener("click", function (event) {
  const button = event.target.closest(
    event.target.closest('[data-action="einkauf-hinzufuegen"]')
    
  );

  if (!button) return;

  lpProduktHinzufuegen();
});
// ❌ Suchfeld leeren
document.addEventListener("input", function (event) {
  if (event.target.id !== "einkauf-produkt") return;

  const button = document.querySelector(".einkauf-suche-leeren");
  if (button) button.hidden = !event.target.value;
});

document.addEventListener("click", function (event) {
  if (!event.target.closest('[data-action="einkauf-suche-leeren"]')) return;

  const feld = document.getElementById("einkauf-produkt");
  if (!feld) return;

  feld.value = "";
  feld.dispatchEvent(new Event("input", { bubbles: true }));
  feld.focus();
});
  // 🔎 Produktvorschläge während des Tippens anzeigen
  document.addEventListener("input", function (event) {
    if (event.target.id !== "einkauf-produkt") return;

    const suchtext = event.target.value.trim().toLocaleLowerCase("de");
    const bereich = document.getElementById("einkauf-vorschlaege");

    if (!bereich) return;

    if (!suchtext) {
      bereich.innerHTML = "";
      return;
    }

    const treffer = [...new Set(lpProduktVorschlaege)]
      .filter(name =>
        name.toLocaleLowerCase("de").includes(suchtext)
      )
      .slice(0, 6);

    bereich.innerHTML = treffer.map(name => `
      <button
        type="button"
        class="einkauf-vorschlag"
        data-action="einkauf-vorschlag"
        data-produkt="${escapeHTML(name)}"
      >
        <span>${lpProduktSymbol(name)}</span>
        <span>${escapeHTML(name)}</span>
      </button>
    `).join("");
  });

  // 🔎 Ausgewählten Vorschlag ins Produktfeld übernehmen
// 🛒 Suchvorschlag direkt zur Einkaufsliste hinzufügen
document.addEventListener("click", function (event) {
  const button = event.target.closest(
    '[data-action="einkauf-vorschlag"]'
  );

  if (!button) return;

  const produktFeld = document.getElementById("einkauf-produkt");
  const bereich = document.getElementById("einkauf-vorschlaege");

  if (!produktFeld) return;

  produktFeld.value = button.dataset.produkt;

  if (bereich) bereich.innerHTML = "";

  lpProduktHinzufuegen();
});


  // Produkt mit Enter hinzufügen
  document.addEventListener("keydown", function (event) {
    if (event.key !== "Enter") return;

    if (event.target.id !== "einkauf-produkt") return;

    event.preventDefault();
    lpProduktHinzufuegen();
  });


  // Produkt aus der Einkaufsliste löschen
  document.addEventListener("click", function (event) {
    const button = event.target.closest(
      '[data-action="einkauf-loeschen"]'
    );

    if (!button) return;

    const produkt = haushalt.einkaufsliste.find(
      eintrag => eintrag.id === button.dataset.id
    );

    if (!produkt) return;

    const bestaetigt = confirm(
      `Möchtest du "${produkt.name}" wirklich löschen? 🗑️`
    );

    if (!bestaetigt) return;

    haushalt.einkaufsliste = haushalt.einkaufsliste.filter(
      eintrag => eintrag.id !== produkt.id
    );

    speichereHaushalt();
    render();
  });

  // Produkte über die Schnellauswahl hinzufügen
  document.addEventListener("click", function (event) {
    const button = event.target.closest(
      '[data-action="einkauf-schnell"]'
    );

    if (!button) return;

    const produktName = button.dataset.produkt;

    if (!produktName) return;

    // Bereits vorhandenes, offenes Produkt nicht doppelt hinzufügen
    const schonVorhanden = haushalt.einkaufsliste.some(
      produkt =>
        produkt.name.toLowerCase() === produktName.toLowerCase() &&
        !produkt.erledigt
    );

    if (schonVorhanden) {
      alert(`${produktName} steht bereits auf deiner Einkaufsliste. 💗`);
      return;
    }

    // Erledigtes Produkt wieder auf die offene Liste setzen
    const erledigtesProdukt = haushalt.einkaufsliste.find(
      produkt =>
        produkt.name.toLocaleLowerCase("de") ===
          produktName.toLocaleLowerCase("de") &&
        produkt.erledigt
    );

    if (erledigtesProdukt) {
      erledigtesProdukt.erledigt = false;
      speichereHaushalt();
      render();
      return;
    }

    const kategorie = produktName === "Wasser"
      ? "Getränke"
      : "Lebensmittel";

    haushalt.einkaufsliste.push({
      id: (Date.now().toString(36) + Math.random().toString(36).slice(2)),
      name: produktName,
      menge: "1 Stück",
      kategorie: kategorie,
      erledigt: false
    });

    speichereHaushalt();
    render();
  });

  // Abgehakte Produkte in die Einkaufshistorie übernehmen
  document.addEventListener("click", function (event) {
    const button = event.target.closest(
      '[data-action="einkauf-abschliessen"]'
    );

    if (!button) return;

    const gekaufteProdukte = lpGekaufteProdukte();

    if (gekaufteProdukte.length === 0) {
      alert("Hake zuerst die gekauften Produkte ab. 🛒");
      return;
    }

    const bestaetigt = confirm(
      `Möchtest du ${gekaufteProdukte.length} gekaufte Produkte ` +
      `in die Einkaufshistorie übernehmen?`
    );

    if (!bestaetigt) return;

    // Gesamtbetrag des Einkaufs erfassen
    const betragEingabe = prompt(
      "💶 Wie viel habt ihr für diesen Einkauf bezahlt?\n" +
      "Bitte den Gesamtbetrag in Euro eingeben, z. B. 24,50:"
    );

    // Abbrechen bedeutet: Einkauf noch nicht abschließen
    if (betragEingabe === null) return;

    const betragText = betragEingabe.trim().replace(",", ".");

    if (
      betragText === "" ||
      !/^\d+(\.\d{1,2})?$/.test(betragText)
    ) {
      alert("Bitte gib einen gültigen Betrag ein, z. B. 24,50 €.");
      return;
    }

    const gesamtbetrag = Math.round(
      Number(betragText) * 100
    ) / 100;

    const einkauf = {
      id: (Date.now().toString(36) + Math.random().toString(36).slice(2)),
      datum: new Date().toISOString(),
      produkte: gekaufteProdukte.map(produkt => ({ ...produkt })),
            gesamtbetrag: gesamtbetrag
    };

    haushalt.einkaeufe.push(einkauf);

    // Nur gekaufte Produkte aus der aktiven Liste entfernen
    haushalt.einkaufsliste = haushalt.einkaufsliste.filter(
      produkt => !produkt.erledigt
    );

    speichereHaushalt();
    render();

    alert("Dein Einkauf wurde gespeichert! 💗");
  });

  // 🧾 Einkaufshistorie über Monatsvergleich öffnen
  document.addEventListener("click", function (event) {
    const button = event.target.closest(
      '[data-action="einkauf-historie-oeffnen"]'
    );

    if (!button) return;

    
    const heute = new Date();

    const monat = heute.getMonth();
    const jahr = heute.getFullYear();

    const einkaeufe = haushalt.einkaeufe
      .filter(einkauf => {
        const datum = new Date(einkauf.datum);

        return (
          datum.getMonth() === monat &&
          datum.getFullYear() === jahr
        );
      })
      .slice()
      .reverse();

    const fenster = window.open("", "_blank");

    if (!fenster) {
      alert("Bitte erlaube Pop-ups, um die Einkaufshistorie zu öffnen. 💗");
      return;
    }

    const titel = heute.toLocaleDateString("de-DE", {
      month: "long",
      year: "numeric"
    });

    fenster.document.title = "🧾 Einkaufshistorie";

    const ueberschrift = fenster.document.createElement("h1");
    ueberschrift.textContent = "🧾 Einkaufshistorie – " + titel;
    fenster.document.body.appendChild(ueberschrift);
    // 📅 Monat und Jahr in der Historie auswählen
    const monatsAuswahl = fenster.document.createElement("input");

    monatsAuswahl.type = "month";
    monatsAuswahl.value =
      jahr + "-" + String(monat + 1).padStart(2, "0");

    monatsAuswahl.style.cssText =
      "padding:12px;font-size:16px;margin:12px 0;border:1px solid #ccc;border-radius:10px;";

    fenster.document.body.appendChild(monatsAuswahl);

    
    monatsAuswahl.addEventListener("change", function () {
      const [neuesJahr, neuerMonat] = this.value
        .split("-")
        .map(Number);

      const ausgewaehlteEinkaeufe = haushalt.einkaeufe
        .filter(einkauf => {
          const datum = new Date(einkauf.datum);

          return (
            datum.getMonth() === neuerMonat - 1 &&
            datum.getFullYear() === neuesJahr
          );
        })
        .slice()
        .reverse();

      fenster.document.querySelectorAll(
        ".historie-eintrag"
      ).forEach(element => element.remove());

      if (ausgewaehlteEinkaeufe.length === 0) {
        const hinweis = fenster.document.createElement("p");

        hinweis.className = "historie-eintrag";
        hinweis.textContent =
          "🛒 Für diesen Monat sind noch keine Einkäufe gespeichert.";

        hinweis.style.cssText =
          "padding:20px;margin-top:16px;background:#fff4f5;" +
          "border:1px solid #e7c4c8;border-radius:12px;" +
          "color:#25252b;";

        fenster.document.body.appendChild(hinweis);
      }

      ausgewaehlteEinkaeufe.forEach(einkauf => {
        const bereich = fenster.document.createElement("div");
        bereich.className = "historie-eintrag";
        bereich.style.cssText =
          "padding:16px;margin:12px 0;border:1px solid #ddd;border-radius:12px;";

        const datum = fenster.document.createElement("h3");
        datum.textContent = new Date(einkauf.datum)
          .toLocaleDateString("de-DE");

        const produkte = fenster.document.createElement("p");
        produkte.textContent = einkauf.produkte
          .map(produkt => produkt.name)
          .join(", ");

        const betrag = fenster.document.createElement("strong");
        betrag.textContent =
          typeof einkauf.gesamtbetrag === "number"
            ? einkauf.gesamtbetrag.toLocaleString("de-DE", {
                style: "currency",
                currency: "EUR"
              })
            : "Betrag nicht erfasst";

        
const bearbeitenButton = fenster.document.createElement("button");

bearbeitenButton.type = "button";
bearbeitenButton.textContent = "✏️ Betrag bearbeiten";

const betragEingabe = fenster.document.createElement("input");

betragEingabe.type = "text";
betragEingabe.value =
  typeof einkauf.gesamtbetrag === "number"
    ? einkauf.gesamtbetrag.toFixed(2).replace(".", ",")
    : "";

betragEingabe.placeholder = "Betrag in Euro";
const speichernButton = fenster.document.createElement("button");

speichernButton.type = "button";
speichernButton.textContent = "💾 Betrag speichern";

speichernButton.style.cssText =
  "display:none;margin-top:8px;padding:10px 14px;" +
  "border:1px solid #c94b5b;border-radius:10px;" +
  "background:#c94b5b;color:white;cursor:pointer;";

betragEingabe.style.cssText =
  "display:none;margin-top:12px;padding:10px;" +
  "width:100%;box-sizing:border-box;" +
  "border:1px solid #aaa;border-radius:10px;";


bearbeitenButton.addEventListener("click", function () {
  betragEingabe.style.display = "block";
  speichernButton.style.display = "block";
  betragEingabe.focus();
});


betragEingabe.addEventListener("keydown", function (event) {
  if (event.key !== "Enter") return;

  const eingabe = betragEingabe.value.trim().replace(",", ".");

  if (eingabe === "" || !/^\d+(\.\d{1,2})?$/.test(eingabe)) {
    betragEingabe.style.borderColor = "red";
    return;
  }

  einkauf.gesamtbetrag = Math.round(Number(eingabe) * 100) / 100;

  speichereHaushalt();

  betrag.textContent = einkauf.gesamtbetrag.toLocaleString("de-DE", {
    style: "currency",
    currency: "EUR"
  });

speichernButton.addEventListener("click", function () {
  betragEingabe.dispatchEvent(
    new fenster.KeyboardEvent("keydown", {
      key: "Enter",
      bubbles: true
    })
  );
});

  betragEingabe.style.display = "none";
  
speichernButton.style.display = "none";

  betragEingabe.style.borderColor = "#aaa";
  bearbeitenButton.textContent = "✅ Betrag gespeichert!";
});



bearbeitenButton.style.cssText =
  "display:block;margin-top:12px;padding:10px 14px;" +
  "border:1px solid #c94b5b;border-radius:10px;" +
  "background:#fff8f8;color:#25252b;cursor:pointer;";



bereich.append(
  datum,
  produkte,
  betrag,
  bearbeitenButton,
  betragEingabe,
  speichernButton
);


        fenster.document.body.appendChild(bereich);
      });
    });



    if (einkaeufe.length === 0) {
      const hinweis = fenster.document.createElement("p");
      hinweis.className = "historie-eintrag";
      hinweis.textContent = "Noch keine Einkäufe in diesem Monat.";
      fenster.document.body.appendChild(hinweis);
    }

    einkaeufe.forEach(einkauf => {
      const bereich = fenster.document.createElement("div");
      bereich.className = "historie-eintrag";
      bereich.style.cssText =
        "padding:16px;margin:12px 0;border:1px solid #ddd;border-radius:12px;";

      const datum = fenster.document.createElement("h3");
      datum.textContent = new Date(einkauf.datum)
        .toLocaleDateString("de-DE");

      const produkte = fenster.document.createElement("p");
      produkte.textContent = einkauf.produkte
        .map(produkt => produkt.name)
        .join(", ");

      const betrag = fenster.document.createElement("strong");
      betrag.textContent =
        typeof einkauf.gesamtbetrag === "number"
          ? einkauf.gesamtbetrag.toLocaleString("de-DE", {
              style: "currency",
              currency: "EUR"
            })
          : "Betrag nicht erfasst";

      
const bearbeitenButton = fenster.document.createElement("button");

bearbeitenButton.type = "button";
bearbeitenButton.textContent = "✏️ Betrag bearbeiten";

const betragEingabe = fenster.document.createElement("input");

betragEingabe.type = "text";
betragEingabe.value =
  typeof einkauf.gesamtbetrag === "number"
    ? einkauf.gesamtbetrag.toFixed(2).replace(".", ",")
    : "";

betragEingabe.placeholder = "Betrag in Euro";

const speichernButton = fenster.document.createElement("button");

speichernButton.type = "button";
speichernButton.textContent = "💾 Betrag speichern";

speichernButton.style.cssText =
  "display:none;margin-top:8px;padding:10px 14px;" +
  "border:1px solid #c94b5b;border-radius:10px;" +
  "background:#c94b5b;color:white;cursor:pointer;";

betragEingabe.style.cssText =
  "display:none;margin-top:12px;padding:10px;" +
  "width:100%;box-sizing:border-box;" +
  "border:1px solid #aaa;border-radius:10px;";

bearbeitenButton.addEventListener("click", function () {
  betragEingabe.style.display = "block";
  speichernButton.style.display = "block";
  betragEingabe.focus();
});

betragEingabe.addEventListener("keydown", function (event) {
    
speichernButton.addEventListener("click", function () {
  betragEingabe.dispatchEvent(
    new fenster.KeyboardEvent("keydown", {
      key: "Enter",
      bubbles: true
    })
  );
});

  if (event.key !== "Enter") return;

  const eingabe = betragEingabe.value.trim().replace(",", ".");

  if (eingabe === "" || !/^\d+(\.\d{1,2})?$/.test(eingabe)) {
    betragEingabe.style.borderColor = "red";
    return;
  }

  einkauf.gesamtbetrag = Math.round(Number(eingabe) * 100) / 100;

  speichereHaushalt();

  betrag.textContent = einkauf.gesamtbetrag.toLocaleString("de-DE", {
    style: "currency",
    currency: "EUR"
  });

  betragEingabe.style.display = "none";
speichernButton.style.display = "none";
  betragEingabe.style.borderColor = "#aaa";
  bearbeitenButton.textContent = "✅ Betrag gespeichert!";
});


bearbeitenButton.style.cssText =
  "display:block;margin-top:12px;padding:10px 14px;" +
  "border:1px solid #c94b5b;border-radius:10px;" +
  "background:#fff8f8;color:#25252b;cursor:pointer;";

bearbeitenButton.style.position = "relative";
bearbeitenButton.style.zIndex = "10";
bearbeitenButton.style.pointerEvents = "auto";


bereich.append(
  datum,
  produkte,
  betrag,
  bearbeitenButton,
  betragEingabe,
  betragEingabe,
speichernButton
);


      fenster.document.body.appendChild(bereich);
    });

  });

/* 💾 Speichern-Button nur bei Budgetänderung anzeigen */
document.addEventListener("input", function (event) {
  if (event.target.id !== "einkauf-monatsbudget") return;

  const feld = event.target;
  const button = document.querySelector(
    '[data-action="einkauf-budget-speichern"]'
  );

  if (!button) return;

  const aktuellerWert = Number(feld.value.replace(",", "."));
  const gespeicherterWert = Number(haushalt.budgets?.gesamt) || 0;

  button.style.display =
    feld.value.trim() !== "" &&
    Number.isFinite(aktuellerWert) &&
    aktuellerWert !== gespeicherterWert
      ? ""
      : "none";
});

  // Gemeinsames Monatsbudget speichern
  document.addEventListener("click", function (event) {
    const button = event.target.closest(
      '[data-action="einkauf-budget-speichern"]'
    );

    if (!button) return;

    const budgetFeld = document.getElementById(
      "einkauf-monatsbudget"
    );

    if (!budgetFeld) return;

    const eingabe = budgetFeld.value.trim().replace(",", ".");
    const budget = Number(eingabe);

    if (
      eingabe === "" ||
      !Number.isFinite(budget) ||
      budget < 0
    ) {
      alert("Bitte gib ein gültiges Budget ein. 💗");
      return;
    }

    if (!haushalt.budgets) {
      haushalt.budgets = {};
    }

    haushalt.budgets.gesamt = Math.round(budget * 100) / 100;

    speichereHaushalt();
    render();

    alert("Euer Monatsbudget wurde gespeichert! 💗");
  });

  // Produkte bequem mit Enter hinzufügen
  document.addEventListener("keydown", function (event) {
    if (event.key !== "Enter") return;

    const feld = event.target;

    if (
      feld.id !== "einkauf-produkt" &&
      feld.id !== "einkauf-menge"
    ) {
      return;
    }

    event.preventDefault();
    lpProduktHinzufuegen();
  });
// 🛒 Langes Drücken auf Produktkarten erkennen
let einkaufLongPressTimer;
let einkaufLongPressAktiv = false;

document.addEventListener("pointerdown", function (event) {
  const karte = event.target.closest(".einkauf-produkt-karte");
if (einkaufLongPressAktiv) {
  einkaufLongPressAktiv = false;
  return;
}
  if (!karte || event.target.closest("button")) return;

  einkaufLongPressAktiv = false;

  clearTimeout(einkaufLongPressTimer);

  einkaufLongPressTimer = setTimeout(() => {
    einkaufLongPressAktiv = true;

    // ✏️ Menge beim langen Drücken bearbeiten
const produkt = haushalt.einkaufsliste.find(
  eintrag => eintrag.id === karte.dataset.id
);

if (!produkt) return;
// 🩸 Itachi-Mengenmenü
const bisherigeMenge = parseInt(produkt.menge, 10) || 1;

const overlay = document.createElement("div");
overlay.className = "einkauf-menge-overlay";

const dialog = document.createElement("div");
dialog.className = "einkauf-menge-dialog";

let menge = bisherigeMenge;

const titel = document.createElement("h3");
titel.textContent = `${lpProduktSymbol(produkt.name)} ${produkt.name}`;

const beschreibung = document.createElement("p");
beschreibung.textContent = "Wie viele Stück brauchst du?";

const steuerung = document.createElement("div");
steuerung.className = "einkauf-menge-steuerung";

const minus = document.createElement("button");
minus.type = "button";
minus.textContent = "−";

const anzeige = document.createElement("strong");
anzeige.textContent = menge;

const plus = document.createElement("button");
plus.type = "button";
plus.textContent = "+";

const mengenSchritt = () => einheit.value === "g" ? 100 : 1;

minus.addEventListener("click", () => {
  menge = Math.max(1, menge - mengenSchritt());
  anzeige.textContent = menge;
});

plus.addEventListener("click", () => {
  menge += mengenSchritt();
  anzeige.textContent = menge;
});

steuerung.append(minus, anzeige, plus);
// 🛒 Einheit für die Menge auswählen
const einheit = document.createElement("select");
einheit.className = "einkauf-menge-einheit";

const einheiten = [
  "Stück",
  "Packungen",
  "Flaschen",
  "Liter",
  "kg",
  "g"
];

const bisherigeEinheit = produkt.menge
  .replace(/^\d+\s*/, "")
  .trim();

einheiten.forEach(wert => {
  const option = document.createElement("option");
  option.value = wert;
  option.textContent = wert;
  einheit.appendChild(option);
});

einheit.value = einheiten.includes(bisherigeEinheit)
  ? bisherigeEinheit
  : "Stück";
  // 🩸 Bei Gramm Menge direkt eingeben
const grammEingabe = document.createElement("input");
grammEingabe.type = "number";
grammEingabe.min = "1";
grammEingabe.step = "1";
grammEingabe.inputMode = "numeric";
grammEingabe.placeholder = "z. B. 900";
grammEingabe.className = "einkauf-gramm-eingabe";

function aktualisiereGrammEingabe() {
  const istGramm = einheit.value === "g";
  grammEingabe.style.display = istGramm ? "block" : "none";

  if (istGramm) {
    grammEingabe.value = menge;
  }
}

einheit.addEventListener("change", () => {
  if (einheit.value === "g" && menge === 1) {
    menge = 100;
    anzeige.textContent = menge;
  }
  aktualisiereGrammEingabe();
});

grammEingabe.addEventListener("input", () => {
  const wert = parseInt(grammEingabe.value, 10);
  if (Number.isFinite(wert) && wert >= 1) {
    menge = wert;
    anzeige.textContent = menge;if (einheit.value === "g") grammEingabe.value = menge;
  }
});

aktualisiereGrammEingabe();
const speichern = document.createElement("button");
speichern.type = "button";
speichern.className = "einkauf-menge-speichern";
speichern.textContent = "Menge speichern";

speichern.addEventListener("click", () => {
  produkt.menge = `${menge} ${einheit.value}`;
  speichereHaushalt();
  overlay.remove();
  render();
});

const abbrechen = document.createElement("button");
abbrechen.type = "button";
abbrechen.className = "einkauf-menge-abbrechen";
abbrechen.textContent = "Abbrechen";

abbrechen.addEventListener("click", () => {
  overlay.remove();
});

dialog.append(titel, beschreibung, steuerung, einheit, grammEingabe, speichern, abbrechen);

overlay.appendChild(dialog);
document.body.appendChild(overlay);
  }, 300);
});

["pointerup", "pointercancel", "pointermove"].forEach(typ => {
  document.addEventListener(typ, function () {
    clearTimeout(einkaufLongPressTimer);
  });
});
  // Produkte mit einem Klick abhaken
  document.addEventListener("click", function (event) {
    
const button = event.target.closest(
  '[data-action="einkauf-erledigen"]'
);

const karte = event.target.closest(".einkauf-produkt-karte");

// Löschen-Button darf nicht gleichzeitig abhaken
if (event.target.closest('[data-action="einkauf-loeschen"]')) {
  return;
}

if (!button && !karte) return;


    const produkt = haushalt.einkaufsliste.find(
      eintrag => eintrag.id === (button || karte).dataset.id
    );

    if (!produkt) return;

produkt.erledigt = !produkt.erledigt;

speichereHaushalt();

const scrollPosition = window.scrollY;

render();

window.scrollTo({
  top: scrollPosition,
  behavior: "instant"
});
  });

  render = function () {
    if (page === "einkaufsliste") {
      renderHeader();
      renderNavigation();

      const content = document.getElementById("content");

      if (content) {
        const offeneBereiche = [...content.querySelectorAll("details[open]")].map(el => el.className);
        content.innerHTML = `
          <div class="grid">
            
<article class="card wide einkauf-hauptkarte">
  <h2>🛒 Unsere Einkaufsliste</h2>

              
<p class="muted">
  
</p>


 

  <div class="einkauf-eingabe">

  <input
    id="einkauf-produkt"
    type="text"
    placeholder="Was brauchst du?"
    autocomplete="off"
  >
<button
  type="button"
  class="einkauf-suche-leeren"
  aria-label="Suche leeren"
  data-action="einkauf-suche-leeren"
  hidden
>×</button>
<div id="einkauf-vorschlaege" class="einkauf-vorschlaege"></div>

  <div class="einkauf-eingabe-details">

    <div class="field">
      <label for="einkauf-menge">Menge</label>
      <input
        id="einkauf-menge"
        type="text"
        placeholder="1 Stück"
      >
    </div>

    <div class="field">
      <label for="einkauf-kategorie">Kategorie</label>
      <select id="einkauf-kategorie">
        <option value="Lebensmittel">🥦 Lebensmittel</option>
        <option value="Drogerie & Hygiene">🧴 Drogerie & Hygiene</option>
        <option value="Haushalt & Reinigung">🧹 Haushalt & Reinigung</option>
        <option value="Getränke">🥤 Getränke</option>
        <option value="Sonstiges">📦 Sonstiges</option>
      </select>
    </div>

  </div>

  <button
  type="button"
  class="einkauf-hinzufuegen-btn"
  data-action="einkauf-hinzufuegen"
  onpointerdown="event.preventDefault(); this.click();"()"
>
  ➕ Hinzufügen
</button>

</div>




<div class="einkauf-zuletzt">
  <details>
    <summary>🕒 Zuletzt verwendet</summary>

    <p class="muted">
      Produkte aus euren letzten Einkäufen.
    </p>

    <div class="einkauf-schnell-grid">
      ${[...new Map(
        [
          ...haushalt.einkaufsliste.slice().reverse(),
          ...haushalt.einkaeufe.slice().reverse()
            .flatMap(einkauf => einkauf.produkte.slice().reverse())
        ].map(produkt => [
          produkt.name.toLocaleLowerCase("de"),
          produkt.name
        ])
      ).values()]
        .slice(0, 15)
        .map(name => `
          <button
            type="button"
            class="secondary"
            data-action="einkauf-schnell"
            data-produkt="${escapeHTML(name)}">
            ${lpProduktSymbol(name)} ${escapeHTML(name)}
          </button>
        `).join("") || `
          <p class="muted">
            Noch keine verwendeten Produkte.
          </p>
        `}
    </div>
  </details>
</div>


<div class="einkauf-schnellauswahl">
  <details>
    <summary>⚡ Schnell hinzufügen</summary>

  <p class="muted">
    Deine häufigsten Produkte mit nur einem Klick.
  </p>

  
<div class="einkauf-schnell-grid">
  ${[
    ...new Set([
      ...lpHaeufigeProdukte().map(produkt => produkt.name),
      "Milch",
      "Brot",
      "Eier",
      "Bananen",
      "Wasser",
      "Käse"
    ].map(name => name.trim()).filter(Boolean))
  ]
    .slice(0, 18)
    .map(name => `
      <button
        class="secondary"
        data-action="einkauf-schnell"
        data-produkt="${escapeHTML(name)}">
        ${lpProduktSymbol(name)} ${escapeHTML(name)}
      </button>

    `).join("")}
</div>

  </details>
</div>

<div id="einkauf-produkte">
  ${haushalt.einkaufsliste.length === 0
    ? `
      <p class="muted">
        🛒 Deine Einkaufsliste ist noch leer.
      </p>
    `
    : [...haushalt.einkaufsliste]
  .sort((a, b) => {
    const kategorieA = a.kategorie || "Sonstiges";
    const kategorieB = b.kategorie || "Sonstiges";

    return (
      Number(a.erledigt) - Number(b.erledigt) ||
      kategorieA.localeCompare(kategorieB, "de")
    );
  })
  .map((produkt, index, liste) => `
  ${index === 0 ||
    produkt.erledigt !== liste[index - 1].erledigt ||
    (produkt.kategorie || "Sonstiges") !==
      (liste[index - 1].kategorie || "Sonstiges")
    ? `
      <h3 class="einkauf-gruppen-titel">
        ${produkt.erledigt ? "✅ Erledigt · " : ""}
        ${escapeHTML(produkt.kategorie || "Sonstiges")}
      </h3>
    `
    : ""
  }
      <div class="einkauf-produkt-karte ${produkt.erledigt ? "erledigt" : ""}" data-id="${produkt.id}">
        <div class="einkauf-produkt-symbol">${lpProduktSymbol(produkt.name)}</div>

        <div class="einkauf-produkt-info">
          <strong>${escapeHTML(produkt.name)}</strong>
          
<span>${escapeHTML(produkt.menge)}</span>


        </div>

        
<button
  class="secondary"
  data-action="einkauf-loeschen"
  data-id="${produkt.id}"
  title="Produkt löschen">
  🗑️
</button>

      </div>
    `).join("")
  }
</div>

<div id="einkauf-fortschritt-position"></div>

<div class="einkauf-abschluss">

  <button
    class="secondary"
    data-action="einkauf-abschliessen">
    🧾 Einkauf abschließen
  </button>
</div>

<div class="einkauf-historie">
  <h3>📜 Unsere letzten Einkäufe</h3>

  ${haushalt.einkaeufe.length === 0
    ? `<p class="muted">Noch keine abgeschlossenen Einkäufe.</p>`
    : [...haushalt.einkaeufe]
        .reverse()
        .slice(0, 5)
        .map(einkauf => `
          <div class="einkauf-historie-eintrag">
            <strong>
              🧾 ${new Date(einkauf.datum).toLocaleDateString("de-DE")}
            </strong>
            <span>
              
${einkauf.produkte.length} Produkte
·
${typeof einkauf.gesamtbetrag === "number"
  ? einkauf.gesamtbetrag.toLocaleString("de-DE", {
      style: "currency",
      currency: "EUR"
    })
  : "Betrag nicht erfasst"}

            </span>
            <div class="muted">
              ${einkauf.produkte
                .map(produkt => escapeHTML(produkt.name))
                .join(", ")}
            </div>


          </div>
        `).join("")
  }
</div>

${(() => {
  const fortschritt = lpEinkaufsfortschritt();

  return `
<div class="einkauf-fortschritt" style="order: 3 !important;">
      <div class="einkauf-fortschritt-kopf">

</div>

      <p>
        ${fortschritt.erledigt} von
        ${fortschritt.gesamt} Produkten erledigt
      </p>

      <div class="einkauf-fortschritt-balken">
        <div
          class="einkauf-fortschritt-fuellung"
          style="width: ${fortschritt.prozent}%"
        ></div>
      </div>
    </div>
  `;
})()}




            </article>

            
<article class="card">
  <details class="einkauf-finanzdetails">
    <summary>💶 Kostenübersicht anzeigen</summary>

              
<p class="muted">
  Eure gemeinsamen Ausgaben im
  ${new Date().toLocaleDateString("de-DE", {
    month: "long",
    year: "numeric"
  })}
</p>

<div class="field">
  <label for="einkauf-monatsbudget">
    🎯 Unser monatliches Einkaufsbudget
  </label>

  <div class="row">
    <input
      id="einkauf-monatsbudget"
      type="number"
      min="0"
      step="0.01"
      placeholder="z. B. 400"
      value="${haushalt.budgets?.gesamt ?? ""}"
    >

    <button class="secondary" data-action="einkauf-budget-speichern" style="display:none">💾 Speichern</button>
    
<script>
  // Wird im nächsten Schritt durch einen Event-Handler ersetzt
</script>

  </div>
</div>

${(() => {
  const budget = Number(haushalt.budgets?.gesamt) || 0;
  const ausgaben = lpMonatsausgaben();
  const rest = budget - ausgaben;

  const prozent = budget > 0
    ? Math.min((ausgaben / budget) * 100, 100)
    : 0;

  const euro = betrag => betrag.toLocaleString("de-DE", {
    style: "currency",
    currency: "EUR"
  });

  if (budget <= 0) {
    return `<p class="muted">
      🎯 Lege oben ein Monatsbudget fest, um deinen Fortschritt zu sehen.
    </p>`;
  }

  return `
    <div class="einkauf-budget-status">
      <div class="einkauf-budget-texte">
        <span>Ausgegeben: ${euro(ausgaben)}</span>
        <strong>
          ${rest >= 0
            ? `Noch übrig: ${euro(rest)}`
            : `Budget überschritten: ${euro(Math.abs(rest))}`}
        </strong>
      </div>

      <div class="einkauf-budget-balken">
        <div
          class="einkauf-budget-fuellung ${rest < 0 ? "ueberschritten" : ""}"
          style="width: ${prozent}%">
        </div>
      </div>

      <p class="muted">
        ${Math.round((ausgaben / budget) * 100)} % eures Monatsbudgets verbraucht
      </p>
    </div>
  `;
})()}

${(() => {
  const aktuell = lpMonatsausgaben();
  const vorher = lpVormonatsausgaben();

  const vormonat = new Date();
  vormonat.setDate(1);
  vormonat.setMonth(vormonat.getMonth() - 1);

  const vormonatName = vormonat.toLocaleDateString("de-DE", {
    month: "long",
    year: "numeric"
  });

  const euro = betrag => betrag.toLocaleString("de-DE", {
    style: "currency",
    currency: "EUR"
  });

  const hatVormonatsdaten = haushalt.einkaeufe.some(einkauf => {
    const datum = new Date(einkauf.datum);

    return (
      !Number.isNaN(datum.getTime()) &&
      datum.getMonth() === vormonat.getMonth() &&
      datum.getFullYear() === vormonat.getFullYear() &&
      typeof einkauf.gesamtbetrag === "number" &&
      Number.isFinite(einkauf.gesamtbetrag)
    );
  });

  return `
    <div class="einkauf-monatsvergleich">
      <h3>📊 Monatsvergleich</h3>

      <div class="einkauf-vergleich-werte">
        
<button
  type="button"
  class="einkauf-monat-button"
  data-action="einkauf-historie-oeffnen"
>
  <span>Dieser Monat 🧾</span>
  <strong>${euro(aktuell)}</strong>
  <small>Tippen für Einkaufshistorie</small>
</button>

        <div>
          <span>${vormonatName}</span>
          <strong>${hatVormonatsdaten ? euro(vorher) : "–"}</strong>
        </div>
      </div>

      <p class="muted">
        ${!hatVormonatsdaten
          ? "Für den Vormonat liegen noch keine erfassten Ausgaben vor."
          : aktuell > vorher
            ? `📈 ${euro(aktuell - vorher)} mehr als im Vormonat.`
            : aktuell < vorher
              ? `📉 ${euro(vorher - aktuell)} weniger als im Vormonat.`
              : "✨ Genau so viel wie im Vormonat."}
      </p>
    </div>
  `;
})()}

${(() => {
  
const aktuellesJahr = new Date().getFullYear();

const jahreMitEinkaeufen = haushalt.einkaeufe
  .map(einkauf => new Date(einkauf.datum))
  .filter(datum => !Number.isNaN(datum.getTime()))
  .map(datum => datum.getFullYear());

const verfuegbareJahre = [
  ...new Set([aktuellesJahr, ...jahreMitEinkaeufen])
].sort((a, b) => b - a);

const gespeichertesJahr = Number(
  sessionStorage.getItem("lp_einkauf_jahr")
);

const jahr = verfuegbareJahre.includes(gespeichertesJahr)
  ? gespeichertesJahr
  : aktuellesJahr;

const monate = lpJahresausgaben(jahr);

  const hoechsterBetrag = Math.max(
    ...monate.map(monat => monat.betrag),
    1
  );

  const euro = betrag => betrag.toLocaleString("de-DE", {
    style: "currency",
    currency: "EUR"
  });

  const jahressumme = monate.reduce(
    (summe, monat) => summe + monat.betrag,
    0
  );

  return `
    <div class="einkauf-jahresuebersicht">
      
<div class="einkauf-jahreskopf">
  <h3>📈 Jahresübersicht ${jahr}</h3>

  <label>
    Jahr:
    <select id="einkauf-jahresauswahl">
      ${verfuegbareJahre.map(einJahr => `
        <option
          value="${einJahr}"
          ${einJahr === jahr ? "selected" : ""}
        >
          ${einJahr}
        </option>
      `).join("")}
    </select>
  </label>
</div>


      <p>
        Bisher erfasst: <strong>${euro(jahressumme)}</strong>
      </p>

      <div class="einkauf-jahresdiagramm">
        ${monate.map(monat => `
          <div class="einkauf-jahresmonat">
            <span class="einkauf-jahresbetrag">
              ${euro(monat.betrag)}
            </span>

            <div class="einkauf-jahresbalken">
              <div
                class="einkauf-jahresfuellung"
                style="height: ${
                  monat.betrag > 0
                    ? Math.max(
                        (monat.betrag / hoechsterBetrag) * 100,
                        4
                      )
                    : 0
                }%">
              </div>
            </div>

            <span class="einkauf-jahresname">
              ${monat.monat}
            </span>
          </div>
        `).join("")}
      </div>

      <p class="muted">
        Die Balken zeigen eure erfassten Einkaufsausgaben
        pro Monat.
      </p>
    </div>
  `;
})()}

<p class="muted">
  🧾 Aus euren abgeschlossenen Einkäufen berechnet.
</p>

            </details></article>
          </div>
            `;
content.querySelectorAll("details").forEach(el => {
  if (offeneBereiche.includes(el.className)) {
    el.open = true;
  }
});
               const balken = content.querySelector(".einkauf-fortschritt");
        const produktliste = content.querySelector("#einkauf-produkte");

        if (balken && produktliste) {
          produktliste.insertAdjacentElement("afterend", balken);

          balken.style.setProperty("order", "3", "important");
          balken.style.setProperty("position", "static", "important");
          balken.style.setProperty("grid-area", "auto", "important");
        }
      }

      return;
    }

    lpEinkaufOriginalRender();
  };
})();
