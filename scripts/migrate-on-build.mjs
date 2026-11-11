#!/usr/bin/env node
// Applique les migrations en attente sur Turso, au build de PRODUCTION sur Vercel.
//
// Pourquoi ici : les variables Turso sont « sensibles » dans Vercel, donc
// illisibles une fois posées — il fallait les avoir sur un poste pour lancer
// scripts/apply-migration.mjs, et oublier cette étape cassait la production au
// déploiement suivant (le client Prisma lit des colonnes qui n'existent pas).
// Le build de production, lui, a les deux valeurs.
//
// Prudence :
//  - hors production (preview, local), rien ne se passe : les builds de preview
//    partagent la même base, ils ne doivent pas la migrer ;
//  - seules les migrations PLUS RÉCENTES que la dernière enregistrée dans
//    _prisma_migrations sont jouées : une ancienne migration appliquée à la main
//    sans trace ne sera jamais rejouée ;
//  - une colonne ou un index déjà présent n'est pas une erreur (rejeu sans risque) ;
//  - toute autre erreur fait échouer le build : Vercel garde alors la version en
//    ligne, et rien de cassé n'est servi.

import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'

if (process.env.VERCEL_ENV !== 'production') {
  console.log('migrations : build hors production, rien à appliquer')
  process.exit(0)
}

const url = process.env.TURSO_DATABASE_URL?.trim()
if (!url) {
  console.error('migrations : TURSO_DATABASE_URL absente du build de production')
  process.exit(1)
}

// Import tardif : un build hors production sort plus haut sans en avoir besoin.
const { createClient } = await import('@libsql/client')
const db = createClient({ url, authToken: process.env.TURSO_AUTH_TOKEN })
const dir = path.join(process.cwd(), 'prisma', 'migrations')

const recorded = (await db.execute('SELECT migration_name FROM _prisma_migrations')).rows.map(r => String(r.migration_name))
const done = new Set(recorded)
const last = recorded.sort().at(-1) ?? ''
const pending = fs.readdirSync(dir, { withFileTypes: true })
  .filter(e => e.isDirectory() && fs.existsSync(path.join(dir, e.name, 'migration.sql')))
  .map(e => e.name)
  .sort()
  .filter(n => !done.has(n) && n > last)

if (!pending.length) {
  console.log(`migrations : à jour (dernière : ${last || 'aucune'})`)
  process.exit(0)
}

const harmless = /duplicate column name|already exists/i

for (const name of pending) {
  const sql = fs.readFileSync(path.join(dir, name, 'migration.sql'), 'utf8')
  const statements = sql.split('\n').filter(l => !l.trim().startsWith('--')).join('\n')
    .split(';').map(s => s.trim()).filter(Boolean)
  console.log(`migrations : ${name} (${statements.length} instruction(s))`)
  for (const stmt of statements) {
    const label = stmt.replace(/\s+/g, ' ').slice(0, 90)
    try {
      await db.execute(stmt)
      console.log(`  ✓ ${label}`)
    } catch (err) {
      if (harmless.test(err.message)) { console.log(`  = déjà en place : ${label}`); continue }
      console.error(`  ✗ ${label}\n    ${err.message}`)
      process.exit(1)
    }
  }
  // Même trace que scripts/apply-migration.mjs.
  await db.execute({
    sql: `INSERT INTO _prisma_migrations (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count)
          VALUES (?, ?, CURRENT_TIMESTAMP, ?, NULL, NULL, CURRENT_TIMESTAMP, ?)`,
    args: [crypto.randomUUID(), crypto.createHash('sha256').update(sql).digest('hex'), name, statements.length],
  })
  console.log(`  ✓ enregistrée dans _prisma_migrations`)
}
