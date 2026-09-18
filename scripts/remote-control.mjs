#!/usr/bin/env node
// Ouvre sur CE poste une session Claude Code pilotable depuis le téléphone
// (Remote Control), puis la sert tant que la fenêtre reste ouverte.
//
//   npm run remote-control              (serveur : nouvelles sessions à la demande)
//   npm run remote-control -- --check   (vérifications seules, rien n'est lancé)
//   npm run remote-control -- --name "Autre titre"
//
// Pourquoi ce script plutôt que `claude remote-control` à la main : une session
// qui tourne ici a accès à ce dossier, à `.env.local` et à `prisma/dev.db` —
// ce qu'une session cloud n'a pas. Encore faut-il qu'elle démarre dans le BON
// dossier et que rien dans l'environnement ne désactive le Remote Control en
// silence. Les deux se sont déjà produits ; d'où les vérifications ci-dessous.
//
// Procédure complète et dépannage : SESSION-WINDOWS.md

import { spawn, spawnSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const WIN = process.platform === 'win32'
// Remote Control existe à partir de cette version ; en dessous, `claude
// remote-control` n'est pas une commande connue.
const MIN_VERSION = '2.1.51'
const DEFAULT_NAME = 'ARETE — bibliothèque BD'

const C = { r: '\x1b[31m', g: '\x1b[32m', y: '\x1b[33m', d: '\x1b[2m', b: '\x1b[1m', x: '\x1b[0m' }
const step = (m) => console.log(`\n${C.b}▶ ${m}${C.x}`)
const ok   = (m) => console.log(`${C.g}✓${C.x} ${m}`)
const warn = (m) => console.log(`${C.y}!${C.x} ${m}`)

function die(msg, hint) {
  console.error(`\n${C.r}✗ ${msg}${C.x}`)
  if (hint) console.error(`${C.d}${hint}${C.x}`)
  process.exit(1)
}

// ── Arguments ───────────────────────────────────────────────────────────────
// Ce qui n'est pas consommé ici (--spawn, --permission-mode…) est passé tel
// quel à `claude remote-control`.
const argv = process.argv.slice(2)
let checkOnly = false
let name = DEFAULT_NAME
const passthrough = []
for (let i = 0; i < argv.length; i++) {
  const arg = argv[i]
  if (arg === '--check') { checkOnly = true; continue }
  if (arg === '--name') {
    const value = argv[++i]
    if (!value) die('--name attend un titre.', 'Exemple : npm run remote-control -- --name "Bibliothèque"')
    name = value
    continue
  }
  passthrough.push(arg)
}

// ── 1. Le bon dossier ───────────────────────────────────────────────────────
// Un ancien dossier ARETE-redesign-preview traîne sur ce poste et sert
// d'anciennes versions : une session ouverte dedans modifie du code mort.
step('Dossier de travail')
const pkgFile = path.join(ROOT, 'package.json')
if (!existsSync(pkgFile)) die(`Aucun package.json dans ${ROOT}.`)
const pkg = JSON.parse(readFileSync(pkgFile, 'utf8'))
if (pkg.name !== 'arete-100') {
  die(`Ce dossier n'est pas ARETE (package.json : « ${pkg.name} »).`,
      'Relance depuis C:\\Users\\jimmy\\ARETE — pas depuis ARETE-redesign-preview.')
}
ok(ROOT)

// ── 2. La CLI ───────────────────────────────────────────────────────────────
step('Claude Code')
const v = spawnSync('claude', ['--version'], { encoding: 'utf8', shell: WIN })
if (v.error || v.status !== 0) {
  die('La commande `claude` est introuvable.',
      WIN ? 'Installe-la dans PowerShell :  irm https://claude.ai/install.ps1 | iex'
          : 'Installe-la :  curl -fsSL https://claude.ai/install.sh | bash')
}
const parsed = /(\d+)\.(\d+)\.(\d+)/.exec(v.stdout ?? '')
if (!parsed) warn(`Version illisible (« ${(v.stdout ?? '').trim()} ») — on continue.`)
else {
  const [maj, min, pat] = parsed.slice(1).map(Number)
  const [Maj, Min, Pat] = MIN_VERSION.split('.').map(Number)
  const older = maj !== Maj ? maj < Maj : min !== Min ? min < Min : pat < Pat
  if (older) {
    die(`Claude Code ${parsed[0]} est trop ancien : Remote Control demande ${MIN_VERSION} ou plus.`,
        'Mets à jour :  claude update')
  }
  ok(`version ${parsed[0]}`)
}

// ── 3. L'environnement ──────────────────────────────────────────────────────
// Ces variables coupent le Remote Control sans le dire : la session démarre en
// local et ne remonte simplement jamais sur le téléphone.
step('Variables d\'environnement')
const blockers = []
const base = process.env.ANTHROPIC_BASE_URL?.trim()
if (base && !/(^|\/\/)([^/]*\.)?api\.anthropic\.com(\/|$)/.test(base)) {
  blockers.push(`ANTHROPIC_BASE_URL=${base} (Remote Control exige api.anthropic.com)`)
}
for (const key of ['DISABLE_TELEMETRY', 'DO_NOT_TRACK', 'CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC', 'DISABLE_GROWTHBOOK']) {
  if (process.env[key]) blockers.push(`${key}=${process.env[key]} (désactive l'évaluation dont dépend Remote Control)`)
}
for (const key of ['CLAUDE_CODE_USE_BEDROCK', 'CLAUDE_CODE_USE_VERTEX']) {
  if (process.env[key]) blockers.push(`${key}=${process.env[key]} (fournisseur tiers : Remote Control indisponible)`)
}
if (blockers.length) {
  for (const b of blockers) console.log(`  ${C.r}•${C.x} ${b}`)
  die('L\'environnement désactive Remote Control.', 'Retire ces variables de ton shell (et du bloc "env" de settings.json), puis relance.')
}
ok('rien qui bloque Remote Control')

// ── 4. La base locale ───────────────────────────────────────────────────────
// Pas bloquant : on signale seulement, pour ne pas découvrir depuis le
// téléphone que `npm run dev:local` n'a aucune donnée à servir.
step('Base de développement')
if (existsSync(path.join(ROOT, 'prisma', 'dev.db'))) ok('prisma/dev.db présente')
else warn('prisma/dev.db absente — `npm run db:from-prod` (copie de la prod) ou `npm run db:sync-local` (schéma seul).')

const branch = spawnSync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], { cwd: ROOT, encoding: 'utf8' })
if (branch.status === 0) console.log(`${C.d}  branche : ${branch.stdout.trim()}${C.x}`)

if (passthrough.length) console.log(`${C.d}  options transmises à claude : ${passthrough.join(' ')}${C.x}`)

if (checkOnly) {
  console.log(`\n${C.g}Prêt.${C.x} ${C.d}Titre de la session : « ${name} ». Lance sans --check pour l'ouvrir.${C.x}`)
  process.exit(0)
}

// ── 5. Le serveur ───────────────────────────────────────────────────────────
step(`Ouverture de la session « ${name} »`)
console.log(`${C.d}Retrouve-la dans l'app Claude (onglet Code) ou sur claude.ai/code.`)
console.log(`Espace affiche un QR code. Ctrl+C ferme la session — le PC doit rester allumé.${C.x}\n`)

const child = spawn('claude', ['remote-control', '--name', name, ...passthrough], {
  cwd: ROOT,
  stdio: 'inherit',
  shell: WIN,
})
child.on('error', () => die('Impossible de lancer `claude remote-control`.'))
child.on('exit', code => process.exit(code ?? 0))
