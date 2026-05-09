-- CreateTable
CREATE TABLE "InvitedUser" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "invitedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acceptedAt" DATETIME
);

-- CreateIndex
CREATE UNIQUE INDEX "InvitedUser_email_key" ON "InvitedUser"("email");

-- CreateIndex
CREATE UNIQUE INDEX "InvitedUser_token_key" ON "InvitedUser"("token");
