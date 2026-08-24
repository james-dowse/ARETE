import AppShell from '@/components/AppShell'

// Layout partagé par toutes les pages de l'app connectée.
//
// Avant, chaque page rendait <AppShell> elle-même : la sidebar était donc
// re-rendue côté serveur et *remontée* côté client à chaque navigation
// (rechargement de /api/me, recalcul de l'état replié, réinitialisation des
// transitions). Placée ici, elle reste montée d'une page à l'autre : seul le
// contenu de la page est échangé, et le squelette de chargement s'affiche
// à l'intérieur d'une coquille stable.
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>
}
