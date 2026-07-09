-- AlterTable : superset persistant par bloc (défaut false)
ALTER TABLE "WorkoutBlock" ADD COLUMN "superset" BOOLEAN NOT NULL DEFAULT false;
