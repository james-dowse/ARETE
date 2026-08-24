#!/usr/bin/env node
// Mesure la latence réseau vers la base, et le temps de réponse de la
// production. Sert de preuve chiffrée avant / après la migration.
//
//   node scripts/perf/benchmark.mjs
//
// Ne modifie rien : lectures seules.

import dotenv from 'dotenv'
import { createClient } from '@libsql/client'

dotenv.config({ quiet: true })

const C = { g: '\x1b[32m', y: '\x1b[33m', d: '\x1b[2m', b: '\x1b[1m', x: '\x1b[0m' }
const say = (m) => console.log(m)

const PROD_URL = 'https://arete-livid.vercel.app/login'
const RUNS = 7

// Région déduite du nom d'hôte Turso, pour rendre le diagnostic évident.
function region(url) {
  const m = String(url).match(/aws-([a-z]+-[a-z]+-\d)/)
  if (!m) return 'inconnue'
  const known = {
    'ap-northeast-1': 'Tokyo',      'us-east-1': 'Virginie',
    'eu-west-1': 'Irlande',         'eu-central-1': 'Francfort',
    'eu-west-3': 'Paris',           'us-west-2': 'Oregon',
  }
  return `${m[1]}${known[m[1]] ? ` (${known[m[1]]})` : ''}`
}

const median = (xs) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)]

async function dbLatency(url, token) {
  const c = createClient({ url, authToken: token })
  await c.execute('SELECT 1')          // connexion à chaud, non mesurée
  const times = []
  for (let i = 0; i < RUNS; i++) {
    const t = Date.now()
    await c.execute('SELECT 1')
    times.push(Date.now() - t)
  }
  return median(times)
}

async function httpLatency(url) {
  const times = []
  for (let i = 0; i < 5; i++) {
    const t = Date.now()
    try { await fetch(url, { cache: 'no-store' }) } catch { return null }
    times.push(Date.now() - t)
  }
  return median(times)
}

say(`${C.b}▶ Latence base de données${C.x}`)

const src = process.env.TURSO_DATABASE_URL
if (!src) { console.error('TURSO_DATABASE_URL absente de .env'); process.exit(1) }

const srcMs = await dbLatency(src, process.env.TURSO_AUTH_TOKEN)
say(`  actuelle   ${String(srcMs).padStart(5)} ms   ${C.d}région ${region(src)}${C.x}`)

const dst = process.env.TARGET_TURSO_DATABASE_URL
if (dst) {
  const dstMs = await dbLatency(dst, process.env.TARGET_TURSO_AUTH_TOKEN)
  say(`  cible      ${String(dstMs).padStart(5)} ms   ${C.d}région ${region(dst)}${C.x}`)
  const gain = srcMs - dstMs
  say(gain > 0
    ? `  ${C.g}gain ${gain} ms par requête${C.x} ${C.d}(×${(srcMs / Math.max(dstMs, 1)).toFixed(1)} plus rapide)${C.x}`
    : `  ${C.y}aucun gain — la cible n'est pas plus proche${C.x}`)
}

say(`\n${C.b}▶ Production${C.x}`)
const prodMs = await httpLatency(PROD_URL)
say(prodMs === null
  ? `  ${C.y}injoignable${C.x}`
  : `  ${PROD_URL.replace('https://', '')}  ${prodMs} ms`)

say(`\n${C.d}Repère : une page tape la base plusieurs fois de suite ; chaque${C.x}`)
say(`${C.d}milliseconde ci-dessus est donc payée plusieurs fois par écran.${C.x}`)

process.exit(0)
