// 404 de tout le domaine. Le doc de not-found.md le dit : « the root
// app/not-found.js [file] handle[s] any unmatched URLs for your whole
// application ». Sans ce fichier, un utilisateur connecté qui tape une adresse
// fausse tombait sur l'écran intégré de Next — anglais, fond blanc, sans lien
// de sortie (node_modules/next/dist/client/components/builtin/not-found.js).
//
// Il est bien atteignable : proxy.ts ne détourne vers /login que l'absence du
// cookie arete_uid, et laisse passer tout le reste.
//
// Pas de coquille ici : une URL inconnue ne contient aucun segment du groupe
// (app), donc ce composant se rend dans app/layout.tsx seul — ni sidebar, ni
// barre d'onglets. Et comme le <body> de ce layout est `min-h-full flex`, le
// conteneur doit prendre `flex: 1` : sans ça il se réduit à la largeur de son
// contenu et se tasse contre le bord gauche. `flex: 1` dans un body
// `min-h-full` suffit à remplir la hauteur, inutile de poser un 100dvh.
//
// Composant serveur, sans prop : le doc est net, « not-found.js components do
// not accept any props ».

import Link from 'next/link'

export default function PageIntrouvable() {
  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 'var(--sp-4)',
        padding: 'var(--sp-6)',
        textAlign: 'center',
      }}
    >
      <h1 className="r-h1">Page introuvable</h1>

      <p
        className="t-body"
        style={{ color: 'var(--text-muted)', lineHeight: 'var(--lh-body)', maxWidth: '38ch' }}
      >
        L'adresse demandée ne correspond à aucune page de l'application.
      </p>

      {/* « / » et non « /dashboard » : app/page.tsx redirige vers /dashboard, et
          proxy.ts renvoie vers /login si la session a expiré. Un seul lien qui
          atterrit au bon endroit dans les deux cas. */}
      <Link href="/" className="btn btn-md btn-primary">
        Revenir à l'accueil
      </Link>
    </div>
  )
}
