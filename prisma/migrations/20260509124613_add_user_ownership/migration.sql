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
    "userId" TEXT,
    CONSTRAINT "Workout_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "WorkoutTemplate" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Workout_userId_fkey" FOREIGN KEY ("userId") REFERENCES "InvitedUser" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Workout" ("createdAt", "description", "duration", "id", "imageUrl", "name", "notes", "templateId") SELECT "createdAt", "description", "duration", "id", "imageUrl", "name", "notes", "templateId" FROM "Workout";
DROP TABLE "Workout";
ALTER TABLE "new_Workout" RENAME TO "Workout";
CREATE TABLE "new_WorkoutTemplate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT,
    CONSTRAINT "WorkoutTemplate_userId_fkey" FOREIGN KEY ("userId") REFERENCES "InvitedUser" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_WorkoutTemplate" ("createdAt", "id", "name") SELECT "createdAt", "id", "name" FROM "WorkoutTemplate";
DROP TABLE "WorkoutTemplate";
ALTER TABLE "new_WorkoutTemplate" RENAME TO "WorkoutTemplate";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
