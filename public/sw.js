// A service worker that does nothing but exist: older Chrome versions only
// offer "Install app" to a site with one that has a fetch handler (see
// src/utils/pwa-install.ts). It caches nothing, so every request still goes
// to the network as normal and a new deploy is seen straight away.

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));
self.addEventListener("fetch", () => {});
