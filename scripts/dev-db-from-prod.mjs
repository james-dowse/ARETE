#!/usr/bin/env node
// Remplace la base de DÉVELOPPEMENT locale par une copie de la production.
//
//   npm run db:from-prod
//
// Pourquoi : `prisma/dev.db` dérivait depuis longtemps (données de seed
// anglaises jamais supprimées, tables manquantes). On y voyait donc des
// anomalies qui n'existent pas en production — des doublons de référentiel
// français/anglais, par exemple — et on ratait celles qui y existent vraiment.
// Travailler sur une copie fidèle est le seul moyen de tester ce que les
// utilisateurs voient.
//
// La production n'est JAMAIS modifiée : ce script n'y exécute que des SELECT.
//
// Les jetons de connexion (`loginToken`, `loginTokenExp`) ne sont pas recopiés :
// ce sont des identifiants de connexion à usage unique qui n'ont rien à faire
// dans une base de test posée en clair sur un poste de travail. Ils ne servent
// pas non plus en local, où la session se pose directement par cookie.

import fs from 'node:fs'
import path from 'node:path'
import dotenv from 'dotenv'
import { createClient } from '@libsql/client'

dotenv.config({ quiet: true })

const C = { r: '\x1b[31m', g: '\x1b[32m', y: '\x1b[33m', d: '\x1b[2m', b: '\x1b[1m', x: '\x1b[0m' }
const step = (m) => console.log(`\n${C.b}▶ ${m}${C.x}`)
const ok = (m) => console.log(`${C.g}✓${C.x} ${m}`)

const SRC_URL = process.env.TURSO_DATABASE_URL?.trim()
const SRC_TOK = process.env.TURSO_AUTH_TOKEN
if (!SRC_URL) {
  console.error(`${C.r}✗ TURSO_DATABASE_URL absente — impossible de lire la production.${C.x}`)
  process.exit(1)
}

const root = process.cwd()
const devDbPath = path.resolve(root, 'prisma/dev.db')
const devDbUrl = 'file:///' + devDbPath.split(path.sep).join('/')

// ── 1. Table rase sur la base locale ────────────────────────────────────────
step('Remise à zéro de la base locale')
for (const suffix of ['', '-shm', '-wal']) {
  const f = devDbPath + suffix
  if (fs.existsSync(f)) { fs.rmSync(f); console.log(`  ${C.d}supprimé ${path.basename(f)}${C.x}`) }
}

const dev = createClient({ url: devDbUrl })

// ── 2. Schéma reconstruit depuis les migrations ─────────────────────────────
step('Reconstruction du schéma')
const migDir = path.join(root, 'prisma', 'migrations')
const migrations = fs.readdirSync(migDir, { withFileTypes: true })
  .filter(e => e.isDirectory()).map(e => e.name).sort()

let applied = 0, skipped = 0
for (const name of migrations) {
  const file = path.join(migDir, name, 'migration.sql')
  if (!fs.existsSync(file)) continue
  const statements = fs.readFileSync(file, 'utf8')
    .split('\n').filter(l => !l.trim().startsWith('--')).join('\n')
    .split(';').map(s => s.trim()).filter(Boolean)
  for (const stmt of statements) {
    try { await dev.execute(stmt); applied++ }
    catch (err) {
      if (/already exists|duplicate column/i.test(String(err.message))) skipped++
      else { console.warn(`  ${C.y}! ${name}: ${String(err.message).split('\n')[0]}${C.x}`) }
    }
  }
}
ok(`${migrations.length} migration(s) rejouée(s) — ${applied} instruction(s), ${skipped} déjà en place`)

// ── 3. Copie des données (lecture seule côté production) ────────────────────
step('Copie des données de production')
const src = createClient({ url: SRC_URL, authToken: SRC_TOK })

const tables = (await dev.execute(
  "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_prisma%' ORDER BY name"
)).rows.map(r => String(r.name))

// Les contraintes de clé étrangère sont désactivées le temps de l'import :
// copier table par table ne respecte pas l'ordre des dépendances.
await dev.execute('PRAGMA foreign_keys = OFF')

// Colonnes à ne jamais recopier, par table.
const REDACT = { InvitedUser: new Set(['loginToken', 'loginTokenExp']) }

let totalRows = 0
for (const table of tables) {
  let rows
  try {
    rows = (await src.execute(`SELECT * FROM "${table}"`)).rows
  } catch (err) {
    console.warn(`  ${C.y}! ${table} absente en production (${String(err.message).split('\n')[0]})${C.x}`)
    continue
  }
  if (rows.length === 0) { console.log(`  ${C.d}${String(0).padStart(6)} ${table}${C.x}`); continue }

  const columns = Object.keys(rows[0])
  const placeholders = columns.map(() => '?').join(', ')
  const quoted = columns.map(c => `"${c}"`).join(', ')
  const redact = REDACT[table]

  // Insertions groupées : une par ligne sur une base locale reste rapide, mais
  // le batch évite des milliers d'allers-retours sur les grosses tables.
  const BATCH = 200
  for (let i = 0; i < rows.length; i += BATCH) {
    const slice = rows.slice(i, i + BATCH)
    await dev.batch(slice.map(row => ({
      sql: `INSERT INTO "${table}" (${quoted}) VALUES (${placeholders})`,
      args: columns.map(c => (redact?.has(c) ? null : row[c] ?? null)),
    })), 'write')
  }
  totalRows += rows.length
  const note = redact ? `  ${C.d}(jetons de connexion non copiés)${C.x}` : ''
  console.log(`  ${String(rows.length).padStart(6)} ${table}${note}`)
}

await dev.execute('PRAGMA foreign_keys = ON')

ok(`${totalRows} ligne(s) copiée(s) dans prisma/dev.db`)
console.log(`\n${C.d}Démarrer dessus :${C.x} npm run dev:local`)
