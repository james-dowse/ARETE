#!/usr/bin/env node
// Applique un fichier de migration SQL à la base Turso de production.
//
//   node scripts/apply-migration.mjs 20260916000000_add_missing_indexes
//
// `prisma migrate deploy` ne tourne pas dans le flux de déploiement de ce
// projet (voir MIGRATION-DB.md) : les migrations sont appliquées à la main.
// Ce script fait la même chose de façon reproductible — il découpe le fichier
// en instructions, les exécute une à une, et enregistre la migration dans
// `_prisma_migrations` pour que Prisma la considère comme appliquée.
//
// Chaque instruction doit être idempotente (`IF NOT EXISTS`) : le script peut
// être rejoué sans risque.

import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import dotenv from 'dotenv'
import { createClient } from '@libsql/client'

dotenv.config({ quiet: true })

const C = { g: '\x1b[32m', r: '\x1b[31m', d: '\x1b[2m', b: '\x1b[1m', x: '\x1b[0m' }

const name = process.argv[2]
if (!name) {
  console.error('Usage : node scripts/apply-migration.mjs <nom_du_dossier_de_migration>')
  process.exit(1)
}

const file = path.join(process.cwd(), 'prisma', 'migrations', name, 'migration.sql')
if (!fs.existsSync(file)) {
  console.error(`${C.r}Migration introuvable : ${file}${C.x}`)
  process.exit(1)
}

const url = process.env.TURSO_DATABASE_URL?.trim()
if (!url) {
  console.error(`${C.r}TURSO_DATABASE_URL absent — rien à faire.${C.x}`)
  process.exit(1)
}

const sql = fs.readFileSync(file, 'utf8')
const statements = sql
  .split('\n')
  .filter(l => !l.trim().startsWith('--'))
  .join('\n')
  .split(';')
  .map(s => s.trim())
  .filter(Boolean)

const db = createClient({ url, authToken: process.env.TURSO_AUTH_TOKEN })

console.log(`${C.b}Migration ${name}${C.x} — ${statements.length} instruction(s)\n`)

for (const stmt of statements) {
  const label = stmt.replace(/\s+/g, ' ').slice(0, 78)
  try {
    await db.execute(stmt)
    console.log(`  ${C.g}✓${C.x} ${C.d}${label}${C.x}`)
  } catch (err) {
    console.error(`  ${C.r}✗ ${label}${C.x}\n    ${err.message}`)
    process.exit(1)
  }
}

// Trace dans _prisma_migrations, pour que l'état de la base reste cohérent avec
// ce que Prisma attend (checksum inclus, comme le fait `migrate deploy`).
const checksum = crypto.createHash('sha256').update(sql).digest('hex')
try {
  const existing = await db.execute({
    sql: 'SELECT id FROM _prisma_migrations WHERE migration_name = ?',
    args: [name],
  })
  if (existing.rows.length === 0) {
    await db.execute({
      sql: `INSERT INTO _prisma_migrations (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count)
            VALUES (?, ?, CURRENT_TIMESTAMP, ?, NULL, NULL, CURRENT_TIMESTAMP, ?)`,
      args: [crypto.randomUUID(), checksum, name, statements.length],
    })
    console.log(`\n${C.g}✓${C.x} enregistrée dans _prisma_migrations`)
  } else {
    console.log(`\n${C.d}déjà enregistrée dans _prisma_migrations${C.x}`)
  }
} catch (err) {
  console.warn(`\n${C.d}_prisma_migrations non mise à jour : ${err.message}${C.x}`)
}

console.log(`\n${C.g}${C.b}Migration appliquée.${C.x}`)
