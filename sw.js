
/* 🩸 LIFEPLANER SERVICE WORKER */

const CACHE_NAME = "lifeplaner-v5";

const APP_FILES = [
  "./",
  "./index.html",
  "./style.css",
  "./app-neu.js",
  "./lifeplaner-erweiterung.css",
  "./lifeplaner-erweiterung.js",
  "./lifeplaner-einkauf.js",
  "./manifest.webmanifest",
  "./icon-192.png",
  "./icon-512.png",
  "./apple-touch-icon.png"
];

self.addEventListener("install", event => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);

      await Promise.allSettled(
        APP_FILES.map(file => cache.add(file))
      );

      await self.skipWaiting();
    })()
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();

      await Promise.all(
        keys
          .filter(key => key.startsWith("lifeplaner-") &&
                         key !== CACHE_NAME)
          .map(key => caches.delete(key))
      );

      await self.clients.claim();
    })()
  );
});

self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;

  if (new URL(event.request.url).origin !== self.location.origin) {
    return;
  }

  event.respondWith(
    (async () => {
      try {
        const response = await fetch(event.request);

        if (response.ok) {
          const cache = await caches.open(CACHE_NAME);
          await cache.put(event.request, response.clone());
        }

        return response;
      } catch (error) {
        const cached = await caches.match(event.request);

        if (cached) return cached;

        throw error;
      }
    })()
  );
});
/* 🩸 LIFEPLANER – PUSH-BENACHRICHTIGUNGEN */

self.addEventListener("push", event => {
  let payload = {};

  try {
    payload = event.data ? event.data.json() : {};
  } catch (error) {
    payload = {
      body: event.data ? event.data.text() : ""
    };
  }

  const title = payload.title || "🩸 LifePlaner";
  const options = {
    body: payload.body || "Du hast eine Erinnerung.",
    icon: "./icon-192.png",
    badge: "./icon-192.png",
    tag: payload.tag || "lifeplaner-reminder",
    data: {
      url: "./index.html"
    }
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

/* 🩸 MITTEILUNG ANTIPPEN → LIFEPLANER ÖFFNEN */

self.addEventListener("notificationclick", event => {
  event.notification.close();

  event.waitUntil(
    (async () => {
      const url = new URL(
        event.notification.data?.url || "./index.html",
        self.registration.scope
      );

      // Nur Seiten innerhalb unserer eigenen App öffnen.
      if (!url.href.startsWith(self.registration.scope)) {
        return;
      }

      const windows = await clients.matchAll({
        type: "window",
        includeUncontrolled: true
      });

      for (const windowClient of windows) {
        if (windowClient.url.startsWith(self.registration.scope)) {
          await windowClient.focus();
          return;
        }
      }

      await clients.openWindow(url.href);
    })()
  );
});