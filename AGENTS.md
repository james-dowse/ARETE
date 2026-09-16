<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Déploiement

Pour mettre en production, utilise **toujours** :

```bash
npm run deploy -- "décris le changement"
```

Ne déploie pas à la main (`git push` seul, `vercel deploy`, `curl` de vérification) : le script encadre les pièges connus de ce projet, et `curl` renvoie `HTTP 200` même quand un déploiement a échoué. Détails et dépannage : [DEPLOY.md](DEPLOY.md).

Serveur de dev local : `arete-dev`, port **3050**. Le dossier `ARETE-redesign-preview` est obsolète — ne pas s'en servir.

⚠️ **`npm run dev` parle à la base de PRODUCTION** : `.env.local` définit
`TURSO_DATABASE_URL`, donc tout ce qu'on fait en local (créer une séance, cocher
des séries, supprimer un mouvement) y est écrit pour de bon. Pour travailler sur
la base SQLite locale à la place :

```bash
npm run dev:local        # port 3051, base prisma/dev.db
npm run db:sync-local    # rejoue les migrations sur prisma/dev.db
```

# Migrations

`npm run deploy` ne joue **pas** les migrations : le schéma est appliqué à la
main sur Turso. Pour une migration écrite dans `prisma/migrations/<nom>/` :

```bash
node scripts/apply-migration.mjs <nom_du_dossier>
```

Le script exécute chaque instruction puis enregistre la migration dans
`_prisma_migrations`. Les instructions doivent être idempotentes
(`CREATE INDEX IF NOT EXISTS`, etc.) pour qu'un rejeu soit sans risque.

# Performance

Base Turso et fonctions Vercel sont **co-localisées en Irlande** (`eu-west-1` /
`dub1`, épinglé dans `vercel.json`). Un aller-retour base coûte quelques
millisecondes. **Ne pas déplacer l'un sans l'autre** : c'est leur écart
géographique qui rendait l'application lente (~260 ms par requête quand la base
était à Tokyo et le serveur à Washington).

Mesurer l'état courant à tout moment :

```bash
node scripts/perf/benchmark.mjs
```

Quelques réflexes qui comptent plus que le reste :

- Regrouper les requêtes indépendantes dans un même `Promise.all`. Les enchaîner
  multiplie la latence d'autant — c'était le défaut du tableau de bord.
- Ne pas relire à chaque requête des données quasi statiques (référentiels) :
  voir `lib/attributes-cache.ts`.
- **Ne jamais mettre `avatarUrl` dans une réponse de liste.** Les avatars sont
  stockés en base sous forme de data URI base64 (~50 Ko) : une liste de 22
  séances transportait 1 Mo de la même image répétée. Les listes renvoient
  `hasAvatar` (`lib/avatar-server.ts`) et le client charge l'image via
  `/api/users/[id]/avatar`, que le navigateur met en cache.
- Utiliser `WORKOUT_SELECT` (`lib/workout-select.ts`) pour toute liste de
  séances : `include: { movements: { include: { movement: true } } }` tire la
  description, l'image et la vidéo de chaque mouvement de chaque séance.
- **SQLite n'indexe pas les clés étrangères.** Toute nouvelle relation a besoin
  d'un `@@index` explicite, sinon chaque jointure — et chaque suppression en
  cascade — parcourt la table entière.
- Le référentiel est passé du serveur au client via `<AttributesSync initial>`
  (`app/(app)/layout.tsx`). L'appliquer seulement dans un effet provoquait une
  différence d'hydratation sur chaque page : React jetait tout le HTML serveur
  et re-rendait l'arbre côté client.

Historique et procédure de bascule : [MIGRATION-DB.md](MIGRATION-DB.md).
