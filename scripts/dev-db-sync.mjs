#!/usr/bin/env node
// Rejoue toutes les migrations sur la base de DEV locale (prisma/dev.db).
//
//   node scripts/dev-db-sync.mjs
//
// Ne touche jamais Turso : l'URL est codée en dur sur le fichier local. Sert à
// rattraper une base de dev restée en arrière (tables ajoutées depuis), pour
// pouvoir faire tourner l'app en local sans pointer sur la production.
// Les erreurs « already exists » / « duplicate column » sont ignorées : rejouer
// une migration déjà appliquée est le cas normal.

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

let applied = 0, skipped = 0, failed = 0
for (const name of names) {
  const file = path.join(dir, name, 'migration.sql')
  if (!fs.existsSync(file)) continue
  const statements = fs.readFileSync(file, 'utf8')
    .split('\n').filter(l => !l.trim().startsWith('--')).join('\n')
    .split(';').map(s => s.trim()).filter(Boolean)

  for (const stmt of statements) {
    try {
      await db.execute(stmt)
      applied++
    } catch (err) {
      const m = String(err.message || '')
      if (/already exists|duplicate column/i.test(m)) skipped++
      else { failed++; console.warn(`  ! ${name}: ${m.split('\n')[0]}`) }
    }
  }
}

console.log(`\n${applied} instruction(s) appliquée(s), ${skipped} déjà en place, ${failed} en erreur.`)
