#!/usr/bin/env node
// Déploiement ARETE en production, de bout en bout.
//
//   node scripts/deploy.mjs "message de commit"
//   node scripts/deploy.mjs --check-only     (barrière qualité seule, aucun push)
//
// Enchaîne : barrière qualité -> commit -> push sur main -> attente du build
// Vercel -> vérification que l'URL de prod sert bien le nouveau déploiement.
// Sort en code 1 dès qu'une étape échoue, en expliquant quoi faire.

import { execSync, spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const BRANCH = 'main'
const PROD_ALIAS = 'arete-livid.vercel.app'
const VERCEL_PROJECT = 'arete'
const POLL_TIMEOUT_MS = 6 * 60_000
const POLL_INTERVAL_MS = 10_000

const C = { r: '\x1b[31m', g: '\x1b[32m', y: '\x1b[33m', d: '\x1b[2m', b: '\x1b[1m', x: '\x1b[0m' }
const say  = (m) => console.log(m)
const step = (m) => console.log(`\n${C.b}▶ ${m}${C.x}`)
const ok   = (m) => console.log(`${C.g}✓${C.x} ${m}`)
const warn = (m) => console.log(`${C.y}!${C.x} ${m}`)

function die(msg, hint) {
  console.error(`\n${C.r}✗ ${msg}${C.x}`)
  if (hint) console.error(`${C.d}${hint}${C.x}`)
  process.exit(1)
}

function sh(cmd, { capture = true } = {}) {
  return execSync(cmd, {
    cwd: ROOT,
    encoding: 'utf8',
    stdio: capture ? 'pipe' : 'inherit',
    maxBuffer: 64 * 1024 * 1024,
  })
}

function run(cmd, label) {
  const r = spawnSync(cmd, { cwd: ROOT, shell: true, stdio: 'inherit' })
  if (r.status !== 0) die(`${label} a échoué.`, 'Corrige les erreurs ci-dessus, puis relance ce script.')
  ok(label)
}

const sleep = (ms) => new Promise(r => setTimeout(r, ms))

// ── 0. Contexte ──────────────────────────────────────────────────────────────
step('Vérification du contexte')

let remote
try {
  remote = sh('git remote get-url origin').trim()
} catch {
  die('Pas de dépôt git ici.', `Attendu : ${ROOT}`)
}
if (!/james-dowse\/ARETE/i.test(remote)) {
  die(`Mauvais dépôt : ${remote}`, 'Ce script ne déploie que james-dowse/ARETE. Vérifie le répertoire courant.')
}
ok(`dépôt ${remote}`)

const branch = sh('git rev-parse --abbrev-ref HEAD').trim()
if (branch !== BRANCH) {
  die(`Branche courante « ${branch} », attendu « ${BRANCH} ».`,
      `La production ne se déploie que depuis ${BRANCH}. Fusionne d'abord :\n` +
      `  git checkout ${BRANCH} && git merge ${branch}`)
}
ok(`branche ${BRANCH}`)

const checkOnly = process.argv.includes('--check-only')
const message = process.argv.slice(2).filter(a => !a.startsWith('--')).join(' ').trim()

// ── 1. Y a-t-il seulement quelque chose à déployer ? ─────────────────────────
// La production suit origin/main : tout ce qui y est déjà poussé est en ligne.
// On ne relance donc un build que pour du travail réellement non déployé.
step('Écart avec la production')

try { sh(`git fetch origin ${BRANCH}`) } catch { warn('git fetch a échoué — comparaison sur la copie locale.') }

// Les fichiers non suivis comptent : un composant tout neuf est du travail à
// déployer. Les vrais déchets (notes, outils locaux) sont couverts par
// .gitignore et n'apparaissent donc pas ici.
const changes = sh('git status --porcelain').split('\n')
  .filter(l => l.trim() && !l.includes('design-variant'))
const dirty = changes.map(l => ({ new: l.startsWith('??'), path: l.slice(3).trim() }))

const pending = sh(`git log origin/${BRANCH}..HEAD --oneline`).split('\n').filter(l => l.trim())

if (dirty.length === 0 && pending.length === 0) {
  ok('Tout est déjà déployé — aucune modification locale, aucun commit en attente.')
  if (!checkOnly) {
    say(`\n${C.g}Rien à faire.${C.x} ${C.d}https://${PROD_ALIAS} est à jour.${C.x}`)
    process.exit(0)
  }
  warn('--check-only : la barrière qualité est tout de même exécutée.')
} else {
  if (pending.length) {
    say(`${C.d}${pending.length} commit(s) déjà fait(s) mais pas encore en ligne :${C.x}`)
    say(`${C.d}${pending.map(l => '  ' + l).join('\n')}${C.x}`)
  }
  if (dirty.length) {
    say(`${C.d}${dirty.length} fichier(s) à committer :${C.x}`)
    say(dirty.map(f => `${C.d}  ${f.new ? '+ (nouveau) ' : '  (modifié) '}${f.path}${C.x}`).join('\n'))
  }
}

// ── 2. Barrière qualité ──────────────────────────────────────────────────────
step('Barrière qualité (types, tests, build)')
run('npx tsc --noEmit', 'Types')
run('npx vitest run', 'Tests')
run('npm run build', 'Build')

if (checkOnly) {
  say(`\n${C.g}Barrière qualité passée.${C.x} Aucun déploiement (--check-only).`)
  process.exit(0)
}

// ── 3. Commit ────────────────────────────────────────────────────────────────
step('Commit')

if (dirty.length > 0) {
  if (!message) {
    die('Des fichiers sont modifiés mais aucun message de commit n\'a été fourni.',
        'Usage : node scripts/deploy.mjs "décris le changement"')
  }
  sh('git add -A -- ":!design-variant"')

  const staged = sh('git diff --cached --name-only').trim()
  if (!staged) die('Rien à committer après filtrage.', 'Vérifie `git status`.')
  say(`${C.d}${staged.split('\n').map(f => '  ' + f).join('\n')}${C.x}`)

  const body = `${message}\n\nCo-Authored-By: Claude <noreply@anthropic.com>`
  spawnSync('git', ['commit', '-m', body], { cwd: ROOT, stdio: 'inherit' })
  ok('commit créé')
} else {
  warn('Aucune modification à committer — on déploie le HEAD actuel.')
}

// ── 4. Push ──────────────────────────────────────────────────────────────────
step('Push vers GitHub')
const localSha = sh('git rev-parse HEAD').trim().slice(0, 7)
const pushedAt = Date.now()
run(`git push origin ${BRANCH}`, `Push ${localSha}`)

// ── 5. Attente du build Vercel ───────────────────────────────────────────────
step('Build Vercel')
say(`${C.d}Peut prendre 1 à 3 minutes. Le script attend et vérifie.${C.x}`)

function newestProdDeployment() {
  let out
  try { out = sh(`npx vercel ls ${VERCEL_PROJECT}`) } catch (e) { return null }
  for (const line of out.split('\n')) {
    const m = line.match(/(https:\/\/\S+)\s+●\s+(\w+)\s+(\w+)/)
    if (m && m[3] === 'Production') return { url: m[1], status: m[2] }
  }
  return null
}

let deployment = null
const deadline = Date.now() + POLL_TIMEOUT_MS

while (Date.now() < deadline) {
  await sleep(POLL_INTERVAL_MS)
  const d = newestProdDeployment()
  if (!d) { warn('Statut Vercel illisible, nouvelle tentative…'); continue }

  if (d.status === 'Ready')  { deployment = d; ok(`build terminé : ${d.url}`); break }
  if (d.status === 'Error')  {
    console.error(`\n${C.r}✗ Le build Vercel a échoué.${C.x}\n`)
    try { say(sh(`npx vercel inspect --logs ${d.url}`).split('\n').slice(-40).join('\n')) } catch { /* best effort */ }
    die('Déploiement en échec.',
        'Les logs ci-dessus donnent la cause. La production continue de servir\n' +
        'la version précédente : rien n\'est cassé côté utilisateur.')
  }
  say(`${C.d}  … ${d.status}${C.x}`)
}

if (!deployment) {
  die('Délai dépassé en attendant Vercel.',
      `Vérifie à la main :  npx vercel ls ${VERCEL_PROJECT}`)
}

// ── 6. Vérification de la production ─────────────────────────────────────────
// `curl` sur le site ne prouve RIEN : Vercel continue de servir l'ancienne
// version quand un build échoue, donc un HTTP 200 peut masquer un échec.
// La seule preuve valable est que l'alias de prod pointe sur un déploiement
// « Ready » créé après le push.
step('Vérification de la production')

let inspect
try { inspect = sh(`npx vercel inspect ${PROD_ALIAS}`) } catch {
  die('Impossible d\'inspecter l\'alias de production.', `Essaie : npx vercel inspect ${PROD_ALIAS}`)
}

const status  = inspect.match(/status\s+●?\s*(\w+)/)?.[1]
const created = inspect.match(/created\s+(.+?)\s*\[/)?.[1]
const createdAt = created ? new Date(created).getTime() : NaN

if (status !== 'Ready') {
  die(`L'alias de production est en statut « ${status ?? 'inconnu'} ».`,
      'Le site sert peut-être encore l\'ancienne version.')
}
if (Number.isFinite(createdAt) && createdAt < pushedAt - 60_000) {
  die('L\'alias de production pointe encore sur un déploiement antérieur au push.',
      `Attends une minute puis revérifie :  npx vercel inspect ${PROD_ALIAS}`)
}

ok(`${PROD_ALIAS} sert le nouveau déploiement`)

say(`\n${C.g}${C.b}Déploiement terminé.${C.x}`)
say(`  commit  ${localSha}`)
say(`  en ligne https://${PROD_ALIAS}`)
