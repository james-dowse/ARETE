# Déployer ARETE

## La commande

Depuis `C:\Users\jimmy\ARETE` :

```bash
node scripts/deploy.mjs "décris le changement en une ligne"
```

C'est tout. Le script fait le reste et **s'arrête en expliquant** si quelque chose cloche.

S'il n'y a rien de nouveau à mettre en ligne, il le dit et ne déclenche aucun build.

Pour seulement vérifier que le code est sain, sans rien déployer :

```bash
node scripts/deploy.mjs --check-only
```

## Ce que le script enchaîne

1. **Contexte** — bon dépôt, branche `main`.
2. **Écart avec la production** — liste ce qui n'est pas encore en ligne ; sort immédiatement si tout y est déjà.
3. **Barrière qualité** — `tsc --noEmit`, `vitest run`, `npm run build`. Un échec arrête tout **avant** le moindre push.
4. **Commit** — uniquement les fichiers du projet.
5. **Push sur `main`** — ce qui déclenche le déploiement Vercel.
6. **Attente du build** — affiche l'avancement ; en cas d'échec, imprime les logs Vercel.
7. **Vérification** — confirme que l'URL de production sert bien le nouveau déploiement.

## Les trois pièges de ce projet

**1. `curl` ne prouve pas qu'un déploiement a réussi.**
Quand un build échoue, Vercel continue de servir la version précédente : `curl` renvoie donc `HTTP 200` sur un déploiement raté. La seule preuve valable :

```bash
npx vercel inspect arete-livid.vercel.app
```

Il faut `status ● Ready` **et** un `created` postérieur au push. Le script le vérifie déjà.

**2. Il existe plusieurs projets Vercel — un seul est le bon.**

| Projet | URL | Statut |
|---|---|---|
| **`arete`** | **arete-livid.vercel.app** | **production, la seule à déployer** |
| `aretetest` | arete-ashen.vercel.app | abandonné, ne pas toucher |

Si une commande `vercel` renvoie des données inattendues, c'est que le dossier est délié :

```bash
npx vercel link --yes --project arete
```

**3. Le serveur de dev doit tourner depuis ce dossier-ci.**
Un ancien dossier `C:\Users\jimmy\ARETE-redesign-preview` traîne encore et sert d'anciennes versions — plusieurs modifications ont semblé « ne rien changer » à cause de lui. Le bon serveur local est `arete-dev`, port **3050** (`.claude/launch.json`).

## Si le build échoue

Le script affiche les logs. Les causes déjà rencontrées :

- **Variable d'environnement manquante** — elles doivent exister dans le scope *Production* **et** *Preview* (Vercel → Settings → Environment Variables). Un build de branche échoue si seul *Production* est coché.
- **Erreur de types ou test rouge** — normalement bloqué par la barrière qualité avant le push.

La production n'est jamais cassée par un build raté : l'ancienne version continue d'être servie.

## Revenir en arrière

```bash
npx vercel rollback arete-livid.vercel.app
```
