/*
  Warnings:

  - The values [CUSTOM] on the enum `TypePrivacy` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the `PostPrivacy` table. If the table is not empty, all the data it contains will be lost.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "TypePrivacy_new" AS ENUM ('PUBLIC', 'FRIENDS', 'PRIVAVTE');
ALTER TABLE "Post" ALTER COLUMN "privacy" DROP DEFAULT;
ALTER TABLE "Post" ALTER COLUMN "privacy" TYPE "TypePrivacy_new" USING ("privacy"::text::"TypePrivacy_new");
ALTER TYPE "TypePrivacy" RENAME TO "TypePrivacy_old";
ALTER TYPE "TypePrivacy_new" RENAME TO "TypePrivacy";
DROP TYPE "TypePrivacy_old";
ALTER TABLE "Post" ALTER COLUMN "privacy" SET DEFAULT 'PUBLIC';
COMMIT;

-- DropForeignKey
ALTER TABLE "PostPrivacy" DROP CONSTRAINT "PostPrivacy_postId_fkey";

-- DropForeignKey
ALTER TABLE "PostPrivacy" DROP CONSTRAINT "PostPrivacy_userId_fkey";

-- DropTable
DROP TABLE "PostPrivacy";
