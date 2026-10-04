// Helpers partagés pour le HTML riche produit par components/RichEditor.tsx
// (contentEditable brut : <div> par ligne dans Chromium, <br> en Shift+Enter,
// <p> uniquement après un embed vidéo, <ul>/<ol>/<li> pour les listes).

// Les entités survivent au retrait des balises : « exercice 1 &gt; exercice 2 »
// ressortait avec son `&gt;` visible. À appeler APRÈS le retrait des balises,
// jamais avant — `&lt;div&gt;` décodé d'abord fabriquerait un `<div>` que le
// retrait suivant effacerait, alors que l'utilisateur voulait voir ce texte.
// `&amp;` en dernier, sinon `&amp;gt;` ressortirait en `>` au lieu de `&gt;`.
function decodeEntites(texte: string): string {
  return texte
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
}

// Convertit les sauts de bloc en \n avant de retirer les tags restants, puis
// ne collapse que les lignes vides consécutives (garde les retours ligne).
// Le décodage s'intercale entre les deux, et non à la toute fin : un `&nbsp;`
// seul doit redevenir un espace avant le trim des lignes, sinon une
// description vide ressortirait « non vide » aux tests de complétude.
export function stripHtmlMultiline(html: string): string {
  return decodeEntites(
    html
      .replace(/<\/(div|p|li)>/gi, '\n')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<[^>]*>/g, '')
  )
    .split('\n')
    .map(line => line.trim())
    // Le collapse vient APRÈS le trim, et c'est l'ordre qui compte : une ligne
    // dont le seul contenu est `&nbsp;` — ce que Chromium écrit quand on tape
    // une espace sur une ligne vide, et ce que colle Word — devient une ligne
    // d'espace au décodage. Collapser avant le trim ne la voyait pas, et elle
    // ressortait en ligne vide conservée : deux façons d'écrire la même ligne
    // vide, `<br>` et `<div>&nbsp;</div>`, ne rendaient pas le même texte.
    .join('\n')
    .replace(/\n{2,}/g, '\n')
    .trim()
}

// Une seule ligne : tout le texte, tout whitespace (y compris les retours
// ligne) collapsé en simples espaces. Décodage avant le collapse, pour que les
// `&nbsp;` redevenus espaces soient collapsés eux aussi.
export function stripHtmlInline(html: string): string {
  return decodeEntites(html.replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim()
}
