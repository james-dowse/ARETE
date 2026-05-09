'use client'
import { useEffect, useRef, useCallback } from 'react'
import { Bold, Italic, List, ListOrdered } from 'lucide-react'

interface RichEditorProps {
  value: string
  onChange: (html: string) => void
  placeholder?: string
  minHeight?: number
  highlight?: boolean
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

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.ctrlKey || e.metaKey) {
      if (e.key === 'b') { e.preventDefault(); exec('bold') }
      if (e.key === 'i') { e.preventDefault(); exec('italic') }
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
          fontSize: 13,
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
