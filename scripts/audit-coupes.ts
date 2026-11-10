// Audit des coupes : pour chaque séance de la base, les versions que le moteur
// (lib/cuts.ts) proposerait, et pourquoi une séance ne se couperait pas bien.
//
//   npx tsx scripts/audit-coupes.ts                 lit la base de .env.local / .env
//   npx tsx scripts/audit-coupes.ts --json f.json   lit un export déjà fait
//   option : --out <dossier>  (défaut : dossier courant)
//
// LECTURE SEULE : quatre SELECT, rien n'est écrit en base. Produit
// audit-coupes.md (à lire) et audit-coupes.json (le détail).

import fs from 'node:fs'
import path from 'node:path'
import { BIO_TYPE_TEMPO } from '../lib/types'
import { BLOCK_ROLE_LABEL, WORK_ROLES, PREP_ROLES, normTitle, roleOf } from '../lib/block-role'
import { applyCut, focusOf, movementsOf, proposeVersions, workoutSeconds, type CutWorkout } from '../lib/cuts'

type Row = Record<string, unknown>
interface Data { workouts: Row[]; blocks: Row[]; movements: Row[]; tempo: Row[] }

const args = process.argv.slice(2)
const opt = (k: string) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : null }
const OUT = opt('--out') || '.'

async function loadFromDb(): Promise<Data> {
  const dotenv = (await import('dotenv')).default
  dotenv.config({ path: '.env.local', quiet: true })
  dotenv.config({ quiet: true })
  // Le certificat du poste que les autres scripts d'ARETE acceptent déjà.
  await import('./lib/system-ca.mjs').catch(() => {})
  const url = process.env.TURSO_DATABASE_URL?.trim()
  if (!url) throw new Error('TURSO_DATABASE_URL absente de .env.local et de .env')
  const { createClient } = await import('@libsql/client')
  const db = createClient({ url, authToken: process.env.TURSO_AUTH_TOKEN })
  const q = async (sql: string) => (await db.execute(sql)).rows.map(r => ({ ...r }) as Row)
  const [workouts, blocks, movements, tempo] = await Promise.all([
    q(`SELECT w.id, w.name, w.public, u.firstName, u.lastName FROM Workout w LEFT JOIN InvitedUser u ON u.id = w.userId`),
    q(`SELECT id, workoutId, "order", bioType, superset, restAfter FROM WorkoutBlock`),
    q(`SELECT wm.workoutId, wm.blockId, wm."order", wm.sets, wm.reps, wm.rest, wm.duration, m.bioType, m.equipment
       FROM WorkoutMovement wm JOIN Movement m ON m.id = wm.movementId`),
    q(`SELECT value, tempo FROM AttributeOption WHERE category = 'bioType'`),
  ])
  return { workouts, blocks, movements, tempo }
}

const num = (v: unknown) => (v == null ? null : Number(v))
const mins = (s: number) => Math.max(1, Math.round(s / 60))

interface Issue { code: string; level: 'bloque' | 'reserve' | 'info'; text: string }

function analyse(name: string, w: CutWorkout, tempo: Record<string, number>) {
  const issues: Issue[] = []
  const add = (code: string, level: Issue['level'], text: string) => issues.push({ code, level, text })
  const withMv = w.blocks.filter(b => movementsOf(w, b.id).length > 0)
  const loose = w.movements.filter(m => !m.blockId).length
  const title = (b: { bioType?: string | null }) => b.bioType || 'sans nom'

  if (!w.blocks.length) add('aucun-bloc', 'bloque', loose ? `Aucun bloc : les ${loose} mouvements sont hors bloc, rien à couper.` : 'Séance vide.')
  else if (withMv.length === 1) add('un-bloc', 'bloque', 'Un seul bloc avec des mouvements : rien à couper.')
  if (w.blocks.length && loose) add('hors-bloc', 'reserve', `${loose} mouvement(s) hors bloc : aucune version ne les garderait.`)
  const empty = w.blocks.length - withMv.length
  if (empty) add('bloc-vide', 'info', `${empty} bloc(s) vide(s).`)
  const unnamed = withMv.filter(b => roleOf(b).how === 'vide')
  if (unnamed.length) add('sans-nom', 'reserve', `${unnamed.length} bloc(s) sans nom : rôle Force par défaut.`)
  const guessed = withMv.filter(b => roleOf(b).how === 'defaut')
  if (guessed.length) add('role-defaut', 'info', `Nom non reconnu, rôle Force par défaut : ${guessed.map(title).join(', ')}.`)
  const mixed = withMv.filter(b => roleOf(b).role === 'force' && focusOf(b, movementsOf(w, b.id)) === 'Mixte')
  if (mixed.length) add('focus-mixte', 'reserve', `Focus mixte (aucun type à 60 %) : ${mixed.map(title).join(', ')}. Pas de version par focus pour ces blocs.`)
  if (withMv.length && !withMv.some(b => WORK_ROLES.has(roleOf(b).role))) add('pas-de-travail', 'bloque', 'Aucun bloc de travail reconnu : que de la préparation ou du complément.')

  const versions = proposeVersions(w, tempo)
  const full = workoutSeconds(w, tempo)
  const durations = [30, 45].filter(t => full / 60 > t + 8).map(t => {
    const sans = applyCut(w, { kind: 'duration', targetMin: t, lever: false }, tempo)
    const avec = applyCut(w, { kind: 'duration', targetMin: t, lever: true }, tempo)
    return { target: t, sansLevier: sans.unreachable ? null : mins(sans.seconds), avecLevier: avec.unreachable ? null : mins(avec.seconds), auPlusCourt: mins(avec.seconds) }
  })

  if (versions.length <= 1 && !issues.some(i => i.level === 'bloque')) {
    const foci = [...new Set(withMv.filter(b => roleOf(b).role === 'force').map(b => focusOf(b, movementsOf(w, b.id))))].filter(f => f !== 'Mixte')
    const why: string[] = []
    why.push(foci.length === 1 ? `un seul type de force (${foci[0]})` : foci.length === 0 ? 'aucun type de force net' : '')
    if (!withMv.some(b => roleOf(b).role === 'conditionnement')) why.push('pas de bloc HIIT ou finisher')
    if (!withMv.some(b => PREP_ROLES.has(roleOf(b).role))) why.push('ni échauffement, ni mobilité, ni retour au calme reconnus')
    if (full / 60 <= 38) why.push(`déjà courte (${mins(full)} min)`)
    add('pas-de-version', 'bloque', `Aucune version à proposer : ${why.filter(Boolean).join(', ')}.`)
  }
  const verdict = issues.some(i => i.level === 'bloque') ? 'ne-se-coupe-pas' : issues.some(i => i.level === 'reserve') ? 'avec-reserves' : 'ok'
  return {
    name, min: mins(full), blocs: withMv.length, horsBloc: loose, verdict, issues, durations,
    versions: versions.map(v => ({ label: v.label, min: mins(v.result.seconds), blocs: v.result.keptBlockIds.length })),
    blocks: withMv.map(b => ({ title: b.bioType || '', role: BLOCK_ROLE_LABEL[roleOf(b).role], how: roleOf(b).how, focus: focusOf(b, movementsOf(w, b.id)) })),
  }
}

function build(data: Data) {
  const tempo: Record<string, number> = { ...BIO_TYPE_TEMPO }
  for (const t of data.tempo) if (t.tempo != null) tempo[String(t.value)] = Number(t.tempo)
  const byW = new Map<string, { name: string; owner: string | null; w: CutWorkout }>()
  for (const r of data.workouts) {
    byW.set(String(r.id), { name: String(r.name), owner: [r.firstName, r.lastName].filter(Boolean).join(' ') || null, w: { blocks: [], movements: [] } })
  }
  for (const b of data.blocks) {
    byW.get(String(b.workoutId))?.w.blocks.push({
      id: String(b.id), order: Number(b.order), bioType: (b.bioType as string) ?? null,
      superset: !!Number(b.superset), restAfter: num(b.restAfter),
    })
  }
  for (const m of data.movements) {
    byW.get(String(m.workoutId))?.w.movements.push({
      blockId: (m.blockId as string) ?? null, order: Number(m.order), sets: num(m.sets), reps: (m.reps as string) ?? null,
      rest: num(m.rest), duration: num(m.duration), bioType: String(m.bioType), equipment: (m.equipment as string) ?? null,
    })
  }
  const results = [...byW.values()].map(x => ({ ...analyse(x.name, x.w, tempo), owner: x.owner }))
    .sort((a, z) => a.name.localeCompare(z.name, 'fr'))
  const titles = new Map<string, { title: string; count: number; role: string; how: string }>()
  for (const r of results) for (const b of r.blocks) {
    const k = normTitle(b.title) || '(sans nom)'
    const t = titles.get(k) ?? { title: b.title || '(sans nom)', count: 0, role: b.role, how: b.how }
    t.count++; titles.set(k, t)
  }
  const issueCount: Record<string, number> = {}
  for (const r of results) for (const i of r.issues) issueCount[i.code] = (issueCount[i.code] ?? 0) + 1
  const verdicts = { ok: 0, 'avec-reserves': 0, 'ne-se-coupe-pas': 0 } as Record<string, number>
  for (const r of results) verdicts[r.verdict]++
  return { generatedAt: new Date().toISOString(), total: results.length, verdicts, issueCount, titles: [...titles.values()].sort((a, z) => z.count - a.count), results }
}

function toMarkdown(r: ReturnType<typeof build>): string {
  const V: Record<string, string> = { ok: 'Se coupe bien', 'avec-reserves': 'Se coupe, avec réserves', 'ne-se-coupe-pas': 'Ne se coupe pas' }
  const HOW: Record<string, string> = { nom: 'reconnu', defaut: 'Force par défaut', vide: 'bloc sans nom', choisi: 'choisi' }
  const L: string[] = [`# Audit des coupes ARETE`, '', `${r.total} séances, lues le ${r.generatedAt.slice(0, 10)} (lecture seule).`, '']
  for (const k of ['ok', 'avec-reserves', 'ne-se-coupe-pas']) L.push(`- ${V[k]} : **${r.verdicts[k]}**`)
  L.push('', '## Constats, du plus fréquent au plus rare', '')
  for (const [k, n] of Object.entries(r.issueCount).sort((a, z) => z[1] - a[1])) L.push(`- ${k} : ${n} séance(s)`)
  L.push('', '## Noms de blocs et rôle déduit', '', '| Nom du bloc | Blocs | Rôle | Comment |', '|---|---:|---|---|')
  for (const t of r.titles) L.push(`| ${t.title} | ${t.count} | ${t.role} | ${HOW[t.how] ?? t.how} |`)
  for (const v of ['ne-se-coupe-pas', 'avec-reserves', 'ok']) {
    const rows = r.results.filter(x => x.verdict === v)
    if (!rows.length) continue
    L.push('', `## ${V[v]} (${rows.length})`, '')
    for (const x of rows) {
      L.push(`### ${x.name} · ${x.min} min · ${x.blocs} bloc(s)${x.horsBloc ? ` · ${x.horsBloc} hors bloc` : ''}${x.owner ? ` · ${x.owner}` : ''}`)
      if (x.versions.length > 1) L.push(`Versions : ${x.versions.map(y => `${y.label} ${y.min} min`).join(' · ')}`)
      for (const d of x.durations) L.push(`Cible ${d.target} min : ${d.sansLevier ? `tenue (${d.sansLevier} min)` : d.avecLevier ? `tenue avec une série de moins (${d.avecLevier} min)` : `hors d'atteinte, au plus court ${d.auPlusCourt} min`}`)
      for (const i of x.issues) L.push(`- ${i.text}`)
      L.push('')
    }
  }
  return L.join('\n')
}

async function main() {
  const jsonPath = opt('--json')
  const data: Data = jsonPath ? JSON.parse(fs.readFileSync(jsonPath, 'utf8')) : await loadFromDb()
  const report = build(data)
  fs.writeFileSync(path.join(OUT, 'audit-coupes.json'), JSON.stringify(report, null, 2))
  fs.writeFileSync(path.join(OUT, 'audit-coupes.md'), toMarkdown(report))
  console.log(`${report.total} séances · se coupe bien ${report.verdicts.ok} · avec réserves ${report.verdicts['avec-reserves']} · ne se coupe pas ${report.verdicts['ne-se-coupe-pas']}`)
  console.log(`Rapport : ${path.join(OUT, 'audit-coupes.md')}`)
}

main().catch(err => { console.error(err instanceof Error ? err.message : err); process.exit(1) })
