# 🚀 Déploiement — Logging de performance (branche `perf-logging`)

> **Pour toi, modèle Claude (y compris Haiku).** Suis ce runbook dans l'ordre, sans
> sauter d'étape. Chaque commande est copiable telle quelle. Les sorties attendues
> sont indiquées. Si une étape ne correspond pas, **ARRÊTE et signale-le** — ne
> continue pas, ne bricole pas.

## Contexte en une phrase
La feature ajoute une table `SessionSet` en base. Le code en prod plantera à
l'enregistrement d'une séance si cette table n'existe pas encore. **La migration
Turso doit donc être faite AVANT de pousser le code. C'est la règle absolue.**

---

## ⛔ Règle d'or (ne jamais l'enfreindre)
**MIGRATION Turso d'abord → vérifier ✅ → SEULEMENT ENSUITE merge + push.**
Jamais l'inverse. Si tu pousses le code avant la migration, la prod casse.

---

## Étape 0 — Préconditions

```bash
cd "C:/Users/jimmy/ARETE"
git branch --show-current
```
Sortie attendue : `perf-logging`.
➡️ Si ce n'est pas `perf-logging` : `git checkout perf-logging` puis recommence.

```bash
git log --oneline -3
```
Tu dois voir les commits `Affiche "la derniere fois"...` et `Logging de performance...`.

Vérifie que tout compile encore :
```bash
npx tsc --noEmit
```
Sortie attendue : aucune erreur (retour vide). ➡️ Si erreurs : **ARRÊTE**.

---

## Étape 1 — MIGRATION PROD (Turso) — À FAIRE EN PREMIER

Cette commande crée la table `SessionSet` sur Turso. Elle est **idempotente**
(sûre à relancer) et ne touche à rien d'autre.

```bash
node scripts/migrate-session-set.mjs
```

**Sortie attendue (SUCCÈS) :**
```
→ Migration SessionSet sur : TURSO (production)
✅ SUCCÈS — table SessionSet présente.
   Colonnes : id, sessionId, movementId, setNumber, reps, weight, rpe, completed, createdAt
```

➡️ Tu vois `✅ SUCCÈS` **et** `TURSO (production)` → passe à l'étape 2.
➡️ Tu vois `❌` ou une cible qui n'est PAS `TURSO (production)` → **ARRÊTE**, ne pousse rien, signale.
➡️ La commande `node ...` est **bloquée par le bac à sable / classifier** → voir « Plan B » en bas. Ne pousse rien tant que la table n'est pas créée.

---

## Étape 2 — Merge sur `main` + push (déclenche le déploiement Vercel)

Uniquement si l'étape 1 a affiché `✅ SUCCÈS` sur `TURSO (production)`.

```bash
git checkout main
git merge perf-logging --no-edit
```
Sortie attendue : merge propre (fast-forward ou merge commit), **aucun conflit**.
➡️ Si conflit : **ARRÊTE** et signale (ne résous pas à l'aveugle).

Vérifie une dernière fois avant de pousser :
```bash
npx tsc --noEmit && npx next build 2>&1 | tail -5
```
Sortie attendue : `tsc` sans erreur, et le build se termine par la liste des routes
(dont `/workouts/[id]/active`). ➡️ Si le build échoue : **ARRÊTE**, `git reset --hard HEAD~1` n'est PAS nécessaire, signale simplement.

Pousse :
```bash
git push origin main
```
Vercel déploie automatiquement.

---

## Étape 3 — Vérification post-déploiement

Attends ~1 min que Vercel déploie, puis :
```powershell
(Invoke-WebRequest -Uri "https://arete-livid.vercel.app/login" -UseBasicParsing -TimeoutSec 20).StatusCode
```
Sortie attendue : `200`.

La preuve fonctionnelle réelle : ouvrir une séance en prod, la terminer avec une
charge saisie, et vérifier qu'aucune erreur n'apparaît (l'ancien comportement
« J'ai fait » doit aussi marcher). Le logging est rétro-compatible.

---

## 🧹 Nettoyage optionnel (après succès)
La branche `perf-logging` peut être conservée ou supprimée :
```bash
git branch -d perf-logging
```

---

## 🅱️ Plan B — si `node scripts/migrate-session-set.mjs` est bloqué

Applique le SQL à la main dans la **console SQL de Turso** (dashboard Turso →
base de prod → onglet SQL), en collant exactement ceci :

```sql
CREATE TABLE IF NOT EXISTS "SessionSet" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "sessionId" TEXT NOT NULL,
  "movementId" TEXT NOT NULL,
  "setNumber" INTEGER NOT NULL,
  "reps" INTEGER,
  "weight" REAL,
  "rpe" INTEGER,
  "completed" INTEGER NOT NULL DEFAULT 1,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SessionSet_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "WorkoutSession" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "SessionSet_movementId_idx" ON "SessionSet"("movementId");
CREATE INDEX IF NOT EXISTS "SessionSet_sessionId_idx" ON "SessionSet"("sessionId");
```
Puis reprends à l'étape 2. (Demande à l'utilisateur de le faire s'il faut un accès
au dashboard — ce n'est pas quelque chose que tu peux forcer depuis le sandbox.)

---

## Rappels de sécurité
- **Ne migre jamais après avoir poussé.** Ordre strict : migration → push.
- Le script de migration est **idempotent** : le relancer ne casse rien.
- Ne touche pas à `.env` / `.env.local` (creds), ni à `prisma/dev.db` (base de test locale).
- En cas de doute à n'importe quelle étape : **arrête et demande**, ne devine pas.
