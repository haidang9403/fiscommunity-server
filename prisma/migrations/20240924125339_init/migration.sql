-- CreateEnum
CREATE TYPE "TypePrivacy" AS ENUM ('PUBLIC', 'FRIENDS', 'PRIVAVTE', 'CUSTOM');

-- AlterTable
ALTER TABLE "Post" ADD COLUMN     "privacy" "TypePrivacy" NOT NULL DEFAULT 'PUBLIC';

-- CreateTable
CREATE TABLE "PostPrivacy" (
    "id" SERIAL NOT NULL,
    "postId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,

    CONSTRAINT "PostPrivacy_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "PostPrivacy" ADD CONSTRAINT "PostPrivacy_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PostPrivacy" ADD CONSTRAINT "PostPrivacy_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
