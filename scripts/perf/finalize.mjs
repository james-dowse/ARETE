#!/usr/bin/env node
// Dernière étape de la migration : rapproche le serveur Vercel de la nouvelle
// base, puis déploie. À lancer UNIQUEMENT après que .env pointe déjà sur la
// nouvelle base (étape 3 de MIGRATION-DB.md).
//
//   node scripts/perf/finalize.mjs
//
// Le gain vient de la co-localisation : une base en Europe servie depuis un
// serveur américain ne va pas plus vite. Les deux doivent bouger ensemble,
// c'est pourquoi ce script refuse d'agir si la base est encore lointaine.

import dotenv from 'dotenv'
import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

dotenv.config({ quiet: true })

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const C = { r: '\x1b[31m', g: '\x1b[32m', y: '\x1b[33m', d: '\x1b[2m', b: '\x1b[1m', x: '\x1b[0m' }
const say  = (m) => console.log(m)
const step = (m) => console.log(`\n${C.b}▶ ${m}${C.x}`)
const ok   = (m) => console.log(`${C.g}✓${C.x} ${m}`)

function die(msg, hint) {
  console.error(`\n${C.r}✗ ${msg}${C.x}`)
  if (hint) console.error(`${C.d}${hint}${C.x}`)
  process.exit(1)
}

// Région Vercel la plus proche de chaque région Turso. Déduit automatiquement :
// aucun choix à faire, donc aucune erreur possible sur ce point.
const REGION_MAP = {
  'eu-west-3':      { vercel: 'cdg1', ville: 'Paris' },
  'eu-central-1':   { vercel: 'fra1', ville: 'Francfort' },
  'eu-west-1':      { vercel: 'dub1', ville: 'Dublin' },
  'eu-north-1':     { vercel: 'arn1', ville: 'Stockholm' },
  'us-east-1':      { vercel: 'iad1', ville: 'Virginie' },
  'us-west-2':      { vercel: 'pdx1', ville: 'Oregon' },
  'ap-northeast-1': { vercel: 'hnd1', ville: 'Tokyo' },
}

// ── 1. Où est la base que l'application utilise réellement ? ─────────────────
step('Région de la base active')

const url = process.env.TURSO_DATABASE_URL
if (!url) die('TURSO_DATABASE_URL est absente de .env.')

const m = String(url).match(/aws-([a-z]+-[a-z]+-\d)/)
if (!m) die('Impossible de déduire la région depuis TURSO_DATABASE_URL.',
            `URL lue : ${String(url).replace(/^\w+:\/\//, '').split('/')[0]}`)

const turso = m[1]
const target = REGION_MAP[turso]
if (!target) die(`Région Turso inconnue : ${turso}`, 'Ajoute-la à REGION_MAP dans ce script.')

say(`  base    ${turso} ${C.d}(${target.ville})${C.x}`)
say(`  serveur ${target.vercel} ${C.d}(${target.ville})${C.x}`)

if (turso === 'ap-northeast-1') {
  die('La base est encore à Tokyo — la migration n\'a pas été faite.',
      'Reprends MIGRATION-DB.md à l\'étape 1. Ce script ne sert qu\'APRÈS\n' +
      'que .env pointe sur la nouvelle base européenne.')
}
ok('base et serveur seront co-localisés')

// ── 2. Épinglage de la région Vercel ─────────────────────────────────────────
step('Configuration Vercel')

const file = path.join(ROOT, 'vercel.json')
const config = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : {}

if (config.regions?.[0] === target.vercel) {
  ok(`vercel.json déjà sur ${target.vercel}`)
} else {
  config.regions = [target.vercel]
  fs.writeFileSync(file, JSON.stringify(config, null, 2) + '\n')
  ok(`vercel.json écrit — regions: ["${target.vercel}"]`)
}

// ── 3. Déploiement ───────────────────────────────────────────────────────────
// On réutilise le script de déploiement habituel : il contient déjà la
// barrière qualité et la vérification que la production sert bien le résultat.
step('Déploiement')
say(`${C.d}Délégué à scripts/deploy.mjs (barrière qualité + vérification).${C.x}`)

const r = spawnSync(
  'node',
  ['scripts/deploy.mjs', `Co-locate serverless functions with database in ${target.ville}`],
  { cwd: ROOT, stdio: 'inherit' },
)

if (r.status !== 0) {
  die('Le déploiement a échoué.',
      'Les variables d\'environnement Vercel pointent-elles bien sur la\n' +
      'nouvelle base, en scope Production ET Preview ? (étape 3 de MIGRATION-DB.md)')
}

say(`\n${C.g}${C.b}Migration terminée.${C.x}`)
say(`${C.d}Mesure le résultat :  node scripts/perf/benchmark.mjs${C.x}`)
