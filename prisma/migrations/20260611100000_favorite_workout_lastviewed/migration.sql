-- CreateTable FavoriteWorkout
CREATE TABLE "FavoriteWorkout" ("id" TEXT NOT NULL PRIMARY KEY, "userId" TEXT NOT NULL, "workoutId" TEXT NOT NULL, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "FavoriteWorkout_userId_fkey" FOREIGN KEY ("userId") REFERENCES "InvitedUser" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FavoriteWorkout_workoutId_fkey" FOREIGN KEY ("workoutId") REFERENCES "Workout" ("id") ON DELETE CASCADE ON UPDATE CASCADE);

-- CreateUniqueIndex FavoriteWorkout
CREATE UNIQUE INDEX "FavoriteWorkout_userId_workoutId_key" ON "FavoriteWorkout"("userId", "workoutId");

-- AlterTable SavedWorkout add lastViewedAt
ALTER TABLE "SavedWorkout" ADD COLUMN "lastViewedAt" DATETIME;
