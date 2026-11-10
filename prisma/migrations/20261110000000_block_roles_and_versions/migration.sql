-- Versions de séance : rôle des blocs, lien version -> séance d'origine, version faite.
-- Quatre colonnes facultatives et un index : aucune donnée existante n'est modifiée.
-- À jouer UNE fois sur Turso : node scripts/apply-migration.mjs 20261110000000_block_roles_and_versions
-- (SQLite refuse d'ajouter deux fois une colonne : un second passage s'arrête à la première ligne, sans dégât.)

ALTER TABLE "WorkoutBlock" ADD COLUMN "role" TEXT;

ALTER TABLE "Workout" ADD COLUMN "derivedFromId" TEXT REFERENCES "Workout" ("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Workout" ADD COLUMN "cut" TEXT;

ALTER TABLE "WorkoutSession" ADD COLUMN "cut" TEXT;

CREATE INDEX IF NOT EXISTS "Workout_derivedFromId_idx" ON "Workout"("derivedFromId");
