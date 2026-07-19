# Pack d'optimisation — exécutable par Sonnet

> **But** : corriger 3 défauts laissés par les dernières features :
> 1. le nom d'une séance peut être vidé (PATCH `name: ''` accepté) ;
> 2. le badge de difficulté manque sur les cartes de la page `/workouts` ;
> 3. impossible d'ajouter un mouvement à une séance **sans blocs**.
>
> **Règles absolues** (ne jamais dévier) :
> 1. Travailler dans `C:\Users\jimmy\ARETE`, branche `main`.
> 2. Ne toucher QUE : `app/workouts/[id]/WorkoutDetailClient.tsx`, `app/workouts/WorkoutsTabs.tsx`, `app/api/workouts/[id]/route.ts`, et ce fichier.
> 3. Après TOUTES les tâches : `npx tsc --noEmit` puis `npx next build`. Les deux doivent passer AVANT de committer.
> 4. Un seul commit (message fourni en bas), puis `git push origin main`.
> 5. Pas de migration, pas d'accès base de données.
> 6. Si un bloc à chercher ne matche pas exactement : relire le fichier, ne pas improviser.

---

## Tâche 1 — Empêcher un nom de séance vide

### 1a. Côté client

**Fichier** : `app/workouts/[id]/WorkoutDetailClient.tsx`

Chercher :
```ts
  const isDirtyName = editMode && editName.trim() !== initial.name
```
Remplacer par :
```ts
  // Champ vidé = pas un changement : on ne doit jamais envoyer un nom vide
  const isDirtyName = editMode && editName.trim() !== '' && editName.trim() !== initial.name
```

### 1b. Côté API (défense en profondeur)

**Fichier** : `app/api/workouts/[id]/route.ts`

Chercher :
```ts
  if ('name' in body) data.name = body.name
```
Remplacer par :
```ts
  if ('name' in body && typeof body.name === 'string' && body.name.trim()) data.name = body.name.trim()
```

---

## Tâche 2 — Badge de difficulté sur les cartes de /workouts

**Fichier** : `app/workouts/WorkoutsTabs.tsx`

L'API renvoie déjà la complexité de chaque mouvement (`include: { movement: true }`),
mais le type client ne la déclare pas.

### 2a. Déclarer `complexity` dans le type

Chercher :
```ts
interface WorkoutMovementItem { id: string; sets?: number | null; movement: { bioType: string; name: string } }
```
Remplacer par :
```ts
interface WorkoutMovementItem { id: string; sets?: number | null; movement: { bioType: string; name: string; complexity: string } }
```

### 2b. Importer le helper et les couleurs

Chercher :
```ts
import { BIO_TYPES, BIO_TYPE_COLORS, BIO_TYPE_ICONS } from '@/lib/types'
```
Remplacer par :
```ts
import { BIO_TYPES, BIO_TYPE_COLORS, BIO_TYPE_ICONS, COMPLEXITY_COLORS, computeWorkoutDifficulty } from '@/lib/types'
```

### 2c. Calculer la difficulté dans WorkoutCard

Chercher :
```ts
  const bioTypes = Array.from(new Set(w.movements.map(m => m.movement.bioType)))
```
Remplacer par :
```ts
  const bioTypes = Array.from(new Set(w.movements.map(m => m.movement.bioType)))
  const difficulty = computeWorkoutDifficulty(w.movements.map(m => ({ complexity: m.movement.complexity })))
```

### 2d. Afficher le badge en tête des tags

Chercher :
```tsx
        <div style={{ marginTop: 10, display: 'flex', gap: 5, flexWrap: 'wrap' }}>
          {bioTypes.map(bt => (
```
Remplacer par :
```tsx
        <div style={{ marginTop: 10, display: 'flex', gap: 5, flexWrap: 'wrap' }}>
          {difficulty && (
            <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 20, fontWeight: 700, background: `${COMPLEXITY_COLORS[difficulty]}18`, color: COMPLEXITY_COLORS[difficulty], border: `1px solid ${COMPLEXITY_COLORS[difficulty]}40` }}>{difficulty}</span>
          )}
          {bioTypes.map(bt => (
```

---

## Tâche 3 — Ajouter un mouvement à une séance sans blocs

**Fichier** : `app/workouts/[id]/WorkoutDetailClient.tsx`

Le bouton « Ajouter un mouvement » n'existe que dans la branche « avec blocs ».
On réutilise le même état `addingToBlockId` avec la sentinelle `'__flat__'`
(l'API accepte déjà `blockId: null`).

### 3a. La sentinelle dans le handler

Chercher :
```ts
      body: JSON.stringify({ movementId: m.id, blockId }),
```
Remplacer par :
```ts
      body: JSON.stringify({ movementId: m.id, blockId: blockId === '__flat__' ? null : blockId }),
```

### 3b. Le bouton en pied de liste plate

Chercher :
```tsx
              : initial.movements.map((wm, i) => <MovementRowView key={wm.id} wm={wm} index={i} onMovementClick={setSelectedMovementId} />)
          )}
        </div>
```
⚠️ Deux blocs du fichier ressemblent à ça — le bon est celui qui commence par `: initial.movements.map`
(la branche sans blocs), PAS celui avec `blockMovements.map`. Le bloc ci-dessus est unique tel quel.

Remplacer par :
```tsx
              : initial.movements.map((wm, i) => <MovementRowView key={wm.id} wm={wm} index={i} onMovementClick={setSelectedMovementId} />)
          )}
          {editMode && !hasBlocks && (
            <button onClick={() => setAddingToBlockId('__flat__')}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '9px', background: 'none', border: '1px dashed var(--border)', borderRadius: 10, color: 'var(--text-muted)', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
              <Plus size={13} /> Ajouter un mouvement
            </button>
          )}
        </div>
```

### 3c. Vérification anti-régression (grep, ne rien modifier)

Dans `app/workouts/[id]/WorkoutDetailClient.tsx` :
- `'__flat__'` → exactement **2 occurrences** (le handler 3a et le bouton 3b) ;
- `Ajouter un mouvement` → exactement **2 occurrences** (bouton des blocs + nouveau bouton plat).

---

## Vérification finale (obligatoire, dans cet ordre)

```bash
cd "C:/Users/jimmy/ARETE"
npx tsc --noEmit        # doit sortir sans AUCUNE erreur
npx next build          # doit se terminer par la liste des routes, sans erreur
```

Si l'une des deux échoue : relire la tâche concernée, corriger, relancer.
Ne JAMAIS committer avec un build cassé.

## Commit et déploiement

```bash
git add "app/workouts/[id]/WorkoutDetailClient.tsx" app/workouts/WorkoutsTabs.tsx "app/api/workouts/[id]/route.ts" OPTIMISATIONS.md
git status --short      # vérifier : seulement ces 4 fichiers stagés
git commit -m "Corrige le nom vide, badge difficulte sur les cartes, ajout hors blocs

- Un nom de seance vide n'est plus considere comme un changement, et
  l'API refuse desormais un name vide (defense en profondeur).
- Les cartes de /workouts affichent le badge de difficulte global
  (computeWorkoutDifficulty), la complexite etant deja dans le payload.
- Les seances sans blocs ont maintenant aussi le bouton 'Ajouter un
  mouvement' (sentinelle __flat__ -> blockId null, deja supporte par
  l'API)."
git push origin main
```

Vercel déploie automatiquement au push. Terminé.
