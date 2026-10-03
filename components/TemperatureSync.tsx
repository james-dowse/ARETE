'use client'
import { useEffect } from 'react'

const CLE = 'arete-temp'
const CRANS = ['froid', 'forge', 'or'] as const

/**
 * Pose l'attribut `data-temp` sur <html>, qui pilote l'axe de température
 * défini dans app/globals.css.
 *
 * Mode manuel, pour l'instant : la valeur vient de `?temp=` dans l'URL, qui la
 * mémorise, ou de ce qui a été mémorisé auparavant. `?temp=auto` efface le
 * choix et rend l'application à son apparence par défaut.
 *
 * La bascule automatique — froid quand rien n'est entrepris, forge pendant la
 * création et l'effort, or après une séance puis refroidissement — n'est pas
 * encore branchée : elle demande de décider ce qui fait foi dans la donnée, et
 * ça ne s'improvise pas dans un effet de rendu.
 */
export default function TemperatureSync() {
  useEffect(() => {
    const racine = document.documentElement
    let choix: string | null = null

    try {
      const url = new URLSearchParams(window.location.search).get('temp')
      if (url === 'auto' || url === 'defaut') {
        localStorage.removeItem(CLE)
        racine.removeAttribute('data-temp')
        return
      }
      if (url && (CRANS as readonly string[]).includes(url)) {
        localStorage.setItem(CLE, url)
        choix = url
      } else {
        choix = localStorage.getItem(CLE)
      }
    } catch {
      // localStorage peut lever en navigation privée : l'application doit
      // simplement rester à son apparence par défaut.
      return
    }

    if (choix && (CRANS as readonly string[]).includes(choix)) racine.setAttribute('data-temp', choix)
    else racine.removeAttribute('data-temp')
  }, [])

  return null
}
