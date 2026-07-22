// Migration idempotente : crée la table SessionSet + index sur la base configurée.
// - En prod : cible Turso via TURSO_DATABASE_URL / TURSO_AUTH_TOKEN (lus depuis .env).
// - Sûr à relancer autant de fois qu'on veut (CREATE ... IF NOT EXISTS).
// - Ne touche à AUCUNE autre table, ne supprime rien, n'écrit aucune donnée.
//
// Usage : node scripts/migrate-session-set.mjs
import { createClient } from '@libsql/client'
import 'dotenv/config'

const url = process.env.TURSO_DATABASE_URL?.trim()
const authToken = process.env.TURSO_AUTH_TOKEN

if (!url) {
  console.error('❌ TURSO_DATABASE_URL manquant dans .env — migration annulée.')
  process.exit(1)
}

const client = createClient({ url, authToken })
const cible = /libsql:|\.turso\.|^https?:/i.test(url) ? 'TURSO (production)' : url

const DDL = [
  `CREATE TABLE IF NOT EXISTS "SessionSet" (
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
  )`,
  `CREATE INDEX IF NOT EXISTS "SessionSet_movementId_idx" ON "SessionSet"("movementId")`,
  `CREATE INDEX IF NOT EXISTS "SessionSet_sessionId_idx" ON "SessionSet"("sessionId")`,
]

console.log(`→ Migration SessionSet sur : ${cible}`)

try {
  for (const stmt of DDL) await client.execute(stmt)

  const t = await client.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='SessionSet'")
  const cols = await client.execute("PRAGMA table_info('SessionSet')")

  if (t.rows.length === 1) {
    console.log('✅ SUCCÈS — table SessionSet présente.')
    console.log('   Colonnes :', cols.rows.map(r => r.name).join(', '))
    process.exit(0)
  }
  console.error('❌ ÉCHEC — table SessionSet absente après exécution.')
  process.exit(1)
} catch (e) {
  console.error('❌ ERREUR pendant la migration :', e.message)
  process.exit(1)
}
