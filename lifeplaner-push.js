// LifePlaner Push – Grundeinstellungen
const LIFEPLANER_PUSH_SERVER = "https://lifeplaner-push.manuel-dulner.workers.dev";

// Hier kommt gleich dein oeffentlicher VAPID-Schluessel hinein.
const LIFEPLANER_VAPID_PUBLIC_KEY =
  "BOMueRiIuikr0X2GkzVrzSAFJSK4Gyvfb3Re92Ysv4GAbh001DL6UVvg8xoBn0PYrIbnVp0-USz1uBIpNWs3Heg";

function lifePlanerUrlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, "+")
    .replace(/_/g, "/");

  const rawData = atob(base64);

  return Uint8Array.from(
    rawData,
    character => character.charCodeAt(0)
  );
}

async function lifePlanerActivatePush() {
  if (!("serviceWorker" in navigator) ||
      !("PushManager" in window) ||
      !("Notification" in window)) {
    alert("Push-Benachrichtigungen werden hier nicht unterstuetzt.");
    return;
  }

  if (LIFEPLANER_VAPID_PUBLIC_KEY.startsWith("HIER_")) {
    alert("Bitte zuerst den oeffentlichen VAPID-Schluessel eintragen.");
    return;
  }

  const permission = await Notification.requestPermission();

  if (permission !== "granted") {
    alert("Benachrichtigungen wurden nicht erlaubt.");
    return;
  }

  const registration = await navigator.serviceWorker.ready;

  let subscription = await registration.pushManager.getSubscription();

  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: lifePlanerUrlBase64ToUint8Array(
        LIFEPLANER_VAPID_PUBLIC_KEY
      )
    });
  }

  let token = localStorage.getItem("lifeplaner_push_token");

  if (!token) {
    const bytes = crypto.getRandomValues(new Uint8Array(32));

    token = Array.from(bytes)
      .map(b => b.toString(16).padStart(2, "0"))
      .join("");

    localStorage.setItem("lifeplaner_push_token", token);
  }

  const response = await fetch(
    LIFEPLANER_PUSH_SERVER + "/api/register",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        subscription: subscription.toJSON(),
        token
      })
    }
  );

  if (!response.ok) {
    throw new Error(
      "Geraeteanmeldung fehlgeschlagen: HTTP " + response.status
    );
  }

  alert("LifePlaner Push wurde aktiviert!");
}async function lifePlanerTestPush() {
  const token = localStorage.getItem("lifeplaner_push_token");

  if (!token) {
    alert("Bitte zuerst Push aktivieren!");
    return;
  }

  const response = await fetch(
    LIFEPLANER_PUSH_SERVER + "/api/reminders",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + token
      },
      body: JSON.stringify({
        id: crypto.randomUUID(),
        title: "🩸 LifePlaner Test-Push!",
        remindAt: new Date(Date.now() + 2 * 60 * 1000).toISOString(),
        kind: "todo"
      })
    }
  );

  const result = await response.text();

  if (!response.ok) {
    throw new Error("HTTP " + response.status + ": " + result);
  }

  alert("🔔 Test-Erinnerung für in 2 Minuten geplant!");
}async function lifePlanerPushNeuVerbinden() {
  const registration = await navigator.serviceWorker.ready;
  const oldSubscription = await registration.pushManager.getSubscription();

  if (oldSubscription) {
    const removed = await oldSubscription.unsubscribe();
    if (!removed) {
      throw new Error("Alte Push-Anmeldung konnte nicht entfernt werden.");
    }
  }

  await lifePlanerActivatePush();
}// ========================================
// AUTOMATISCHE AUFGABEN-ERINNERUNGEN
// ========================================

async function lifePlanerScheduleTaskPush(key, task) {
  if (!task.time || task.done) return;

  const token = localStorage.getItem("lifeplaner_push_token");

  if (!token) {
    console.warn("LifePlaner: Push ist nicht aktiviert.");
    return;
  }

  const remindAt = new Date(`${key}T${task.time}:00`);

  // Keine Erinnerungen in der Vergangenheit erstellen
  if (
    !Number.isFinite(remindAt.getTime()) ||
    remindAt.getTime() <= Date.now()
  ) {
    return;
  }

  const response = await fetch(
    LIFEPLANER_PUSH_SERVER + "/api/reminders",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + token
      },
      body: JSON.stringify({
        id: "task_" + task.id,
        title: "✅ " + task.title,
        remindAt: remindAt.toISOString(),
        kind: "todo"
      })
    }
  );

  if (!response.ok) {
    throw new Error(
      "Aufgaben-Erinnerung fehlgeschlagen: HTTP " +
      response.status
    );
  }
}
// 🩸 Push-Erinnerung einer Aufgabe löschen
async function lifePlanerDeleteTaskPush(taskId) {
  const token = localStorage.getItem("lifeplaner_push_token");
  if (!token) return;

  const reminderId = "task_" + taskId;

  const response = await fetch(
    LIFEPLANER_PUSH_SERVER +
      "/api/reminders/" +
      encodeURIComponent(reminderId),
    {
      method: "DELETE",
      headers: {
        "Authorization": "Bearer " + token
      }
    }
  );

  if (!response.ok) {
    throw new Error(
      "Aufgaben-Push löschen fehlgeschlagen: HTTP " +
      response.status
    );
  }
}
async function lifePlanerScheduleEventPush(event) {
  const token = localStorage.getItem("lifeplaner_push_token");
  if (!token || !event.time) return;

  const start = new Date(`${event.date}T${event.time}:00`);

  if (!Number.isFinite(start.getTime())) return;

  for (const minutes of event.reminderMinutes || []) {
    const remindAt = new Date(
      start.getTime() - minutes * 60 * 1000
    );

    if (remindAt.getTime() <= Date.now()) continue;

    const response = await fetch(
      LIFEPLANER_PUSH_SERVER + "/api/reminders",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": "Bearer " + token
        },
        body: JSON.stringify({
         id: "event_" + event.id + "_" + minutes,
          title: "📅 " + event.title,
          remindAt: remindAt.toISOString(),
          kind: "event"
        })
      }
    );

    if (!response.ok) {
      throw new Error(
        "Termin-Push fehlgeschlagen: HTTP " + response.status
      );
    }
  }
}async function lifePlanerDeleteEventPush(eventId, minutes) {
  const token = localStorage.getItem("lifeplaner_push_token");
  if (!token) return;

  const reminderId = "event_" + eventId + "_" + minutes;

  const response = await fetch(
    LIFEPLANER_PUSH_SERVER + "/api/reminders/" + encodeURIComponent(reminderId),
    {
      method: "DELETE",
      headers: {
        "Authorization": "Bearer " + token
      }
    }
  );

  if (!response.ok) {
    throw new Error("Termin-Erinnerung löschen fehlgeschlagen: HTTP " + response.status);
  }
}// 🩸 Alte To-do-Erinnerungen prüfen
async function lifePlanerCheckOldTaskPush() {
  const token = localStorage.getItem("lifeplaner_push_token");

  if (!token) {
    alert("Push ist nicht aktiviert.");
    return;
  }

  const response = await fetch(
    LIFEPLANER_PUSH_SERVER + "/api/reminders",
    {
      headers: {
        "Authorization": "Bearer " + token
      }
    }
  );

  if (!response.ok) {
    throw new Error("HTTP " + response.status);
  }

  const result = await response.json();

  const oldReminders = result.reminders.filter(reminder =>
    reminder.kind === "todo" &&
    reminder.status === "pending" &&
    !reminder.id.startsWith("task_")
  );

  alert(
    "Alte offene To-do-Erinnerungen: " +
    oldReminders.length
  );
}