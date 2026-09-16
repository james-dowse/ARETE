// Source d'affichage d'un avatar, quel que soit l'endpoint d'origine.
//
// Les routes qui ne renvoient qu'un profil (mon profil, fiche utilisateur,
// édition admin) continuent d'inclure le data URI complet — c'est une seule
// image et l'écran en a besoin tout de suite. Les routes de *liste* ne
// renvoient plus que `hasAvatar` et laissent le navigateur récupérer l'image
// via /api/users/[id]/avatar, qu'il met en cache (voir la route pour le
// détail du problème).

export interface AvatarUser {
  id?: string | null
  avatarUrl?: string | null
  hasAvatar?: boolean
}

export function avatarSrc(user: AvatarUser | null | undefined): string | null {
  if (!user) return null
  if (user.avatarUrl) return user.avatarUrl
  if (user.hasAvatar && user.id) return `/api/users/${user.id}/avatar`
  return null
}
