#!/usr/bin/env node
// Copie la base Turso de production vers une nouvelle base (typiquement pour la
// rapprocher géographiquement du serveur — voir MIGRATION-DB.md).
//
//   node scripts/perf/migrate-db.mjs
//
// La base SOURCE n'est jamais modifiée : ce script ne fait que lire dedans.
// En cas de doute, on peut donc toujours revenir en arrière en remettant les
// anciennes variables d'environnement.
//
// Variables lues (SOURCE dans .env, CIBLE à fournir) :
//   TURSO_DATABASE_URL / TURSO_AUTH_TOKEN                 <- source, existante
//   TARGET_TURSO_DATABASE_URL / TARGET_TURSO_AUTH_TOKEN   <- cible, nouvelle

import dotenv from 'dotenv'
import { createClient } from '@libsql/client'

dotenv.config({ quiet: true })

const C = { r: '\x1b[31m', g: '\x1b[32m', y: '\x1b[33m', d: '\x1b[2m', b: '\x1b[1m', x: '\x1b[0m' }
const say  = (m) => console.log(m)
const step = (m) => console.log(`\n${C.b}▶ ${m}${C.x}`)
const ok   = (m) => console.log(`${C.g}✓${C.x} ${m}`)

function die(msg, hint) {
  console.error(`\n${C.r}✗ ${msg}${C.x}`)
  if (hint) console.error(`${C.d}${hint}${C.x}`)
  process.exit(1)
}

const FORCE = process.argv.includes('--force')

const SRC_URL  = process.env.TURSO_DATABASE_URL
const SRC_TOK  = process.env.TURSO_AUTH_TOKEN
const DST_URL  = process.env.TARGET_TURSO_DATABASE_URL
const DST_TOK  = process.env.TARGET_TURSO_AUTH_TOKEN

if (!SRC_URL) die('TURSO_DATABASE_URL est absente.', 'Elle doit être dans .env — c\'est la base actuelle.')
if (!DST_URL) {
  die('TARGET_TURSO_DATABASE_URL est absente.',
      'Crée d\'abord la nouvelle base (étape 1 de MIGRATION-DB.md), puis relance ainsi :\n\n' +
      '  TARGET_TURSO_DATABASE_URL="libsql://…" TARGET_TURSO_AUTH_TOKEN="…" node scripts/perf/migrate-db.mjs\n')
}
if (SRC_URL === DST_URL) die('La cible est identique à la source.', 'Vérifie TARGET_TURSO_DATABASE_URL.')

const host = (u) => String(u).replace(/^\w+:\/\//, '').split('/')[0]

const src = createClient({ url: SRC_URL, authToken: SRC_TOK })
const dst = createClient({ url: DST_URL, authToken: DST_TOK })

// ── 1. Connexions ────────────────────────────────────────────────────────────
step('Connexions')
try { await src.execute('SELECT 1') } catch (e) { die(`Base SOURCE injoignable : ${e.message}`) }
ok(`source ${C.d}${host(SRC_URL)}${C.x}`)
try { await dst.execute('SELECT 1') } catch (e) { die(`Base CIBLE injoignable : ${e.message}`, 'Vérifie l\'URL et le token de la nouvelle base.') }
ok(`cible  ${C.d}${host(DST_URL)}${C.x}`)

// ── 2. Lecture du schéma source ──────────────────────────────────────────────
step('Lecture du schéma source')
const schema = (await src.execute(
  "SELECT type, name, sql FROM sqlite_schema WHERE sql IS NOT NULL AND name NOT LIKE 'sqlite_%'"
)).rows

const tables = schema.filter(r => r.type === 'table')
const others = schema.filter(r => r.type !== 'table') // index, trigger, view

if (tables.length === 0) die('Aucune table trouvée dans la source.', 'La base source semble vide — rien à migrer.')
ok(`${tables.length} tables, ${others.length} index/vues`)

// ── 3. La cible doit être vide ───────────────────────────────────────────────
step('Vérification de la cible')
const dstExisting = (await dst.execute(
  "SELECT name FROM sqlite_schema WHERE type='table' AND name NOT LIKE 'sqlite_%'"
)).rows

if (dstExisting.length > 0 && !FORCE) {
  die(`La base cible contient déjà ${dstExisting.length} table(s).`,
      'Par sécurité, ce script n\'écrase rien.\n' +
      'Utilise une base neuve et vide, ou relance avec --force pour tout remplacer.')
}
if (dstExisting.length > 0) {
  say(`${C.y}!${C.x} --force : suppression de ${dstExisting.length} table(s) existante(s)`)
  await dst.execute('PRAGMA foreign_keys=OFF')
  for (const t of dstExisting) await dst.execute(`DROP TABLE IF EXISTS "${t.name}"`)
}
ok('cible prête')

// ── 4. Création du schéma ────────────────────────────────────────────────────
step('Création du schéma')
await dst.execute('PRAGMA foreign_keys=OFF')
for (const t of tables) await dst.execute(t.sql)
ok(`${tables.length} tables créées`)

// ── 5. Copie des données ─────────────────────────────────────────────────────
step('Copie des données')
const BATCH = 200
const counts = []

for (const t of tables) {
  const name = t.name
  const rows = (await src.execute(`SELECT * FROM "${name}"`)).rows
  counts.push({ name, source: rows.length })

  if (rows.length === 0) { say(`${C.d}${String(0).padStart(6)}  ${name}${C.x}`); continue }

  const cols = Object.keys(rows[0])
  const quoted = cols.map(c => `"${c}"`).join(', ')
  const holes = cols.map(() => '?').join(', ')
  const sql = `INSERT INTO "${name}" (${quoted}) VALUES (${holes})`

  for (let i = 0; i < rows.length; i += BATCH) {
    const chunk = rows.slice(i, i + BATCH)
      .map(r => ({ sql, args: cols.map(c => r[c] === undefined ? null : r[c]) }))
    await dst.batch(chunk, 'write')
  }
  say(`${C.d}${String(rows.length).padStart(6)}  ${name}${C.x}`)
}

// ── 6. Index et vues ─────────────────────────────────────────────────────────
step('Index et vues')
let created = 0
for (const o of others) {
  try { await dst.execute(o.sql); created++ } catch (e) {
    say(`${C.y}!${C.x} ${o.name} ignoré : ${e.message}`)
  }
}
ok(`${created}/${others.length} recréés`)

// ── 7. Vérification ligne à ligne ────────────────────────────────────────────
// Le seul contrôle qui compte : chaque table doit avoir exactement le même
// nombre de lignes des deux côtés. Un écart interdit de basculer.
step('Vérification')
let mismatch = 0, total = 0

for (const c of counts) {
  const n = Number((await dst.execute(`SELECT COUNT(*) n FROM "${c.name}"`)).rows[0].n)
  total += n
  if (n !== c.source) {
    console.error(`${C.r}✗${C.x} ${c.name} : source ${c.source}, cible ${n}`)
    mismatch++
  }
}

if (mismatch > 0) {
  die(`${mismatch} table(s) n'ont pas le même nombre de lignes.`,
      'NE BASCULE PAS les variables d\'environnement.\n' +
      'La base actuelle reste intacte et en service. Signale cet écart.')
}

ok(`${counts.length} tables identiques — ${total} lignes au total`)

say(`\n${C.g}${C.b}Migration terminée et vérifiée.${C.x}`)
say(`${C.d}La base d'origine n'a pas été modifiée : elle reste le plan de secours.${C.x}`)
say(`\nÉtape suivante : bascule des variables d'environnement (étape 3 de MIGRATION-DB.md).`)
