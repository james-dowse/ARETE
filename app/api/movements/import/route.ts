import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { MOVEMENT_ID_PATTERN, nextMovementIds } from '@/lib/movement-id'
import { normalizeMovementName } from '@/lib/normalize'
import * as XLSX from 'xlsx'

type ErrorType = 'champs_manquants' | 'id_non_conforme' | 'doublon_fichier' | 'erreur_bdd'

interface ImportError {
  line: number      // ligne dans le fichier (2 = première ligne de données, après l'en-tête)
  name: string
  id: string
  type: ErrorType
  message: string
}

const ERROR_LABELS: Record<ErrorType, string> = {
  champs_manquants: 'Champs manquants',
  id_non_conforme: 'ID non conforme',
  doublon_fichier: 'Doublon dans le fichier',
  erreur_bdd: 'Erreur base de données',
}

export async function POST(req: NextRequest) {
  const form = await req.formData()
  const file = form.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'Fichier manquant' }, { status: 400 })

  const buffer = Buffer.from(await file.arrayBuffer())
  const wb = XLSX.read(buffer, { type: 'buffer' })
  const ws = wb.Sheets[wb.SheetNames[0]]
  const rows = XLSX.utils.sheet_to_json(ws) as Record<string, unknown>[]

  const existingMovements = await prisma.movement.findMany({ select: { id: true, name: true } }) as { id: string; name: string }[]
  const existingIds = new Set(existingMovements.map(m => m.id))
  // Reconnaissance par nom (fallback quand la ligne n'a pas d'ID exploitable) :
  // même logique de normalisation que l'onglet "Doublons" de l'admin.
  const idByNormalizedName = new Map(existingMovements.map(m => [normalizeMovementName(m.name), m.id]))
  const errors: ImportError[] = []

  // ── Passe 1 : validation, sans toucher la base ──────────────────────────────
  // Un ID manquant dans le fichier n'est pas une erreur : il sera généré (ou
  // l'existant sera mis à jour si le nom matche). Un ID présent mais mal formé,
  // ou déjà pris ailleurs dans le même fichier, est rejeté explicitement.
  // Un ID qui matche un mouvement existant — ou, à défaut d'ID, un nom qui
  // matche (normalisé) — met à jour ce mouvement au lieu d'en créer un
  // doublon : l'ID fait foi s'il est présent et valide, le nom sert de repli.
  const seenInFile = new Set<string>()
  type Row = { line: number; id: string | null; name: string; bioType: string; complexity: string; equipment: string | null; description: string | null; videoUrl: string | null }
  const toCreate: Row[] = []
  const toUpdate: Row[] = []

  rows.forEach((row, i) => {
    const line = i + 2
    const rawId = String(row['ID'] ?? '').trim()
    const name = String(row['MOVE'] ?? '').trim()
    const bioType = String(row['TYPE BIOMECANIQUE'] ?? '').trim()
    const complexity = String(row['COMPLEXITY'] ?? '').trim()
    const equipment = row['EQUIPMENT'] ? String(row['EQUIPMENT']).trim() : null
    const description = row['DESCRIPTION'] ? String(row['DESCRIPTION']).trim() : null
    const videoUrl = row['VIDEO'] ? String(row['VIDEO']).trim() : null

    if (!name || !bioType || !complexity) {
      errors.push({ line, name: name || '(sans nom)', id: rawId, type: 'champs_manquants', message: 'MOVE, TYPE BIOMECANIQUE et COMPLEXITY sont requis' })
      return
    }

    if (!rawId) {
      const matchedId = idByNormalizedName.get(normalizeMovementName(name))
      if (matchedId && !seenInFile.has(matchedId)) {
        seenInFile.add(matchedId)
        toUpdate.push({ line, id: matchedId, name, bioType, complexity, equipment, description, videoUrl })
      } else {
        // Pas de match par nom (ou déjà traité plus haut dans ce fichier) : sera généré en passe 2.
        toCreate.push({ line, id: null, name, bioType, complexity, equipment, description, videoUrl })
      }
      return
    }

    if (!MOVEMENT_ID_PATTERN.test(rawId)) {
      errors.push({ line, name, id: rawId, type: 'id_non_conforme', message: `"${rawId}" n'est pas un ID valide (numérique attendu)` })
      return
    }

    if (seenInFile.has(rawId)) {
      errors.push({ line, name, id: rawId, type: 'doublon_fichier', message: `ID "${rawId}" déjà utilisé plus haut dans ce fichier` })
      return
    }

    seenInFile.add(rawId)
    if (existingIds.has(rawId)) {
      toUpdate.push({ line, id: rawId, name, bioType, complexity, equipment, description, videoUrl })
    } else {
      toCreate.push({ line, id: rawId, name, bioType, complexity, equipment, description, videoUrl })
    }
  })

  // ── Passe 2 : génération des ID manquants ───────────────────────────────────
  const missingCount = toCreate.filter(r => r.id === null).length
  if (missingCount > 0) {
    const reserved = new Set(seenInFile) // évite qu'un ID auto-généré percute un ID du fichier
    const generated = await nextMovementIds(missingCount, reserved)
    let gi = 0
    for (const r of toCreate) if (r.id === null) r.id = generated[gi++]
  }

  // ── Passe 3 : écriture ───────────────────────────────────────────────────────
  const createdIds: string[] = []
  for (const r of toCreate) {
    try {
      await prisma.movement.create({
        data: { id: r.id!, name: r.name, bioType: r.bioType, complexity: r.complexity, equipment: r.equipment, description: r.description, videoUrl: r.videoUrl },
      })
      createdIds.push(r.id!)
    } catch (e) {
      errors.push({ line: r.line, name: r.name, id: r.id!, type: 'erreur_bdd', message: e instanceof Error ? e.message : String(e) })
    }
  }

  // Mise à jour des mouvements reconnus par ID ou par nom : seuls les champs
  // non vides de la ligne écrasent l'existant (une cellule vide ne doit pas
  // effacer une donnée déjà saisie, ex. imageUrl qui n'est de toute façon
  // jamais présent dans le fichier importé).
  const updatedIds: string[] = []
  for (const r of toUpdate) {
    try {
      await prisma.movement.update({
        where: { id: r.id! },
        data: {
          name: r.name,
          bioType: r.bioType,
          complexity: r.complexity,
          ...(r.equipment !== null ? { equipment: r.equipment } : {}),
          ...(r.description !== null ? { description: r.description } : {}),
          ...(r.videoUrl !== null ? { videoUrl: r.videoUrl } : {}),
        },
      })
      updatedIds.push(r.id!)
    } catch (e) {
      errors.push({ line: r.line, name: r.name, id: r.id!, type: 'erreur_bdd', message: e instanceof Error ? e.message : String(e) })
    }
  }

  return NextResponse.json({
    imported: createdIds.length,
    createdIds, // permet d'annuler l'import (voir /api/movements/import/undo)
    updated: updatedIds.length,
    updatedIds, // non annulables — reconnus par ID ou par nom et mis à jour en place
    errorCount: errors.length,
    errors: errors.map(e => ({ ...e, typeLabel: ERROR_LABELS[e.type] })),
  })
}
