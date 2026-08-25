CREATE TABLE "Follow" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "followerId" TEXT NOT NULL,
  "followedId" TEXT NOT NULL,
  "notifyByEmail" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Follow_followerId_fkey" FOREIGN KEY ("followerId") REFERENCES "InvitedUser" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "Follow_followedId_fkey" FOREIGN KEY ("followedId") REFERENCES "InvitedUser" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "Follow_followerId_followedId_key" ON "Follow"("followerId", "followedId");
