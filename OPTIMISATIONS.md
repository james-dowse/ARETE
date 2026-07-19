# Pack d'optimisation vidéo — exécutable par Sonnet

> **But** : unifier la logique d'embed vidéo (aujourd'hui dupliquée et divergente entre
> `components/MovementModal.tsx` et `app/workouts/[id]/active/page.tsx`) dans un
> helper partagé `lib/video.ts`, et améliorer l'autoplay :
> - support des **YouTube Shorts** et fichiers `.mp4/.webm` en séance active (aujourd'hui ignorés) ;
> - `playsinline=1` (sans ça, iOS force le plein écran dans la PWA) ;
> - `loop=1` (la démo tourne en boucle pendant la série au lieu de s'arrêter) ;
> - domaine `youtube-nocookie.com` (embed sans cookies de tracking).
>
> **Règles absolues** (ne jamais dévier) :
> 1. Travailler dans `C:\Users\jimmy\ARETE`, branche `main`.
> 2. Ne toucher QUE : `lib/video.ts` (nouveau), `components/MovementModal.tsx`, `app/workouts/[id]/active/page.tsx`, et ce fichier.
> 3. Après TOUTES les tâches : `npx tsc --noEmit` puis `npx next build`. Les deux doivent passer AVANT de committer.
> 4. Un seul commit (message fourni en bas), puis `git push origin main`.
> 5. Pas de migration, pas d'accès base de données.
> 6. Si un bloc à chercher ne matche pas exactement : relire le fichier, ne pas improviser.

---

## Tâche 1 — Créer le helper partagé `lib/video.ts`

Créer le fichier `lib/video.ts` avec EXACTEMENT ce contenu :

```ts
// Résolution d'une URL vidéo vers un embed autoplay.
// autoplay=1&mute=1 : seule combinaison d'autoplay acceptée par tous les navigateurs
// (le son se réactive manuellement dans le player).
// playsinline=1 : sans lui, iOS force le plein écran dans la PWA.
// loop=1&playlist=<id> : la démo boucle — utile pendant une série.
// youtube-nocookie.com : embed sans cookies de tracking.
export type EmbedInfo = { url: string; type: 'youtube' | 'instagram' | 'video' }

export function getYouTubeId(url: string): string | null {
  try {
    const u = new URL(url)
    if (u.hostname === 'youtu.be') return u.pathname.slice(1).split('/')[0] || null
    if (u.hostname.includes('youtube.com')) {
      const v = u.searchParams.get('v')
      if (v) return v
      const m = u.pathname.match(/\/(shorts|embed)\/([^/]+)/)
      if (m) return m[2]
    }
  } catch {
    // URL invalide
  }
  return null
}

export function getEmbedInfo(url: string): EmbedInfo | null {
  const yt = getYouTubeId(url)
  if (yt) {
    return {
      url: `https://www.youtube-nocookie.com/embed/${yt}?autoplay=1&mute=1&playsinline=1&rel=0&modestbranding=1&loop=1&playlist=${yt}`,
      type: 'youtube',
    }
  }
  try {
    const u = new URL(url)
    if (u.hostname.includes('instagram.com')) {
      const m = u.pathname.match(/\/(reel|p)\/([^/]+)/)
      if (m) return { url: `https://www.instagram.com/${m[1]}/${m[2]}/embed/`, type: 'instagram' }
    }
    if (/\.(mp4|webm|ogg)(\?.*)?$/i.test(u.pathname)) {
      return { url, type: 'video' }
    }
  } catch {
    // URL invalide
  }
  return null
}
```

---

## Tâche 2 — MovementModal : utiliser le helper partagé

**Fichier** : `components/MovementModal.tsx`

### 2a. Remplacer la logique locale par l'import

Chercher le bloc exact (juste après les imports lucide/types) :
```ts
// autoplay=1&mute=1 : seule combinaison acceptée par tous les navigateurs.
// Le son peut être réactivé manuellement dans le player YouTube.
// rel=0 : pas de vidéos suggérées à la fin. modestbranding=1 : logo minimal.
const YT_PARAMS = 'autoplay=1&mute=1&rel=0&modestbranding=1'

type EmbedResult = { url: string; type: 'youtube' | 'instagram' | 'video' } | null

function getEmbedInfo(url: string): EmbedResult {
  try {
    const u = new URL(url)

    // YouTube
    if (u.hostname === 'youtu.be') {
      return { url: `https://www.youtube.com/embed${u.pathname}?${YT_PARAMS}`, type: 'youtube' }
    }
    if (u.hostname.includes('youtube.com')) {
      const v = u.searchParams.get('v')
      if (v) return { url: `https://www.youtube.com/embed/${v}?${YT_PARAMS}`, type: 'youtube' }
      const shorts = u.pathname.match(/\/shorts\/([^/]+)/)
      if (shorts) return { url: `https://www.youtube.com/embed/${shorts[1]}?${YT_PARAMS}`, type: 'youtube' }
    }

    // Instagram Reels
    if (u.hostname.includes('instagram.com')) {
      const reel = u.pathname.match(/\/reel\/([^/]+)/)
      if (reel) return { url: `https://www.instagram.com/reel/${reel[1]}/embed/`, type: 'instagram' }
      const p = u.pathname.match(/\/p\/([^/]+)/)
      if (p) return { url: `https://www.instagram.com/p/${p[1]}/embed/`, type: 'instagram' }
    }

    // Fichiers vidéo directs
    if (/\.(mp4|webm|ogg)(\?.*)?$/i.test(u.pathname)) {
      return { url, type: 'video' }
    }
  } catch {
    // URL invalide
  }
  return null
}
```
**Supprimer tout ce bloc**, et ajouter à la place l'import (avec les autres imports en haut du fichier) :
```ts
import { getEmbedInfo } from '@/lib/video'
```

### 2b. Ajouter loop à la balise `<video>` (fichiers directs)

Chercher :
```tsx
                <video
                  src={embedInfo.url}
                  autoPlay
                  muted
                  playsInline
                  controls
```
Remplacer par :
```tsx
                <video
                  src={embedInfo.url}
                  autoPlay
                  muted
                  loop
                  playsInline
                  controls
```

Aucun autre changement dans ce fichier — le reste du composant utilise `embedInfo`
exactement de la même façon (`embedInfo?.type`, `embedInfo.url`).

---

## Tâche 3 — Séance active : Shorts + mp4 + playsinline via le helper

**Fichier** : `app/workouts/[id]/active/page.tsx`

### 3a. Remplacer la regex locale par l'import

Chercher :
```ts
const ytId = (url: string) => {
  const m = url.match(/(?:v=|youtu\.be\/)([A-Za-z0-9_-]{11})/)
  return m ? m[1] : null
}
```
**Supprimer ce bloc**, et ajouter l'import en haut du fichier (après `import { useToast } from '@/components/Toast'`) :
```ts
import { getEmbedInfo } from '@/lib/video'
```

### 3b. Calculer l'embed au lieu de l'ID brut

Chercher :
```ts
  const currentVid = currentWm?.movement.videoUrl ? ytId(currentWm.movement.videoUrl) : null
```
Remplacer par :
```ts
  const rawEmbed = currentWm?.movement.videoUrl ? getEmbedInfo(currentWm.movement.videoUrl) : null
  // Instagram ne supporte pas l'autoplay en iframe — pas de panneau vidéo dans ce cas
  const currentEmbed = rawEmbed && rawEmbed.type !== 'instagram' ? rawEmbed : null
```

### 3c. Adapter le panneau vidéo

Chercher le bloc exact :
```tsx
      {/* ── Video panel (current movement) ── */}
      {currentVid && (
        <div style={{ position: 'relative', width: '100%', maxWidth: 680, margin: '0 auto', background: '#000', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
          {/* movement name badge */}
          <div style={{ position: 'absolute', top: 8, left: 8, zIndex: 2, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(6px)', borderRadius: 6, padding: '3px 8px', fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.85)', pointerEvents: 'none' }}>
            {currentWm?.movement.name}
          </div>
          <div style={{ position: 'relative', width: '100%', paddingBottom: '42%', overflow: 'hidden' }}>
            <iframe
              key={currentVid}
              src={`https://www.youtube.com/embed/${currentVid}?autoplay=1&mute=1&rel=0&modestbranding=1`}
              style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 'none' }}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', padding: '4px 8px' }}>
            🔇 Lecture automatique muette — clique 🔊 dans le player pour activer le son
          </div>
        </div>
      )}
```
Remplacer par :
```tsx
      {/* ── Video panel (current movement) ── */}
      {currentEmbed && (
        <div style={{ position: 'relative', width: '100%', maxWidth: 680, margin: '0 auto', background: '#000', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
          {/* movement name badge */}
          <div style={{ position: 'absolute', top: 8, left: 8, zIndex: 2, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(6px)', borderRadius: 6, padding: '3px 8px', fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.85)', pointerEvents: 'none' }}>
            {currentWm?.movement.name}
          </div>
          <div style={{ position: 'relative', width: '100%', paddingBottom: '42%', overflow: 'hidden' }}>
            {currentEmbed.type === 'video' ? (
              <video
                key={currentEmbed.url}
                src={currentEmbed.url}
                autoPlay
                muted
                loop
                playsInline
                controls
                style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
              />
            ) : (
              <iframe
                key={currentEmbed.url}
                src={currentEmbed.url}
                style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 'none' }}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            )}
          </div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', padding: '4px 8px' }}>
            🔇 Lecture automatique muette en boucle — clique 🔊 dans le player pour le son
          </div>
        </div>
      )}
```

### 3d. Vérification anti-régression (grep, ne rien modifier)

Après les edits, vérifier avec grep dans `app/workouts/[id]/active/page.tsx` :
- `ytId` → **0 occurrence** (sinon une référence a été oubliée) ;
- `currentVid` → **0 occurrence** ;
- `currentEmbed` → présent dans le calcul (3b) et le panneau (3c).

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
git add lib/video.ts components/MovementModal.tsx "app/workouts/[id]/active/page.tsx" OPTIMISATIONS.md
git status --short      # vérifier : seulement ces 4 fichiers stagés
git commit -m "Unifie la logique d'embed video dans lib/video.ts

Supprime la duplication divergente entre MovementModal et la seance
active : la seance gere maintenant les YouTube Shorts et les fichiers
mp4/webm comme la bibliotheque. Ajoute playsinline (evite le plein ecran
force sur iOS PWA), la lecture en boucle des demos, et le domaine
youtube-nocookie.com sur tous les embeds."
git push origin main
```

Vercel déploie automatiquement au push. Terminé.
