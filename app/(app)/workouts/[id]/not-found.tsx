// Attrape le notFound() de page.tsx (ligne 36 : `if (!workout) notFound()`),
// le seul appel de ce genre dans tout app/.
//
// Posé dans le segment [id] plutôt que dans le groupe pour deux raisons : les
// layouts au-dessus se rendent quand même, donc la coquille <AppShell> est là ;
// et la phrase peut nommer la séance au lieu de parler d'une « page ».
// Côté rendu, le doc de not-found.md situe ce composant entre loading.js et
// page.js : il s'affiche donc à l'intérieur du Suspense de loading.tsx du même
// segment.
//
// Composant serveur, sans 'use client' : le doc est net, « not-found.js
// components do not accept any props ».

import Link from 'next/link'

export default function SeanceIntrouvable() {
  return (
    <div className="page-reading">
      <div
        className="card"
        style={{
          padding: 'var(--sp-7)',
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--sp-4)',
        }}
      >
        <h1 className="r-h2">Cette séance est introuvable</h1>

        <p className="t-body" style={{ color: 'var(--text-muted)', lineHeight: 'var(--lh-body)' }}>
          Elle a été supprimée, ou le lien que tu as suivi ne pointe plus sur rien.
        </p>

        {/* alignSelf sur le lien, et non alignItems sur la carte : la carte est
            une colonne flex, donc sans ça le bouton s'étirerait sur toute la
            largeur du gabarit de lecture. Posé sur la carte, alignItems aurait
            en revanche fait perdre au paragraphe son comportement de bloc. */}
        <Link href="/workouts" className="btn btn-md btn-primary" style={{ alignSelf: 'flex-start' }}>
          Voir mes séances
        </Link>
      </div>
    </div>
  )
}
