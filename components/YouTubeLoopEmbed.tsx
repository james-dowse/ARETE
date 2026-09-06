'use client'
import { useEffect, useId, useRef } from 'react'

// Boucle sans coupure : on pilote un seul lecteur via l'IFrame API et on
// revient au début à la fin (seekTo + playVideo) plutôt que de compter sur
// loop=1&playlist=<id>, qui force YouTube à recharger l'iframe à chaque tour
// (flash noir + rebuffering visibles).

declare global {
  interface Window {
    YT?: {
      Player: new (elementId: string, options: Record<string, unknown>) => YTPlayer
      PlayerState: { ENDED: number }
    }
    onYouTubeIframeAPIReady?: () => void
  }
}

interface YTPlayer {
  destroy: () => void
  seekTo: (seconds: number, allowSeekAhead: boolean) => void
  playVideo: () => void
  loadVideoById: (videoId: string) => void
}

let apiReady: Promise<void> | null = null
function loadYouTubeApi(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve()
  if (window.YT?.Player) return Promise.resolve()
  if (apiReady) return apiReady
  apiReady = new Promise(resolve => {
    const prev = window.onYouTubeIframeAPIReady
    window.onYouTubeIframeAPIReady = () => { prev?.(); resolve() }
    if (!document.getElementById('youtube-iframe-api')) {
      const script = document.createElement('script')
      script.id = 'youtube-iframe-api'
      script.src = 'https://www.youtube.com/iframe_api'
      document.head.appendChild(script)
    }
  })
  return apiReady
}

export default function YouTubeLoopEmbed({ videoId, style }: { videoId: string; style?: React.CSSProperties }) {
  const containerId = 'yt-loop-' + useId().replace(/[^a-zA-Z0-9]/g, '')
  const playerRef = useRef<YTPlayer | null>(null)
  // L'ID de la vidéo actuellement chargée dans le player, distinct de la prop
  // `videoId` : permet de détecter un changement de mouvement sans dépendre
  // de l'ordre effet/re-render.
  const loadedIdRef = useRef<string | null>(null)

  // Un seul player créé au montage, jamais détruit/recréé lors d'un simple
  // changement de mouvement (`loadVideoById` à la place) : détruire l'iframe
  // YouTube pendant que React tient encore une réf dessus (remount forcé par
  // une `key` sur ce composant à chaque mouvement) provoquait une exception
  // DOM (`removeChild` sur un nœud déjà retiré par l'API YouTube) qui
  // plantait le rendu React de toute la page "séance en cours" — d'où le
  // "page can't load" à chaque changement d'exercice, aussi bien en
  // superset qu'en classique.
  useEffect(() => {
    let cancelled = false
    loadYouTubeApi().then(() => {
      if (cancelled || !window.YT || playerRef.current) return
      playerRef.current = new window.YT.Player(containerId, {
        host: 'https://www.youtube-nocookie.com',
        videoId,
        playerVars: {
          autoplay: 1, mute: 1, playsinline: 1, rel: 0, modestbranding: 1,
          origin: typeof window !== 'undefined' ? window.location.origin : undefined,
        },
        events: {
          onStateChange: (e: { data: number; target: YTPlayer }) => {
            if (window.YT && e.data === window.YT.PlayerState.ENDED) {
              e.target.seekTo(0, true)
              e.target.playVideo()
            }
          },
        },
      })
      loadedIdRef.current = videoId
    })
    return () => {
      cancelled = true
      playerRef.current?.destroy?.()
      playerRef.current = null
      loadedIdRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [containerId])

  useEffect(() => {
    if (playerRef.current && loadedIdRef.current !== videoId) {
      playerRef.current.loadVideoById(videoId)
      loadedIdRef.current = videoId
    }
  }, [videoId])

  return <div id={containerId} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', ...style }} />
}
