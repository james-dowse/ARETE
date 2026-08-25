ALTER TABLE "Workout" ADD COLUMN "public" BOOLEAN NOT NULL DEFAULT false;
UPDATE "Workout" SET "public" = true WHERE "userId" IS NOT NULL;
