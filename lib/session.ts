import { cache } from 'react'
import { cookies } from 'next/headers'
import { createHmac, hkdfSync, timingSafeEqual } from 'crypto'
import { prisma } from './prisma'

export const SESSION_COOKIE = 'arete_uid'

// ── Le cookie de session est signé ───────────────────────────────────────────
//
// Avant, `arete_uid` contenait l'identifiant brut et getCurrentUser faisait
// directement findUnique({ where: { id: <valeur du cookie> } }) : le cookie
// ÉTAIT le mot de passe du compte. Or les identifiants des autres comptes
// sortaient des réponses d'API (recherche d'utilisateur, auteur d'une séance
// publique) — coller celui de l'administrateur dans son propre cookie
// suffisait à prendre son compte, sans rien deviner ni forcer. D'où la
// signature HMAC : le serveur refuse tout cookie qu'il n'a pas émis lui-même.
//
// Aucune compatibilité avec l'ancienne forme non signée : l'accepter encore,
// même « le temps de la transition », laisserait la faille grande ouverte.
//
// LA CLÉ : SESSION_SECRET si la variable existe, sinon une clé DÉRIVÉE de
// TURSO_AUTH_TOKEN. Exiger SESSION_SECRET aurait déconnecté tout le monde au
// déploiement, puisque Vercel ne le définit pas encore et qu'un déploiement ne
// prévient pas. TURSO_AUTH_TOKEN, lui, est déjà indispensable au
// fonctionnement, n'existe que côté serveur, et la dérivation HKDF avec ses
// étiquettes de domaine propres ne permet ni de remonter au jeton ni de
// réutiliser la clé ailleurs.
//
// POUR BASCULER PLUS TARD SUR UN VRAI SESSION_SECRET SANS DÉCONNECTER
// PERSONNE : définir la variable, puis accepter temporairement les deux clés
// dans verifiedUserId (boucler sur [clé explicite, clé dérivée]) tout en
// signant avec la seule nouvelle, et retirer la dérivée une fois les cookies
// renouvelés. En l'état, définir SESSION_SECRET invalide les sessions en
// cours : les trois comptes se reconnectent par lien magique, rien de plus.
const KEY_SALT = 'arete/cookie-de-session'
const KEY_INFO = 'hmac-sha256/v1'

let cachedKey: Buffer | null = null

function signingKey(): Buffer {
  if (cachedKey) return cachedKey

  const explicit = process.env.SESSION_SECRET?.trim()
  if (explicit) {
    cachedKey = Buffer.from(explicit, 'utf8')
    return cachedKey
  }

  const turso = process.env.TURSO_AUTH_TOKEN?.trim()
  if (turso) {
    cachedKey = Buffer.from(hkdfSync('sha256', turso, KEY_SALT, KEY_INFO, 32))
    return cachedKey
  }

  // Échec franc, et volontairement : se rabattre sur une clé par défaut
  // rendrait la signature décorative (n'importe qui pourrait signer), et
  // renvoyer « non connecté » masquerait une configuration cassée derrière un
  // écran de login qui ne marcherait jamais.
  throw new Error(
    'Clé de signature de session introuvable : définir SESSION_SECRET, ' +
      'ou TURSO_AUTH_TOKEN (dont la clé est alors dérivée).',
  )
}

function signature(userId: string): string {
  return createHmac('sha256', signingKey()).update(userId).digest('base64url')
}

// Valeur à poser dans le cookie : « <id>.<signature> ». Seul chemin pour
// fabriquer cette valeur — les trois points d'entrée qui connectent
// (api/auth/verify, api/auth/verify-code, api/invite/accept) passent par ici,
// pour qu'aucun n'oublie la signature.
export function sessionCookieValue(userId: string): string {
  return `${userId}.${signature(userId)}`
}

// La signature est vérifiée AVANT toute requête base : un cookie forgé ne doit
// pas même coûter un aller-retour Turso.
//
// `lastIndexOf` et non `split` : un identifiant cuid ne contient pas de point,
// mais découper sur le dernier séparateur reste juste si cela change un jour.
function verifiedUserId(raw: string | undefined): string | null {
  if (!raw) return null
  const cut = raw.lastIndexOf('.')
  if (cut <= 0 || cut === raw.length - 1) return null

  const userId = raw.slice(0, cut)
  const given = Buffer.from(raw.slice(cut + 1), 'base64url')
  const expected = Buffer.from(signature(userId), 'base64url')

  // timingSafeEqual lève une exception si les longueurs diffèrent : on les
  // compare d'abord, la longueur d'une signature n'étant pas un secret.
  if (given.length !== expected.length) return null
  return timingSafeEqual(given, expected) ? userId : null
}

// cache() dédoublonne l'appel sur la durée d'une requête : une page qui rend un
// layout + des composants serveur touchant tous la session ne paie qu'un seul
// aller-retour base au lieu d'un par appel.
export const getCurrentUser = cache(async () => {
  const jar = await cookies()
  const uid = verifiedUserId(jar.get(SESSION_COOKIE)?.value)
  if (!uid) return null
  try {
    return await prisma.invitedUser.findUnique({ where: { id: uid } })
  } catch {
    return null
  }
})

export async function getCurrentUserId(): Promise<string | null> {
  const user = await getCurrentUser()
  return user?.id ?? null
}
