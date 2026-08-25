import AppShell from '@/components/AppShell'
import { syncAttributesFromDb } from '@/lib/attributes-server'

// Layout partagé par toutes les pages de l'app connectée.
//
// Avant, chaque page rendait <AppShell> elle-même : la sidebar était donc
// re-rendue côté serveur et *remontée* côté client à chaque navigation
// (rechargement de /api/me, recalcul de l'état replié, réinitialisation des
// transitions). Placée ici, elle reste montée d'une page à l'autre : seul le
// contenu de la page est échangé, et le squelette de chargement s'affiche
// à l'intérieur d'une coquille stable.
//
// syncAttributesFromDb() ici, une seule fois pour toute page de l'app : sans
// ça, chaque page cliente utilisant BIO_TYPE_COLORS/BIO_TYPE_ICONS/
// COMPLEXITY_COLORS était SSR avec les valeurs anglaises par défaut, puis
// re-rendue par React au montage une fois <AttributesSync/> arrivé côté
// client — un flash de contenu incorrect à chaque chargement de page.
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  await syncAttributesFromDb()
  return <AppShell>{children}</AppShell>
}
