-- CreateTable
CREATE TABLE "WorkoutBlock" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workoutId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "bioType" TEXT,
    "instructions" TEXT,
    CONSTRAINT "WorkoutBlock_workoutId_fkey" FOREIGN KEY ("workoutId") REFERENCES "Workout" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_WorkoutMovement" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workoutId" TEXT NOT NULL,
    "movementId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "sets" INTEGER,
    "reps" TEXT,
    "duration" INTEGER,
    "blockId" TEXT,
    CONSTRAINT "WorkoutMovement_movementId_fkey" FOREIGN KEY ("movementId") REFERENCES "Movement" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "WorkoutMovement_workoutId_fkey" FOREIGN KEY ("workoutId") REFERENCES "Workout" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "WorkoutMovement_blockId_fkey" FOREIGN KEY ("blockId") REFERENCES "WorkoutBlock" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_WorkoutMovement" ("duration", "id", "movementId", "order", "reps", "sets", "workoutId") SELECT "duration", "id", "movementId", "order", "reps", "sets", "workoutId" FROM "WorkoutMovement";
DROP TABLE "WorkoutMovement";
ALTER TABLE "new_WorkoutMovement" RENAME TO "WorkoutMovement";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
