-- CreateTable
CREATE TABLE "Movement" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "bioType" TEXT NOT NULL,
    "complexity" TEXT NOT NULL,
    "description" TEXT,
    "imageUrl" TEXT,
    "videoUrl" TEXT
);

-- CreateTable
CREATE TABLE "Workout" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "duration" INTEGER,
    "rounds" INTEGER,
    "notes" TEXT,
    "templateId" TEXT,
    CONSTRAINT "Workout_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "WorkoutTemplate" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "WorkoutMovement" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workoutId" TEXT NOT NULL,
    "movementId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "sets" INTEGER,
    "reps" TEXT,
    "duration" INTEGER,
    CONSTRAINT "WorkoutMovement_movementId_fkey" FOREIGN KEY ("movementId") REFERENCES "Movement" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "WorkoutMovement_workoutId_fkey" FOREIGN KEY ("workoutId") REFERENCES "Workout" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "WorkoutTemplate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "TemplateBlock" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "templateId" TEXT NOT NULL,
    "bioType" TEXT,
    "complexity" TEXT,
    "count" INTEGER NOT NULL,
    "order" INTEGER NOT NULL,
    CONSTRAINT "TemplateBlock_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "WorkoutTemplate" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
