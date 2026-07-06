import { VisionBoard, boardRatio, printSizeMm } from './visionBoard'

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = src
  })
}

// Reproduit object-fit: cover
function drawCover(ctx: CanvasRenderingContext2D, img: HTMLImageElement, dx: number, dy: number, dw: number, dh: number) {
  const scale = Math.max(dw / img.naturalWidth, dh / img.naturalHeight)
  const sWidth = dw / scale
  const sHeight = dh / scale
  const sx = (img.naturalWidth - sWidth) / 2
  const sy = (img.naturalHeight - sHeight) / 2
  ctx.drawImage(img, sx, sy, sWidth, sHeight, dx, dy, dw, dh)
}

function wrapLines(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const lines: string[] = []
  for (const paragraph of text.split('\n')) {
    const words = paragraph.split(' ')
    let line = ''
    for (const word of words) {
      const test = line ? `${line} ${word}` : word
      if (line && ctx.measureText(test).width > maxWidth) {
        lines.push(line)
        line = word
      } else {
        line = test
      }
    }
    lines.push(line)
  }
  return lines
}

export async function renderBoardToCanvas(board: VisionBoard, widthPx: number): Promise<HTMLCanvasElement> {
  const ratio = boardRatio(board.pageSize, board.orientation)
  const heightPx = Math.round(widthPx / ratio)
  const canvas = document.createElement('canvas')
  canvas.width = widthPx
  canvas.height = heightPx
  const ctx = canvas.getContext('2d')!

  ctx.fillStyle = board.bgColor
  ctx.fillRect(0, 0, widthPx, heightPx)

  await document.fonts.ready
  const fontFamily = getComputedStyle(document.documentElement).getPropertyValue('--font-display').trim() || 'serif'

  const sorted = [...board.slots].sort((a, b) => a.z - b.z)
  for (const slot of sorted) {
    const dx = (slot.x / 100) * widthPx
    const dy = (slot.y / 100) * heightPx
    const dw = (slot.w / 100) * widthPx
    const dh = (slot.h / 100) * heightPx

    if (slot.type === 'image' && slot.content) {
      try {
        const img = await loadImage(slot.content)
        drawCover(ctx, img, dx, dy, dw, dh)
      } catch {
        // image invalide — on l'ignore plutôt que d'interrompre l'export
      }
    } else if (slot.type === 'color' && slot.content) {
      ctx.fillStyle = slot.content
      ctx.fillRect(dx, dy, dw, dh)
    } else if (slot.type === 'text' && slot.content) {
      const pad = widthPx * 0.03
      const maxWidth = Math.max(1, dw - pad * 2)
      const fontPx = ((slot.fontSize || 5) / 100) * widthPx
      const align = (slot.align || 'center') as CanvasTextAlign
      ctx.font = `${slot.fontWeight === 'bold' ? 800 : 400} ${fontPx}px ${fontFamily}`
      ctx.fillStyle = slot.color || '#12100C'
      ctx.textAlign = align
      ctx.textBaseline = 'alphabetic'

      const lines = wrapLines(ctx, slot.content, maxWidth)
      const lineHeight = fontPx * 1.15
      const totalHeight = lines.length * lineHeight
      const tx = align === 'left' ? dx + pad : align === 'right' ? dx + dw - pad : dx + dw / 2
      let ty = dy + dh / 2 - totalHeight / 2 + fontPx * 0.85
      for (const line of lines) {
        ctx.fillText(line, tx, ty, maxWidth)
        ty += lineHeight
      }
    }
  }

  return canvas
}

export function canvasToPngDownload(canvas: HTMLCanvasElement, filename: string) {
  canvas.toBlob(blob => {
    if (!blob) return
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
  }, 'image/png')
}

export function printResolutionPx(board: VisionBoard, dpi = 300): number {
  const { w } = printSizeMm(board.pageSize, board.orientation)
  return Math.round((w / 25.4) * dpi)
}

export async function downloadBoardAsPdf(board: VisionBoard, filename: string) {
  const { w, h } = printSizeMm(board.pageSize, board.orientation)
  const widthPx = printResolutionPx(board, 300)
  const canvas = await renderBoardToCanvas(board, widthPx)
  const { jsPDF } = await import('jspdf')
  const pdf = new jsPDF({ orientation: w >= h ? 'landscape' : 'portrait', unit: 'mm', format: [w, h] })
  pdf.addImage(canvas.toDataURL('image/jpeg', 0.92), 'JPEG', 0, 0, w, h)
  pdf.save(filename)
}
