const CACHE = 'arete-v1'
const SHELL = ['/generator', '/offline']
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()))
})
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()))
})
self.addEventListener('fetch', (e) => {
  const { request } = e
  if (request.method !== 'GET') return
  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return

  // Navigations : réseau d'abord, fallback cache puis /offline
  if (request.mode === 'navigate') {
    e.respondWith(fetch(request).catch(() => caches.match(request).then(r => r || caches.match('/offline'))))
    return
  }
  // Données de séance : stale-while-revalidate
  if (url.pathname.startsWith('/api/workouts/')) {
    e.respondWith(caches.open(CACHE).then(async c => {
      const cached = await c.match(request)
      const net = fetch(request).then(res => { if (res.ok) c.put(request, res.clone()); return res }).catch(() => cached)
      return cached || net
    }))
    return
  }
  // Assets statiques : cache d'abord
  if (url.pathname.startsWith('/_next/') || url.pathname.startsWith('/icon-') || url.pathname.endsWith('.svg') || url.pathname.endsWith('.png')) {
    e.respondWith(caches.match(request).then(r => r || fetch(request).then(res => { const cp = res.clone(); caches.open(CACHE).then(c => c.put(request, cp)); return res })))
  }
})
