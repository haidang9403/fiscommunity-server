/*
  Warnings:

  - The `type` column on the `Media` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- CreateEnum
CREATE TYPE "TypeMedia" AS ENUM ('IMAGE', 'VIDEO');

-- AlterTable
ALTER TABLE "Media" DROP COLUMN "type",
ADD COLUMN     "type" "TypeMedia" NOT NULL DEFAULT 'IMAGE';
