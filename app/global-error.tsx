'use client'

// Dernier filet. Le seul qui couvre le rendu de app/layout.tsx lui-même :
// <ServiceWorkerRegister>, <ToastProvider> et <ConfirmProvider> sont rendus
// dans le JSX du layout racine, donc hors d'atteinte de app/error.tsx (règle du
// même segment, doc error.md).
//
// Ce fichier REMPLACE le layout racine quand il s'active : il doit donc
// déclarer son propre <html> et son propre <body>, et importer globals.css
// lui-même. Sans cet import, aucune variable de palette n'existe —
// var(--bg-primary), .btn, .r-h1 ne résolvent rien — et l'écran de dernier
// recours sortirait blanc et sans style, exactement le défaut qu'on corrige.
//
// Les polices next/font sont perdues : leurs variables (--font-inter,
// --font-display) sont posées sur le <html> du layout remplacé. Et comme
// `font-family: var(--font-inter), -apple-system, …` (globals.css) devient
// invalide dès que la variable manque — la déclaration entière est jetée, pas
// seulement son premier terme — le texte retomberait sur la serif par défaut du
// navigateur. D'où la pile système posée explicitement sur le <body> ci-dessous.
// Acceptable pour un écran qui ne doit s'afficher qu'une fois.
//
// Pas d'export metadata ni generateMetadata : le doc le signale, ils ne sont pas
// supportés sur un composant client. Le titre passe par le composant React
// <title>.
//
// Enfin, on ne s'appuie que sur les variables de rôle : data-theme="light" est
// posé impérativement sur <html> par components/Sidebar.tsx et peut ne pas
// survivre au remplacement de la balise, mais --bg-primary, --text-primary et
// --text-muted existent dans les deux thèmes.

import './globals.css'

export default function ErreurGlobale({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string }
  unstable_retry: () => void
}) {
  return (
    <html lang="fr">
      <body
        style={{
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
          minHeight: '100dvh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 'var(--sp-4)',
          padding: 'var(--sp-6)',
          textAlign: 'center',
          background: 'var(--bg-primary)',
          color: 'var(--text-primary)',
        }}
      >
        <title>ARETE — erreur</title>

        <h1 className="r-h1">L'application n'a pas pu démarrer</h1>

        <p
          className="t-body"
          style={{ color: 'var(--text-muted)', lineHeight: 'var(--lh-body)', maxWidth: '42ch' }}
        >
          Une erreur s'est produite au chargement.
        </p>

        <button type="button" className="btn btn-md btn-primary" onClick={() => unstable_retry()}>
          Réessayer
        </button>

        {error?.digest && <p className="t-micro">Référence {error.digest}</p>}
      </body>
    </html>
  )
}
