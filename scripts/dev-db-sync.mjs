#!/usr/bin/env node
// Rejoue les migrations MANQUANTES sur la base de DEV locale (prisma/dev.db).
//
//   node scripts/dev-db-sync.mjs
//
// Ne touche jamais Turso : l'URL est codée en dur sur le fichier local. Sert à
// rattraper une base de dev restée en arrière (tables ajoutées depuis), pour
// pouvoir faire tourner l'app en local sans pointer sur la production.
//
// ── POURQUOI UN JOURNAL ────────────────────────────────────────────────────
// Ce script rejouait TOUTES les migrations à chaque exécution, en se reposant
// sur le fait qu'une migration déjà appliquée échoue (« already exists »). Ce
// n'est pas vrai de toutes : `20260508170842_add_workout_blocks` reconstruit
// WorkoutMovement selon le motif SQLite habituel —
//
//     INSERT INTO new_WorkoutMovement ("duration","id",…) SELECT … FROM WorkoutMovement;
//     DROP TABLE WorkoutMovement;
//     ALTER TABLE new_WorkoutMovement RENAME TO WorkoutMovement;
//
// — et sa liste de colonnes ne contient pas `blockId`, qui n'existait pas
// encore à l'époque. Au rejeu, ces trois instructions réussissent parfaitement
// et recopient toutes les lignes SANS leur bloc : chaque exécution détachait
// la totalité des mouvements de la base locale, en annonçant « 0 en erreur ».
// Une migration qui reconstruit une table n'est jamais idempotente ; le seul
// garde-fou fiable est de savoir ce qui a déjà été appliqué.
//
// ── LE RATTRAPAGE INITIAL ──────────────────────────────────────────────────
// Une base locale qui existe déjà vient de `npm run db:from-prod`, donc de la
// production, donc elle est à jour. La première exécution se contente donc
// d'INSCRIRE les migrations existantes sans les exécuter. Seules les migrations
// écrites après ce rattrapage seront jouées. Une base vide, elle, les reçoit
// toutes normalement.

import fs from 'node:fs'
import path from 'node:path'
import { createClient } from '@libsql/client'

const root = process.cwd()
const abs = path.resolve(root, 'prisma/dev.db').split(path.sep).join('/')
const db = createClient({ url: 'file:///' + abs })

const dir = path.join(root, 'prisma', 'migrations')
const names = fs.readdirSync(dir, { withFileTypes: true })
  .filter(e => e.isDirectory())
  .map(e => e.name)
  .sort()

await db.execute(`CREATE TABLE IF NOT EXISTS "_dev_migrations" (
  "name" TEXT NOT NULL PRIMARY KEY,
  "appliedAt" TEXT NOT NULL
)`)

const inscrire = async (name) =>
  db.execute({
    sql: 'INSERT OR IGNORE INTO "_dev_migrations" ("name","appliedAt") VALUES (?, ?)',
    args: [name, new Date().toISOString()],
  })

const deja = new Set(
  (await db.execute('SELECT name FROM "_dev_migrations"')).rows.map(r => String(r.name)),
)

// La base est-elle déjà peuplée ? On teste une table du socle plutôt que le
// nombre de lignes : une base neuve n'a pas la table du tout.
const socle = await db.execute(
  `SELECT COUNT(*) n FROM sqlite_master WHERE type = 'table' AND name = 'WorkoutMovement'`,
)
const baseExistante = Number(socle.rows[0].n) > 0

if (deja.size === 0 && baseExistante) {
  for (const name of names) await inscrire(name)
  console.log(
    `\nBase existante et journal absent : ${names.length} migration(s) inscrite(s) sans être rejouées.\n` +
    `Une base locale vient de la production, donc elle est à jour — et rejouer\n` +
    `add_workout_blocks détacherait tous les mouvements de leur bloc.`,
  )
  process.exit(0)
}

let applied = 0, skipped = 0, failed = 0, jouees = 0
for (const name of names) {
  if (deja.has(name)) continue
  const file = path.join(dir, name, 'migration.sql')
  if (!fs.existsSync(file)) continue
  const statements = fs.readFileSync(file, 'utf8')
    .split('\n').filter(l => !l.trim().startsWith('--')).join('\n')
    .split(';').map(s => s.trim()).filter(Boolean)

  let enErreur = false
  for (const stmt of statements) {
    try {
      await db.execute(stmt)
      applied++
    } catch (err) {
      const m = String(err.message || '')
      if (/already exists|duplicate column/i.test(m)) skipped++
      else { failed++; enErreur = true; console.warn(`  ! ${name}: ${m.split('\n')[0]}`) }
    }
  }
  // Inscrite même si toutes ses instructions étaient déjà en place — c'est le
  // cas normal d'une base à jour. Pas inscrite si une instruction a vraiment
  // échoué : il faut pouvoir la rejouer une fois le problème corrigé.
  if (!enErreur) { await inscrire(name); jouees++ }
}

console.log(
  `\n${jouees} migration(s) traitée(s) — ${applied} instruction(s) appliquée(s), ` +
  `${skipped} déjà en place, ${failed} en erreur.`,
)
