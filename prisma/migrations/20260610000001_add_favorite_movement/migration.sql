-- CreateTable
CREATE TABLE "FavoriteMovement" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "movementId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FavoriteMovement_userId_fkey" FOREIGN KEY ("userId") REFERENCES "InvitedUser" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "FavoriteMovement_movementId_fkey" FOREIGN KEY ("movementId") REFERENCES "Movement" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "FavoriteMovement_userId_movementId_key" ON "FavoriteMovement"("userId", "movementId");
