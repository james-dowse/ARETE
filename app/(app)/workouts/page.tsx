import Link from 'next/link'
import { Zap } from 'lucide-react'
import { getCurrentUserId } from '@/lib/session'
import WorkoutsTabs from './WorkoutsTabs'

export const dynamic = 'force-dynamic'

export default async function WorkoutsPage() {
  const currentUserId = await getCurrentUserId()

  return (
    <>
      <div className="page">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--sp-6)' }}>
          <header>
            <div className="t-micro" style={{ marginBottom: 6 }}>ENTRAÎNEMENT</div>
            <h1 className="r-h1">Mes séances</h1>
                      </header>
          <Link href="/generator">
            {/* .btn .btn-md pour la géométrie, fond terracotta conservé :
                .btn-primary est or, et la charte interdit l'or sur une action. */}
            <button className="btn btn-md" style={{ background: 'var(--accent)', color: 'var(--on-accent)' }}>
              <Zap size={14} /> Nouveau
            </button>
          </Link>
        </div>

        <WorkoutsTabs currentUserId={currentUserId} />
      </div>
    </>
  )
}
