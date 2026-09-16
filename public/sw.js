const CACHE = 'arete-v2'
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

  // Vignettes de démonstration YouTube : cache d'abord, durablement.
  // Ce sont les couvertures des cartouches et des lignes de bibliothèque,
  // immuables pour un identifiant de vidéo donné, et le seul poste d'images de
  // l'application. Les conserver évite de les retélécharger à chaque ouverture
  // sur un réseau mobile, et garde les listes lisibles hors connexion.
  if (url.hostname === 'i.ytimg.com') {
    e.respondWith(
      caches.open(CACHE).then(async c => {
        const cached = await c.match(request)
        if (cached) return cached
        try {
          const res = await fetch(request)
          if (res && (res.ok || res.type === 'opaque')) c.put(request, res.clone())
          return res
        } catch {
          return Response.error()
        }
      })
    )
    return
  }

  if (url.origin !== self.location.origin) return

  // Navigations : réseau d'abord, on met en cache les pages de séance active
  // (seules pages où un rechargement à froid sans réseau doit rester utilisable —
  // le state + localStorage suffisent tant que l'onglet reste ouvert), fallback
  // cache puis /offline si vraiment rien n'est disponible.
  if (request.mode === 'navigate') {
    const cacheable = /\/workouts\/[^/]+\/active$/.test(url.pathname)
    e.respondWith(
      fetch(request)
        .then(res => {
          if (cacheable && res.ok) { const cp = res.clone(); caches.open(CACHE).then(c => c.put(request, cp)) }
          return res
        })
        .catch(() => caches.match(request).then(r => r || caches.match('/offline')))
    )
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
