/*
  Warnings:

  - You are about to drop the column `note` on the `Media` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Media" DROP COLUMN "note",
ADD COLUMN     "caption" TEXT;
