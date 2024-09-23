/*
  Warnings:

  - You are about to drop the column `state` on the `UserRelation` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "FriendRequestStatus" AS ENUM ('NONE', 'PENDING', 'ACCEPTED');

-- AlterTable
ALTER TABLE "UserRelation" DROP COLUMN "state",
ADD COLUMN     "friendRequestStatus" "FriendRequestStatus" NOT NULL DEFAULT 'NONE',
ADD COLUMN     "isBlock" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "isFollow" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "isFriend" BOOLEAN NOT NULL DEFAULT false;
