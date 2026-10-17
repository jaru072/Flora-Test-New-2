// Flora Garden - Service Worker Cleanup & Self-Unregister
self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    self.registration.unregister()
  );
});
