-- CreateTable
CREATE TABLE "DifficultyTier" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "complexities" TEXT NOT NULL,
    "sets" INTEGER NOT NULL DEFAULT 3,
    "position" INTEGER NOT NULL DEFAULT 0
);

-- CreateIndex
CREATE UNIQUE INDEX "DifficultyTier_key_key" ON "DifficultyTier"("key");
