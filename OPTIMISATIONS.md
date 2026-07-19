# Runbook d'optimisation — exécutable par n'importe quel modèle

> **But** : finir la migration des toasts (#5) et durcir la gestion d'erreur réseau
> dans `app/workouts/[id]/WorkoutDetailClient.tsx` et `app/planner/page.tsx`.
> Chaque tâche est autonome : contexte, edit exact, vérification, commit.
>
> **Règles absolues** (ne jamais dévier) :
> 1. Travailler dans `C:\Users\jimmy\ARETE`, branche `main`.
> 2. Ne toucher AUCUN autre fichier que ceux listés.
> 3. Après TOUTES les tâches : `npx tsc --noEmit` puis `npx next build`. Les deux doivent passer sans erreur AVANT de committer.
> 4. Un seul commit pour tout le runbook (message fourni en bas), puis `git push origin main` (Vercel déploie tout seul).
> 5. Ne PAS toucher à la base de données, ne PAS créer de migration.
> 6. Si un `old_string` ne matche pas exactement : relire le fichier, ne pas improviser un autre changement.

---

## Contexte minimal

- Le système de toasts unifié existe déjà : `components/Toast.tsx` exporte `useToast()`.
  Usage : `const toast = useToast()` puis `toast('message')` (succès) ou `toast('message', 'error')` / `toast('message', 'info')`.
- `ToastProvider` est déjà monté dans `app/layout.tsx` — rien à faire côté layout.
- `WorkoutDetailClient.tsx` a été découpé : ses sous-composants sont dans `app/workouts/[id]/parts.tsx` (ne pas y toucher).

---

## Tâche 1 — Migrer les 2 toasts locaux résiduels de WorkoutDetailClient

**Fichier** : `app/workouts/[id]/WorkoutDetailClient.tsx`

### 1a. Ajouter l'import du hook

Chercher la ligne :
```ts
import { BIO_TYPE_COLORS, BIO_TYPE_ICONS } from '@/lib/types'
```
Ajouter juste après :
```ts
import { useToast } from '@/components/Toast'
```

### 1b. Remplacer les états locaux par le hook

Chercher (vers les lignes 38 et 43) :
```ts
  const [addedToast, setAddedToast] = useState(false)
```
et
```ts
  const [sessionToast, setSessionToast] = useState(false)
```
**Supprimer ces deux lignes**, et ajouter à la place (une seule fois, à l'endroit du premier) :
```ts
  const toast = useToast()
```

### 1c. handleLogSession — remplacer le toast local ET ajouter la gestion d'erreur

Chercher le bloc exact :
```ts
  const handleLogSession = async () => {
    setLoggingSession(true)
    const res = await fetch(`/api/workouts/${initial.id}/sessions`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) })
    const s = await res.json()
    setSessions(prev => [s, ...prev])
    setLoggingSession(false)
    setSessionToast(true)
    setTimeout(() => setSessionToast(false), 3000)
  }
```
Remplacer par :
```ts
  const handleLogSession = async () => {
    setLoggingSession(true)
    const res = await fetch(`/api/workouts/${initial.id}/sessions`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) }).catch(() => null)
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
```

### 1d. Modale « Ajouter à la semaine » — remplacer le déclencheur

Chercher :
```tsx
          onAdded={() => setAddedToast(true)}
```
Remplacer par :
```tsx
          onAdded={() => toast('Ajouté au planner ✓')}
```

### 1e. Supprimer les 2 blocs de rendu des anciens toasts

Chercher et **supprimer entièrement** ce bloc :
```tsx
      {addedToast && (
        <div onAnimationEnd={() => setTimeout(() => setAddedToast(false), 2500)}
          style={{ position: 'fixed', bottom: 28, left: '50%', transform: 'translateX(-50%)', background: 'var(--green)', color: 'var(--ink)', fontWeight: 700, fontSize: 13, padding: '10px 22px', borderRadius: 10, boxShadow: '0 8px 32px rgba(0,0,0,0.4)', zIndex: 2000 }}>
          Ajouté au planner ✓
        </div>
      )}
```
Puis chercher et **supprimer entièrement** ce bloc :
```tsx
      {sessionToast && (
        <div style={{ position: 'fixed', bottom: 28, left: '50%', transform: 'translateX(-50%)', background: 'var(--green)', color: 'var(--ink)', fontWeight: 700, fontSize: 13, padding: '10px 22px', borderRadius: 10, boxShadow: '0 8px 32px rgba(0,0,0,0.4)', zIndex: 2000, display: 'flex', alignItems: 'center', gap: 8 }}>
          <CheckCircle2 size={15} /> Séance enregistrée !
        </div>
      )}
```
⚠️ Après suppression, vérifier avec grep que `CheckCircle2` est encore utilisé ailleurs
dans le fichier (il l'est : bouton « J'ai fait » et historique). NE PAS retirer son import.

---

## Tâche 2 — Gestion d'erreur sur handleDuplicate

**Fichier** : `app/workouts/[id]/WorkoutDetailClient.tsx`

Chercher :
```ts
  const handleDuplicate = async () => {
    setDuplicating(true)
    const res = await fetch(`/api/workouts/${initial.id}/duplicate`, { method: 'POST' })
    const copy = await res.json()
    setDuplicating(false)
    router.push(`/workouts/${copy.id}`)
  }
```
Remplacer par :
```ts
  const handleDuplicate = async () => {
    setDuplicating(true)
    const res = await fetch(`/api/workouts/${initial.id}/duplicate`, { method: 'POST' }).catch(() => null)
    setDuplicating(false)
    if (!res || !res.ok) { toast('Échec de la duplication', 'error'); return }
    const copy = await res.json()
    router.push(`/workouts/${copy.id}`)
  }
```

---

## Tâche 3 — Gestion d'erreur sur handleDelete

**Fichier** : `app/workouts/[id]/WorkoutDetailClient.tsx`

Chercher :
```ts
  const handleDelete = async () => {
    if (!confirm('Supprimer définitivement cette séance ?')) return
    setDeleting(true)
    await fetch(`/api/workouts/${initial.id}`, { method: 'DELETE' })
    router.push(backTo ?? '/workouts')
  }
```
Remplacer par :
```ts
  const handleDelete = async () => {
    if (!confirm('Supprimer définitivement cette séance ?')) return
    setDeleting(true)
    const res = await fetch(`/api/workouts/${initial.id}`, { method: 'DELETE' }).catch(() => null)
    if (!res || !res.ok) {
      toast('Échec de la suppression', 'error')
      setDeleting(false)
      return
    }
    router.push(backTo ?? '/workouts')
  }
```

---

## Tâche 4 — handleSave : détecter les sauvegardes partielles

**Fichier** : `app/workouts/[id]/WorkoutDetailClient.tsx`

Dans `handleSave`, chercher la fin du bloc :
```ts
    ])

    setSaving(false)
    setEditMode(false)
    router.refresh()
  }
```
Remplacer par :
```ts
    ])

    const failed = results.filter(r => !r || !r.ok).length
    setSaving(false)
    if (failed > 0) {
      toast(`${failed} modification${failed > 1 ? 's' : ''} n'a pas pu être sauvegardée — réessaie.`, 'error')
      return
    }
    setEditMode(false)
    toast('Modifications sauvegardées ✓')
    router.refresh()
  }
```
Et changer le début du même `Promise.all` : chercher
```ts
    await Promise.all([
```
remplacer par
```ts
    const results = await Promise.all([
```
⚠️ Il n'y a qu'un seul `Promise.all` dans ce fichier. Les fetchs à l'intérieur doivent
chacun recevoir `.catch(() => null)` ajouté en fin de chaîne — SEULEMENT ceux dans ce
`Promise.all` (il y en a 6 : movements PATCH, blocks PATCH, workout PATCH,
image DELETE/POST, movements DELETE, blocks DELETE). Exemple de transformation :
`fetch(...)` → `fetch(...).catch(() => null)`. Ne pas toucher aux fetchs hors du Promise.all.

---

## Tâche 5 — planner : ne pas planter si le chargement échoue

**Fichier** : `app/planner/page.tsx`

Chercher :
```ts
  const load = useCallback(async (mon: Date) => {
    setLoading(true)
    const res = await fetch(`/api/planner?weekStart=${toISODate(mon)}`)
    const data = await res.json()
    setEntries(data.entries ?? [])
    setLoading(false)
  }, [])
```
Remplacer par :
```ts
  const load = useCallback(async (mon: Date) => {
    setLoading(true)
    const res = await fetch(`/api/planner?weekStart=${toISODate(mon)}`).catch(() => null)
    if (!res || !res.ok) {
      setEntries([])
      setLoading(false)
      return
    }
    const data = await res.json()
    setEntries(data.entries ?? [])
    setLoading(false)
  }, [])
```

---

## Vérification finale (obligatoire, dans cet ordre)

```bash
cd "C:/Users/jimmy/ARETE"
npx tsc --noEmit        # doit sortir sans AUCUNE erreur
npx next build          # doit se terminer par la liste des routes, sans erreur
```

Si l'une des deux commandes échoue : relire la tâche concernée, corriger, relancer.
Ne JAMAIS committer avec un build cassé.

## Commit et déploiement

```bash
git add "app/workouts/[id]/WorkoutDetailClient.tsx" app/planner/page.tsx OPTIMISATIONS.md
git status --short      # vérifier : seulement ces 3 fichiers stagés
git commit -m "Finit la migration des toasts et durcit la gestion d'erreur reseau

Migre les 2 derniers toasts locaux de WorkoutDetailClient vers useToast(),
ajoute la gestion d'erreur sur handleLogSession, handleDuplicate,
handleDelete et handleSave (detection des sauvegardes partielles), et
protege le chargement du planner contre les echecs reseau."
git push origin main
```

Vercel déploie automatiquement au push. Terminé.
