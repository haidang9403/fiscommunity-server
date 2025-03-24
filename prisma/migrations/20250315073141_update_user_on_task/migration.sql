/*
  Warnings:

  - You are about to drop the column `statusTask` on the `UserOnTask` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "UserOnTask" DROP COLUMN "statusTask",
ADD COLUMN     "isSubmit" BOOLEAN NOT NULL DEFAULT false;
