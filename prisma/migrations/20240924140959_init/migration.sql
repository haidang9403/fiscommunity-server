-- CreateEnum
CREATE TYPE "TypePost" AS ENUM ('POST', 'SHARE');

-- AlterTable
ALTER TABLE "Post" ADD COLUMN     "type" "TypePost" NOT NULL DEFAULT 'POST';
