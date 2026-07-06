'use client'
import { useEffect, useState, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Maximize, ArrowLeft } from 'lucide-react'
import BoardCanvas from '@/components/BoardCanvas'
import { VisionBoard, boardRatio } from '@/lib/visionBoard'

export default function VisionBoardPresentPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [board, setBoard] = useState<VisionBoard | null>(null)
  const [showUi, setShowUi] = useState(true)
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => { fetch(`/api/vision-boards/${id}`).then(r => r.json()).then(setBoard) }, [id])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !document.fullscreenElement) router.push(`/vision-board/${id}`) }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [id, router])

  const wake = () => {
    setShowUi(true)
    if (hideTimer.current) clearTimeout(hideTimer.current)
    hideTimer.current = setTimeout(() => setShowUi(false), 2500)
  }
  useEffect(() => { wake(); return () => { if (hideTimer.current) clearTimeout(hideTimer.current) } }, [])

  if (!board) return null

  return (
    <div
      onMouseMove={wake}
      onClick={wake}
      style={{ width: '100vw', height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#000' }}
    >
      <div style={{ width: `min(96vw, calc(96vh * ${boardRatio(board.pageSize, board.orientation)}))`, aspectRatio: boardRatio(board.pageSize, board.orientation) }}>
        <BoardCanvas
          slots={board.slots}
          bgColor={board.bgColor}
          ratio={boardRatio(board.pageSize, board.orientation)}
          mode="display"
          style={{ borderRadius: 6, boxShadow: '0 0 80px rgba(0,0,0,0.6)' }}
        />
      </div>

      <div style={{
        position: 'fixed', top: 20, right: 20, display: 'flex', gap: 8,
        opacity: showUi ? 1 : 0, transition: 'opacity 0.4s',
      }}>
        <button
          onClick={e => { e.stopPropagation(); document.documentElement.requestFullscreen?.() }}
          title="Plein écran"
          style={btnStyle}
        ><Maximize size={16} /></button>
        <button
          onClick={e => { e.stopPropagation(); router.push(`/vision-board/${id}`) }}
          title="Retour à l'édition"
          style={btnStyle}
        ><ArrowLeft size={16} /></button>
      </div>
    </div>
  )
}

const btnStyle: React.CSSProperties = {
  width: 38, height: 38, borderRadius: '50%', background: 'rgba(255,255,255,0.12)', color: '#fff',
  border: '1px solid rgba(255,255,255,0.2)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
  backdropFilter: 'blur(6px)',
}
