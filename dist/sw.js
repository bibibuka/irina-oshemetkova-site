/* The «Ночник на экран Домой» offline copy is gone. Anyone who installed it gets this worker
   once: it clears the old cache and unregisters itself, so the site is served straight from
   the network again. Nothing else is registered any more. */
self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.map((key) => caches.delete(key))))
      .then(() => self.registration.unregister())
      .catch(() => {}),
  );
});
