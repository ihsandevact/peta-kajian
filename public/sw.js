const CACHE_NAME = 'peta-kajian-v2';
const PRECACHE_ASSETS = [
  '/logo.png?v=3',
  '/favicon.ico?v=3',
  '/site.webmanifest',
  '/android-chrome-192x192.png',
  '/android-chrome-512x512.png',
];

// Install: precache core assets and activate immediately
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_ASSETS).catch((err) => console.warn('PWA Precache warning:', err)))
      .then(() => self.skipWaiting())
  );
});

// Activate: clean up older cache versions
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.map((key) => {
            if (key !== CACHE_NAME) {
              return caches.delete(key);
            }
          })
        )
      )
      .then(() => self.clients.claim())
  );
});

// Fetch: Network-first strategy with cache fallback
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // Bypass non-HTTP(S), API, dan request internal Next.js (RSC, static chunks, HMR, Turbopack)
  if (
    !url.protocol.startsWith('http') ||
    url.pathname.startsWith('/api') ||
    url.pathname.startsWith('/auth') ||
    url.pathname.startsWith('/_next') ||
    url.searchParams.has('_rsc') ||
    url.pathname.includes('turbopack') ||
    url.pathname.includes('webpack') ||
    url.pathname.includes('__nextjs') ||
    url.host.includes('supabase.co') ||
    url.host.includes('maptiler.com')
  ) {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        // Cache successful basic responses for static assets and HTML
        if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
          const responseClone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseClone));
        }
        return networkResponse;
      })
      .catch(async () => {
        const cachedResponse = await caches.match(event.request);
        if (cachedResponse) {
          return cachedResponse;
        }
        // Fallback to home page if navigating offline
        if (event.request.mode === 'navigate') {
          const homeFallback = await caches.match('/');
          if (homeFallback) return homeFallback;
        }
        return new Response('Mode offline - Mohon periksa koneksi internet Anda.', {
          status: 503,
          headers: { 'Content-Type': 'text/plain; charset=utf-8' },
        });
      })
  );
});

// Push notification event listener (ready for web push)
self.addEventListener('push', (event) => {
  if (!event.data) return;
  try {
    const data = event.data.json();
    const title = data.title || 'Peta Kajian';
    const options = {
      body: data.body || 'Ada info kajian terbaru di sekitar Anda.',
      icon: '/android-chrome-192x192.png',
      badge: '/favicon-32x32.png',
      data: { url: data.url || '/' },
    };
    event.waitUntil(self.registration.showNotification(title, options));
  } catch (err) {
    console.error('Error handling push event:', err);
  }
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || '/';
  event.waitUntil(
    clients.matchAll({ type: 'window' }).then((clientList) => {
      for (const client of clientList) {
        if (client.url === targetUrl && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});
