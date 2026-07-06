'use client'
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import BoardCanvas from '@/components/BoardCanvas'
import { VisionBoard, boardRatio, printSizeMm } from '@/lib/visionBoard'

export default function VisionBoardPrintPage() {
  const { id } = useParams<{ id: string }>()
  const [board, setBoard] = useState<VisionBoard | null>(null)

  useEffect(() => { fetch(`/api/vision-boards/${id}`).then(r => r.json()).then(setBoard) }, [id])

  useEffect(() => {
    if (!board) return
    const t = setTimeout(() => window.print(), 400)
    return () => clearTimeout(t)
  }, [board])

  if (!board) return <div style={{ padding: 40, color: '#ccc', fontSize: 14 }}>Chargement…</div>

  const { w, h } = printSizeMm(board.pageSize, board.orientation)

  return (
    <>
      <style>{`@page { size: ${w}mm ${h}mm; }`}</style>
      <button className="print-btn" onClick={() => window.print()}>Imprimer / PDF</button>
      <div className="print-page">
        <div style={{ width: '100%', maxWidth: `${w}mm` }}>
          <BoardCanvas
            slots={board.slots}
            bgColor={board.bgColor}
            ratio={boardRatio(board.pageSize, board.orientation)}
            mode="display"
            style={{ boxShadow: '0 4px 30px rgba(0,0,0,0.35)' }}
          />
        </div>
      </div>
    </>
  )
}
