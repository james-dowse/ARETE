-- AlterTable: add tags to Workout
ALTER TABLE "Workout" ADD COLUMN "tags" TEXT;

-- CreateTable WeekPlan
CREATE TABLE "WeekPlan" ("id" TEXT NOT NULL PRIMARY KEY, "userId" TEXT NOT NULL, "weekStart" DATETIME NOT NULL, CONSTRAINT "WeekPlan_userId_fkey" FOREIGN KEY ("userId") REFERENCES "InvitedUser" ("id") ON DELETE CASCADE ON UPDATE CASCADE);

-- CreateUniqueIndex WeekPlan
CREATE UNIQUE INDEX "WeekPlan_userId_weekStart_key" ON "WeekPlan"("userId", "weekStart");

-- CreateTable WeekPlanEntry
CREATE TABLE "WeekPlanEntry" ("id" TEXT NOT NULL PRIMARY KEY, "weekPlanId" TEXT NOT NULL, "workoutId" TEXT NOT NULL, "dayOfWeek" INTEGER NOT NULL, "order" INTEGER NOT NULL DEFAULT 0, CONSTRAINT "WeekPlanEntry_weekPlanId_fkey" FOREIGN KEY ("weekPlanId") REFERENCES "WeekPlan" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "WeekPlanEntry_workoutId_fkey" FOREIGN KEY ("workoutId") REFERENCES "Workout" ("id") ON DELETE CASCADE ON UPDATE CASCADE);
