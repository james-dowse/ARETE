-- AlterTable : dropset persistant par bloc (défaut false).
-- Exclusif de `superset`, garanti côté routes et non par contrainte SQL.
-- Pas d'IF NOT EXISTS : SQLite n'en a pas pour ADD COLUMN. Un rejeu échoue donc
-- à la première instruction, avant d'avoir touché une ligne — bruyant, sans
-- effet de bord. C'est la règle de fait du dépôt (voir add_block_superset).
ALTER TABLE "WorkoutBlock" ADD COLUMN "dropset" BOOLEAN NOT NULL DEFAULT false;
