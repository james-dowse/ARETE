# Rapprocher la base — procédure d'exécution

> **Pour l'agent qui exécute :** suis les étapes dans l'ordre. Chaque étape dit
> quoi lancer et quoi vérifier. **Si une vérification échoue, arrête-toi et
> signale-le** — ne tente pas de contourner. Rien n'est cassé en cas d'arrêt :
> l'ancienne base reste en service jusqu'à l'étape 3 incluse.

## Le problème

La base est à **Tokyo**, le serveur à **Washington**, l'utilisateur en **France**.
Chaque lecture en base coûte ~260 ms, et une page en fait plusieurs de suite.

Mettre la base **et** le serveur en Europe ramène ce coût à ~15 ms. C'est le
gain le plus important qui reste sur cette application.

**Les deux doivent bouger ensemble.** Déplacer seulement la base, ou seulement
le serveur, n'apporte rien — voire dégrade. Les scripts refusent d'ailleurs de
s'exécuter dans le désordre.

## Avant de commencer

Mesure l'état de départ et **garde le résultat** pour comparer à la fin :

```bash
node scripts/perf/benchmark.mjs
```

Attendu aujourd'hui : `~260 ms — région ap-northeast-1 (Tokyo)`.

---

## Étape 1 — Créer la nouvelle base *(action humaine)*

Cette étape ne peut pas être automatisée : elle demande l'accès au compte Turso.
**Demande-la à l'utilisateur** et attends sa réponse.

Message à lui transmettre :

> Sur <https://turso.tech> → ta base ARETE → **Create Database** :
> - **Région** : une région européenne (Paris, Francfort ou Irlande — la plus proche proposée)
> - **Nom** : `arete-eu`
>
> Puis ouvre cette nouvelle base et copie-moi ses deux identifiants :
> son **URL** (`libsql://…`) et un **token d'authentification**.

**Ne continue pas** tant que tu n'as pas ces deux valeurs.

---

## Étape 2 — Copier les données *(script)*

Remplace les deux valeurs par celles reçues, puis lance :

```bash
TARGET_TURSO_DATABASE_URL="libsql://COLLE_URL_ICI" TARGET_TURSO_AUTH_TOKEN="COLLE_TOKEN_ICI" node scripts/perf/migrate-db.mjs
```

Le script copie les 18 tables (~1000 lignes, quelques secondes) puis **compare
le nombre de lignes des deux côtés**.

| Résultat | Quoi faire |
|---|---|
| `Migration terminée et vérifiée.` | Passe à l'étape 3 |
| Toute erreur | **Arrête-toi.** Signale le message. Rien n'a bougé, la base d'origine est intacte |

La base d'origine n'est jamais modifiée : elle reste le plan de secours.

---

## Étape 3 — Basculer sur la nouvelle base *(action humaine + locale)*

**3a. Sur Vercel** — demande à l'utilisateur :

> Sur <https://vercel.com> → projet **`arete`** → Settings → Environment Variables.
> Modifie ces deux variables avec les valeurs de la nouvelle base, en cochant
> **Production ET Preview** pour chacune :
> - `TURSO_DATABASE_URL`
> - `TURSO_AUTH_TOKEN`

**3b. En local** — édite `.env` dans `C:\Users\jimmy\ARETE` et remplace les
mêmes deux variables par les nouvelles valeurs.

> ⚠️ `.env` contient des secrets : ne les affiche jamais dans la conversation.

Vérifie que la bascule locale est prise en compte :

```bash
node scripts/perf/benchmark.mjs
```

| Résultat | Quoi faire |
|---|---|
| Une région **européenne** et une latence **nettement plus basse** | Passe à l'étape 4 |
| Encore `ap-northeast-1 (Tokyo)` | `.env` n'a pas été mis à jour — reprends 3b |

---

## Étape 4 — Rapprocher le serveur et déployer *(script)*

```bash
node scripts/perf/finalize.mjs
```

Le script déduit tout seul la bonne région Vercel depuis celle de la base,
écrit `vercel.json`, puis déploie via la procédure habituelle (types, tests,
build, vérification que la production sert bien le résultat).

| Résultat | Quoi faire |
|---|---|
| `Migration terminée.` | Passe à l'étape 5 |
| `La base est encore à Tokyo` | L'étape 3b n'est pas faite — reprends-la |
| Échec du déploiement | Les variables Vercel de l'étape 3a sont probablement incomplètes (**Preview** oublié) |

---

## Étape 5 — Confirmer le gain *(script)*

```bash
node scripts/perf/benchmark.mjs
```

Compare avec la mesure du début et **annonce les deux chiffres à l'utilisateur**.
Attendu : passage d'environ **260 ms à moins de 30 ms** par requête.

Vérifie enfin que l'application répond correctement :
<https://arete-livid.vercel.app>

---

## Revenir en arrière

À tout moment, remettre les **anciennes** valeurs de `TURSO_DATABASE_URL` et
`TURSO_AUTH_TOKEN` (sur Vercel et dans `.env`) restaure l'état d'origine :
l'ancienne base n'a jamais été modifiée ni supprimée.

Pour annuler aussi le déplacement du serveur, supprime `vercel.json` et
redéploie avec `npm run deploy -- "revert region pinning"`.

Ne supprime l'ancienne base Turso **que** plusieurs jours après, une fois la
nouvelle éprouvée — et uniquement si l'utilisateur le demande.

---

## Récapitulatif des commandes

```bash
node scripts/perf/benchmark.mjs      # 1. mesure de départ
# ... l'utilisateur crée la base EU et fournit URL + token ...
TARGET_TURSO_DATABASE_URL="…" TARGET_TURSO_AUTH_TOKEN="…" node scripts/perf/migrate-db.mjs
# ... l'utilisateur bascule les variables Vercel ; toi, tu édites .env ...
node scripts/perf/finalize.mjs       # 4. co-localisation + déploiement
node scripts/perf/benchmark.mjs      # 5. preuve du gain
```
