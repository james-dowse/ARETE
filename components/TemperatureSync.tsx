'use client'
import { useEffect } from 'react'
import { usePathname } from 'next/navigation'

const CLE = 'arete-temp'
const CRANS = ['froid', 'forge', 'or'] as const
type Cran = (typeof CRANS)[number]

/**
 * Pose l'attribut `data-temp` sur <html>, qui pilote l'axe de température
 * défini dans app/globals.css.
 *
 * La température suit la place de l'écran dans le parcours, pas une préférence :
 * froid tant que rien n'est engagé, forge pendant qu'on crée et qu'on fait, or
 * une fois que c'est accompli. Les écrans partagent la même trame et gagnent en
 * chaleur à mesure qu'on avance.
 *
 * Un `?temp=froid|forge|or` force un cran sur toute l'application — c'est un
 * outil de comparaison, pas le fonctionnement normal. `?temp=auto` l'efface et
 * rend la main à la gradation.
 */

// Du plus spécifique au moins spécifique : la première entrée qui correspond
// gagne, sinon c'est le froid.
const PARCOURS: ReadonlyArray<readonly [RegExp, Cran]> = [
  // On crée, on lance, on fait. Le générateur n'est pas une antichambre :
  // forger la séance est déjà l'acte de forge.
  [/^\/generator/, 'forge'],
  [/^\/workouts\/[^/]+/, 'forge'],
  [/^\/workouts$/, 'forge'],

  // C'est accompli : ce qu'on vient de faire, et ce qu'on a accumulé.
  [/^\/progression/, 'or'],

  // Tout le reste est la matière première et l'intendance : le référentiel, le
  // planning, l'accueil, les réglages. Rien n'y est engagé.
]

function cranPour(chemin: string): Cran {
  for (const [motif, cran] of PARCOURS) if (motif.test(chemin)) return cran
  return 'froid'
}

export default function TemperatureSync() {
  const chemin = usePathname()

  useEffect(() => {
    const racine = document.documentElement

    // Le forçage ne vaut que pour ce chargement, et n'est jamais mémorisé : une
    // préférence stockée avait enfermé toute l'application dans un seul cran,
    // menus compris, ce qui est exactement le contraire d'une gradation.
    let force: string | null = null
    try {
      const url = new URLSearchParams(window.location.search).get('temp')
      if (url && (CRANS as readonly string[]).includes(url)) force = url
      localStorage.removeItem(CLE)
    } catch {
      force = null
    }

    racine.setAttribute('data-temp', (force as Cran) ?? cranPour(chemin || '/'))
  }, [chemin])

  return null
}
