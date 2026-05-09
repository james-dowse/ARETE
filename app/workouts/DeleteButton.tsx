'use client'
import { useRouter } from 'next/navigation'
import { Trash2, Copy } from 'lucide-react'
import { useState } from 'react'

export default function WorkoutActions({ workoutId }: { workoutId: string }) {
  const router = useRouter()
  const [deleting, setDeleting] = useState(false)
  const [duplicating, setDuplicating] = useState(false)

  const handleDelete = async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (!confirm('Supprimer ce workout ?')) return
    setDeleting(true)
    await fetch(`/api/workouts/${workoutId}`, { method: 'DELETE' })
    router.refresh()
  }

  const handleDuplicate = async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDuplicating(true)
    const res = await fetch(`/api/workouts/${workoutId}/duplicate`, { method: 'POST' })
    const copy = await res.json()
    setDuplicating(false)
    router.push(`/workouts/${copy.id}`)
  }

  return (
    <div style={{ display: 'flex', gap: 4 }}>
      <button onClick={handleDuplicate} disabled={duplicating} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-dim)', display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, padding: '4px 8px', borderRadius: 6 }}>
        <Copy size={12} />
        {duplicating ? 'Duplication...' : 'Dupliquer'}
      </button>
      <button onClick={handleDelete} disabled={deleting} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-dim)', display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, padding: '4px 8px', borderRadius: 6 }}>
        <Trash2 size={12} />
        {deleting ? 'Suppression...' : 'Supprimer'}
      </button>
    </div>
  )
}
