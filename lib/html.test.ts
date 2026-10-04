import { describe, it, expect } from 'vitest'
import { stripHtmlMultiline } from './html'

describe('stripHtmlMultiline — les deux façons d’écrire une ligne vide', () => {
  // Régression. Le collapse des lignes vides se faisait AVANT le trim ligne à
  // ligne : une ligne dont le seul contenu est `&nbsp;` devenait une ligne
  // d’espace au décodage, que le collapse — déjà passé — ne voyait plus, et que
  // le trim laissait en ligne vide. Deux façons d’écrire la même chose ne
  // rendaient donc pas le même texte, et la ligne blanche s’imprimait sur la
  // feuille de séance (`white-space: pre-line`) ou mangeait l’une des deux
  // lignes visibles d’une carte (`WebkitLineClamp: 2`).
  //
  // Chromium écrit `<div>&nbsp;</div>` dès qu’on tape une espace sur une ligne
  // vide dans l’éditeur riche, et Word colle les mêmes séparateurs.
  it('une ligne ne contenant qu’un &nbsp; ne laisse pas de ligne blanche', () => {
    expect(stripHtmlMultiline('<div>Bloc A</div><div>&nbsp;</div><div>Bloc B</div>'))
      .toBe('Bloc A\nBloc B')
  })

  it('plusieurs &nbsp; consécutifs non plus', () => {
    expect(stripHtmlMultiline('<div>Bloc A</div><div>&nbsp;</div><div>&nbsp;</div><div>Bloc B</div>'))
      .toBe('Bloc A\nBloc B')
  })

  it('les <br> vides donnent exactement le même texte', () => {
    expect(stripHtmlMultiline('Bloc A<br><br>Bloc B'))
      .toBe(stripHtmlMultiline('<div>Bloc A</div><div>&nbsp;</div><div>Bloc B</div>'))
  })

  it('les vrais retours à la ligne sont conservés', () => {
    expect(stripHtmlMultiline('<div>Un</div><div>Deux</div><div>Trois</div>'))
      .toBe('Un\nDeux\nTrois')
  })

  it('les entités sont décodées et les balises retirées', () => {
    expect(stripHtmlMultiline('<p>Gainage &amp; <b>tirage</b> &gt; 30 s</p>'))
      .toBe('Gainage & tirage > 30 s')
  })

  it('une description qui n’a que du vide ressort vide', () => {
    expect(stripHtmlMultiline('<div>&nbsp;</div><div><br></div>')).toBe('')
  })
})
