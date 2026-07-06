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
CREATE TABLE "VisionBoard" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT,
    "name" TEXT NOT NULL,
    "pageSize" TEXT NOT NULL DEFAULT 'A4',
    "orientation" TEXT NOT NULL DEFAULT 'landscape',
    "bgColor" TEXT NOT NULL DEFAULT '#F1EAD8',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "VisionBoard_userId_fkey" FOREIGN KEY ("userId") REFERENCES "InvitedUser" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "VisionSlot" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "boardId" TEXT NOT NULL,
    "x" REAL NOT NULL,
    "y" REAL NOT NULL,
    "w" REAL NOT NULL,
    "h" REAL NOT NULL,
    "z" INTEGER NOT NULL DEFAULT 0,
    "type" TEXT NOT NULL DEFAULT 'empty',
    "content" TEXT,
    "color" TEXT,
    "fontSize" INTEGER,
    "fontWeight" TEXT,
    "align" TEXT,
    CONSTRAINT "VisionSlot_boardId_fkey" FOREIGN KEY ("boardId") REFERENCES "VisionBoard" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
