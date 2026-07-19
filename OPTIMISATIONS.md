# Pack thème clair — exécutable par Haiku

> **But** : en mode clair uniquement —
> 1. renforcer le contraste des textes (aujourd'hui trop ton sur ton) ;
> 2. passer le fond de la barre de menu du noir au bordeaux foncé.
>
> **Ce pack ne contient qu'UNE SEULE modification, dans UN SEUL fichier.**
>
> **Règles absolues** :
> 1. Travailler dans `C:\Users\jimmy\ARETE`, branche `main`.
> 2. Ne modifier QUE le fichier `app/globals.css`.
> 3. Faire l'édition de l'étape 1, puis les vérifications de l'étape 2, puis le commit de l'étape 3. Dans cet ordre.
> 4. Ne rien inventer. Si le texte à chercher ne correspond pas exactement, s'arrêter et le signaler.

---

## Étape 1 — L'unique modification

**Fichier** : `app/globals.css`

Ce bloc se trouve à l'intérieur de `html[data-theme="light"] { ... }` (vers la ligne 135).
Il n'apparaît qu'une seule fois dans le fichier.

**Chercher EXACTEMENT ce texte** (10 lignes, dont une ligne vide au milieu) :

```
  --sidebar-bg:           #0B0A09;
  --sidebar-border:       rgba(200,165,95,0.20);
  --sidebar-text:         rgba(223,216,194,0.62);
  --sidebar-text-hover:   rgba(223,216,194,0.95);
  --sidebar-text-active:  #F1EAD8;
  --sidebar-active-bg:    var(--crimson);

  --text-primary: #1A1610;
  --text-muted:   #5E5744;
  --text-dim:     #9A9178;
```

**Le remplacer EXACTEMENT par** :

```
  /* Barre de menu : bordeaux foncé (plus noir), texte éclairci pour rester lisible dessus */
  --sidebar-bg:           #3B1117;
  --sidebar-border:       rgba(200,165,95,0.28);
  --sidebar-text:         rgba(240,232,214,0.72);
  --sidebar-text-hover:   #F7F2E4;
  --sidebar-text-active:  #F7F2E4;
  --sidebar-active-bg:    var(--crimson-bright);

  /* Textes assombris : le gris clair passait sous le seuil de lisibilité sur fond ivoire */
  --text-primary: #14110B;
  --text-muted:   #4A4436;
  --text-dim:     #6E6650;
```

C'est tout. Aucune autre modification n'est à faire.

---

## Étape 2 — Vérifications obligatoires

Lancer ces deux commandes, dans cet ordre :

```bash
cd "C:/Users/jimmy/ARETE"
npx tsc --noEmit
```
→ ne doit rien afficher (aucune erreur).

```bash
cd "C:/Users/jimmy/ARETE"
npx next build
```
→ doit se terminer par la liste des routes, sans erreur.

Si l'une des deux échoue : ne PAS committer. Relire l'étape 1 et corriger.

---

## Étape 3 — Commit et déploiement

Lancer ces trois commandes, dans cet ordre :

```bash
cd "C:/Users/jimmy/ARETE"
git add app/globals.css OPTIMISATIONS.md
```

```bash
cd "C:/Users/jimmy/ARETE"
git commit -m "Mode clair : contraste des textes renforce, barre de menu en bordeaux fonce

Les textes secondaires et tertiaires etaient trop proches du fond ivoire
(text-dim ressortait a ~2.6:1, sous le seuil WCAG AA de 4.5:1). Ils
passent respectivement a 8.1:1 et 4.8:1. La barre de menu quitte le
quasi-noir pour un bordeaux fonce coherent avec la palette crimson, avec
texte eclairci et pastille active en crimson-bright pour rester lisible."
```

```bash
cd "C:/Users/jimmy/ARETE"
git push origin main
```

Vercel déploie automatiquement au push. Terminé.
