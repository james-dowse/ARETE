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

La base Turso est à **Tokyo** et les fonctions Vercel à **Washington** : chaque
lecture en base coûte ~260 ms, payés plusieurs fois par écran. C'est de loin le
premier facteur de lenteur de l'application, avant toute optimisation de code.

La procédure de correction est prête et scriptée : [MIGRATION-DB.md](MIGRATION-DB.md).
Mesurer l'état courant à tout moment :

```bash
node scripts/perf/benchmark.mjs
```

Avant d'ajouter une requête sur un rendu serveur, regrouper les requêtes
indépendantes dans un même `Promise.all` : les enchaîner multiplie cette
latence d'autant.
