#!/usr/bin/env node
// Démarre le serveur de développement sur la base SQLite locale (prisma/dev.db)
// au lieu de la base Turso de production.
//
//   npm run dev:local
//
// `.env.local` définit TURSO_DATABASE_URL : `npm run dev` parle donc à la
// PRODUCTION, et toute manipulation faite en local (créer une séance, cocher
// des séries, supprimer un mouvement) y est écrite pour de bon. Ce script
// neutralise ces deux variables pour le processus fils uniquement — les
// fichiers .env ne sont pas touchés — et lib/prisma.ts retombe alors
// automatiquement sur prisma/dev.db.
//
// Pour remettre la base locale à niveau après un changement de schéma :
//   node scripts/dev-db-sync.mjs

import { spawn } from 'node:child_process'

const env = { ...process.env }
delete env.TURSO_DATABASE_URL
delete env.TURSO_AUTH_TOKEN
// Next recharge .env.local de lui-même au démarrage et redéfinirait les deux
// variables supprimées ci-dessus : ce drapeau, lui, court-circuite le choix
// d'adaptateur dans lib/prisma.ts et a la priorité sur tout le reste.
env.ARETE_LOCAL_DB = '1'

console.log('\x1b[33m⚑ Base LOCALE (prisma/dev.db) — la production n\'est pas touchée.\x1b[0m\n')

const child = spawn('npx', ['next', 'dev', '--port', process.env.PORT || '3051'], {
  env,
  stdio: 'inherit',
  shell: process.platform === 'win32',
})
child.on('exit', code => process.exit(code ?? 0))
