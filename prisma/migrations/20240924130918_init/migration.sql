/*
  Warnings:

  - The values [PRIVAVTE] on the enum `TypePrivacy` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "TypePrivacy_new" AS ENUM ('PUBLIC', 'FRIENDS', 'PRIVATE');
ALTER TABLE "Post" ALTER COLUMN "privacy" DROP DEFAULT;
ALTER TABLE "Post" ALTER COLUMN "privacy" TYPE "TypePrivacy_new" USING ("privacy"::text::"TypePrivacy_new");
ALTER TYPE "TypePrivacy" RENAME TO "TypePrivacy_old";
ALTER TYPE "TypePrivacy_new" RENAME TO "TypePrivacy";
DROP TYPE "TypePrivacy_old";
ALTER TABLE "Post" ALTER COLUMN "privacy" SET DEFAULT 'PUBLIC';
COMMIT;
