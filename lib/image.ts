import { thumbnailSrcSet, isYouTubeThumbnail } from './video'

// Dimensionnement des images de couverture.
//
// Les images de séance sont hébergées sur Google Drive
// (`lh3.googleusercontent.com`) et servies en pleine résolution par défaut :
// une couverture mesurée fait 3,2 Mo. La liste « Mes séances » en affiche 22 —
// soit une soixantaine de mégaoctets d'images pour des vignettes de 84 px sur
// un téléphone, en 4G.
//
// Ces URL acceptent des paramètres de redimensionnement côté Google, gratuits
// et immédiats : `=w104-h130-c` ramène la même image à 22 Ko. On les applique
// donc systématiquement, à la taille réellement affichée.
//
// Les vignettes YouTube (couverture dérivée d'une vidéo de démonstration) ont
// leur propre jeu de définitions, géré dans lib/video.ts.

const GOOGLE_HOSTS = ['lh3.googleusercontent.com', 'lh4.googleusercontent.com', 'lh5.googleusercontent.com', 'lh6.googleusercontent.com']

function isGoogleUserContent(url: string): boolean {
  try {
    return GOOGLE_HOSTS.includes(new URL(url).hostname)
  } catch {
    return false
  }
}

// Retire un éventuel suffixe de dimensionnement déjà présent (`=w320-h400-c`),
// pour ne jamais en empiler deux.
function stripSizeSuffix(url: string): string {
  const i = url.lastIndexOf('=')
  if (i === -1) return url
  const suffix = url.slice(i + 1)
  return /^[swh]\d/.test(suffix) ? url.slice(0, i) : url
}

/**
 * URL de l'image ramenée à la taille d'affichage.
 * `crop` recadre au format demandé plutôt que de tenir dans la boîte.
 * Une URL d'un autre hébergeur est renvoyée telle quelle.
 */
export function sizedImage(
  url: string | null | undefined,
  { width, height, crop = true }: { width: number; height?: number; crop?: boolean },
): string | null | undefined {
  if (!url || !isGoogleUserContent(url)) return url
  const base = stripSizeSuffix(url)
  const parts = [`w${Math.round(width)}`]
  if (height) parts.push(`h${Math.round(height)}`)
  if (crop && height) parts.push('c')
  return `${base}=${parts.join('-')}`
}

/**
 * Jeu `srcset` en 1x et 2x, pour rester net sur les écrans à forte densité
 * sans imposer la double résolution à tout le monde.
 */
export function sizedImageSrcSet(
  url: string | null | undefined,
  { width, height, crop = true }: { width: number; height?: number; crop?: boolean },
): string | undefined {
  if (!url || !isGoogleUserContent(url)) return undefined
  const x1 = sizedImage(url, { width, height, crop })
  const x2 = sizedImage(url, { width: width * 2, height: height ? height * 2 : undefined, crop })
  return `${x1} 1x, ${x2} 2x`
}

// ── Couverture de séance, tous hébergeurs confondus ────────────────────────
// Une couverture est soit une image choisie par l'auteur (Google Drive), soit
// la vignette dérivée d'une vidéo de démonstration (YouTube). Les deux ont un
// mécanisme de définition différent ; ce point d'entrée unique évite d'avoir à
// s'en souvenir sur chaque écran.

export function coverSources(
  url: string | null | undefined,
  size: { width: number; height?: number; crop?: boolean },
): { src: string | null | undefined; srcSet: string | undefined; sizes: string | undefined } {
  if (!url) return { src: url, srcSet: undefined, sizes: undefined }
  if (isYouTubeThumbnail(url)) {
    return {
      src: url,
      srcSet: thumbnailSrcSet(url),
      sizes: `${Math.round(size.width)}px`,
    }
  }
  return {
    src: sizedImage(url, size),
    srcSet: sizedImageSrcSet(url, size),
    sizes: undefined, // srcset en densité (1x/2x) : `sizes` ne s'applique pas
  }
}
