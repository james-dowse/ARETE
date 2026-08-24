import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { MOVEMENT_ID_PATTERN, nextMovementIds } from '@/lib/movement-id'
import * as XLSX from 'xlsx'

type ErrorType = 'champs_manquants' | 'id_non_conforme' | 'doublon_fichier' | 'doublon_existant' | 'erreur_bdd'

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
  doublon_existant: 'ID déjà utilisé',
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

  const existingIds = new Set((await prisma.movement.findMany({ select: { id: true } })).map(m => m.id))
  const errors: ImportError[] = []

  // ── Passe 1 : validation, sans toucher la base ──────────────────────────────
  // Un ID manquant dans le fichier n'est pas une erreur : il sera généré. Un ID
  // présent mais mal formé, ou déjà pris (dans la base ou ailleurs dans le même
  // fichier), est en revanche rejeté explicitement — plus de doublon silencieux.
  const seenInFile = new Set<string>()
  const toCreate: { line: number; id: string | null; name: string; bioType: string; complexity: string; equipment: string | null; description: string | null; videoUrl: string | null }[] = []

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
      // Pas d'ID dans le fichier : sera généré en passe 2.
      toCreate.push({ line, id: null, name, bioType, complexity, equipment, description, videoUrl })
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

    if (existingIds.has(rawId)) {
      errors.push({ line, name, id: rawId, type: 'doublon_existant', message: `ID "${rawId}" existe déjà dans la bibliothèque` })
      return
    }

    seenInFile.add(rawId)
    toCreate.push({ line, id: rawId, name, bioType, complexity, equipment, description, videoUrl })
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

  return NextResponse.json({
    imported: createdIds.length,
    createdIds, // permet d'annuler l'import (voir /api/movements/import/undo)
    errorCount: errors.length,
    errors: errors.map(e => ({ ...e, typeLabel: ERROR_LABELS[e.type] })),
  })
}
