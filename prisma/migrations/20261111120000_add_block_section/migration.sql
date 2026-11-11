-- AlterTable : regroupement facultatif de blocs en sections.
-- Nullable, donc rien à reprendre sur les blocs existants : ils restent hors
-- section. Une section est la suite de blocs consécutifs portant le même nom.
ALTER TABLE "WorkoutBlock" ADD COLUMN "section" TEXT;
