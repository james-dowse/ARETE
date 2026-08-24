'use client'
import { useEffect, useRef, useCallback } from 'react'
import { Bold, Italic, List, ListOrdered, Link2 } from 'lucide-react'
import { getEmbedInfo, type EmbedInfo } from '@/lib/video'

interface RichEditorProps {
  value: string
  onChange: (html: string) => void
  placeholder?: string
  minHeight?: number
  highlight?: boolean
}

const escapeHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const escapeAttr = (s: string) => escapeHtml(s).replace(/"/g, '&quot;')

// Retire l'autoplay des embeds vidéo : dans une description on parcourt la page
// passivement, contrairement à la modale mouvement où l'utilisateur vient de
// cliquer "regarder". Le lecteur reste cliquable (accessible au clic), pas
// intrusif au chargement.
function clickToPlayUrl(url: string): string {
  try {
    const u = new URL(url)
    ;['autoplay', 'mute', 'loop', 'playlist'].forEach(p => u.searchParams.delete(p))
    return u.toString()
  } catch {
    return url
  }
}

function buildVideoEmbedHtml(embed: EmbedInfo): string {
  if (embed.type === 'video') {
    return `<div class="rich-video-embed" contenteditable="false"><video src="${escapeAttr(embed.url)}" controls playsinline style="width:100%;display:block"></video></div><p><br></p>`
  }
  const src = escapeAttr(clickToPlayUrl(embed.url))
  return `<div class="rich-video-embed" contenteditable="false"><div class="rich-video-embed-ratio"><iframe src="${src}" allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen loading="lazy"></iframe></div></div><p><br></p>`
}

export default function RichEditor({
  value,
  onChange,
  placeholder = 'Écrire ici…',
  minHeight = 80,
  highlight = false,
}: RichEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null)
  const composingRef = useRef(false)
  const savedRangeRef = useRef<Range | null>(null)

  // Set initial HTML once on mount only — don't sync from prop on re-renders (would destroy cursor)
  useEffect(() => {
    if (editorRef.current) {
      editorRef.current.innerHTML = value || ''
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const exec = useCallback(
    (command: string) => {
      editorRef.current?.focus()
      // eslint-disable-next-line @typescript-eslint/no-deprecated
      document.execCommand(command, false, undefined)
      onChange(editorRef.current?.innerHTML || '')
    },
    [onChange]
  )

  const handleInput = () => {
    if (!composingRef.current) {
      onChange(editorRef.current?.innerHTML || '')
    }
  }

  // Le prompt() vole le focus de l'éditeur : sans sauvegarder la sélection avant
  // de l'ouvrir, on perd l'endroit où insérer le lien/embed au retour.
  const saveSelection = () => {
    const sel = window.getSelection()
    if (sel && sel.rangeCount > 0 && editorRef.current?.contains(sel.anchorNode)) {
      savedRangeRef.current = sel.getRangeAt(0).cloneRange()
    }
  }

  const restoreSelection = () => {
    const sel = window.getSelection()
    if (!sel) return
    sel.removeAllRanges()
    if (savedRangeRef.current) sel.addRange(savedRangeRef.current)
  }

  const insertLink = () => {
    // La sélection est encore intacte ici (le mousedown du bouton a fait
    // preventDefault, donc pas de perte de focus) — on la sauvegarde avant que
    // prompt() ne vole le focus et ne la fasse potentiellement disparaître.
    saveSelection()
    const raw = window.prompt('URL du lien — colle un lien vidéo (YouTube, Instagram, TikTok…) pour l\'incruster :')
    const url = raw?.trim()
    if (!url) return

    editorRef.current?.focus()
    restoreSelection()

    const embed = getEmbedInfo(url)
    if (embed) {
      // eslint-disable-next-line @typescript-eslint/no-deprecated
      document.execCommand('insertHTML', false, buildVideoEmbedHtml(embed))
      onChange(editorRef.current?.innerHTML || '')
      return
    }

    const sel = window.getSelection()
    const hasSelection = !!sel && !sel.isCollapsed
    if (hasSelection) {
      // eslint-disable-next-line @typescript-eslint/no-deprecated
      document.execCommand('createLink', false, url)
    } else {
      const label = window.prompt('Texte affiché pour ce lien :', url) || url
      // eslint-disable-next-line @typescript-eslint/no-deprecated
      document.execCommand(
        'insertHTML', false,
        `<a href="${escapeAttr(url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(label)}</a>&nbsp;`
      )
    }
    onChange(editorRef.current?.innerHTML || '')
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.ctrlKey || e.metaKey) {
      if (e.key === 'b') { e.preventDefault(); exec('bold') }
      if (e.key === 'i') { e.preventDefault(); exec('italic') }
      if (e.key === 'k') { e.preventDefault(); insertLink() }
    }
  }

  const borderColor = highlight ? 'var(--dirty-border)' : 'var(--border)'
  const bgColor = highlight ? 'var(--dirty)' : 'var(--bg-elevated)'

  return (
    <div style={{ border: `1px solid ${borderColor}`, borderRadius: 8, overflow: 'hidden', background: bgColor, transition: 'all 0.2s' }}>
      {/* Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 1, padding: '3px 6px', borderBottom: `1px solid ${borderColor}`, background: 'var(--bg-card)' }}>
        <ToolBtn onClick={() => exec('bold')} title="Gras (Ctrl+B)"><Bold size={12} /></ToolBtn>
        <ToolBtn onClick={() => exec('italic')} title="Italique (Ctrl+I)"><Italic size={12} /></ToolBtn>
        <div style={{ width: 1, height: 14, background: 'var(--border)', margin: '0 4px' }} />
        <ToolBtn onClick={() => exec('insertUnorderedList')} title="Liste à puces"><List size={12} /></ToolBtn>
        <ToolBtn onClick={() => exec('insertOrderedList')} title="Liste numérotée"><ListOrdered size={12} /></ToolBtn>
        <div style={{ width: 1, height: 14, background: 'var(--border)', margin: '0 4px' }} />
        <ToolBtn onClick={insertLink} title="Lien / incruster une vidéo (Ctrl+K)"><Link2 size={12} /></ToolBtn>
      </div>
      {/* Editable area */}
      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        onInput={handleInput}
        onKeyDown={handleKeyDown}
        onCompositionStart={() => { composingRef.current = true }}
        onCompositionEnd={() => { composingRef.current = false; handleInput() }}
        data-placeholder={placeholder}
        className="rich-editor"
        style={{
          padding: '10px 12px',
          minHeight,
          outline: 'none',
          fontSize: 14,
          lineHeight: 1.7,
          color: highlight ? 'var(--dirty-text)' : 'var(--text-primary)',
          cursor: 'text',
        }}
      />
    </div>
  )
}

function ToolBtn({ onClick, title, children }: { onClick: () => void; title: string; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onMouseDown={e => { e.preventDefault(); onClick() }}
      title={title}
      style={{
        width: 26, height: 26,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'none', border: 'none', borderRadius: 5,
        cursor: 'pointer', color: 'var(--text-muted)',
        flexShrink: 0,
      }}
    >
      {children}
    </button>
  )
}
