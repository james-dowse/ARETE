'use client'
import { useEffect, useState } from 'react'
import { X, Play, ExternalLink, Heart } from 'lucide-react'
import { BIO_TYPE_COLORS, BIO_TYPE_ICONS, COMPLEXITY_COLORS, EQUIPMENT_ICONS } from '@/lib/types'

interface Movement {
  id: string
  name: string
  bioType: string
  complexity: string
  equipment?: string | null
  description?: string | null
  imageUrl?: string | null
  videoUrl?: string | null
  favorited?: boolean
}

interface Props {
  movementId: string | null
  onClose: () => void
}

// autoplay=1&mute=1 : seule combinaison acceptée par tous les navigateurs.
// Le son peut être réactivé manuellement dans le player YouTube.
// rel=0 : pas de vidéos suggérées à la fin. modestbranding=1 : logo minimal.
const YT_PARAMS = 'autoplay=1&mute=1&rel=0&modestbranding=1'

type EmbedResult = { url: string; type: 'youtube' | 'instagram' | 'video' } | null

function getEmbedInfo(url: string): EmbedResult {
  try {
    const u = new URL(url)

    // YouTube
    if (u.hostname === 'youtu.be') {
      return { url: `https://www.youtube.com/embed${u.pathname}?${YT_PARAMS}`, type: 'youtube' }
    }
    if (u.hostname.includes('youtube.com')) {
      const v = u.searchParams.get('v')
      if (v) return { url: `https://www.youtube.com/embed/${v}?${YT_PARAMS}`, type: 'youtube' }
      const shorts = u.pathname.match(/\/shorts\/([^/]+)/)
      if (shorts) return { url: `https://www.youtube.com/embed/${shorts[1]}?${YT_PARAMS}`, type: 'youtube' }
    }

    // Instagram Reels
    if (u.hostname.includes('instagram.com')) {
      const reel = u.pathname.match(/\/reel\/([^/]+)/)
      if (reel) return { url: `https://www.instagram.com/reel/${reel[1]}/embed/`, type: 'instagram' }
      const p = u.pathname.match(/\/p\/([^/]+)/)
      if (p) return { url: `https://www.instagram.com/p/${p[1]}/embed/`, type: 'instagram' }
    }

    // Fichiers vidéo directs
    if (/\.(mp4|webm|ogg)(\?.*)?$/i.test(u.pathname)) {
      return { url, type: 'video' }
    }
  } catch {
    // URL invalide
  }
  return null
}

export default function MovementModal({ movementId, onClose }: Props) {
  const [movement, setMovement] = useState<Movement | null>(null)
  const [loading, setLoading] = useState(false)
  const [favorited, setFavorited] = useState<boolean | null>(null)
  const [togglingFav, setTogglingFav] = useState(false)

  useEffect(() => {
    if (!movementId) { setMovement(null); setFavorited(null); return }
    setLoading(true)
    setFavorited(null)
    fetch(`/api/movements/${movementId}`)
      .then(r => r.json())
      .then(data => { setMovement(data); setFavorited(data.favorited ?? false) })
      .finally(() => setLoading(false))
  }, [movementId])

  const toggleFavorite = async () => {
    if (!movementId || togglingFav) return
    setTogglingFav(true)
    try {
      const res = await fetch('/api/favorites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ movementId }),
      })
      const data = await res.json()
      setFavorited(data.favorited)
    } finally {
      setTogglingFav(false)
    }
  }

  if (!movementId) return null

  const bioColor = movement ? BIO_TYPE_COLORS[movement.bioType] || 'var(--text-muted)' : 'var(--text-muted)'
  const cxColor  = movement ? COMPLEXITY_COLORS[movement.complexity] || 'var(--text-muted)' : 'var(--text-muted)'
  const embedInfo = movement?.videoUrl ? getEmbedInfo(movement.videoUrl) : null

  return (
    <div
      onClick={onClose}
      className="overlay-in"
      style={{ position: 'fixed', inset: 0, background: 'rgba(8,6,2,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100, padding: 24 }}
    >
      <div
        onClick={e => e.stopPropagation()}
        className="modal-in"
        style={{ background: 'var(--bg-card)', border: '1px solid var(--gold-border)', borderRadius: 'var(--r-lg)', width: '100%', maxWidth: 520, maxHeight: '90vh', overflowY: 'auto', boxShadow: 'var(--elev-3)' }}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '20px 20px 0' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            {loading || !movement ? (
              <div style={{ height: 24, width: 180, background: 'var(--border)', borderRadius: 6, marginBottom: 8 }} />
            ) : (
              <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800, lineHeight: 1.2 }}>{movement.name}</h2>
            )}
            {movement && (
              <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 12, padding: '3px 10px', borderRadius: 20, background: `${bioColor}18`, color: bioColor, border: `1px solid ${bioColor}33`, fontWeight: 600 }}>
                  {BIO_TYPE_ICONS[movement.bioType]} {movement.bioType}
                </span>
                <span style={{ fontSize: 12, padding: '3px 10px', borderRadius: 20, background: `${cxColor}18`, color: cxColor, border: `1px solid ${cxColor}33`, fontWeight: 600 }}>
                  {movement.complexity}
                </span>
                {movement.equipment && (
                  <span style={{ fontSize: 12, padding: '3px 10px', borderRadius: 20, background: 'var(--bg-elevated)', color: 'var(--text-muted)', border: '1px solid var(--border)', fontWeight: 600 }}>
                    {EQUIPMENT_ICONS[movement.equipment] || '🔧'} {movement.equipment}
                  </span>
                )}
              </div>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0, marginLeft: 12 }}>
            {favorited !== null && (
              <button
                onClick={toggleFavorite}
                disabled={togglingFav}
                title={favorited ? 'Retirer des favoris' : 'Ajouter aux favoris'}
                style={{
                  background: favorited ? 'rgba(239,68,68,0.1)' : 'none',
                  border: `1px solid ${favorited ? 'rgba(239,68,68,0.4)' : 'var(--border)'}`,
                  borderRadius: 8,
                  cursor: togglingFav ? 'wait' : 'pointer',
                  padding: '5px 8px',
                  display: 'flex', alignItems: 'center', gap: 5,
                  color: favorited ? 'var(--red)' : 'var(--text-muted)',
                  fontSize: 12, fontWeight: 600,
                  transition: 'all 0.15s',
                  opacity: togglingFav ? 0.6 : 1,
                }}
              >
                <Heart size={14} fill={favorited ? 'currentColor' : 'none'} />
                {favorited ? 'Favori' : 'Favori'}
              </button>
            )}
            <button
              onClick={onClose}
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: 'var(--text-muted)' }}
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Body */}
        <div style={{ padding: '16px 20px 20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          {loading && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[140, 100, 80].map(w => (
                <div key={w} style={{ height: 14, width: w, background: 'var(--border)', borderRadius: 4 }} />
              ))}
            </div>
          )}

          {/* Video */}
          {movement?.videoUrl && (
            <div>
              {embedInfo?.type === 'video' ? (
                // Fichier vidéo direct
                <video
                  src={embedInfo.url}
                  autoPlay
                  muted
                  playsInline
                  controls
                  style={{ width: '100%', borderRadius: 10, background: '#000', maxHeight: 300 }}
                />
              ) : embedInfo ? (
                // YouTube ou Instagram iframe
                <div>
                  <div style={{
                    position: 'relative',
                    paddingBottom: embedInfo.type === 'instagram' ? '125%' : '56.25%',
                    borderRadius: 10,
                    overflow: 'hidden',
                    background: '#000',
                  }}>
                    <iframe
                      src={embedInfo.url}
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                      allowFullScreen
                      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 'none' }}
                    />
                  </div>
                  {embedInfo.type === 'youtube' && (
                    <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
                      🔇 Lecture automatique muette — clique 🔊 dans le player pour activer le son
                    </div>
                  )}
                </div>
              ) : (
                // Fallback lien externe
                <a
                  href={movement.videoUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 10, textDecoration: 'none', color: 'var(--text-primary)', fontSize: 13, fontWeight: 600 }}
                >
                  <Play size={14} fill="currentColor" />
                  Voir la vidéo
                  <ExternalLink size={12} style={{ marginLeft: 'auto', color: 'var(--text-muted)' }} />
                </a>
              )}
            </div>
          )}

          {/* Image (if no video) */}
          {movement?.imageUrl && !movement.videoUrl && (
            <img
              src={movement.imageUrl}
              alt={movement.name}
              style={{ width: '100%', borderRadius: 10, objectFit: 'cover', maxHeight: 240 }}
            />
          )}

          {/* Description */}
          {movement?.description && (
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: 0.8, marginBottom: 8 }}>DESCRIPTION</div>
              <p style={{ margin: 0, fontSize: 15, color: 'var(--text-primary)', lineHeight: 1.65, whiteSpace: 'pre-wrap' }}>
                {movement.description}
              </p>
            </div>
          )}

          {movement && !movement.description && !movement.videoUrl && !movement.imageUrl && (
            <p style={{ margin: 0, fontSize: 13, color: 'var(--text-dim)', fontStyle: 'italic' }}>
              Aucune description disponible pour ce mouvement.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
