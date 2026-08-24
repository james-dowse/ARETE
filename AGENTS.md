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

Deux réflexes qui comptent plus que le reste :

- Regrouper les requêtes indépendantes dans un même `Promise.all`. Les enchaîner
  multiplie la latence d'autant — c'était le défaut du tableau de bord.
- Ne pas relire à chaque requête des données quasi statiques (référentiels) :
  voir `lib/attributes-cache.ts`.

Historique et procédure de bascule : [MIGRATION-DB.md](MIGRATION-DB.md).
