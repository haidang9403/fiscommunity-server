/*
  Warnings:

  - The values [OVERDUE] on the enum `StatusTask` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the `_TaskFiles` table. If the table is not empty, all the data it contains will be lost.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "StatusTask_new" AS ENUM ('PENDING', 'IN_PROGRESS', 'PENDING_PREVIEW', 'COMPLETED', 'FAILED');
ALTER TABLE "Task" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Task" ALTER COLUMN "status" TYPE "StatusTask_new" USING ("status"::text::"StatusTask_new");
ALTER TYPE "StatusTask" RENAME TO "StatusTask_old";
ALTER TYPE "StatusTask_new" RENAME TO "StatusTask";
DROP TYPE "StatusTask_old";
ALTER TABLE "Task" ALTER COLUMN "status" SET DEFAULT 'PENDING';
COMMIT;

-- AlterEnum
ALTER TYPE "UploadDocumentWhere" ADD VALUE 'WORKSPACE';

-- DropForeignKey
ALTER TABLE "_TaskFiles" DROP CONSTRAINT "_TaskFiles_A_fkey";

-- DropForeignKey
ALTER TABLE "_TaskFiles" DROP CONSTRAINT "_TaskFiles_B_fkey";

-- AlterTable
ALTER TABLE "Task" ADD COLUMN     "submitAt" TIMESTAMP(3);

-- DropTable
DROP TABLE "_TaskFiles";

-- CreateTable
CREATE TABLE "_FileAttachments" (
    "A" INTEGER NOT NULL,
    "B" INTEGER NOT NULL
);

-- CreateTable
CREATE TABLE "_FileSubmissions" (
    "A" INTEGER NOT NULL,
    "B" INTEGER NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "_FileAttachments_AB_unique" ON "_FileAttachments"("A", "B");

-- CreateIndex
CREATE INDEX "_FileAttachments_B_index" ON "_FileAttachments"("B");

-- CreateIndex
CREATE UNIQUE INDEX "_FileSubmissions_AB_unique" ON "_FileSubmissions"("A", "B");

-- CreateIndex
CREATE INDEX "_FileSubmissions_B_index" ON "_FileSubmissions"("B");

-- AddForeignKey
ALTER TABLE "_FileAttachments" ADD CONSTRAINT "_FileAttachments_A_fkey" FOREIGN KEY ("A") REFERENCES "File"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_FileAttachments" ADD CONSTRAINT "_FileAttachments_B_fkey" FOREIGN KEY ("B") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_FileSubmissions" ADD CONSTRAINT "_FileSubmissions_A_fkey" FOREIGN KEY ("A") REFERENCES "File"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_FileSubmissions" ADD CONSTRAINT "_FileSubmissions_B_fkey" FOREIGN KEY ("B") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;
