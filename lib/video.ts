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

// Extrait l'ID vidéo d'une URL d'embed YouTube déjà construite (youtube-nocookie.com/embed/{id}?...).
// Sert à réinitialiser le lecteur via l'IFrame API plutôt que de dépendre de l'URL brute d'origine.
export function extractEmbedVideoId(embedUrl: string): string | null {
  const m = embedUrl.match(/\/embed\/([^/?]+)/)
  return m ? m[1] : null
}

// Vignette YouTube d'une URL de démonstration.
//
// Sert de couverture de secours pour les séances sans image : les cartouches
// affichaient toutes le même logo délavé sur un carré vide, donc une liste de
// séances était visuellement indifférenciée. Les vignettes YouTube sont
// servies gratuitement par `i.ytimg.com`, sans clé ni stockage : une séance
// dont le premier mouvement a une vidéo hérite donc d'une couverture réelle.
//
// `hqdefault` plutôt que `maxresdefault` : toujours présent, y compris sur les
// vidéos anciennes ou de faible définition, où `maxresdefault` renvoie 404.
export function youtubeThumbnail(url: string | null | undefined): string | null {
  if (!url) return null
  const id = getYouTubeId(url) || null
  return id ? `https://i.ytimg.com/vi/${id}/hqdefault.jpg` : null
}

// Jeu de sources pour `srcset` : le navigateur choisit la définition adaptée à
// la taille réelle d'affichage et à la densité de l'écran.
//
// Une vignette de cartouche fait 84 px sur téléphone : y servir le hqdefault
// (480×360, ~20 Ko) revenait à télécharger 22 images inutilement lourdes sur
// un réseau mobile. Le mqdefault (320×180, ~8 Ko) suffit à cette taille, et le
// hqdefault reste disponible pour les écrans à forte densité.
export function youtubeThumbnailSrcSet(url: string | null | undefined): string | null {
  if (!url) return null
  const id = getYouTubeId(url)
  if (!id) return null
  return `https://i.ytimg.com/vi/${id}/mqdefault.jpg 320w, https://i.ytimg.com/vi/${id}/hqdefault.jpg 480w`
}

// Vrai si l'URL de couverture est une vignette YouTube (donc déclinable en
// plusieurs définitions) — une image téléversée par l'auteur ne l'est pas.
export function isYouTubeThumbnail(url: string | null | undefined): boolean {
  return !!url && url.startsWith('https://i.ytimg.com/vi/')
}

// Décline une URL de vignette YouTube déjà construite en `srcset`.
export function thumbnailSrcSet(url: string | null | undefined): string | undefined {
  if (!isYouTubeThumbnail(url)) return undefined
  const id = url!.slice('https://i.ytimg.com/vi/'.length).split('/')[0]
  return `https://i.ytimg.com/vi/${id}/mqdefault.jpg 320w, https://i.ytimg.com/vi/${id}/hqdefault.jpg 480w`
}

// Première vignette exploitable parmi les mouvements d'une séance.
export function derivedCover(movements: { movement?: { videoUrl?: string | null } | null }[] | undefined): string | null {
  if (!movements) return null
  for (const m of movements) {
    const thumb = youtubeThumbnail(m.movement?.videoUrl)
    if (thumb) return thumb
  }
  return null
}
