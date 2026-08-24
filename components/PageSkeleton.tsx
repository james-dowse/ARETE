import AppShell from './AppShell'

// Squelette affiché pendant le rendu serveur d'une page.
//
// Sans loading.tsx, cliquer un lien vers une page dynamique fige l'écran
// précédent jusqu'au retour du serveur : le clic semble ignoré. Avec ce
// squelette, Next.js bascule instantanément et la page se remplit ensuite.
// La sidebar est rendue ici aussi pour qu'elle ne clignote pas.

function Bar({ w, h = 14, r = 6 }: { w: string | number; h?: number; r?: number }) {
  return (
    <div className="skeleton" style={{ width: w, height: h, borderRadius: r }} />
  )
}

export function SkeletonCard({ lines = 3 }: { lines?: number }) {
  return (
    <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--r-md, 12px)', padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
        <Bar w={130} h={86} r={10} />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 9 }}>
          <Bar w="45%" h={15} />
          <Bar w="25%" h={11} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 4 }}>
            {Array.from({ length: lines }).map((_, i) => <Bar key={i} w={`${72 - i * 9}%`} h={11} />)}
          </div>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 6 }}>
        {Array.from({ length: 4 }).map((_, i) => <Bar key={i} w={62} h={18} r={20} />)}
      </div>
    </div>
  )
}

export default function PageSkeleton({ cards = 3 }: { cards?: number }) {
  return (
    <AppShell>
      <div style={{ maxWidth: 1240, margin: '0 auto', width: '100%' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 28 }}>
          <Bar w={240} h={30} r={8} />
          <Bar w={330} h={14} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {Array.from({ length: cards }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
      </div>
    </AppShell>
  )
}
