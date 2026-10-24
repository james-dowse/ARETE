import { NextResponse } from 'next/server'
import { SESSION_COOKIE } from '@/lib/session'

// Déconnexion. Il n'existait aucune route pour sortir de l'application : le
// commentaire de proxy.ts le relevait déjà comme le piège d'un cookie mort —
// une application qui a l'air connectée, vide, et dont on ne peut pas sortir.
//
// Il n'y a rien à révoquer côté serveur : la session EST le cookie signé (voir
// lib/session.ts), aucun jeton n'est stocké en base pour une session ouverte.
// Supprimer le cookie suffit donc à fermer la session — et comme la signature
// n'encode pas de date, un cookie recopié ailleurs avant la déconnexion reste
// valide. C'est le modèle en place, pas une régression introduite ici : le
// changer demande une colonne de version de session sur InvitedUser.
//
// POST et non GET : un GET se déclenche par une balise <img>, un préchargement
// de lien ou un scanner d'URL. Une déconnexion accidentelle au survol d'un
// lien est exactement ce qu'on ne veut pas sur une PWA où revenir coûte un
// code par email.
export async function POST() {
  const res = NextResponse.json({ ok: true })

  // Valeur vide + maxAge 0, avec LES MÊMES attributs que la pose du cookie
  // (api/auth/verify-code et api/auth/verify) : un navigateur n'écrase un
  // cookie que si le nom, le chemin et le domaine correspondent. Un
  // `delete(nom)` nu, sans `path`, laisse survivre celui posé sur `/`.
  res.cookies.set(SESSION_COOKIE, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  })

  return res
}
