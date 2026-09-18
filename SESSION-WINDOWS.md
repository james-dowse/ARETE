# Faire tourner une session Claude Code sur le PC

Une session ouverte depuis le téléphone ou le navigateur tourne par défaut dans
un conteneur Linux jetable : elle voit le dépôt GitHub, et rien d'autre. Pas
`C:\Users\jimmy\ARETE`, pas `.env.local`, pas `prisma/dev.db`, pas le serveur de
dev sur 3050/3051 — donc pas moyen de regarder la bibliothèque tourner sur la
vraie base.

Pour ça, la session doit s'exécuter **sur ce poste**. Deux chemins, selon qu'on
veut rapatrier un travail déjà commencé ou ouvrir la porte pour plus tard.

## 1. Rapatrier ici une session cloud

Depuis le dossier du projet :

```bash
cd C:\Users\jimmy\ARETE
git status                          # l'arbre doit être propre
claude --teleport <id-de-la-session>
```

L'identifiant est la portion d'URL entre `/code/` et le `?` sur claude.ai/code.
Claude vérifie qu'on est dans le bon dépôt, récupère la branche de la session
(**elle doit avoir été poussée**) et recharge toute la conversation.

Le terminal en reçoit **sa propre copie** : ce qu'on fait ensuite reste local et
ne remonte pas dans la session cloud. Pour continuer à la piloter du téléphone,
lancer dans la session rapatriée :

```text
/remote-control
```

## 2. Armer le poste pour le piloter de loin

```bash
npm run remote-control
```

ou, sans terminal, double-clic sur `scripts\remote-control.cmd`.

Le script vérifie d'abord les trois choses qui font échouer la manœuvre en
silence — le dossier (l'ancien `ARETE-redesign-preview` traîne encore et sert du
code mort), la version de la CLI, et les variables d'environnement qui coupent
Remote Control sans prévenir — puis laisse `claude remote-control` tourner dans
la fenêtre. Espace affiche un QR code.

Le téléphone retrouve la session dans l'app Claude, onglet **Code** : icône
d'ordinateur, pastille verte. De là on peut aussi **ouvrir de nouvelles sessions
sur le poste**, sans y toucher.

Deux confirmations n'arrivent qu'une fois, et elles arrivent **sur le poste** :
l'écran de confiance du dossier, et `Enable Remote Control? (y/n)`. Tant qu'on
ne les a pas acceptées à la main, rien ne démarre — c'est la raison la plus
fréquente d'un démarrage automatique qui ne donne rien.

Ctrl+C ferme. Pendant environ quatre heures, `npm run remote-control` relancé
depuis le même dossier rouvre les sessions qu'il servait.

### Démarrer à l'ouverture de session Windows

Une fois les deux confirmations acceptées, le plus simple est un raccourci :
`Win+R` → `shell:startup` → y déposer un raccourci vers
`C:\Users\jimmy\ARETE\scripts\remote-control.cmd`.

En une commande, au choix :

```bat
schtasks /create /tn "ARETE session a distance" /tr "C:\Users\jimmy\ARETE\scripts\remote-control.cmd" /sc onlogon /f
```

Le poste devient alors joignable dès qu'il est allumé et la session ouverte. À
garder en tête : elle accepte du travail venu du téléphone et s'exécute avec tes
droits sur cette machine.

## Le poste doit rester joignable

Remote Control n'est pas un service hébergé : c'est **ce** processus, sur **ce**
PC. Éteint, en veille ou sans réseau, la session passe hors ligne en quelques
secondes et le téléphone affiche `computer_unreachable` — c'est ce qui s'est
déjà produit ici.

- Réglages Windows → Système → Alimentation : mettre la mise en veille sur
  *Jamais* pendant les périodes où on veut pouvoir s'y connecter.
- Coupure réseau : la session interactive se reconnecte seule quand le réseau
  revient ; le mode serveur, lui, abandonne au bout d'une dizaine de minutes et
  il faut le relancer.

## Une fois la session ouverte

```bash
npm run dev:local        # port 3051, base prisma/dev.db
```

⚠️ `npm run dev` (3050) parle à la base de **production** : `.env.local` définit
`TURSO_DATABASE_URL`. Sur le poste, tout ce qu'on coche ou supprime en testant y
est écrit pour de bon. Si `prisma/dev.db` est absente ou a dérivé :

```bash
npm run db:from-prod     # copie fidèle de la production (lecture seule côté prod)
npm run db:sync-local    # schéma seul, si la base locale est en retard
```

## Quand ça ne marche pas

Vérifier sans rien lancer :

```bash
npm run remote-control -- --check
```

| Symptôme | Cause habituelle |
|---|---|
| `claude` introuvable | CLI absente : `irm https://claude.ai/install.ps1 \| iex` dans PowerShell |
| `remote-control` rejeté comme commande inconnue | CLI trop ancienne : `claude update` |
| La session ne remonte jamais sur le téléphone | `ANTHROPIC_BASE_URL`, `DISABLE_TELEMETRY`, `DO_NOT_TRACK`, `CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC` ou `DISABLE_GROWTHBOOK` dans le shell ou le bloc `env` de `settings.json` |
| `Remote Control requires a claude.ai subscription` | connexion par clé API : `/login` pour repasser par le compte claude.ai |
| Hors ligne alors que le PC tourne | le processus `claude` a été fermé — le relancer |
| La bibliothèque est vide dans la session | base locale jamais remplie : `npm run db:from-prod` |

Diagnostic complet de l'installation : `claude doctor`.
