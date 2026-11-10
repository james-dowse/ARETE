'use client'
import React from 'react'
import RichEditor from '@/components/RichEditor'
import MovementModal from '@/components/MovementModal'
import ResumeSessionBanner from '@/components/ResumeSessionBanner'
import LibraryPicker, { type PickableMovement } from '@/components/LibraryPicker'
import { BIO_TYPE_COLORS, BIO_TYPE_ICONS, COMPLEXITY_COLORS, COMPLEXITIES, effectiveDifficulty } from '@/lib/types'
import { estimateWorkoutMinutes, type DurationMovement } from '@/lib/duration'
import { combine, cutWorkoutFrom, isCombinable, parseSessionCut, proposeVersions, sessionCutJson } from '@/lib/cuts'
import { useToast } from '@/components/Toast'
import CreatorBadge, { creatorName } from '@/components/CreatorBadge'
import OverflowMenu from '@/components/OverflowMenu'
import { readableAccent } from '@/lib/color'
import { useConfirm } from '@/components/ConfirmDialog'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'
import {
  ArrowLeft, Clock, Copy, X, Pencil, Plus,
  Trash2, ChevronDown, ChevronUp, CalendarPlus, CheckCircle2, History, FileText, PlayCircle,
  Share2, UserPlus,
} from 'lucide-react'
import {
  Workout, WorkoutMovement, WorkoutBlock, Movement, EditState, LastPerf,
  WorkoutImage, ImageEditZone, MovementRowView, MovementRowEdit,
  BlockHeaderView, BlockHeaderEdit, BlockRestAfterEdit, EditBar, AddToWeekModal, Stat,
  AssignFromWorkoutModal, RailBloc, type ModeBloc,
  toEditState, toDurationMovement, stripHtml, fmtMin, fmtSec,
} from './parts'
import { ShareModal } from '@/components/ShareModal'

// Le régime d'un bloc. `dropset` n'a pas encore de champ en base : la valeur
// existe dans le type et dans le rendu, et ce sera le seul endroit à changer
// quand la colonne sera là.
const modeDuBloc = (b: WorkoutBlock): ModeBloc => (b.superset ? 'superset' : 'classique')

// Casier des mouvements rattachés à aucun bloc. Ce n'est pas un bloc en base :
// juste une destination de glisser-déposer et un groupe d'affichage.
const HORS_BLOC = '__hors__'

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function WorkoutDetailClient({ workout: initial, backTo, isAdmin, passages = 0, dernierPassage = null }: { workout: Workout; backTo?: string; isAdmin?: boolean; passages?: number; dernierPassage?: string | null }) {
  const router = useRouter()

  const [editMode, setEditMode] = useState(false)
  const [editStates, setEditStates] = useState<EditState[]>([])
  const [blockInstructions, setBlockInstructions] = useState<Record<string, string>>({})
  const [blockSuperset, setBlockSuperset] = useState<Record<string, boolean>>({})
  const [blockTitle, setBlockTitle] = useState<Record<string, string>>({})
  const [blockRestAfter, setBlockRestAfter] = useState<Record<string, number | null>>({})
  // Rôle choisi par bloc ; '' = « Auto », déduit du nom (lib/block-role.ts).
  const [blockRole, setBlockRole] = useState<Record<string, string>>({})
  const [editName, setEditName] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [imageUrl, setImageUrl] = useState<string | null>(initial.imageUrl ?? null)
  const [imagePosition, setImagePosition] = useState<string | null>(initial.imagePosition ?? null)
  const originals = initial.movements

  const [duplicating, setDuplicating] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [showAddToWeek, setShowAddToWeek] = useState(false)
  const [showShare, setShowShare] = useState(false)
  const [showAssign, setShowAssign] = useState(false)
  const toast = useToast()
  const confirm = useConfirm()
  const [saving, setSaving] = useState(false)
  const [sessions, setSessions] = useState<{ id: string; doneAt: string; note?: string | null; cut?: string | null }[]>([])
  // Pastilles « Versions » cochées ; ['full'] = la séance entière.
  const [versionKeys, setVersionKeys] = useState<string[]>(['full'])
  const [sessionsOpen, setSessionsOpen] = useState(false)
  const [loggingSession, setLoggingSession] = useState(false)
  const [selectedMovementId, setSelectedMovementId] = useState<string | null>(null)
  const [addingToBlockId, setAddingToBlockId] = useState<string | null>(null)
  // Mouvements ajoutés en édition, pas encore persistés : symétrique avec la suppression
  // (differée jusqu'à Sauvegarder), au lieu de sauvegarder immédiatement à l'ajout.
  const [pendingAdds, setPendingAdds] = useState<{ tempId: string; blockId: string | null; orig: WorkoutMovement; es: EditState }[]>([])
  const [removedWmIds, setRemovedWmIds] = useState<Set<string>>(new Set())
  const [removedBlockIds, setRemovedBlockIds] = useState<Set<string>>(new Set())
  // Blocs ajoutés en édition, pas encore persistés — même logique différée que
  // pendingAdds pour les mouvements. Un mouvement ajouté dans un bloc pending
  // référence ce tempId comme blockId ; handleSave le remappe vers le vrai ID
  // une fois le bloc créé côté serveur.
  interface PendingBlock { tempId: string; bioType: string; instructions: string; superset: boolean; restAfter: number | null; role: string }
  const [pendingBlocks, setPendingBlocks] = useState<PendingBlock[]>([])
  const handleAddBlock = () => {
    const tempId = `new-block-${Math.random().toString(36).slice(2)}`
    setPendingBlocks(prev => [...prev, { tempId, bioType: '', instructions: '', superset: false, restAfter: null, role: '' }])
  }
  const [collapsedViewBlocks, setCollapsedViewBlocks] = useState<Record<string, boolean>>({})
  const toggleViewBlock = (id: string) => setCollapsedViewBlocks(prev => ({ ...prev, [id]: !prev[id] }))
  const [editTags, setEditTags] = useState<string[]>(() => initial.tags ? initial.tags.split(',').map(t => t.trim()).filter(Boolean) : [])
  const [tagInput, setTagInput] = useState('')
  const [editPublic, setEditPublic] = useState(!!initial.public)
  const [editDifficultyOverride, setEditDifficultyOverride] = useState(initial.difficultyOverride ?? '')
  const [movementOrder, setMovementOrder] = useState<Record<string, number>>({})
  const [draggedWmId, setDraggedWmId] = useState<string | null>(null)
  // Le bloc d’un mouvement devient un état modifiable : sans lui, le
  // regroupement lisait `orig.blockId` et déplacer un mouvement d’un bloc à
  // l’autre était impossible par construction, quoi qu’on fasse à l’écran.
  // `null` est une valeur légitime ici : « détaché de tout bloc ». D'où le type
  // nullable, et la lecture par `in` plutôt que par `??` partout — `??` ferait
  // retomber un détachement explicite sur le blockId d'origine.
  const [movementBlock, setMovementBlock] = useState<Record<string, string | null>>({})
  // La cible de dépôt, visée précisément : un bloc et une position entre deux
  // lignes. L’ancien modèle réordonnait pendant le survol, ce qui faisait
  // vibrer la liste et interdisait de viser le début ou la fin d’un bloc.
  const [cibleDepot, setCibleDepot] = useState<{ blockId: string; pos: number } | null>(null)
  // Ordre des blocs (édition) — même mécanique que movementOrder pour les
  // mouvements : un glisser-déposer réordonne localement, la vraie valeur
  // `order` n'est envoyée au serveur qu'à la sauvegarde, sur les blocs dont
  // la position a réellement changé.
  const [blockOrder, setBlockOrder] = useState<Record<string, number>>({})
  const [draggedBlockId, setDraggedBlockId] = useState<string | null>(null)
  // Même traitement que pour les mouvements : une position visée entre deux
  // blocs, plutôt qu’un réordonnancement pendant le survol.
  const [cibleBloc, setCibleBloc] = useState<number | null>(null)

  // Déplace un mouvement vers un bloc et une position donnés, puis renumérote
  // tout le monde. La renumérotation globale est volontaire : `order` est un
  // rang global dans ce schéma, et ne renuméroter qu’un bloc laisserait des
  // rangs qui s’entrelacent entre blocs.
  const deplacerMouvement = (wmId: string, versBlocId: string, pos: number) => {
    const pend = pendingAdds.find(p => p.tempId === wmId)

    // Ordre d’affichage actuel des blocs, pour renuméroter dans le bon sens.
    const blocsOrdonnes = [
      ...initial.blocks
        .filter(b => !removedBlockIds.has(b.id))
        .slice()
        .sort((a, b) => (blockOrder[a.id] ?? a.order) - (blockOrder[b.id] ?? b.order))
        .map(b => b.id),
      // En dernier, comme à l'affichage : les orphelins se lisent après les blocs.
      HORS_BLOC,
    ]

    // Contenu de chaque bloc avant déplacement, le mouvement déplacé retiré.
    const contenu: Record<string, string[]> = {}
    for (const bid of blocsOrdonnes) contenu[bid] = getBlockOrderedIds(bid).filter(id => id !== wmId)
    if (!contenu[versBlocId]) return

    const borne = Math.max(0, Math.min(pos, contenu[versBlocId].length))
    contenu[versBlocId].splice(borne, 0, wmId)

    const cible = versBlocId === HORS_BLOC ? null : versBlocId
    if (pend) {
      // Un mouvement pas encore enregistré n’a pas de ligne en base : c’est
      // `pendingAdds` qui porte son bloc.
      setPendingAdds(prev => prev.map(x => x.tempId === wmId ? { ...x, blockId: cible } : x))
    } else {
      setMovementBlock(prev => ({ ...prev, [wmId]: cible }))
    }

    const rangs: Record<string, number> = {}
    let n = 0
    for (const bid of blocsOrdonnes) for (const id of contenu[bid]) rangs[id] = n++
    setMovementOrder(prev => ({ ...prev, ...rangs }))
  }

  // Une zone de dépôt entre deux lignes. Haute de 2 px au repos pour ne pas
  // écarter la liste, elle s’épaissit et se colore dès qu’on la survole avec
  // un mouvement en main. Le padding invisible lui donne une cible de 14 px,
  // sinon elle serait impossible à viser.
  // Fonction de rendu, PAS un composant : defini dans le corps du composant,
  // un composant est un type neuf a chaque rendu, et React demonte puis remonte
  // son sous-arbre. La zone disparaissait donc sous le curseur en plein glisser.
  const zoneDepot = (blockId: string, pos: number) => {
    const actif = !!draggedWmId
    const vise = cibleDepot?.blockId === blockId && cibleDepot?.pos === pos
    if (!actif) return null
    return (
      <div
        onDragOver={e => { e.preventDefault(); if (!vise) setCibleDepot({ blockId, pos }) }}
        onDragLeave={() => { if (vise) setCibleDepot(null) }}
        onDrop={e => {
          e.preventDefault()
          if (draggedWmId) deplacerMouvement(draggedWmId, blockId, pos)
          setDraggedWmId(null); setCibleDepot(null)
        }}
        style={{ height: 2, margin: '-6px 0', padding: '6px 0', boxSizing: 'content-box' }}
      >
        <div style={{
          height: 2, borderRadius: 2,
          background: vise ? 'var(--accent)' : 'transparent',
          boxShadow: vise ? '0 0 0 3px rgba(180,85,45,0.18)' : 'none',
          transition: 'background 90ms',
        }} />
      </div>
    )
  }

  const deplacerBloc = (blocId: string, pos: number) => {
    const ids = initial.blocks
      .filter(b => !removedBlockIds.has(b.id))
      .slice()
      .sort((a, b) => (blockOrder[a.id] ?? a.order) - (blockOrder[b.id] ?? b.order))
      .map(b => b.id)
    const depuis = ids.indexOf(blocId)
    if (depuis === -1) return
    ids.splice(depuis, 1)
    // La position visée est comptée AVANT le retrait : si on descend un bloc,
    // tout ce qui le suivait a reculé d’un cran.
    const vers = Math.max(0, Math.min(pos > depuis ? pos - 1 : pos, ids.length))
    ids.splice(vers, 0, blocId)
    const rangs: Record<string, number> = {}
    ids.forEach((id, i) => { rangs[id] = i })
    setBlockOrder(prev => ({ ...prev, ...rangs }))

    // Les mouvements suivent leur bloc : leur rang global doit être recalculé,
    // sinon l’ordre affiché et l’ordre enregistré divergent.
    const rangsMvt: Record<string, number> = {}
    let n = 0
    for (const bid of ids) for (const mid of getBlockOrderedIds(bid)) rangsMvt[mid] = n++
    setMovementOrder(prev => ({ ...prev, ...rangsMvt }))
  }

  // Séance sans aucun bloc : les mouvements forment une liste plate, qui
  // souffrait exactement du même défaut.
  const deplacerDansListePlate = (wmId: string, pos: number) => {
    const ids = editStates
      .map((_, i) => originals[i])
      .filter(o => o && !removedWmIds.has(o.id))
      .sort((a, b) => (movementOrder[a.id] ?? a.order) - (movementOrder[b.id] ?? b.order))
      .map(o => o.id)
    const depuis = ids.indexOf(wmId)
    if (depuis === -1) return
    ids.splice(depuis, 1)
    const vers = Math.max(0, Math.min(pos > depuis ? pos - 1 : pos, ids.length))
    ids.splice(vers, 0, wmId)
    const rangs: Record<string, number> = {}
    ids.forEach((id, i) => { rangs[id] = i })
    setMovementOrder(prev => ({ ...prev, ...rangs }))
  }

  const zonePlate = (pos: number) => {
    if (!draggedWmId) return null
    const vise = cibleDepot?.blockId === '__plat__' && cibleDepot?.pos === pos
    return (
      <div
        onDragOver={e => { e.preventDefault(); if (!vise) setCibleDepot({ blockId: '__plat__', pos }) }}
        onDragLeave={() => { if (vise) setCibleDepot(null) }}
        onDrop={e => {
          e.preventDefault()
          if (draggedWmId) deplacerDansListePlate(draggedWmId, pos)
          setDraggedWmId(null); setCibleDepot(null)
        }}
        style={{ height: 2, margin: '-6px 0', padding: '6px 0', boxSizing: 'content-box' }}
      >
        <div style={{
          height: 2, borderRadius: 2,
          background: vise ? 'var(--accent)' : 'transparent',
          boxShadow: vise ? '0 0 0 3px rgba(180,85,45,0.18)' : 'none',
          transition: 'background 90ms',
        }} />
      </div>
    )
  }

  // Zone de dépôt entre deux blocs.
  const zoneBloc = (pos: number) => {
    if (!draggedBlockId) return null
    const vise = cibleBloc === pos
    return (
      <div
        onDragOver={e => { e.preventDefault(); if (!vise) setCibleBloc(pos) }}
        onDragLeave={() => { if (vise) setCibleBloc(null) }}
        onDrop={e => {
          e.preventDefault()
          if (draggedBlockId) deplacerBloc(draggedBlockId, pos)
          setDraggedBlockId(null); setCibleBloc(null)
        }}
        style={{ height: 3, margin: '-8px 0', padding: '8px 0', boxSizing: 'content-box' }}
      >
        <div style={{
          height: 3, borderRadius: 2,
          background: vise ? 'var(--gold)' : 'transparent',
          boxShadow: vise ? '0 0 0 3px rgba(201,165,53,0.20)' : 'none',
          transition: 'background 90ms',
        }} />
      </div>
    )
  }

  // ── Superset : mêmes séries pour tout le bloc, repos 0 sauf sur le dernier ──
  // Un bloc superset enchaîne ses mouvements sans pause (1→2→…→X), puis observe
  // un repos avant de recommencer le tour. Ce repos vit sur le dernier mouvement
  // du bloc ; les autres n'ont donc pas de repos éditable (forcé à 0).
  const isSupersetBlock = (blockId: string): boolean =>
    blockSuperset[blockId] ?? pendingBlocks.find(pb => pb.tempId === blockId)?.superset ?? false

  // Ordre d'un bloc = mouvements existants (triés) puis mouvements en attente
  // (dans leur ordre d'ajout) — fonctionne aussi bien pour un bloc existant
  // que pour un bloc tout juste créé (où seuls des pendingAdds existent).
  // Le bloc courant d’un mouvement : celui où le glisser-déposer l’a mis,
  // sinon celui d’origine.
  const blocDe = (o: { id: string; blockId?: string | null }): string | null =>
    o.id in movementBlock ? movementBlock[o.id] : (o.blockId ?? null)

  // « Hors bloc » se manipule comme un bloc : même groupement, mêmes zones de
  // dépôt, même renumérotation. Sans ça, un mouvement détaché n'a aucun endroit
  // où être déposé — et c'est exactement ce qui rendait les 15 orphelins d'Alan
  // Hanik impossibles à rattacher.
  // Trois cas tombent dans « hors bloc », et pas seulement le premier :
  //   blockId nul ; blockId pointant vers un bloc qui n'existe plus (donnée
  //   abîmée) ; bloc supprimé dans la session d'édition en cours — la relation
  //   est optionnelle, donc sa suppression détachera ces mouvements plutôt que
  //   de les effacer. Les montrer évite d'en fabriquer de nouveaux sans le voir.
  const casier = (o: { id: string; blockId?: string | null }): string => {
    const b = blocDe(o)
    if (!b || removedBlockIds.has(b)) return HORS_BLOC
    const existe = initial.blocks.some(x => x.id === b) || pendingBlocks.some(p => p.tempId === b)
    return existe ? b : HORS_BLOC
  }

  const getBlockOrderedIds = (blockId: string): string[] => {
    const existingIds = originals
      .map((o, i) => ({ o, i }))
      .filter(({ o }) => casier(o) === blockId && !removedWmIds.has(o.id))
      .sort((a, b) => (movementOrder[a.o.id] ?? a.o.order) - (movementOrder[b.o.id] ?? b.o.order))
      .map(({ o }) => o.id)
    const pendingIds = pendingAdds.filter(p => (p.blockId ?? HORS_BLOC) === blockId).map(p => p.tempId)
    return [...existingIds, ...pendingIds]
  }

  const getRowSets = (rowId: string): number => {
    const pend = pendingAdds.find(p => p.tempId === rowId)
    if (pend) return pend.es.sets
    const idx = originals.findIndex(o => o.id === rowId)
    return idx !== -1 ? editStates[idx].sets : 2
  }

  const getRowRest = (rowId: string): number | null => {
    const pend = pendingAdds.find(p => p.tempId === rowId)
    if (pend) return pend.es.rest
    const idx = originals.findIndex(o => o.id === rowId)
    return idx !== -1 ? editStates[idx].rest : null
  }

  // Ces trois fonctions passent par `blocDe` et non par `originals[i].blockId` :
  // depuis le glisser-déposer entre blocs, le bloc d'un mouvement est celui où la
  // souris l'a posé, et le `blockId` d'origine ne vaut plus que jusqu'au premier
  // déplacement. Les lire sur l'original égalisait l'ancien bloc et pas le nouveau.
  const syncSupersetSets = (blockId: string, sets: number) => {
    setEditStates(prev => prev.map((es, i) => originals[i] && blocDe(originals[i]) === blockId ? { ...es, sets } : es))
    setPendingAdds(prev => prev.map(p => p.blockId === blockId ? { ...p, es: { ...p.es, sets } } : p))
  }

  const zeroRestExceptLast = (blockId: string) => {
    const orderedIds = getBlockOrderedIds(blockId)
    const lastId = orderedIds[orderedIds.length - 1]
    setEditStates(prev => prev.map((es, i) => {
      const o = originals[i]
      return (o && blocDe(o) === blockId && o.id !== lastId) ? { ...es, rest: 0 } : es
    }))
    setPendingAdds(prev => prev.map(p => (p.blockId === blockId && p.tempId !== lastId) ? { ...p, es: { ...p.es, rest: 0 } } : p))
  }

  const handleToggleSuperset = (blockId: string, isPending: boolean) => {
    const turningOn = !isSupersetBlock(blockId)
    if (isPending) setPendingBlocks(prev => prev.map(x => x.tempId === blockId ? { ...x, superset: turningOn } : x))
    else setBlockSuperset(prev => ({ ...prev, [blockId]: turningOn }))

    if (turningOn) {
      const orderedIds = getBlockOrderedIds(blockId)
      if (orderedIds.length > 0) {
        syncSupersetSets(blockId, getRowSets(orderedIds[0]))
        zeroRestExceptLast(blockId)
      }
    }
  }

  const handleAddMovementToBlock = (blockId: string, m: PickableMovement) => {
    const resolvedBlockId = blockId === '__flat__' ? null : blockId
    const tempId = `new-${Math.random().toString(36).slice(2)}`
    const movement: Movement = { id: m.id, name: m.name, bioType: m.bioType, complexity: m.complexity, equipment: m.equipment, description: m.description, videoUrl: m.videoUrl }
    // Dans un bloc superset, le nouveau mouvement hérite du nombre de séries commun
    // et n'a pas de repos éditable tant qu'il n'est pas le dernier du bloc.
    const isSuper = !!resolvedBlockId && isSupersetBlock(resolvedBlockId)
    const existingIds = resolvedBlockId ? getBlockOrderedIds(resolvedBlockId) : []
    const previousLastId = existingIds[existingIds.length - 1] ?? null
    const sets = isSuper && existingIds.length > 0 ? getRowSets(existingIds[0]) : 2
    const orig: WorkoutMovement = { id: tempId, movementId: m.id, order: Number.MAX_SAFE_INTEGER, sets, reps: '10', duration: null, rest: isSuper ? 0 : null, movement, blockId: resolvedBlockId }
    setPendingAdds(prev => [...prev, { tempId, blockId: resolvedBlockId, orig, es: toEditState(orig) }])
    setAddingToBlockId(null)
    // Ce nouveau mouvement devient le dernier du bloc : l'ancien dernier n'a plus
    // à avoir de repos éditable, on le remet à 0.
    if (isSuper && previousLastId) {
      setEditStates(prev => prev.map((es, i) => originals[i]?.id === previousLastId ? { ...es, rest: 0 } : es))
      setPendingAdds(prev => prev.map(p => p.tempId === previousLastId ? { ...p, es: { ...p.es, rest: 0 } } : p))
    }
  }

  // Track last viewed (fire-and-forget)
  useEffect(() => {
    fetch(`/api/workouts/${initial.id}/view`, { method: 'POST' }).catch(() => {})
  }, [initial.id])

  // Load sessions
  useEffect(() => {
    fetch(`/api/workouts/${initial.id}/sessions`)
      .then(r => r.json())
      .then(data => { if (Array.isArray(data)) setSessions(data) })
      .catch(() => {})
  }, [initial.id])

  // Dernière perf par mouvement — aperçu "la dernière fois" avant de lancer la séance
  const [lastPerf, setLastPerf] = useState<Record<string, LastPerf>>({})
  useEffect(() => {
    fetch(`/api/workouts/${initial.id}/last-performance`)
      .then(r => r.json())
      .then(d => setLastPerf(d || {}))
      .catch(() => {})
  }, [initial.id])

  const handleLogSession = async () => {
    setLoggingSession(true)
    const res = await fetch(`/api/workouts/${initial.id}/sessions`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(version ? { cut: sessionCutJson(version) } : {}) }).catch(() => null)
    if (!res || !res.ok) {
      toast('Impossible d\'enregistrer la séance', 'error')
      setLoggingSession(false)
      return
    }
    const s = await res.json()
    setSessions(prev => [s, ...prev])
    setLoggingSession(false)
    toast('Séance enregistrée ✓')
  }

  // Session toast auto-hide already handled above

  // Auto-enter edit mode if navigated with ?edit=1
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('edit') === '1') {
      handleEnterEdit()
      window.history.replaceState({}, '', window.location.pathname)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Dirty checks ──
  const isDirtyMovements = editMode && (pendingAdds.length > 0 || editStates.some((es, i) => {
    const orig = originals[i]
    return es.movementId !== orig.movementId || es.sets !== (orig.sets ?? 2) || es.reps !== (orig.reps ?? '10') || es.duration !== (orig.duration ?? null) || es.rest !== (orig.rest ?? null)
  }))
  const blockChanged = (b: WorkoutBlock) =>
    (blockInstructions[b.id] ?? '') !== (b.instructions ?? '') ||
    (blockSuperset[b.id] ?? false) !== !!b.superset ||
    (blockTitle[b.id] ?? '') !== (b.bioType ?? '') ||
    (blockRestAfter[b.id] ?? null) !== (b.restAfter ?? null) ||
    (blockRole[b.id] ?? '') !== (b.role ?? '')
  const isDirtyBlocks = editMode && initial.blocks.some(blockChanged)
  // Champ vidé = pas un changement : on ne doit jamais envoyer un nom vide
  const isDirtyName = editMode && editName.trim() !== '' && editName.trim() !== initial.name
  const isDirtyDescription = editMode && stripHtml(editDescription) !== stripHtml(initial.description ?? '')
  const isDirtyImage = editMode && imageUrl !== (initial.imageUrl ?? null)
  const isDirtyImagePosition = editMode && !isDirtyImage && imagePosition !== (initial.imagePosition ?? null)
  const isDirtyTags = editMode && editTags.join(',') !== (initial.tags ?? '')
  const isDirtyPublic = editMode && editPublic !== !!initial.public
  const isDirtyDifficultyOverride = editMode && editDifficultyOverride !== (initial.difficultyOverride ?? '')
  const isDirtyOrder = editMode && originals.some(o => (movementOrder[o.id] ?? o.order) !== o.order)
  const isDirtyBlockOrder = editMode && initial.blocks.some(b => (blockOrder[b.id] ?? b.order) !== b.order)
  // Changer un mouvement de bloc sans changer son rang global n'était détecté
  // par rien : ni `isDirtyMovements` (qui ne compare que les champs de série),
  // ni `isDirtyOrder`. Déplacer la dernière ligne d'un bloc vers le début du
  // suivant laisse justement le rang inchangé — la barre affichait « Aucune
  // modification » et le bouton Sauvegarder disparaissait, alors que l'écran
  // montrait bien le mouvement à sa nouvelle place. `handleSave`, lui, savait
  // déjà envoyer le changement : il n'était jamais appelé.
  const isDirtyBlockMembership = editMode && originals.some(o => blocDe(o) !== (o.blockId ?? null))
  const isDirty = isDirtyMovements || isDirtyBlocks || isDirtyName || isDirtyDescription || isDirtyImage || isDirtyImagePosition || isDirtyTags || isDirtyPublic || isDirtyDifficultyOverride || isDirtyOrder || isDirtyBlockOrder || isDirtyBlockMembership || removedWmIds.size > 0 || removedBlockIds.size > 0 || pendingBlocks.length > 0

  const pendingCount = editMode
    ? editStates.filter((es, i) => {
        const orig = originals[i]
        return es.movementId !== orig.movementId || es.sets !== (orig.sets ?? 2) || es.reps !== (orig.reps ?? '10') || es.duration !== (orig.duration ?? null) || es.rest !== (orig.rest ?? null)
      }).length
      + initial.blocks.filter(blockChanged).length
      + (isDirtyName ? 1 : 0)
      + (isDirtyDescription ? 1 : 0)
      + (isDirtyImage ? 1 : 0)
      + (isDirtyOrder ? 1 : 0)
      + (isDirtyBlockOrder ? 1 : 0)
      + originals.filter(o => blocDe(o) !== (o.blockId ?? null)).length
      + removedWmIds.size
      + removedBlockIds.size
      + pendingAdds.length
      + pendingBlocks.length
    : 0

  const handleEnterEdit = () => {
    setEditStates(initial.movements.map(toEditState))
    const initBI: Record<string, string> = {}
    const initBS: Record<string, boolean> = {}
    const initBT: Record<string, string> = {}
    const initRA: Record<string, number | null> = {}
    const initRO: Record<string, string> = {}
    initial.blocks.forEach(b => { initBI[b.id] = b.instructions ?? ''; initBS[b.id] = !!b.superset; initBT[b.id] = b.bioType ?? ''; initRA[b.id] = b.restAfter ?? null; initRO[b.id] = b.role ?? '' })
    setBlockInstructions(initBI)
    setBlockSuperset(initBS)
    setBlockTitle(initBT)
    setBlockRestAfter(initRA)
    setBlockRole(initRO)
    setEditName(initial.name)
    setEditDescription(initial.description ?? '')
    setImageUrl(initial.imageUrl ?? null); setImagePosition(initial.imagePosition ?? null)
    setEditPublic(!!initial.public)
    setEditDifficultyOverride(initial.difficultyOverride ?? '')
    setRemovedWmIds(new Set()); setRemovedBlockIds(new Set()); setPendingAdds([]); setPendingBlocks([])
    const initOrder: Record<string, number> = {}
    initial.movements.forEach(wm => { initOrder[wm.id] = wm.order })
    setMovementOrder(initOrder)
    const initBlockOrder: Record<string, number> = {}
    initial.blocks.forEach(b => { initBlockOrder[b.id] = b.order })
    setBlockOrder(initBlockOrder)
    setEditMode(true)
  }

  const handleCancelAll = () => {
    setEditStates(initial.movements.map(toEditState))
    const initBI: Record<string, string> = {}
    const initBS: Record<string, boolean> = {}
    const initBT: Record<string, string> = {}
    const initRA: Record<string, number | null> = {}
    const initRO: Record<string, string> = {}
    initial.blocks.forEach(b => { initBI[b.id] = b.instructions ?? ''; initBS[b.id] = !!b.superset; initBT[b.id] = b.bioType ?? ''; initRA[b.id] = b.restAfter ?? null; initRO[b.id] = b.role ?? '' })
    setBlockInstructions(initBI)
    setBlockSuperset(initBS)
    setBlockTitle(initBT)
    setBlockRestAfter(initRA)
    setBlockRole(initRO)
    setEditName(initial.name)
    setEditDescription(initial.description ?? '')
    setImageUrl(initial.imageUrl ?? null); setImagePosition(initial.imagePosition ?? null)
    setEditPublic(!!initial.public)
    setEditDifficultyOverride(initial.difficultyOverride ?? '')
    setRemovedWmIds(new Set()); setRemovedBlockIds(new Set()); setPendingAdds([]); setPendingBlocks([])
    const initOrder: Record<string, number> = {}
    initial.movements.forEach(wm => { initOrder[wm.id] = wm.order })
    setMovementOrder(initOrder)
    const initBlockOrder: Record<string, number> = {}
    initial.blocks.forEach(b => { initBlockOrder[b.id] = b.order })
    setBlockOrder(initBlockOrder)
    setEditMode(false)
  }

  const handleUpdate = (idx: number, patch: Partial<EditState>) => {
    setEditStates(prev => prev.map((es, i) => i === idx ? { ...es, ...patch } : es))
    // Superset : les séries doivent rester identiques sur tout le bloc.
    if (patch.sets !== undefined) {
      const o = originals[idx]
      const blockId = o ? blocDe(o) : null
      if (blockId && isSupersetBlock(blockId)) syncSupersetSets(blockId, patch.sets)
    }
  }

  // Même logique que handleUpdate, mais pour un mouvement encore en attente
  // (pendingAdds) — utilisé par les lignes ajoutées en édition avant sauvegarde.
  const handlePendingUpdate = (tempId: string, patch: Partial<EditState>, blockId: string | null) => {
    setPendingAdds(prev => prev.map(x => x.tempId === tempId ? { ...x, es: { ...x.es, ...patch } } : x))
    if (patch.sets !== undefined && blockId && isSupersetBlock(blockId)) syncSupersetSets(blockId, patch.sets)
  }

  const handleRevert = (idx: number) =>
    setEditStates(prev => prev.map((es, i) => i === idx ? toEditState(originals[i]) : es))

  const handleSave = async () => {
    setSaving(true)

    // Filet de sécurité superset : quel que soit l'état de l'UI (un réordonnancement
    // par glisser-déposer ne remet pas à jour "qui est le dernier", par exemple), on
    // recalcule ici la contrainte réelle — mêmes séries partout, repos 0 sauf sur le
    // dernier mouvement du bloc — et on l'applique aux corps de requête plus bas.
    const forcedSets = new Map<string, number>()
    const forcedRest = new Map<string, number | null>()
    const allBlockIds = new Set([
      ...initial.blocks.filter(b => !removedBlockIds.has(b.id)).map(b => b.id),
      ...pendingBlocks.map(pb => pb.tempId),
    ])
    allBlockIds.forEach(blockId => {
      if (!isSupersetBlock(blockId)) return
      const ordered = getBlockOrderedIds(blockId)
      if (ordered.length === 0) return
      const targetSets = getRowSets(ordered[0])
      const lastId = ordered[ordered.length - 1]
      ordered.forEach(rowId => {
        forcedSets.set(rowId, targetSets)
        forcedRest.set(rowId, rowId === lastId ? getRowRest(rowId) : 0)
      })
    })

    // Les blocs en attente doivent exister côté serveur AVANT les mouvements qui
    // les référencent : cette étape est donc séquentielle, avant le Promise.all
    // qui gère le reste (indépendant entre les entrées).
    const blockIdMap: Record<string, string> = {}
    if (pendingBlocks.length > 0) {
      const created = await Promise.all(pendingBlocks.map(pb =>
        fetch(`/api/workouts/${initial.id}/blocks`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ bioType: pb.bioType || null, instructions: pb.instructions || null, superset: pb.superset, restAfter: pb.restAfter, role: pb.role || null }),
        }).then(r => r.ok ? r.json() : null).catch(() => null)
      ))
      if (created.some(c => !c)) {
        setSaving(false)
        toast('Un bloc n\'a pas pu être créé — réessaie.', 'error')
        return
      }
      pendingBlocks.forEach((pb, i) => { blockIdMap[pb.tempId] = created[i].id })
    }

    const changedMovements = editStates.filter((es, i) => {
      const orig = originals[i]
      const effSets = forcedSets.get(orig.id) ?? es.sets
      const effRest = forcedRest.has(orig.id) ? forcedRest.get(orig.id)! : es.rest
      return es.movementId !== orig.movementId || effSets !== (orig.sets ?? 2) || es.reps !== (orig.reps ?? '10')
        || es.duration !== (orig.duration ?? null) || effRest !== (orig.rest ?? null)
        || (movementOrder[orig.id] ?? orig.order) !== orig.order
        || blocDe(orig) !== (orig.blockId ?? null)
    })
    const blockOrderChanged = (b: WorkoutBlock) => (blockOrder[b.id] ?? b.order) !== b.order
    const changedBlocks = initial.blocks.filter(b => blockChanged(b) || blockOrderChanged(b))

    const results = await Promise.all([
      ...changedMovements.map(es => {
        const absIdx = editStates.indexOf(es)
        const orig = originals[absIdx]
        const effSets = forcedSets.get(orig.id) ?? es.sets
        const effRest = forcedRest.has(orig.id) ? forcedRest.get(orig.id)! : es.rest
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const body: Record<string, any> = {}
        if (es.movementId !== orig.movementId) body.newMovementId = es.movementId
        if (effSets !== (orig.sets ?? 2)) body.sets = effSets
        if (es.reps !== (orig.reps ?? '10')) body.reps = es.reps
        if (es.duration !== (orig.duration ?? null)) body.duration = es.duration
        if (effRest !== (orig.rest ?? null)) body.rest = effRest
        if ((movementOrder[orig.id] ?? orig.order) !== orig.order) body.order = movementOrder[orig.id]
        // Le PATCH accepte blockId depuis le 11/10 ; le client ne s’en servait
        // pas, d’où l’impossibilité de déplacer un mouvement entre deux blocs.
        // `blocDe` et non `movementBlock[...] ?? …` : la valeur null veut dire
        // « détaché », et la route PATCH l'accepte comme tel.
        const bidCible = blocDe(orig)
        if (bidCible !== (orig.blockId ?? null)) body.blockId = bidCible
        return fetch(`/api/workouts/${initial.id}/movements/${orig.id}`, {
          method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
        }).catch(() => null)
      }),
      ...changedBlocks.map(b =>
        fetch(`/api/workouts/${initial.id}/blocks/${b.id}`, {
          method: 'PATCH', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            instructions: blockInstructions[b.id], superset: blockSuperset[b.id] ?? false,
            bioType: blockTitle[b.id] || null, restAfter: blockRestAfter[b.id] ?? null,
            role: blockRole[b.id] || null,
            ...(blockOrderChanged(b) ? { order: blockOrder[b.id] } : {}),
          }),
        }).catch(() => null)
      ),
      ...((isDirtyName || isDirtyDescription || isDirtyTags || isDirtyPublic || isDirtyDifficultyOverride || isDirtyImage || isDirtyImagePosition) ? [
        fetch(`/api/workouts/${initial.id}`, {
          method: 'PATCH', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...(isDirtyName ? { name: editName.trim() } : {}),
            ...(isDirtyDescription ? { description: editDescription } : {}),
            ...(isDirtyTags ? { tags: editTags.join(',') || null } : {}),
            ...(isDirtyPublic ? { public: editPublic } : {}),
            ...(isDirtyDifficultyOverride ? { difficultyOverride: editDifficultyOverride || null } : {}),
            ...(isDirtyImage ? { imageUrl } : {}),
            ...(isDirtyImagePosition ? { imagePosition } : {}),
          }),
        }).catch(() => null)
      ] : []),
      ...[...removedWmIds].map(wmId =>
        fetch(`/api/workouts/${initial.id}/movements/${wmId}`, { method: 'DELETE' }).catch(() => null)
      ),
      ...[...removedBlockIds].map(blockId =>
        fetch(`/api/workouts/${initial.id}/blocks/${blockId}`, { method: 'DELETE' }).catch(() => null)
      ),
      ...pendingAdds.map(p => {
        const blockId = p.blockId !== null ? (blockIdMap[p.blockId] ?? p.blockId) : null
        const sets = forcedSets.get(p.tempId) ?? p.es.sets
        const rest = forcedRest.has(p.tempId) ? forcedRest.get(p.tempId)! : p.es.rest
        return fetch(`/api/workouts/${initial.id}/movements`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ movementId: p.es.movementId, blockId, sets, reps: p.es.reps, duration: p.es.duration, rest }),
        }).catch(() => null)
      }),
    ])

    const failed = results.filter(r => !r || !r.ok).length
    setSaving(false)
    if (failed > 0) {
      toast(`${failed} modification${failed > 1 ? 's' : ''} n'a pas pu être sauvegardée — réessaie.`, 'error')
      return
    }
    setPendingAdds([])
    setPendingBlocks([])
    setEditMode(false)
    toast('Modifications sauvegardées ✓')
    router.refresh()
  }

  const handleDuplicate = async () => {
    setDuplicating(true)
    const res = await fetch(`/api/workouts/${initial.id}/duplicate`, { method: 'POST' }).catch(() => null)
    setDuplicating(false)
    if (!res || !res.ok) { toast('Échec de la duplication', 'error'); return }
    const copy = await res.json()
    router.push(`/workouts/${copy.id}`)
  }

  // Le DELETE cascade (prisma/schema.prisma) sur WorkoutSession — et donc sur
  // ses SessionSet : les passages déjà faits, leurs séries, leurs charges et
  // leur ressenti partent avec la séance. C'est la seule donnée que
  // l'utilisateur ne peut pas refaire de mémoire, et l'ancien message n'en
  // disait rien : il ne parlait que du nombre de personnes ayant sauvegardé le
  // workout, c'est-à-dire de la perte la plus facile à réparer. `passages` est
  // déjà en props (compté côté serveur dans page.tsx), donc on le chiffre.
  const handleDelete = async () => {
    const savedCount = initial._count?.savedBy ?? 0
    const perte = passages === 0
      ? 'Tous les passages enregistrés sur cette séance seront supprimés avec elle : séries, charges et ressenti, sans retour possible.'
      : passages === 1
        ? 'Ton passage sur cette séance sera supprimé avec elle : séries, charges et ressenti, sans retour possible.'
        : `Tes ${passages} passages sur cette séance seront supprimés avec elle : séries, charges et ressenti, sans retour possible.`
    const partage = savedCount === 0 ? ''
      : savedCount === 1 ? " Un autre utilisateur l'a sauvegardée : il perdra son accès et son propre historique."
      : ` ${savedCount} autres utilisateurs l'ont sauvegardée : ils perdront leur accès et leur propre historique.`
    if (!await confirm(perte + partage, { title: 'Supprimer définitivement cette séance ?', danger: true })) return
    setDeleting(true)
    const res = await fetch(`/api/workouts/${initial.id}`, { method: 'DELETE' }).catch(() => null)
    if (!res || !res.ok) {
      toast('Échec de la suppression', 'error')
      setDeleting(false)
      return
    }
    router.push(backTo ?? '/workouts')
  }

  // Inclut les ajouts encore en attente (pas persistés) dans tous les agrégats affichés,
  // pour que le compteur de mouvements / la difficulté / la durée reflètent l'aperçu réel.
  const allEditStates = editMode ? [...editStates, ...pendingAdds.map(p => p.es)] : []

  const allMovementIds = editMode
    ? allEditStates.map(es => es.movementId)
    : initial.movements.map(m => m.movementId)

  const bioTypes = Array.from(new Set(
    (editMode ? allEditStates.map(es => es.movement.bioType) : initial.movements.map(m => m.movement.bioType))
  ))

  // Difficulté globale : recalculée à chaque changement de mouvement (reroll, bibliothèque, ajout/suppression),
  // sauf si un ajustement manuel est actif (editDifficultyOverride / initial.difficultyOverride), qui prime toujours.
  const computedMovementsForDifficulty = editMode ? allEditStates.map(es => ({ complexity: es.movement.complexity })) : initial.movements.map(m => ({ complexity: m.movement.complexity }))
  const difficulty = editMode
    ? effectiveDifficulty(editDifficultyOverride || null, computedMovementsForDifficulty)
    : effectiveDifficulty(initial.difficultyOverride, computedMovementsForDifficulty)

  // Même estimation que partout ailleurs dans l'app (liste des séances, aperçu
  // de bloc, générateur) — voir lib/duration.ts. En édition, reconstruit blockId
  // par mouvement (EditState ne le porte pas) pour rester exacte y compris sur
  // les blocs superset et les blocs tout juste créés (pas encore sauvegardés).
  const editDurationMovements: DurationMovement[] = [
    ...editStates.map((es, i) => ({
      sets: es.sets, reps: es.reps, duration: es.duration, rest: es.rest,
      blockId: originals[i]?.blockId ?? null, order: originals[i]?.order ?? i,
      bioType: es.movement.bioType,
    })),
    ...pendingAdds.map(p => ({
      sets: p.es.sets, reps: p.es.reps, duration: p.es.duration, rest: p.es.rest,
      blockId: p.blockId, order: Number.MAX_SAFE_INTEGER, bioType: p.es.movement.bioType,
    })),
  ]
  const editDurationBlocks = [
    ...initial.blocks.filter(b => !removedBlockIds.has(b.id)).map(b => ({
      id: b.id, superset: blockSuperset[b.id] ?? b.superset, restAfter: blockRestAfter[b.id] ?? b.restAfter,
    })),
    ...pendingBlocks.map(pb => ({ id: pb.tempId, superset: pb.superset, restAfter: pb.restAfter })),
  ]
  const estimatedMin = editMode
    ? estimateWorkoutMinutes(editDurationMovements, editDurationBlocks)
    : estimateWorkoutMinutes(initial.movements.map(toDurationMovement), initial.blocks)

  // ── Versions de la séance (lib/cuts.ts) ─────────────────────────────────────
  // Calculées à l'affichage, rien en base : une version coupe la séance en blocs
  // entiers. Types de travail et HIIT se cochent ensemble (Push + Pull), le reste
  // se choisit seul. Hors édition seulement : en édition, on voit tout.
  const cutW = cutWorkoutFrom(initial)
  const versions = editMode ? [] : proposeVersions(cutW)
  const pickedVersions = versions.filter(v => versionKeys.includes(v.key))
  const version = pickedVersions.length ? combine(cutW, pickedVersions) : versions[0]
  const isCut = !!version && version.rule.kind !== 'full'
  const keptBlocks = new Set(isCut ? version.result.keptBlockIds : initial.blocks.map(b => b.id))
  const droppedWhy = new Map(isCut ? version.result.dropped.map(d => [d.blockId, d.reason] as const) : [])
  const versionMin = isCut ? Math.max(1, Math.round(version.result.seconds / 60)) : estimatedMin
  const toggleVersion = (key: string) => {
    const v = versions.find(x => x.key === key)
    if (!v) return
    if (!isCombinable(v)) { setVersionKeys([key]); return }
    setVersionKeys(prev => {
      const cur = prev.filter(k => { const x = versions.find(y => y.key === k); return !!x && isCombinable(x) })
      const next = cur.includes(key) ? cur.filter(k => k !== key) : [...cur, key]
      return next.length ? next : ['full']
    })
  }

  const hasBlocks = initial.blocks.length > 0
  const blockMovementsMap: Record<string, WorkoutMovement[]> = {}
  if (hasBlocks) {
    initial.blocks.forEach(b => { blockMovementsMap[b.id] = [] })
    initial.movements.forEach(wm => { if (wm.blockId && blockMovementsMap[wm.blockId]) blockMovementsMap[wm.blockId].push(wm) })
  }
  // Tout ce que la boucle par bloc ne montrera jamais : `blockId` nul, ou
  // pointant vers un bloc qui n'existe plus.
  const orphanMovements = hasBlocks
    ? initial.movements.filter(wm => !wm.blockId || !blockMovementsMap[wm.blockId])
    : []
  const blockEditStatesMap: Record<string, { es: EditState; orig: WorkoutMovement; absIdx: number }[]> = {}
  if (hasBlocks && editMode) {
    initial.blocks.forEach(b => { blockEditStatesMap[b.id] = [] })
    blockEditStatesMap[HORS_BLOC] = []
    originals.forEach((orig, absIdx) => {
      // Après un ajout de mouvement, `initial.movements` (donc `originals`) grandit sur le
      // rendu qui suit router.refresh(), avant que l'effect ne rattrape `editStates` (un
      // render plus tard). Sans ce garde, `editStates[absIdx]` vaut undefined pour l'entrée
      // fraîchement ajoutée et fait planter MovementRowEdit.
      const bid = casier(orig)
      if (blockEditStatesMap[bid] && editStates[absIdx] && !removedWmIds.has(orig.id))
        blockEditStatesMap[bid].push({ es: editStates[absIdx], orig, absIdx })
    })
    Object.values(blockEditStatesMap).forEach(list =>
      list.sort((a, b) => (movementOrder[a.orig.id] ?? a.orig.order) - (movementOrder[b.orig.id] ?? b.orig.order))
    )
  }

  return (
    <>
      <div className="page-list" style={{ paddingBottom: isDirty ? 100 : 32 }}>
        <Link href={backTo ?? '/workouts'} style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-muted)', textDecoration: 'none', fontSize: 13, marginBottom: 24 }}>
          <ArrowLeft size={14} /> {backTo === '/admin' ? 'Retour à l\'administration' : 'Retour aux séances'}
        </Link>

        <ResumeSessionBanner workoutId={initial.id} />

        {/* Header */}
        <div style={{ marginBottom: 22 }}>
          <div style={{ minWidth: 0, marginBottom: 14 }}>
            {editMode ? (
              <input
                value={editName}
                onChange={e => setEditName(e.target.value)}
                placeholder="Nom de la séance"
                style={{ fontSize: 26, fontWeight: 800, background: isDirtyName ? 'var(--dirty)' : 'var(--bg-elevated)', border: `1px solid ${isDirtyName ? 'var(--dirty-border)' : 'var(--border)'}`, borderRadius: 8, padding: '4px 10px', color: isDirtyName ? 'var(--dirty-text)' : 'var(--text-primary)', outline: 'none', width: '100%', maxWidth: 480 }}
              />
            ) : (
              <h1 style={{ fontSize: 26, fontWeight: 800, margin: 0, wordBreak: 'break-word' }}>{initial.name}</h1>
            )}
            <div style={{ display: 'flex', gap: 14, marginTop: 8, flexWrap: 'wrap' }}>
              {/* La date de création ne répond à aucune question qu'on se pose en
                  ouvrant une séance. Le nombre de fois où on l'a faite, si. */}
              <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                {passages === 0
                  ? 'Jamais faite'
                  : `${passages}${passages === 1 ? 're' : 'e'} passage${dernierPassage ? ` · dernière fois le ${new Date(dernierPassage).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}` : ''}`}
              </span>
              {initial.duration && <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 13, color: 'var(--text-muted)' }}><Clock size={12} /> {initial.duration} min</span>}
              {initial.user && (
                <Link href={`/users/${initial.user.id}`} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--text-muted)', textDecoration: 'none' }}>
                  <CreatorBadge user={initial.user} size={20} />
                  {creatorName(initial.user)}
                </Link>
              )}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {!editMode ? (
              <>
                {/* Deux actions en clair, le reste dans le menu « … ». Huit
                    boutons de poids identique sur deux rangées rendaient
                    « Démarrer » invisible. Terracotta plein : la palette la
                    réserve à « l'action, le maintenant » — elle était en or,
                    couleur de la marque et de la progression. */}
                <button onClick={() => router.push(`/workouts/${initial.id}/active${isCut ? `?version=${encodeURIComponent(version.key)}` : ''}`)}
                  style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '9px 20px', background: 'var(--accent)', border: '1px solid transparent', borderRadius: 'var(--r-sm)', color: 'var(--on-accent)', fontSize: 13.5, fontWeight: 700, cursor: 'pointer', boxShadow: 'var(--elev-1)' }}>
                  <PlayCircle size={15} /> Démarrer{isCut ? ` · ${version.label}` : ''}
                </button>
                <button onClick={handleLogSession} disabled={loggingSession}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 15px', background: 'none', border: '1px solid var(--cypress-light)', borderRadius: 'var(--r-sm)', color: 'var(--green)', fontSize: 13, fontWeight: 600, cursor: loggingSession ? 'wait' : 'pointer' }}>
                  <CheckCircle2 size={14} /> {loggingSession ? '…' : 'J\'ai fait'}
                </button>
                <button onClick={() => setShowAddToWeek(true)}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 15px', background: 'none', border: '1px solid var(--border)', borderRadius: 'var(--r-sm)', color: 'var(--text-muted)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                  <CalendarPlus size={14} /> Planning
                </button>
                <OverflowMenu items={[
                  { label: 'Recommander', icon: <Share2 size={14} />, onClick: () => setShowShare(true) },
                  ...(isAdmin ? [{ label: 'Assigner à un utilisateur', icon: <UserPlus size={14} />, onClick: () => setShowAssign(true) }] : []),
                  { label: 'Exporter en PDF', icon: <FileText size={14} />, onClick: () => window.open(`/workouts/${initial.id}/print`, '_blank') },
                  { label: duplicating ? 'Copie…' : 'Dupliquer', icon: <Copy size={14} />, onClick: () => handleDuplicate(), disabled: duplicating },
                  { label: 'Modifier', icon: <Pencil size={14} />, onClick: () => handleEnterEdit() },
                  { label: deleting ? 'Suppression…' : 'Supprimer', icon: <Trash2 size={14} />, onClick: () => handleDelete(), danger: true, disabled: deleting },
                ]} />
              </>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', background: 'var(--accent)', border: '1px solid var(--accent)', borderRadius: 9 }}>
                <Pencil size={13} color="var(--on-accent)" />
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--on-accent)' }}>Mode édition</span>
              </div>
            )}
          </div>
        </div>

        {/* Versions — rangée de pastilles, rien n'est écrit en la touchant. */}
        {!editMode && versions.length > 1 && (
          <div style={{ marginBottom: 18 }}>
            <div className="t-micro" style={{ color: 'var(--text-dim)', marginBottom: 8 }}>Versions</div>
            <div role="group" aria-label="Versions de la séance" style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4 }}>
              {versions.map(v => {
                const on = v.key === 'full' ? !isCut : versionKeys.includes(v.key)
                return (
                  <button key={v.key} onClick={() => toggleVersion(v.key)} aria-pressed={on}
                    style={{
                      flexShrink: 0, display: 'inline-flex', alignItems: 'baseline', gap: 6, padding: '6px 12px',
                      borderRadius: 'var(--r-full)', cursor: 'pointer', fontSize: 'var(--fs-sm)', fontWeight: 700,
                      border: `1px solid ${on ? 'var(--crimson)' : 'var(--border-plus)'}`,
                      background: on ? 'var(--crimson-ghost)' : 'var(--bg-card)', color: 'var(--text-primary)',
                    }}>
                    {v.label}
                    <span style={{ fontSize: 'var(--fs-micro)', fontWeight: 800, color: 'var(--orange)' }}>{fmtMin(Math.max(1, Math.round(v.result.seconds / 60)))}</span>
                  </button>
                )
              })}
            </div>
            {isCut && version.result.looseDropped > 0 && (
              <div style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 6 }}>
                {version.result.looseDropped} mouvement{version.result.looseDropped > 1 ? 's' : ''} hors bloc ne {version.result.looseDropped > 1 ? 'sont' : 'est'} pas dans cette version.
              </div>
            )}
          </div>
        )}

        {/* Stats */}
        <div className="r-detail-stats" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 10, marginBottom: 18 }}>
          <Stat value={isCut ? initial.movements.filter(wm => !!wm.blockId && keptBlocks.has(wm.blockId)).length : initial.movements.length} label="Mouvements" color="var(--accent)" />
          <Stat value={bioTypes.length} label="Types" color="var(--blue)" />
          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-cartouche)', borderRadius: 10, padding: '12px 14px', textAlign: 'center' }}>
            <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--orange)' }}>{fmtMin(versionMin)}</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
              {isCut ? `Version ${version.label}` : initial.duration ? `${initial.duration}min prévu` : 'Estimé'}
            </div>
          </div>
        </div>

        {/* Bio tags */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 18 }}>
          {editMode ? (
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <select
                value={editDifficultyOverride}
                onChange={e => setEditDifficultyOverride(e.target.value)}
                style={{
                  padding: '6px 12px', borderRadius: 20, fontSize: 13, fontWeight: 700, cursor: 'pointer', outline: 'none',
                  background: difficulty ? `${COMPLEXITY_COLORS[difficulty]}18` : 'var(--bg-elevated)',
                  color: difficulty ? readableAccent(COMPLEXITY_COLORS[difficulty]) : 'var(--text-muted)',
                  border: `1px solid ${difficulty ? `${COMPLEXITY_COLORS[difficulty]}40` : 'var(--border)'}`,
                }}
              >
                <option value="">Auto{difficulty ? ` (${difficulty})` : ''}</option>
                {COMPLEXITIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              {isDirtyDifficultyOverride && <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 20, background: 'var(--dirty)', fontWeight: 600 }}>modifié</span>}
            </span>
          ) : difficulty && (
            <span style={{ padding: '6px 16px', borderRadius: 20, fontSize: 15, fontWeight: 700, background: `${COMPLEXITY_COLORS[difficulty]}18`, color: readableAccent(COMPLEXITY_COLORS[difficulty]), border: `1px solid ${COMPLEXITY_COLORS[difficulty]}40` }}>
              {difficulty}
            </span>
          )}
          {bioTypes.map(bt => (
            <span key={bt} style={{ padding: '6px 16px', borderRadius: 20, fontSize: 15, fontWeight: 600, background: `${BIO_TYPE_COLORS[bt] || '#000'}10`, color: BIO_TYPE_COLORS[bt] || 'var(--text-muted)', border: `1px solid ${BIO_TYPE_COLORS[bt] || '#000'}20` }}>
              {BIO_TYPE_ICONS[bt]} {bt}
            </span>
          ))}
        </div>

        {/* Edit hint */}
        {editMode && !isDirty && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: 'var(--accent-dim)', border: '1px solid var(--border)', borderRadius: 8, marginBottom: 16, fontSize: 12, color: 'var(--text-muted)' }}>
            <Pencil size={12} color="var(--text-dim)" />
            <span>Modifie les mouvements, la description, les photos et les instructions des blocs.</span>
          </div>
        )}

        {/* ── IMAGE ── */}
        {editMode ? (
          <ImageEditZone
            url={imageUrl}
            position={imagePosition}
            onUrlChange={u => { setImageUrl(u); setImagePosition(null) }}
            onPositionChange={setImagePosition}
          />
        ) : (
          initial.imageUrl && <WorkoutImage src={initial.imageUrl} position={initial.imagePosition} difficulty={difficulty} />
        )}

        {/* ── DESCRIPTION ── */}
        {editMode ? (
          <div style={{ marginBottom: 20 }}>
            <label style={{ fontSize: 11, fontWeight: 700, color: isDirtyDescription ? 'var(--dirty-text)' : 'var(--text-muted)', letterSpacing: 0.6, display: 'flex', alignItems: 'center', gap: 5, marginBottom: 6 }}>
              DESCRIPTION {isDirtyDescription && <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 20, background: 'var(--dirty)', fontWeight: 600 }}>modifié</span>}
            </label>
            <RichEditor
              key="description"
              value={editDescription}
              onChange={setEditDescription}
              placeholder="Décris cette séance…"
              minHeight={90}
              highlight={isDirtyDescription}
            />
          </div>
        ) : (
          initial.description && stripHtml(initial.description) && (
            <div style={{ marginBottom: 22, background: 'var(--bg-card)', border: '1px solid var(--border-cartouche)', borderRadius: 12, padding: '14px 16px' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: 0.8, marginBottom: 8 }}>DESCRIPTION</div>
              <div
                className="rich-content"
                style={{ fontSize: 14, lineHeight: 1.7, color: 'var(--text-primary)' }}
                dangerouslySetInnerHTML={{ __html: initial.description }}
              />
            </div>
          )
        )}

        {/* ── TAGS ── */}
        {editMode ? (
          <div style={{ marginBottom: 20 }}>
            <label style={{ fontSize: 11, fontWeight: 700, color: isDirtyTags ? 'var(--dirty-text)' : 'var(--text-muted)', letterSpacing: 0.6, display: 'flex', alignItems: 'center', gap: 5, marginBottom: 8 }}>
              TAGS {isDirtyTags && <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 20, background: 'var(--dirty)', fontWeight: 600 }}>modifié</span>}
            </label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
              {editTags.map(tag => (
                <span key={tag} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '3px 10px', borderRadius: 20, background: 'var(--gold-ghost)', border: '1px solid var(--gold-border)', color: 'var(--gold)', fontSize: 12, fontWeight: 600 }}>
                  #{tag}
                  <button onClick={() => setEditTags(prev => prev.filter(t => t !== tag))} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: 'var(--gold)', display: 'flex', lineHeight: 1 }}>
                    <X size={11} />
                  </button>
                </span>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <input
                value={tagInput}
                onChange={e => setTagInput(e.target.value.toLowerCase().replace(/[^a-z0-9-_]/g, ''))}
                onKeyDown={e => {
                  if ((e.key === 'Enter' || e.key === ',') && tagInput.trim()) {
                    e.preventDefault()
                    const t = tagInput.trim()
                    if (!editTags.includes(t)) setEditTags(prev => [...prev, t])
                    setTagInput('')
                  }
                }}
                placeholder="Ajouter un tag…"
                style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-cartouche)', borderRadius: 8, padding: '6px 10px', color: 'var(--text-primary)', fontSize: 13, outline: 'none', flex: 1 }}
              />
              <button
                onClick={() => { const t = tagInput.trim(); if (t && !editTags.includes(t)) { setEditTags(prev => [...prev, t]); setTagInput('') } }}
                disabled={!tagInput.trim()}
                style={{ padding: '6px 12px', background: 'var(--bg-elevated)', border: '1px solid var(--border-cartouche)', borderRadius: 8, color: 'var(--text-muted)', fontSize: 12, cursor: 'pointer' }}
              >
                + Ajouter
              </button>
            </div>
          </div>
        ) : (
          initial.tags && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 16 }}>
              {initial.tags.split(',').map(t => t.trim()).filter(Boolean).map(tag => (
                <span key={tag} style={{ padding: '2px 10px', borderRadius: 20, background: 'var(--gold-ghost)', border: '1px solid var(--gold-border)', color: 'var(--gold)', fontSize: 12, fontWeight: 600 }}>
                  #{tag}
                </span>
              ))}
            </div>
          )
        )}

        {/* ── PUBLICATION ── */}
        {editMode ? (
          <div style={{ marginBottom: 20 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, color: 'var(--text-primary)' }}>
              <input
                type="checkbox"
                checked={editPublic}
                onChange={async e => {
                  const checked = e.target.checked
                  if (checked) {
                    const missing: string[] = []
                    if (!stripHtml(editDescription)) missing.push('description')
                    if (initial.blocks.some(b => !stripHtml(blockInstructions[b.id] ?? ''))) missing.push('instructions de bloc')
                    if (editName.trim().startsWith('Séance')) missing.push('titre personnalisé')
                    if (missing.length > 0 && !await confirm(`Ce workout semble incomplet (${missing.join(', ')}). Publier quand même sur la Communauté ?`, { confirmLabel: 'Publier quand même' })) {
                      return
                    }
                  }
                  setEditPublic(checked)
                }}
                style={{ width: 16, height: 16, accentColor: 'var(--gold)' }}
              />
              Publier sur la Communauté
              {isDirtyPublic && <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 20, background: 'var(--dirty)', fontWeight: 600 }}>modifié</span>}
            </label>
          </div>
        ) : (
          initial.userId && (
            <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 16 }}>
              {initial.public ? 'Publié sur la Communauté' : 'Privé (non publié sur la Communauté)'}
            </div>
          )
        )}

        {/* ── MOVEMENTS ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {hasBlocks ? (
            initial.blocks
              .filter(block => !removedBlockIds.has(block.id))
              .slice()
              .sort((a, b) => (blockOrder[a.id] ?? a.order) - (blockOrder[b.id] ?? b.order))
              .map((block, bi) => {
              // Bloc hors de la version choisie : une ligne en pointillé qui dit
              // pourquoi, plutôt qu'une disparition sans explication.
              if (!editMode && isCut && !keptBlocks.has(block.id)) {
                return (
                  <div key={block.id} style={{ marginTop: bi === 0 ? 0 : 10, padding: '8px 12px', border: '1px dashed var(--border-plus)', borderRadius: 'var(--r-md)', display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 10, fontWeight: 800, color: 'var(--text-dim)', letterSpacing: 1 }}>BLOC {bi + 1}</span>
                    <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-dim)', textDecoration: 'line-through' }}>{block.bioType || 'Sans nom'}</span>
                    <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>{droppedWhy.get(block.id) ?? 'Hors de cette version'}</span>
                  </div>
                )
              }
              const blockMovements = blockMovementsMap[block.id] || []
              const blockES = (blockEditStatesMap[block.id] || []).filter(({ orig }) => !removedWmIds.has(orig.id))
              const blockCollapsed = !editMode && !!collapsedViewBlocks[block.id]
              const blockIsSuper = isSupersetBlock(block.id)
              const blockOrderedIds = editMode && blockIsSuper ? getBlockOrderedIds(block.id) : []
              const lastInBlockId = blockOrderedIds[blockOrderedIds.length - 1]
              const roleFor = (id: string): 'none' | 'linked' | 'last' =>
                !blockIsSuper ? 'none' : (id === lastInBlockId ? 'last' : 'linked')
              return (
                <div key={block.id}>
                  {editMode && zoneBloc(bi)}
                  {editMode ? (
                    <BlockHeaderEdit
                      block={block} index={bi}
                      title={blockTitle[block.id] ?? ''}
                      onTitleChange={v => setBlockTitle(prev => ({ ...prev, [block.id]: v }))}
                      role={blockRole[block.id] ?? ''}
                      onRoleChange={v => setBlockRole(prev => ({ ...prev, [block.id]: v }))}
                      instructions={blockInstructions[block.id] ?? ''}
                      onChange={v => setBlockInstructions(prev => ({ ...prev, [block.id]: v }))}
                      superset={blockSuperset[block.id] ?? false}
                      canSuperset={blockMovements.length > 1}
                      onToggleSuperset={() => handleToggleSuperset(block.id, false)}
                      isDirty={blockChanged(block)}
                      onRemove={() => setRemovedBlockIds(prev => new Set([...prev, block.id]))}
                      isDragging={draggedBlockId === block.id}
                      onDragStart={() => setDraggedBlockId(block.id)}
                      onDragOver={() => {}}
                      onDrop={() => { setDraggedBlockId(null); setCibleBloc(null) }}
                      onDragEnd={() => { setDraggedBlockId(null); setCibleBloc(null) }}
                    />
                  ) : (
                    <BlockHeaderView
                      block={block} index={bi} movements={blockMovementsMap[block.id] || []}
                      collapsed={blockCollapsed} onToggle={() => toggleViewBlock(block.id)}
                      mode={modeDuBloc(block)}
                    />
                  )}
                  {!blockCollapsed && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {editMode
                        ? <>
                            {blockES.map(({ es, orig, absIdx }, pos) => (
                              <React.Fragment key={orig.id}>
                              {zoneDepot(block.id, pos)}
                              <MovementRowEdit es={es} original={orig} index={absIdx} displayNumber={pos + 1} allMovementIds={allMovementIds} onUpdate={handleUpdate} onRevert={handleRevert} onMovementClick={setSelectedMovementId}
                                supersetRole={roleFor(orig.id)}
                                onRemove={() => setRemovedWmIds(prev => new Set([...prev, orig.id]))}
                                isDragging={draggedWmId === orig.id}
                                onDragStart={() => setDraggedWmId(orig.id)}
                                // Le survol d’une ligne ne réordonne plus : c’est la zone
                                // entre les lignes qui porte la cible, pour pouvoir viser
                                // le début et la fin d’un bloc.
                                onDragOver={() => {}}
                                onDrop={() => { setDraggedWmId(null); setCibleDepot(null) }}
                                onDragEnd={() => { setDraggedWmId(null); setCibleDepot(null) }}
                              />
                              </React.Fragment>
                            ))}
                            {zoneDepot(block.id, blockES.length)}
                            {pendingAdds.filter(p => p.blockId === block.id).map((p, pos) => (
                              <MovementRowEdit key={p.tempId} es={p.es} original={p.orig} index={-1} displayNumber={blockES.length + pos + 1} allMovementIds={allMovementIds} onMovementClick={setSelectedMovementId}
                                supersetRole={roleFor(p.tempId)}
                                onUpdate={(_, patch) => handlePendingUpdate(p.tempId, patch, block.id)}
                                onRevert={() => setPendingAdds(prev => prev.map(x => x.tempId === p.tempId ? { ...x, es: toEditState(x.orig) } : x))}
                                onRemove={() => setPendingAdds(prev => prev.filter(x => x.tempId !== p.tempId))}
                                isDragging={false} onDragStart={() => {}} onDragOver={() => {}} onDrop={() => {}} onDragEnd={() => {}}
                              />
                            ))}
                          </>
                        : <RailBloc
                            mode={modeDuBloc(block)}
                            tours={blockMovements[0]?.sets ?? 3}
                            lignes={blockMovements.map((wm, i) => <MovementRowView key={wm.id} wm={wm} index={i} onMovementClick={setSelectedMovementId} lastPerf={lastPerf[wm.movement.id]} />)}
                          />
                      }
                      {editMode && (
                        <button onClick={() => setAddingToBlockId(block.id)}
                          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '9px', background: 'none', border: '1px dashed var(--border)', borderRadius: 10, color: 'var(--text-muted)', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                          <Plus size={13} /> Ajouter un mouvement
                        </button>
                      )}
                      {editMode && (
                        <BlockRestAfterEdit
                          block={block}
                          restAfter={blockRestAfter[block.id] ?? null}
                          onRestAfterChange={v => setBlockRestAfter(prev => ({ ...prev, [block.id]: v }))}
                        />
                      )}
                    </div>
                  )}
                  {/* Inter-block rest */}
                  {!editMode && !blockCollapsed && bi < initial.blocks.length - 1 && (block.restAfter != null || initial.blockRest != null)
                    && (!isCut || initial.blocks.some(b2 => b2.order > block.order && keptBlocks.has(b2.id))) && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 12 }}>
                      <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
                      <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                        ⏸ {fmtSec((block.restAfter ?? initial.blockRest)!)} · repos entre blocs
                      </span>
                      <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
                    </div>
                  )}
                </div>
              )
            })
          ) : (
            editMode
              ? <>
                  {editStates
                    .map((es, i) => ({ es, orig: originals[i], i }))
                    .filter(({ orig }) => !removedWmIds.has(orig.id))
                    .sort((a, b) => (movementOrder[a.orig.id] ?? a.orig.order) - (movementOrder[b.orig.id] ?? b.orig.order))
                    .map(({ es, orig, i }, pos) => (
                      <React.Fragment key={orig.id}>
                      {zonePlate(pos)}
                      <MovementRowEdit es={es} original={orig} index={i} displayNumber={pos + 1} allMovementIds={allMovementIds} onUpdate={handleUpdate} onRevert={handleRevert} onMovementClick={setSelectedMovementId}
                        onRemove={() => setRemovedWmIds(prev => new Set([...prev, orig.id]))}
                        isDragging={draggedWmId === orig.id}
                        onDragStart={() => setDraggedWmId(orig.id)}
                        onDragOver={() => {}}
                        onDrop={() => { setDraggedWmId(null); setCibleDepot(null) }}
                        onDragEnd={() => { setDraggedWmId(null); setCibleDepot(null) }}
                      />
                      </React.Fragment>
                    ))}
                  {zonePlate(editStates.filter((_, i) => originals[i] && !removedWmIds.has(originals[i].id)).length)}
                  {pendingAdds.filter(p => p.blockId === null).map((p, pos) => (
                    <MovementRowEdit key={p.tempId} es={p.es} original={p.orig} index={-1} displayNumber={editStates.length + pos + 1} allMovementIds={allMovementIds} onMovementClick={setSelectedMovementId}
                      onUpdate={(_, patch) => setPendingAdds(prev => prev.map(x => x.tempId === p.tempId ? { ...x, es: { ...x.es, ...patch } } : x))}
                      onRevert={() => setPendingAdds(prev => prev.map(x => x.tempId === p.tempId ? { ...x, es: toEditState(x.orig) } : x))}
                      onRemove={() => setPendingAdds(prev => prev.filter(x => x.tempId !== p.tempId))}
                      isDragging={false} onDragStart={() => {}} onDragOver={() => {}} onDrop={() => {}} onDragEnd={() => {}}
                    />
                  ))}
                </>
              : initial.movements.map((wm, i) => <MovementRowView key={wm.id} wm={wm} index={i} onMovementClick={setSelectedMovementId} lastPerf={lastPerf[wm.movement.id]} />)
          )}
          {/* Les mouvements rattachés à aucun bloc. Sans ce rattrapage, une séance
              qui a des blocs mais dont les mouvements portent `blockId = null`
              affichait ses en-têtes de bloc et pas un seul mouvement : la fiche
              paraissait vide alors que la séance était complète. Même défaut que
              celui déjà corrigé sur l'écran de séance active. */}
          {!editMode && !isCut && hasBlocks && orphanMovements.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 12 }}>
              {orphanMovements.map((wm, i) => (
                <MovementRowView key={wm.id} wm={wm} index={i} onMovementClick={setSelectedMovementId} lastPerf={lastPerf[wm.movement.id]} />
              ))}
            </div>
          )}
          {/* Les mêmes orphelins, mais EN ÉDITION. Sans cette section, la boucle
              par bloc était le seul rendu du mode édition : une séance de 22
              mouvements dont 15 détachés s'ouvrait à 7 lignes. Rien n'était
              perdu en base — simplement invisible, donc irréparable depuis
              l'application, ce qui est pire qu'une perte visible.
              La section s'affiche aussi quand elle est vide pendant un glisser,
              pour offrir une destination « détacher du bloc ». */}
          {editMode && hasBlocks && ((blockEditStatesMap[HORS_BLOC] ?? []).length > 0 || !!draggedWmId) && (
            <div style={{ marginTop: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--text-dim)', letterSpacing: 1 }}>HORS BLOC</span>
                <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {(blockEditStatesMap[HORS_BLOC] ?? []).map(({ es, orig, absIdx }, pos) => (
                  <React.Fragment key={orig.id}>
                    {zoneDepot(HORS_BLOC, pos)}
                    <MovementRowEdit
                      es={es} original={orig} index={absIdx} displayNumber={pos + 1}
                      allMovementIds={allMovementIds} onUpdate={handleUpdate} onRevert={handleRevert}
                      onMovementClick={setSelectedMovementId}
                      onRemove={() => setRemovedWmIds(prev => new Set([...prev, orig.id]))}
                      isDragging={draggedWmId === orig.id}
                      onDragStart={() => setDraggedWmId(orig.id)}
                      onDragOver={() => {}}
                      onDrop={() => { setDraggedWmId(null); setCibleDepot(null) }}
                      onDragEnd={() => { setDraggedWmId(null); setCibleDepot(null) }}
                    />
                  </React.Fragment>
                ))}
                {zoneDepot(HORS_BLOC, (blockEditStatesMap[HORS_BLOC] ?? []).length)}
              </div>
            </div>
          )}
          {editMode && !hasBlocks && (
            <button onClick={() => setAddingToBlockId('__flat__')}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '9px', background: 'none', border: '1px dashed var(--border)', borderRadius: 10, color: 'var(--text-muted)', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
              <Plus size={13} /> Ajouter un mouvement
            </button>
          )}

          {/* Blocs ajoutés en édition, pas encore persistés */}
          {editMode && pendingBlocks.map((pb, pbi) => {
            const fakeBlock: WorkoutBlock = { id: pb.tempId, order: 0, bioType: '', instructions: '', superset: false, restAfter: null }
            const blockAdds = pendingAdds.filter(p => p.blockId === pb.tempId)
            return (
              <div key={pb.tempId}>
                <BlockHeaderEdit
                  block={fakeBlock} index={initial.blocks.filter(b => !removedBlockIds.has(b.id)).length + pbi}
                  title={pb.bioType}
                  onTitleChange={v => setPendingBlocks(prev => prev.map(x => x.tempId === pb.tempId ? { ...x, bioType: v } : x))}
                  role={pb.role}
                  onRoleChange={v => setPendingBlocks(prev => prev.map(x => x.tempId === pb.tempId ? { ...x, role: v } : x))}
                  instructions={pb.instructions}
                  onChange={v => setPendingBlocks(prev => prev.map(x => x.tempId === pb.tempId ? { ...x, instructions: v } : x))}
                  superset={pb.superset}
                  canSuperset={blockAdds.length > 1}
                  onToggleSuperset={() => handleToggleSuperset(pb.tempId, true)}
                  isDirty={false}
                  onRemove={() => {
                    setPendingBlocks(prev => prev.filter(x => x.tempId !== pb.tempId))
                    setPendingAdds(prev => prev.filter(p => p.blockId !== pb.tempId))
                  }}
                />
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {blockAdds.map((p, pos) => (
                    <MovementRowEdit key={p.tempId} es={p.es} original={p.orig} index={-1} displayNumber={pos + 1} allMovementIds={allMovementIds} onMovementClick={setSelectedMovementId}
                      supersetRole={!pb.superset ? 'none' : (pos === blockAdds.length - 1 ? 'last' : 'linked')}
                      onUpdate={(_, patch) => handlePendingUpdate(p.tempId, patch, pb.tempId)}
                      onRevert={() => setPendingAdds(prev => prev.map(x => x.tempId === p.tempId ? { ...x, es: toEditState(x.orig) } : x))}
                      onRemove={() => setPendingAdds(prev => prev.filter(x => x.tempId !== p.tempId))}
                      isDragging={false} onDragStart={() => {}} onDragOver={() => {}} onDrop={() => {}} onDragEnd={() => {}}
                    />
                  ))}
                  <button onClick={() => setAddingToBlockId(pb.tempId)}
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '9px', background: 'none', border: '1px dashed var(--border)', borderRadius: 10, color: 'var(--text-muted)', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                    <Plus size={13} /> Ajouter un mouvement
                  </button>
                  <BlockRestAfterEdit
                    block={fakeBlock}
                    restAfter={pb.restAfter}
                    onRestAfterChange={v => setPendingBlocks(prev => prev.map(x => x.tempId === pb.tempId ? { ...x, restAfter: v } : x))}
                  />
                </div>
              </div>
            )
          })}

          {editMode && (
            <button onClick={handleAddBlock}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '10px', marginTop: 4, background: 'var(--bg-elevated)', border: '1px dashed var(--text-dim)', borderRadius: 10, color: 'var(--text-primary)', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
              <Plus size={13} /> Ajouter un bloc
            </button>
          )}
        </div>

        {initial.notes && (
          <div style={{ marginTop: 22, background: 'var(--bg-card)', border: '1px solid var(--border-cartouche)', borderRadius: 12, padding: '14px 16px' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: 0.8, marginBottom: 6 }}>NOTES</div>
            <div style={{ fontSize: 14, lineHeight: 1.6 }}>{initial.notes}</div>
          </div>
        )}
      </div>

      {editMode && isDirty && <EditBar count={pendingCount} onSave={handleSave} onCancel={handleCancelAll} saving={saving} />}

      {editMode && !isDirty && (
        <div style={{ position: 'fixed', bottom: 'calc(28px + var(--mobile-tabbar-h, 0px))', left: '50%', transform: 'translateX(-50%)', background: 'var(--bg-card)', border: '1px solid var(--border-cartouche)', borderRadius: 14, padding: '12px 20px', display: 'flex', alignItems: 'center', gap: 12, boxShadow: '0 4px 16px rgba(0,0,0,0.1)', zIndex: 50, animation: 'slideUp 0.25s ease' }}>
          <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Aucune modification</span>
          <button onClick={() => setEditMode(false)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 16px', background: 'none', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text-primary)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
            <X size={13} /> Quitter l'édition
          </button>
        </div>
      )}

      <MovementModal movementId={selectedMovementId} onClose={() => setSelectedMovementId(null)} />

      {addingToBlockId && (
        <LibraryPicker
          currentName=""
          onPick={m => handleAddMovementToBlock(addingToBlockId, m)}
          onClose={() => setAddingToBlockId(null)}
        />
      )}

      {showAddToWeek && (
        <AddToWeekModal
          workoutId={initial.id}
          onClose={() => setShowAddToWeek(false)}
          onAdded={() => toast('Ajouté au planner ✓')}
        />
      )}

      {showShare && (
        <ShareModal workout={{ id: initial.id, name: initial.name }} onClose={() => setShowShare(false)} />
      )}

      {showAssign && (
        <AssignFromWorkoutModal workout={{ id: initial.id, name: initial.name }} onClose={() => setShowAssign(false)} />
      )}

      {/* Historique des séances */}
      {sessions.length > 0 && !editMode && (
        <div style={{ maxWidth: 700, marginTop: 32 }}>
          <div
            onClick={() => setSessionsOpen(o => !o)}
            style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', userSelect: 'none', marginBottom: sessionsOpen ? 12 : 0 }}
          >
            <History size={14} color="var(--text-muted)" />
            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: 0.6, textTransform: 'uppercase' }}>Historique</span>
            <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>{sessions.length} séance{sessions.length > 1 ? 's' : ''}</span>
            {sessions[0] && (
              <span style={{ fontSize: 11, color: 'var(--text-dim)', marginLeft: 4 }}>
                · dernière {new Date(sessions[0].doneAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
              </span>
            )}
            <span style={{ marginLeft: 'auto', color: 'var(--text-dim)', display: 'flex' }}>
              {sessionsOpen ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
            </span>
          </div>
          {sessionsOpen && (
            <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-cartouche)', borderRadius: 10, overflow: 'hidden' }}>
              {sessions.map((s, i) => (
                <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px', borderTop: i > 0 ? '1px solid var(--border)' : 'none' }}>
                  <CheckCircle2 size={13} color="var(--green)" />
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
                    {new Date(s.doneAt).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' })}
                  </span>
                  {parseSessionCut(s.cut) && <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>· {parseSessionCut(s.cut)!.label}</span>}
                  <span style={{ fontSize: 12, color: 'var(--text-dim)', marginLeft: 'auto' }}>
                    {new Date(s.doneAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes slideUp { from { opacity: 0; transform: translateX(-50%) translateY(16px); } to { opacity: 1; transform: translateX(-50%) translateY(0); } }
      `}</style>
    </>
  )
}
