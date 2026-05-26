const CACHE_VERSION = 'triptalk-precache-v4';
const APP_SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './sw.js',
  './styles/triptalk.css',
  './scripts/phrases.js',
  './scripts/triptalk.js',
  './images/TripTalk.png',
  './icons/triptalk-180.png',
  './icons/triptalk-192.png',
  './icons/triptalk-512.png'
];

self.window = self;
importScripts('./scripts/phrases.js');

function sectionKey(section) {
  return (section?.section || '').toLowerCase();
}

function recordAssetParts(record) {
  const match = typeof record?.id === 'string' ? record.id.match(/^([a-z]+)_\d{3}$/) : null;
  return match ? { section: match[1], id: record.id } : null;
}

function buildPrecacheAssets() {
  const assets = new Set(APP_SHELL);
  const sections = Array.isArray(self.phraseData) ? self.phraseData.filter(Boolean) : [];

  sections.forEach((section) => {
    const key = sectionKey(section);
    if (key) {
      assets.add(`./images/${key}/section_images/${key}.png`);
      assets.add(`./images/${key}/section_images/${key}_color.png`);
    }

    (section.records || []).forEach((record) => {
      const parts = recordAssetParts(record);
      if (!parts) return;

      assets.add(`./images/${parts.section}/${parts.id}.png`);
      assets.add(`./media/${parts.section}/English/${parts.id}.mp3`);
      assets.add(`./media/${parts.section}/Greek/${parts.id}.mp3`);
    });
  });

  return [...assets];
}

const PRECACHE_ASSETS = buildPrecacheAssets();

async function precacheAll() {
  const cache = await caches.open(CACHE_VERSION);
  const failures = [];
  const remainingAssets = [...PRECACHE_ASSETS];

  async function cacheNextAsset() {
    while (remainingAssets.length) {
      const asset = remainingAssets.shift();
      try {
        const request = new Request(asset, { cache: 'reload' });
        const response = await fetch(request);
        if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
        await cache.put(request, response);
      } catch (error) {
        failures.push({ asset, error });
      }
    }
  }

  await Promise.all(Array.from({ length: 8 }, cacheNextAsset));

  if (failures.length) {
    console.error('TripTalk precache failed.', failures);
    throw new Error(`TripTalk could not precache ${failures.length} assets.`);
  }
}

self.addEventListener('install', (event) => {
  event.waitUntil(precacheAll().then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((key) => key !== CACHE_VERSION).map((key) => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;

      if (event.request.mode === 'navigate') {
        return caches.match('./index.html');
      }

      return fetch(event.request).then((response) => {
        if (!response || !response.ok) return response;

        const copy = response.clone();
        caches.open(CACHE_VERSION).then((cache) => cache.put(event.request, copy));
        return response;
      });
    })
  );
});
