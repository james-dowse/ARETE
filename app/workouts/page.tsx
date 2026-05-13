import AppShell from '@/components/AppShell'
import Link from 'next/link'
import { Zap } from 'lucide-react'
import { getCurrentUserId } from '@/lib/session'
import WorkoutsTabs from './WorkoutsTabs'

export const dynamic = 'force-dynamic'

export default async function WorkoutsPage() {
  const currentUserId = await getCurrentUserId()

  return (
    <AppShell>
      <div style={{ maxWidth: 800 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28 }}>
          <div>
            <h1 style={{ fontSize: 40, fontWeight: 800, margin: 0, letterSpacing: '-0.02em' }}>Workouts</h1>
          </div>
          <Link href="/generator">
            <button style={{ padding: '10px 18px', background: 'var(--accent)', color: 'var(--on-accent)', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
              <Zap size={14} /> Nouveau
            </button>
          </Link>
        </div>

        <WorkoutsTabs currentUserId={currentUserId} />
      </div>
    </AppShell>
  )
}
