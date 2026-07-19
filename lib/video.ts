// Résolution d'une URL vidéo vers un embed autoplay.
// autoplay=1&mute=1 : seule combinaison d'autoplay acceptée par tous les navigateurs
// (le son se réactive manuellement dans le player).
// playsinline=1 : sans lui, iOS force le plein écran dans la PWA.
// loop=1&playlist=<id> : la démo boucle — utile pendant une série.
// youtube-nocookie.com : embed sans cookies de tracking.
export type EmbedInfo = { url: string; type: 'youtube' | 'instagram' | 'video' }

export function getYouTubeId(url: string): string | null {
  try {
    const u = new URL(url)
    if (u.hostname === 'youtu.be') return u.pathname.slice(1).split('/')[0] || null
    if (u.hostname.includes('youtube.com')) {
      const v = u.searchParams.get('v')
      if (v) return v
      const m = u.pathname.match(/\/(shorts|embed)\/([^/]+)/)
      if (m) return m[2]
    }
  } catch {
    // URL invalide
  }
  return null
}

export function getEmbedInfo(url: string): EmbedInfo | null {
  const yt = getYouTubeId(url)
  if (yt) {
    return {
      url: `https://www.youtube-nocookie.com/embed/${yt}?autoplay=1&mute=1&playsinline=1&rel=0&modestbranding=1&loop=1&playlist=${yt}`,
      type: 'youtube',
    }
  }
  try {
    const u = new URL(url)
    if (u.hostname.includes('instagram.com')) {
      const m = u.pathname.match(/\/(reel|p)\/([^/]+)/)
      if (m) return { url: `https://www.instagram.com/${m[1]}/${m[2]}/embed/`, type: 'instagram' }
    }
    if (/\.(mp4|webm|ogg)(\?.*)?$/i.test(u.pathname)) {
      return { url, type: 'video' }
    }
  } catch {
    // URL invalide
  }
  return null
}
