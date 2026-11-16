
/* 🩸 LIFEPLANER PWA – SERVICE WORKER */

const CACHE_NAME = "lifeplaner-v2";

const APP_FILES = [
  "./",
  "./index.html",

  "./style.css",
  "./lifeplaner-erweiterung.css",

  "./app-neu.js",
  "./lifeplaner-erweiterung.js",
  "./lifeplaner-einkauf.js",

  "./manifest.webmanifest",
  "./icon-192.png",
"./icon-512.png",
"./apple-touch-icon.png",

  "./chopper-shaker-zu.png",
  "./mini-itachi.png"
];

/* INSTALLATION */

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(APP_FILES);
    })
  );

  self.skipWaiting();
});

/* ALTE CACHES ENTFERNEN */

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(names => {
      return Promise.all(
        names
          .filter(name => name !== CACHE_NAME)
          .map(name => caches.delete(name))
      );
    }).then(() => self.clients.claim())
  );
});

/* DATEIEN LADEN */

self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") {
    return;
  }

  const url = new URL(event.request.url);

  if (url.origin !== self.location.origin) {
    return;
  }

  if (!url.pathname.startsWith(
    new URL(self.registration.scope).pathname
  )) {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then(response => {
        if (response.ok) {
          const copy = response.clone();

          caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, copy);
          });
        }

        return response;
      })
      .catch(async () => {
        const cached = await caches.match(event.request);

        if (cached) {
          return cached;
        }

        if (event.request.mode === "navigate") {
          const fallback = await caches.match("./index.html");

          if (fallback) {
            return fallback;
          }
        }

        return Response.error();
      })
  );
});
