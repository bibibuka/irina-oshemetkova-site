/* «Ночник» offline. Registered only when the visitor asks for it. Network first, so the
   page is always fresh online; the cache is a fallback for nights without a connection.
   Nothing personal is cached — only the site's own public files. */
const CACHE = 'nochnik-v1';
const CORE = [
  './', 'index.html', 'manifest.webmanifest',
  'css/tokens.css', 'css/base.css', 'css/layout.css', 'css/components.css', 'css/motion.css',
  'css/features/hero.css', 'css/features/checkin.css', 'css/features/doors.css', 'css/features/breath.css',
  'css/features/practices.css', 'css/features/thought.css', 'css/features/words.css', 'css/features/deck.css',
  'css/features/irina.css', 'css/features/night.css', 'css/features/bot.css', 'css/features/letter.css',
  'css/features/help.css', 'css/features/settings.css',
  'js/main.js',
  'js/core/actions.js', 'js/core/audio.js', 'js/core/celebrate.js', 'js/core/dom.js', 'js/core/minibreath.js', 'js/core/motion.js',
  'js/core/phrases.js', 'js/core/prefs.js', 'js/core/safety.js', 'js/core/share.js', 'js/core/sheets.js', 'js/core/store.js',
  'js/core/time.js', 'js/core/wakelock.js',
  'js/features/help.js', 'js/features/settings.js', 'js/features/hero.js', 'js/features/checkin.js', 'js/features/doors.js',
  'js/features/breath.js', 'js/features/letter.js', 'js/features/irina.js', 'js/features/practices.js', 'js/features/thought.js',
  'js/features/words.js', 'js/features/deck.js', 'js/features/night.js', 'js/features/bot.js',
  'js/content/greetings.js', 'js/content/checkin.js', 'js/content/practices.js', 'js/content/letter.js', 'js/content/thought.js',
  'js/content/words.js', 'js/content/deck.js',
  'assets/fonts/cormorant-400.woff2', 'assets/fonts/cormorant-italic-400.woff2', 'assets/fonts/inter-cyrillic.woff2',
  'assets/favicon.svg', 'assets/icon-192.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => Promise.all(CORE.map((url) => cache.add(url).catch(() => null)))).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;
  event.respondWith(fetch(request).then((response) => {
    if (response.ok && response.type === 'basic') {
      const copy = response.clone();
      caches.open(CACHE).then((cache) => cache.put(request, copy)).catch(() => {});
    }
    return response;
  }).catch(() => caches.match(request, { ignoreSearch: true })
    .then((hit) => hit || (request.mode === 'navigate' ? caches.match('index.html') : Response.error()))));
});
