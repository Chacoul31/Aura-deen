const CACHE_NAME = 'aura-deen-v1';

// Coquille de l'app + données texte du Coran : mises en cache dès l'installation
// (quelques Mo au total, ça permet de lire le Coran hors-ligne dès la 1ère visite complète)
const PRECACHE_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './data/chapter.json',
  './data/quran.json',
  './data/fr.json',
  './data/transliteration.json',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Audio : mise en cache "à la demande" — chaque verset écouté est sauvegardé pour être
  // rejouable hors-ligne ensuite, sans jamais précharger les 114 sourates d'un coup.
  if (url.pathname.includes('/audio/')) {
    event.respondWith(
      caches.match(req).then((cached) => {
        if (cached) return cached;
        return fetch(req).then((res) => {
          if (res.ok) {
            const clone = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, clone));
          }
          return res;
        }).catch(() => cached);
      })
    );
    return;
  }

  // Page principale : réseau en priorité (pour avoir les mises à jour), cache en secours si hors-ligne
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req).catch(() => caches.match('./index.html'))
    );
    return;
  }

  // Reste (données JSON, icônes, polices) : cache en priorité, réseau en secours
  event.respondWith(
    caches.match(req).then((cached) => {
      return cached || fetch(req).then((res) => {
        if (res.ok) {
          const clone = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, clone));
        }
        return res;
      });
    })
  );
});
