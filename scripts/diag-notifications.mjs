#!/usr/bin/env node
// Diagnostic des annonces et des notifications sur la base de PRODUCTION.
//
//   node scripts/diag-notifications.mjs
//
// STRICTEMENT EN LECTURE : que des SELECT. Aucune écriture, aucune suppression.
//
// Répond à trois questions d'un coup :
//   1. L'annonce existe-t-elle, et est-elle active ? Le tableau de bord ne lit
//      que `where: { active: true }` (app/(app)/dashboard/page.tsx) — une annonce
//      désactivée laisse derrière elle des notifications qui pointent vers une
//      page où il n'y a plus rien.
//   2. Combien de notifications, pour combien d'utilisateurs. Publier une
//      annonce déclenche un createMany sur TOUS les utilisateurs
//      (app/api/admin/content/[key]/route.ts) : six essais font six notifications
//      par personne.
//   3. Les notifications orphelines, dont le `link` mène à une séance supprimée.
//      Le lien est une chaîne figée que personne ne nettoie.
//
// On lit .env et .env.local à la main plutôt que par dotenv : le paquet n'est
// pas une dépendance déclarée du projet, il ne se résout qu'en transitif.

import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { createClient } from '@libsql/client'

const C = { g: '\x1b[32m', r: '\x1b[31m', j: '\x1b[33m', d: '\x1b[2m', b: '\x1b[1m', x: '\x1b[0m' }

// Sur ce poste, Node n'utilise pas le magasin de certificats de Windows : toute
// requête vers Turso échoue sur un « fetch failed » laconique, qui ressemble à
// une panne réseau alors que c'est un refus TLS. Les configurations de lancement
// du poste posent toutes NODE_OPTIONS=--use-system-ca pour cette raison. Plutôt
// que d'exiger qu'on s'en souvienne, on se relance une fois avec le drapeau.
if (!(process.env.NODE_OPTIONS || '').includes('--use-system-ca')) {
  const r = spawnSync(process.execPath, [fileURLToPath(import.meta.url), ...process.argv.slice(2)], {
    stdio: 'inherit',
    env: { ...process.env, NODE_OPTIONS: `${process.env.NODE_OPTIONS || ''} --use-system-ca`.trim() },
  })
  process.exit(r.status ?? 1)
}

function lireEnv() {
  const env = {}
  for (const nom of ['.env', '.env.local']) {
    const f = path.join(process.cwd(), nom)
    if (!fs.existsSync(f)) continue
    for (const ligne of fs.readFileSync(f, 'utf8').split(/\r?\n/)) {
      const m = ligne.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/)
      if (!m) continue
      let v = m[2].trim()
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
      env[m[1]] = v
    }
  }
  return env
}

const env = { ...lireEnv(), ...process.env }
const url = (env.TURSO_DATABASE_URL || '').trim()
if (!url) {
  console.error(`${C.r}TURSO_DATABASE_URL introuvable.${C.x} Lance le script depuis C:\\Users\\jimmy\\ARETE.`)
  process.exit(1)
}
const db = createClient({ url, authToken: (env.TURSO_AUTH_TOKEN || '').trim() || undefined })

const titre = (t) => console.log(`\n${C.b}── ${t} ${'─'.repeat(Math.max(0, 60 - t.length))}${C.x}`)

try {
  const tables = await db.execute(
    `SELECT name FROM sqlite_master WHERE type='table' AND name IN ('SiteContent','Notification','Workout')`
  )
  const presentes = tables.rows.map(r => r.name)

  // ── 1. Les contenus ───────────────────────────────────────────────────
  titre('Les contenus du site')
  if (!presentes.includes('SiteContent')) {
    console.log(`  ${C.r}La table SiteContent N'EXISTE PAS en production.${C.x}`)
    console.log(`  ${C.d}Le tableau de bord avale l'erreur (.catch(() => [])) et affiche « rien ».${C.x}`)
  } else {
    const c = await db.execute(
      `SELECT key, title, active, length(body) AS taille, substr(body, 1, 90) AS debut, updatedAt
         FROM SiteContent ORDER BY key`
    )
    if (!c.rows.length) console.log(`  ${C.j}Aucune ligne : rien n'a jamais été enregistré depuis l'admin.${C.x}`)
    for (const r of c.rows) {
      console.log(`  ${C.b}${String(r.key).padEnd(14)}${C.x}${r.active ? `${C.g}ACTIF${C.x}` : `${C.r}inactif${C.x}`}`)
      console.log(`    titre  ${r.title === null ? `${C.d}(vide)${C.x}` : JSON.stringify(r.title)}`)
      console.log(`    corps  ${r.taille} caractères — ${JSON.stringify(r.debut ?? '')}`)
      console.log(`    modifié le ${r.updatedAt}`)
    }
    const a = c.rows.find(r => r.key === 'announcement')
    console.log()
    if (!a) console.log(`  ${C.j}VERDICT : aucune ligne « announcement ». Rien ne peut s'afficher.${C.x}`)
    else if (!a.active) {
      console.log(`  ${C.g}VERDICT : l'annonce existe mais elle est INACTIVE.${C.x}`)
      console.log(`  ${C.d}Comportement normal. Les notifications déjà parties restent et pointent`)
      console.log(`  vers un tableau de bord qui n'a plus rien à montrer.${C.x}`)
    } else if (!a.taille) console.log(`  ${C.j}VERDICT : annonce active mais corps VIDE.${C.x}`)
    else {
      console.log(`  ${C.r}VERDICT : l'annonce est ACTIVE et non vide — elle DEVRAIT s'afficher.${C.x}`)
      console.log(`  ${C.d}Il y a donc un vrai bug côté tableau de bord.${C.x}`)
    }
  }

  // ── 2. Les notifications ──────────────────────────────────────────────
  if (presentes.includes('Notification')) {
    titre('Les notifications, regroupées par intitulé')
    const n = await db.execute(
      `SELECT title, COUNT(*) AS n, COUNT(DISTINCT userId) AS users,
              SUM(CASE WHEN readAt IS NULL THEN 1 ELSE 0 END) AS non_lues,
              MIN(createdAt) AS premiere, MAX(createdAt) AS derniere,
              substr(MAX(body), 1, 60) AS un_corps, MAX(link) AS un_lien
         FROM Notification GROUP BY title ORDER BY n DESC LIMIT 20`
    )
    for (const r of n.rows) {
      console.log(`  ${C.b}${JSON.stringify(r.title)}${C.x}`)
      console.log(`    ${r.n} notification(s) pour ${r.users} utilisateur(s), dont ${r.non_lues} non lue(s)`)
      console.log(`    corps ${JSON.stringify(r.un_corps ?? '')}  lien ${JSON.stringify(r.un_lien ?? '')}`)
      console.log(`    ${C.d}du ${r.premiere} au ${r.derniere}${C.x}`)
    }
    const t = await db.execute(`SELECT COUNT(*) AS n FROM Notification`)
    console.log(`\n  Total : ${t.rows[0].n} notification(s) en base.`)
  }

  // ── 3. Les orphelines ─────────────────────────────────────────────────
  if (presentes.includes('Notification') && presentes.includes('Workout')) {
    titre('Notifications dont le lien mène à une séance supprimée')
    const o = await db.execute(
      `SELECT n.title, n.link, COUNT(*) AS n
         FROM Notification n
        WHERE n.link LIKE '/workouts/%'
          AND NOT EXISTS (SELECT 1 FROM Workout w WHERE '/workouts/' || w.id = n.link)
        GROUP BY n.link ORDER BY n DESC LIMIT 15`
    )
    if (!o.rows.length) console.log(`  ${C.g}Aucune. Tous les liens de séance pointent vers une séance existante.${C.x}`)
    for (const r of o.rows) {
      console.log(`  ${C.r}${r.n}×${C.x} ${JSON.stringify(r.title)} → ${r.link} ${C.d}(séance absente)${C.x}`)
    }
  }

  console.log()
} catch (e) {
  console.error(`\n${C.r}Échec : ${e.message}${C.x}`)
  if (/fetch failed|certificate|self[- ]signed|UNABLE_TO_VERIFY/i.test(e.message)) {
    console.error(`${C.d}Un « fetch failed » ici est presque toujours un refus TLS, pas une panne`)
    console.error(`réseau : le script se relance pourtant déjà avec --use-system-ca. Vérifie que`)
    console.error(`TURSO_AUTH_TOKEN n'a pas expiré, puis que l'URL répond :`)
    console.error(`  node --use-system-ca -e "fetch(process.env.U).then(r=>console.log(r.status))"${C.x}`)
  }
  process.exit(1)
}
