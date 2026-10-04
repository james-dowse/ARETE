'use client'

// Frontière d'erreur racine. Elle ne double PAS app/(app)/error.tsx — ne pas la
// supprimer comme un doublon.
//
// Raison d'être, et c'est la règle du même segment (doc error.md) : « error.js
// wraps loading.js, not-found.js, page.js, and nested layout.js files. It does
// not wrap the layout.js or template.js above it in the same segment. » Une
// frontière posée dans app/(app)/ n'attrape donc pas une exception de
// app/(app)/layout.tsx — or ce layout est async et fait
// `await syncAttributesFromDb()`, qui appelle prisma.attributeOption.findMany()
// sans .catch() (lib/attributes-server.ts). C'est la panne la plus probable de
// l'application, et elle tombe au-dessus de la frontière du groupe : seul ce
// fichier-ci la rattrape.
//
// Il couvre en plus les 4 pages hors groupe : /, /login, /invite/[token],
// /offline.
//
// Pas de coquille à ce niveau (le layout du groupe est précisément ce qui a
// échoué), et le <body> de app/layout.tsx est `min-h-full flex` : d'où le
// `flex: 1`, sans lequel le conteneur se tasserait contre le bord gauche.
//
// unstable_retry et non reset, et digest sans message : mêmes raisons que dans
// app/(app)/error.tsx, où elles sont détaillées.

import Link from 'next/link'

export default function ErreurRacine({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string }
  unstable_retry: () => void
}) {
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
      <h1 className="r-h1">L'application n'a pas pu se charger</h1>

      <p
        className="t-body"
        style={{ color: 'var(--text-muted)', lineHeight: 'var(--lh-body)', maxWidth: '42ch' }}
      >
        Une erreur s'est produite avant l'affichage de la page.
      </p>

      <div
        style={{
          display: 'flex',
          gap: 'var(--sp-3)',
          flexWrap: 'wrap',
          justifyContent: 'center',
        }}
      >
        <button type="button" className="btn btn-md btn-primary" onClick={() => unstable_retry()}>
          Réessayer
        </button>
        <Link href="/" className="btn btn-md btn-ghost">
          Revenir à l'accueil
        </Link>
      </div>

      {error.digest && <p className="t-micro">Référence {error.digest}</p>}
    </div>
  )
}
