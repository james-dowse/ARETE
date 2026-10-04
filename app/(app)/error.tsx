'use client'

// Frontière d'erreur de l'application connectée — couvre les 16 pages du
// groupe (app).
//
// Pourquoi ce fichier est posé DANS le groupe et pas plus bas : une frontière
// se rend à la place du {children} du layout de son propre segment. Posée ici,
// elle remplace donc le contenu de app/(app)/layout.tsx mais pas le layout
// lui-même : <AppShell> (sidebar + barre d'onglets mobile) reste à l'écran, et
// <TemperatureSync/> reste monté au-dessus. La carte d'erreur hérite ainsi de
// la coquille et du cran de température de l'écran qu'elle remplace, au lieu
// d'éjecter l'utilisateur sur une page nue.
//
// Pourquoi unstable_retry et non reset : le doc de la version installée
// (node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/
// error.md) prescrit unstable_retry — ajouté en 16.2.0 — et renvoie reset au
// cas particulier, parce que reset vide l'état de la frontière SANS refaire les
// requêtes. Avec reset, le bouton rejouerait exactement le rendu qui vient
// d'échouer.
//
// error.message n'est pas affiché : le doc est explicite, en production le
// message d'une erreur venue d'un composant serveur est remplacé par un texte
// générique, et celui d'une erreur cliente exposerait un détail interne. Seul
// le digest est montré, pour recouper avec les journaux serveur.

import Link from 'next/link'

export default function ErreurApplication({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string }
  unstable_retry: () => void
}) {
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
        <h1 className="r-h2">Cette page n'a pas pu se charger</h1>

        <p className="t-body" style={{ color: 'var(--text-muted)', lineHeight: 'var(--lh-body)' }}>
          Une erreur s'est produite pendant l'affichage. Rien de ce qui est enregistré n'a été
          touché.
        </p>

        <div style={{ display: 'flex', gap: 'var(--sp-3)', flexWrap: 'wrap' }}>
          <button
            type="button"
            className="btn btn-md btn-primary"
            onClick={() => unstable_retry()}
          >
            Réessayer
          </button>
          <Link href="/dashboard" className="btn btn-md btn-ghost">
            Retour au tableau de bord
          </Link>
        </div>

        {error.digest && <p className="t-micro">Référence {error.digest}</p>}
      </div>
    </div>
  )
}
