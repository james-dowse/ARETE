-- AlterTable
ALTER TABLE "InvitedUser" ADD COLUMN "loginToken" TEXT;
ALTER TABLE "InvitedUser" ADD COLUMN "loginTokenExp" DATETIME;

-- CreateIndex
CREATE UNIQUE INDEX "InvitedUser_loginToken_key" ON "InvitedUser"("loginToken");
