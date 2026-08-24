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
