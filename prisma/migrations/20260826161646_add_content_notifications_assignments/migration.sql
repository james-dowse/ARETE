-- DropIndex
DROP INDEX "WorkoutSession_workoutId_idx";

-- DropIndex
DROP INDEX "WorkoutSession_userId_idx";

-- AlterTable
ALTER TABLE "InvitedUser" ADD COLUMN "avatarUrl" TEXT;
ALTER TABLE "InvitedUser" ADD COLUMN "bio" TEXT;
ALTER TABLE "InvitedUser" ADD COLUMN "firstName" TEXT;
ALTER TABLE "InvitedUser" ADD COLUMN "lastName" TEXT;

-- AlterTable
ALTER TABLE "Movement" ADD COLUMN "equipment" TEXT;

-- AlterTable
ALTER TABLE "TemplateBlock" ADD COLUMN "equipments" TEXT;

-- AlterTable
ALTER TABLE "Workout" ADD COLUMN "blockRest" INTEGER;

-- AlterTable
ALTER TABLE "WorkoutMovement" ADD COLUMN "rest" INTEGER;

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT,
    "title" TEXT NOT NULL,
    "body" TEXT,
    "link" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "readAt" DATETIME,
    CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "InvitedUser" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AssignedWorkout" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workoutId" TEXT NOT NULL,
    "assignedToId" TEXT NOT NULL,
    "assignedById" TEXT NOT NULL,
    "note" TEXT,
    "scheduledFor" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AssignedWorkout_workoutId_fkey" FOREIGN KEY ("workoutId") REFERENCES "Workout" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AssignedWorkout_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "InvitedUser" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AssignedWorkout_assignedById_fkey" FOREIGN KEY ("assignedById") REFERENCES "InvitedUser" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SessionSet" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sessionId" TEXT NOT NULL,
    "movementId" TEXT NOT NULL,
    "setNumber" INTEGER NOT NULL,
    "reps" INTEGER,
    "weight" REAL,
    "rpe" INTEGER,
    "completed" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SessionSet_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "WorkoutSession" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SiteContent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "key" TEXT NOT NULL,
    "title" TEXT,
    "body" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE INDEX "Notification_userId_idx" ON "Notification"("userId");

-- CreateIndex
CREATE INDEX "AssignedWorkout_assignedToId_idx" ON "AssignedWorkout"("assignedToId");

-- CreateIndex
CREATE INDEX "SessionSet_movementId_idx" ON "SessionSet"("movementId");

-- CreateIndex
CREATE INDEX "SessionSet_sessionId_idx" ON "SessionSet"("sessionId");

-- CreateIndex
CREATE UNIQUE INDEX "SiteContent_key_key" ON "SiteContent"("key");
