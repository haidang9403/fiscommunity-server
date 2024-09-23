/*
  Warnings:

  - You are about to drop the column `content` on the `Notify` table. All the data in the column will be lost.
  - You are about to drop the column `image` on the `Notify` table. All the data in the column will be lost.
  - Added the required column `message` to the `Notify` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Notify" DROP COLUMN "content",
DROP COLUMN "image",
ADD COLUMN     "message" TEXT NOT NULL,
ADD COLUMN     "read" BOOLEAN NOT NULL DEFAULT false,
ALTER COLUMN "type" SET DATA TYPE TEXT;
