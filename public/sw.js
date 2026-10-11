// Nom incrémenté à chaque changement de stratégie : `activate` supprime tous
// les caches dont le nom diffère, sinon les réponses d'API déjà en cache
// (servies cache d'abord par la version précédente) survivraient à la
// correction et continueraient à montrer une édition de retard.
const CACHE = 'arete-v3'
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
  // Données de séance : réseau d'abord, repli sur le cache — même stratégie que
  // la branche navigation ci-dessus.
  //
  // Cette branche renvoyait `cached || net` : la réponse du cache était servie
  // telle quelle et le réseau ne rafraîchissait que l'entrée mise en cache. La
  // fiche affichait donc en permanence l'état d'AVANT la dernière édition —
  // 4×12 à l'écran pendant que la séance active faisait 3×10. Seul l'ORDRE
  // change : le repli cache reste, c'est lui qui tient le mode hors connexion
  // en salle, là où le réseau tombe au milieu d'une séance.
  //
  // Toutes les routes concernées (/api/workouts/[id], ses blocs, ses séries,
  // ses sessions) sont des données propres à l'utilisateur et éditables : aucune
  // ne gagnerait à rester en cache d'abord. Le seul référentiel quasi statique,
  // /api/attributes, ne passe pas par ici (il arrive par le serveur, voir
  // <AttributesSync initial>), et les vignettes YouTube gardent leur branche
  // cache d'abord plus haut.
  // MAIS le réseau d'abord SANS DÉLAI casserait le cas d'usage de
  // l'application. app/(app)/workouts/[id]/active/page.tsx documente un délai
  // de 12 s dimensionné sur l'ancien comportement : en salle, réseau dégradé
  // plutôt que mort, l'écran de séance s'affichait instantanément depuis le
  // cache ; il se serait mis à attendre, puis à tomber en erreur. On borne donc
  // l'attente réseau à 3 s avant de retomber sur le cache. Au-delà, mieux vaut
  // une donnée d'hier tout de suite qu'une donnée juste dans douze secondes.
  //
  // Seules les réponses exploitables sont mises en cache : res.ok ne suffit pas
  // à lui seul, deux routes répondaient 200 avec un corps vide hors session, et
  // une réponse vide en cache annonce « jamais fait » sur une séance faite dix
  // fois — exactement quand on en a besoin. Ces routes répondent désormais 401.
  if (url.pathname.startsWith('/api/workouts/')) {
    const reseau = new Promise((resolve, reject) => {
      const minuteur = setTimeout(() => reject(new Error('lent')), 3000)
      fetch(request).then(res => { clearTimeout(minuteur); resolve(res) },
                          err => { clearTimeout(minuteur); reject(err) })
    })
    e.respondWith(
      reseau
        .then(res => {
          if (res.ok) { const cp = res.clone(); caches.open(CACHE).then(c => c.put(request, cp)) }
          return res
        })
        .catch(() => caches.match(request).then(r => r || fetch(request)))
    )
    return
  }
  // Assets statiques : cache d'abord
  if (url.pathname.startsWith('/_next/') || url.pathname.startsWith('/icon-') || url.pathname.endsWith('.svg') || url.pathname.endsWith('.png')) {
    e.respondWith(caches.match(request).then(r => r || fetch(request).then(res => { const cp = res.clone(); caches.open(CACHE).then(c => c.put(request, cp)); return res })))
  }
})
