-- CreateTable
CREATE TABLE "WorkoutShare" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workoutId" TEXT NOT NULL,
    "sharedByUserId" TEXT NOT NULL,
    "sharedToEmail" TEXT NOT NULL,
    "sharedToUserId" TEXT,
    "token" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acceptedAt" DATETIME,
    CONSTRAINT "WorkoutShare_workoutId_fkey" FOREIGN KEY ("workoutId") REFERENCES "Workout" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "WorkoutShare_sharedByUserId_fkey" FOREIGN KEY ("sharedByUserId") REFERENCES "InvitedUser" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "WorkoutShare_sharedToUserId_fkey" FOREIGN KEY ("sharedToUserId") REFERENCES "InvitedUser" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "WorkoutShare_token_key" ON "WorkoutShare"("token");
