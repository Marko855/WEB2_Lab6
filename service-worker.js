const CACHE_NAME = 'video-recorder-cache-v1';
const urlsToCache = [
  '/',
  '/index.html',
  '/assets/styles/main.css',
  '/assets/scripts/main.js',
  '/assets/icons/icon-512x512.png',
  '/service-worker.js',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        return cache.addAll(urlsToCache);
      })
      .catch((error) => console.error('Failed to cache resources:', error))
  );
});

self.addEventListener('activate', (event) => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (!cacheWhitelist.includes(cacheName)) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  
  if (url.pathname.includes('browser-sync-client.js')) {
    return; 
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }
    })
  );
});

self.addEventListener('sync', (event) => {
  if (event.tag === 'counter-sync') {
    event.waitUntil(syncCounter());
  }
});

async function syncCounter() {
  console.log('Syncing video counter locally...');
  
  const counter = await getCounterFromIndexedDB();

  if (counter !== null) {
    console.log(`Synced counter: ${counter}`);
  }
}

function getCounterFromIndexedDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('videoRecorderDB', 1);

    request.onsuccess = (event) => {
      const db = event.target.result;
      const transaction = db.transaction('counters', 'readonly');
      const store = transaction.objectStore('counters');
      const getRequest = store.get('videoCounter');

      getRequest.onsuccess = () => {
        resolve(getRequest.result ? getRequest.result.count : null);
      };

      getRequest.onerror = () => {
        reject('Failed to fetch counter from IndexedDB');
      };
    };

    request.onerror = () => {
      reject('Failed to open IndexedDB');
    };
  });
}
