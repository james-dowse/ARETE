// Helpers partagés pour le HTML riche produit par components/RichEditor.tsx
// (contentEditable brut : <div> par ligne dans Chromium, <br> en Shift+Enter,
// <p> uniquement après un embed vidéo, <ul>/<ol>/<li> pour les listes).

// Convertit les sauts de bloc en \n avant de retirer les tags restants, puis
// ne collapse que les lignes vides consécutives (garde les retours ligne).
export function stripHtmlMultiline(html: string): string {
  return html
    .replace(/<\/(div|p|li)>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/\n{2,}/g, '\n')
    .split('\n')
    .map(line => line.trim())
    .join('\n')
    .trim()
}

// Une seule ligne : tout le texte, tout whitespace (y compris les retours
// ligne) collapsé en simples espaces.
export function stripHtmlInline(html: string): string {
  return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
}
