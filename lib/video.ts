// Résolution d'une URL vidéo vers un embed autoplay.
// autoplay=1&mute=1 : seule combinaison d'autoplay acceptée par tous les navigateurs
// (le son se réactive manuellement dans le player).
// playsinline=1 : sans lui, iOS force le plein écran dans la PWA.
// loop=1&playlist=<id> : la démo boucle — utile pendant une série.
// youtube-nocookie.com : embed sans cookies de tracking.
export type EmbedInfo = { url: string; type: 'youtube' | 'instagram' | 'tiktok' | 'facebook' | 'video' }

// Certaines URL collectées sont en réalité des liens de recherche Google Vidéo
// qui encapsulent l'ID YouTube réel dans le paramètre vld (vid:XXXXXXXXXXX).
// On les récupère avant le parsing normal plutôt que de les laisser tomber en lien externe.
function extractGoogleSearchYouTubeId(url: string): string | null {
  try {
    const u = new URL(url)
    if (!u.hostname.includes('google.') || u.pathname !== '/search') return null
    const vld = u.hash.match(/vld=([^&]+)/)?.[1] || u.searchParams.get('vld')
    if (!vld) return null
    const m = decodeURIComponent(vld).match(/vid:([a-zA-Z0-9_-]{6,})/)
    return m ? m[1] : null
  } catch {
    return null
  }
}

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
  const googleYt = extractGoogleSearchYouTubeId(url)
  const yt = googleYt || getYouTubeId(url)
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
    // TikTok : embed iframe non officiel mais stable, pas de script tiers requis.
    if (u.hostname.includes('tiktok.com')) {
      const m = u.pathname.match(/\/video\/(\d+)/)
      if (m) return { url: `https://www.tiktok.com/embed/v2/${m[1]}`, type: 'tiktok' }
    }
    // Facebook Reel/Video : plugin officiel Meta, pur iframe, pas de SDK JS.
    if (u.hostname.includes('facebook.com') && /\/(reel|videos)\//.test(u.pathname)) {
      return {
        url: `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(url)}&show_text=false&autoplay=true&mute=1`,
        type: 'facebook',
      }
    }
    if (/\.(mp4|webm|ogg)(\?.*)?$/i.test(u.pathname)) {
      return { url, type: 'video' }
    }
  } catch {
    // URL invalide
  }
  return null
}
