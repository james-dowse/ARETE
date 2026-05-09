/*
  Warnings:

  - You are about to drop the column `rounds` on the `Workout` table. All the data in the column will be lost.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Workout" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "duration" INTEGER,
    "notes" TEXT,
    "description" TEXT,
    "imageUrl" TEXT,
    "templateId" TEXT,
    CONSTRAINT "Workout_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "WorkoutTemplate" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Workout" ("createdAt", "description", "duration", "id", "imageUrl", "name", "notes", "templateId") SELECT "createdAt", "description", "duration", "id", "imageUrl", "name", "notes", "templateId" FROM "Workout";
DROP TABLE "Workout";
ALTER TABLE "new_Workout" RENAME TO "Workout";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
