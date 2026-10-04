#!/usr/bin/env node
// Vérifie, EN LECTURE SEULE, que la base de PRODUCTION correspond bien à la
// base locale sur laquelle le rattachement bloc ↔ mouvement a été calculé.
//
//   node scripts/verifier-blocs-prod.mjs
//
// STRICTEMENT DES SELECT. Aucune écriture, aucune suppression, aucun UPDATE.
//
// POURQUOI. Le SQL de rattachement a été établi sur prisma/dev.db. Or AGENTS.md
// indique que `db:sync-local` ne rejoue que les migrations, sans copier les
// données : rien ne prouve que la base locale soit un miroir de la production.
// Tous les identifiants du SQL sont des identifiants LOCAUX. Les appliquer sans
// ce contrôle reviendrait à écrire au hasard.
//
// Ce script lit le SQL, en déduit ce qui est attendu, et le confronte à Turso.

import fs from 'node:fs'
import path from 'node:path'
import './lib/system-ca.mjs'
import { createClient } from '@libsql/client'

const C = { g: '\x1b[32m', r: '\x1b[31m', j: '\x1b[33m', d: '\x1b[2m', b: '\x1b[1m', x: '\x1b[0m' }

const SQL = process.argv[2] ?? '.claude/tmp/rattachement.sql'
if (!fs.existsSync(SQL)) {
  console.error(`${C.r}Fichier SQL introuvable : ${SQL}${C.x}`)
  console.error('Passe son chemin en argument si tu l\'as déplacé.')
  process.exit(1)
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

// ── Ce que le SQL attend ────────────────────────────────────────────────
// On découpe en instructions puis on lit chacune, plutôt que de chercher des
// motifs dans tout le fichier : les UPDATE portent des commentaires « -- » en
// FIN de ligne, et leur WHERE combine workoutId, la garde IS NULL et parfois
// une liste d'id. Un motif global en ratait les trois quarts en silence, et le
// script aurait alors conclu « tout va bien » sans avoir rien contrôlé.
const brut = fs.readFileSync(SQL, 'utf8')

// Retrait des commentaires, y compris en fin de ligne, en respectant les
// chaînes entre apostrophes.
const sansCommentaires = brut.split('\n').map(ligne => {
  let dansChaine = false
  for (let i = 0; i < ligne.length; i++) {
    const c = ligne[i]
    if (c === "'") dansChaine = !dansChaine
    else if (!dansChaine && c === '-' && ligne[i + 1] === '-') return ligne.slice(0, i)
  }
  return ligne
}).join('\n')

const instructions = sansCommentaires.split(';').map(s => s.trim()).filter(s => /^UPDATE\s+"WorkoutMovement"/i.test(s))

const cibles = instructions.map((sql) => {
  const blockId = sql.match(/SET\s+"blockId"\s*=\s*'([^']+)'/i)?.[1] ?? null
  const workoutId = sql.match(/"workoutId"\s*=\s*'([^']+)'/i)?.[1] ?? null
  const bloc = sql.match(/"id"\s+IN\s*\(([\s\S]*?)\)/i)?.[1]
  const ids = bloc ? [...bloc.matchAll(/'([^']+)'/g)].map(x => x[1]) : []
  const garde = /"blockId"\s+IS\s+NULL/i.test(sql)
  return { blockId, workoutId, ids, garde, sql }
})

const totalUpdates = (sansCommentaires.match(/^\s*UPDATE\s+"WorkoutMovement"/gmi) || []).length
const mauvais = cibles.filter(c => !c.blockId || !c.workoutId || !c.garde)

console.log(`${C.b}Ce que le SQL attend${C.x}`)
console.log(`  ${cibles.length} UPDATE lus sur ${totalUpdates} présents dans le fichier`)

if (cibles.length !== totalUpdates || cibles.length === 0 || mauvais.length > 0) {
  console.error(`\n${C.r}${C.b}REFUS DE CONTRÔLER.${C.x}`)
  if (cibles.length !== totalUpdates) console.error(`${C.r}  ${totalUpdates - cibles.length} UPDATE n'ont pas été compris.${C.x}`)
  if (cibles.length === 0) console.error(`${C.r}  Aucun UPDATE reconnu : il n'y aurait rien à vérifier.${C.x}`)
  for (const m of mauvais) console.error(`${C.r}  incomplet (bloc/séance/garde) : ${m.sql.slice(0, 90).replace(/\s+/g, ' ')}${C.x}`)
  console.error(`${C.d}  Un contrôle qui ne lit pas tout conclurait « tout va bien » à tort.${C.x}`)
  process.exit(2)
}

const parWorkout = cibles.filter(c => c.ids.length === 0).map(c => ({ blockId: c.blockId, workoutId: c.workoutId }))
const parListe = cibles.filter(c => c.ids.length > 0)
const blocsAttendus = new Set(cibles.map(c => c.blockId))
const workoutsAttendus = new Set(cibles.map(c => c.workoutId))
const mvtsAttendus = parListe.flatMap(c => c.ids)

console.log(`  ${parWorkout.length} « toute la séance », ${parListe.length} « liste d'id », tous gardés par « blockId IS NULL »`)
console.log(`  ${blocsAttendus.size} blocs cibles, ${workoutsAttendus.size} séances concernées, ${mvtsAttendus.length} mouvements nommés`)

const lot = async (table, colonne, valeurs) => {
  const trouves = new Set()
  for (let i = 0; i < valeurs.length; i += 400) {
    const tranche = valeurs.slice(i, i + 400)
    const r = await db.execute({
      sql: `SELECT "${colonne}" AS v FROM "${table}" WHERE "${colonne}" IN (${tranche.map(() => '?').join(',')})`,
      args: tranche,
    })
    for (const x of r.rows) trouves.add(String(x.v))
  }
  return trouves
}

let bloquant = 0

try {
  console.log(`\n${C.b}1. L'état d'ensemble en production${C.x}`)
  const tot = await db.execute(`SELECT
      (SELECT COUNT(*) FROM "Workout") w,
      (SELECT COUNT(*) FROM "WorkoutBlock") b,
      (SELECT COUNT(*) FROM "WorkoutMovement") m,
      (SELECT COUNT(*) FROM "WorkoutMovement" WHERE "blockId" IS NOT NULL) rattaches`)
  const t = tot.rows[0]
  console.log(`  ${t.w} séances, ${t.b} blocs, ${t.m} mouvements`)
  console.log(`  mouvements déjà rattachés : ${t.rattaches}`)
  console.log(`  ${C.d}pour mémoire en local : 24 séances, 64 blocs, 346 mouvements, 0 rattaché avant le SQL${C.x}`)
  if (Number(t.rattaches) > 0) {
    console.log(`  ${C.j}⚠ La production a déjà des rattachements. Les UPDATE portent « AND blockId IS NULL »`)
    console.log(`    et ne les écraseront pas — mais les comptes de vérification seront décalés d'autant.${C.x}`)
  }

  console.log(`\n${C.b}2. Les séances visées existent-elles, avec ces identifiants ?${C.x}`)
  const wTrouves = await lot('Workout', 'id', [...workoutsAttendus])
  for (const id of workoutsAttendus) {
    const ok = wTrouves.has(id)
    if (!ok) bloquant++
    console.log(`  ${ok ? C.g + '✓' : C.r + '✗ ABSENTE'}${C.x} ${id}`)
  }

  console.log(`\n${C.b}3. Les blocs cibles existent-ils ?${C.x}`)
  const bTrouves = await lot('WorkoutBlock', 'id', [...blocsAttendus])
  const bManquants = [...blocsAttendus].filter(x => !bTrouves.has(x))
  console.log(`  ${bTrouves.size}/${blocsAttendus.size} trouvés`)
  if (bManquants.length) { bloquant++; for (const x of bManquants) console.log(`  ${C.r}✗ bloc absent : ${x}${C.x}`) }

  console.log(`\n${C.b}4. Les mouvements nommés un par un existent-ils ?${C.x}`)
  const mTrouves = await lot('WorkoutMovement', 'id', mvtsAttendus)
  const mManquants = mvtsAttendus.filter(x => !mTrouves.has(x))
  console.log(`  ${mTrouves.size}/${mvtsAttendus.length} trouvés`)
  if (mManquants.length) {
    bloquant++
    console.log(`  ${C.r}✗ ${mManquants.length} mouvement(s) absent(s), dont : ${mManquants.slice(0, 5).join(', ')}${C.x}`)
  }

  console.log(`\n${C.b}5. Chaque bloc cible appartient-il bien à la séance attendue ?${C.x}`)
  let croises = 0
  for (const { blockId, workoutId } of cibles) {
    const r = await db.execute({ sql: `SELECT "workoutId" AS w FROM "WorkoutBlock" WHERE "id" = ?`, args: [blockId] })
    const reel = r.rows[0]?.w
    if (reel !== workoutId) {
      croises++
      console.log(`  ${C.r}✗ bloc ${blockId} appartient à ${reel ?? '(aucune séance)'}, pas à ${workoutId}${C.x}`)
    }
  }
  if (croises === 0) console.log(`  ${C.g}✓ aucun des ${cibles.length} rattachements n'est croisé${C.x}`)
  else bloquant++

  console.log(`\n${C.b}6. Le nombre de mouvements par séance, à comparer au local${C.x}`)
  const ATTENDU_LOCAL = {
    cmt6ikt08000004l4j1rwumaq: 6, cmt7hbmxs000004judfkthowd: 6, cmt8w26bx000004jxeqx4ey0g: 5,
    impaccp4y2x5sixx6: 5, impfe4zob8g5sig3b: 7, impm7my117s5shutm: 7,
    impj007wb1i5shyp3: 21, impqf1spuh75sipcx: 27, imptfdtcwry5sj3lf: 9,
  }
  for (const workoutId of workoutsAttendus) {
    const r = await db.execute({ sql: `SELECT COUNT(*) n FROM "WorkoutMovement" WHERE "workoutId" = ?`, args: [workoutId] })
    const n = Number(r.rows[0].n)
    const attendu = ATTENDU_LOCAL[workoutId]
    const ok = attendu === undefined || n === attendu
    if (!ok) bloquant++
    console.log(`  ${ok ? C.g + '✓' : C.r + '✗'}${C.x} ${workoutId} : ${n} mouvement(s)${attendu !== undefined ? ` ${C.d}(local : ${attendu})${C.x}` : ''}`)
  }

  console.log()
  if (bloquant === 0) {
    console.log(`${C.g}${C.b}La production correspond à la base locale sur tous les points contrôlés.${C.x}`)
    console.log(`${C.d}Le SQL de rattachement peut s'appliquer tel quel. Fais la sauvegarde d'abord.${C.x}`)
  } else {
    console.log(`${C.r}${C.b}${bloquant} contrôle(s) en échec : NE PAS appliquer le SQL.${C.x}`)
    console.log(`${C.d}Les identifiants diffèrent entre la base locale et la production : la`)
    console.log(`segmentation doit être refaite sur les données réelles.${C.x}`)
  }
  process.exit(bloquant === 0 ? 0 : 1)
} catch (e) {
  console.error(`\n${C.r}Échec : ${e.message}${C.x}`)
  process.exit(1)
}
